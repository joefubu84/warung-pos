import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  HardDrive, 
  Trash2, 
  Broom, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Loader2,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface StorageFileItem {
  name: string;
  id?: string | null;
  updated_at?: string;
  created_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  } | null;
  isOrphaned: boolean;
  publicUrl: string;
  sizeKb: number;
}

interface StorageManagementCardProps {
  onRefreshExpenses: () => void;
  dailyCashId: string | null;
}

export function StorageManagementCard({ onRefreshExpenses, dailyCashId }: StorageManagementCardProps) {
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalSizeBytes, setTotalSizeBytes] = useState<number>(0);
  const [orphanedCount, setOrphanedCount] = useState<number>(0);
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<StorageFileItem | null>(null);
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState<boolean>(false);
  const [isPurgeOldConfirmOpen, setIsPurgeOldConfirmOpen] = useState<boolean>(false);

  // Soft storage limit: 100 MB
  const STORAGE_LIMIT_MB = 100;

  const fetchStorageFiles = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch file objects in `receipts/expenses` folder
      const { data: storageList, error: listErr } = await supabase.storage
        .from('receipts')
        .list('expenses', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (listErr) {
        console.warn("Storage list fetch notice:", listErr);
        setFiles([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch all receipt URLs referenced in `expenses` & `cash_transactions`
      const { data: expRows } = await supabase.from('expenses').select('receipt_url');
      const { data: txRows } = await supabase.from('cash_transactions').select('notes');

      const referencedUrls = new Set<string>();
      (expRows || []).forEach(r => {
        if (r.receipt_url) referencedUrls.add(r.receipt_url);
      });
      (txRows || []).forEach(t => {
        if (t.notes) {
          const match = t.notes.match(/\[RECEIPT_URL:\s*([^\]]+)\]/i);
          if (match && match[1]) referencedUrls.add(match[1].trim());
        }
      });

      let totalBytes = 0;
      let orphanCount = 0;

      const items: StorageFileItem[] = (storageList || []).map(f => {
        const filePath = `expenses/${f.name}`;
        const { data: pData } = supabase.storage.from('receipts').getPublicUrl(filePath);
        const pUrl = pData?.publicUrl || '';
        
        const sizeB = f.metadata?.size || 0;
        totalBytes += sizeB;

        // Check if referenced by any URL
        let isRef = false;
        referencedUrls.forEach(url => {
          if (url.includes(f.name)) isRef = true;
        });

        const orphaned = !isRef;
        if (orphaned) orphanCount++;

        return {
          name: f.name,
          id: f.id,
          created_at: f.created_at || f.updated_at || new Date().toISOString(),
          metadata: f.metadata,
          isOrphaned: orphaned,
          publicUrl: pUrl,
          sizeKb: Math.round(sizeB / 1024)
        };
      });

      setFiles(items);
      setTotalSizeBytes(totalBytes);
      setOrphanedCount(orphanCount);
    } catch (err) {
      console.error("Error fetching storage files:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageFiles();
  }, []);

  const totalMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);
  const usedPercentage = Math.min(Math.round(((totalSizeBytes / (1024 * 1024)) / STORAGE_LIMIT_MB) * 100), 100);

  // Delete single file from storage
  const handleDeleteFile = async (file: StorageFileItem) => {
    try {
      const { error } = await supabase.storage
        .from('receipts')
        .remove([`expenses/${file.name}`]);

      if (error) throw error;

      // Log action
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('daily_cash_edit_logs').insert({
        daily_cash_id: dailyCashId || 'system',
        edited_by: session?.user.id || null,
        edited_by_name: 'Staff',
        change_reason: `Deleted receipt storage file expenses/${file.name} (${file.sizeKb} KB)`
      });

      toast.success(`Storage file deleted (${file.sizeKb} KB freed)`);
      setDeleteConfirmFile(null);
      fetchStorageFiles();
      onRefreshExpenses();
    } catch (err: any) {
      toast.error(`Failed to delete storage file: ${err.message}`);
    }
  };

  // Cleanup all orphaned files
  const handleCleanupOrphaned = async () => {
    setIsCleaning(true);
    try {
      const orphanedFiles = files.filter(f => f.isOrphaned);
      if (orphanedFiles.length === 0) {
        toast.info("No orphaned receipt files found to clean.");
        setIsCleanupConfirmOpen(false);
        setIsCleaning(false);
        return;
      }

      const pathsToRemove = orphanedFiles.map(f => `expenses/${f.name}`);
      const freedKb = orphanedFiles.reduce((acc, f) => acc + f.sizeKb, 0);

      const { error } = await supabase.storage
        .from('receipts')
        .remove(pathsToRemove);

      if (error) throw error;

      // Log cleanup action
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('daily_cash_edit_logs').insert({
        daily_cash_id: dailyCashId || 'system',
        edited_by: session?.user.id || null,
        edited_by_name: 'Staff',
        change_reason: `Auto-cleaned ${orphanedFiles.length} orphaned receipt files, freed ${(freedKb / 1024).toFixed(2)} MB`
      });

      toast.success(`Cleaned ${orphanedFiles.length} orphaned files, freed ${(freedKb / 1024).toFixed(2)} MB!`);
      setIsCleanupConfirmOpen(false);
      fetchStorageFiles();
      onRefreshExpenses();
    } catch (err: any) {
      toast.error(`Cleanup failed: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  // Purge old receipts older than 90 days
  const handlePurgeOldReceipts = async () => {
    setIsCleaning(true);
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const oldFiles = files.filter(f => new Date(f.created_at || 0) < ninetyDaysAgo);
      if (oldFiles.length === 0) {
        toast.info("No receipts older than 90 days found.");
        setIsPurgeOldConfirmOpen(false);
        setIsCleaning(false);
        return;
      }

      const pathsToRemove = oldFiles.map(f => `expenses/${f.name}`);
      const freedKb = oldFiles.reduce((acc, f) => acc + f.sizeKb, 0);

      const { error } = await supabase.storage
        .from('receipts')
        .remove(pathsToRemove);

      if (error) throw error;

      // Log purge action
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('daily_cash_edit_logs').insert({
        daily_cash_id: dailyCashId || 'system',
        edited_by: session?.user.id || null,
        edited_by_name: 'Staff',
        change_reason: `Purged ${oldFiles.length} receipts older than 90 days, freed ${(freedKb / 1024).toFixed(2)} MB`
      });

      toast.success(`Purged ${oldFiles.length} old receipts, freed ${(freedKb / 1024).toFixed(2)} MB!`);
      setIsPurgeOldConfirmOpen(false);
      fetchStorageFiles();
      onRefreshExpenses();
    } catch (err: any) {
      toast.error(`Purge failed: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-6 font-sans shadow-xs">
      {/* HEADER & METRICS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-600" /> Receipt Storage & File Manager
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Monitor Supabase Storage usage, inspect receipt image files, and purge orphaned data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStorageFiles}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 h-9 text-xs font-bold rounded-xl shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCleanupConfirmOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs flex items-center gap-1.5 rounded-xl shadow-xs"
          >
            <Broom className="w-3.5 h-3.5" /> Cleanup Orphaned ({orphanedCount})
          </Button>
        </div>
      </div>

      {/* STORAGE GAUGES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gauge 1: Used Capacity */}
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-600 font-bold">Storage Capacity Used</span>
            <span className="text-emerald-700 font-bold">{totalMb} MB / {STORAGE_LIMIT_MB} MB</span>
          </div>
          <Progress value={usedPercentage} className="h-2 bg-slate-200" />
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-0.5">
            <span>Quota: {STORAGE_LIMIT_MB} MB</span>
            <span>{usedPercentage}% Used</span>
          </div>
        </div>

        {/* Gauge 2: Total Files Count */}
        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-slate-600 text-xs font-mono font-bold">Total Receipt Files</span>
            <div className="text-2xl font-black font-mono text-slate-900 mt-1">{files.length} <span className="text-xs text-slate-500 font-normal">photos</span></div>
          </div>
          <div className="p-3.5 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-200 shadow-2xs">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Gauge 3: Orphaned Receipts */}
        <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-100 flex items-center justify-between">
          <div>
            <span className="text-slate-600 text-xs font-mono font-bold">Orphaned Unlinked Files</span>
            <div className="text-2xl font-black font-mono text-amber-700 mt-1">{orphanedCount} <span className="text-xs text-slate-500 font-normal">files</span></div>
          </div>
          <div className="p-3.5 bg-amber-100 rounded-2xl text-amber-700 border border-amber-200 shadow-2xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200">
        <span className="text-xs text-slate-700 font-mono font-bold flex items-center gap-2">
          <Broom className="w-4 h-4 text-emerald-600" /> Quick Storage Maintenance Tools
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPurgeOldConfirmOpen(true)}
            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs h-8 font-bold rounded-xl shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 mr-1 text-rose-600" /> Purge Old Receipts (&gt;90 Days)
          </Button>
        </div>
      </div>

      {/* STORAGE FILES LIST TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
            Receipt Files in Supabase Storage ({files.length})
          </h4>
          <span className="text-[10px] text-slate-500 font-mono">Sorted by Upload Date</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading storage files...
          </div>
        ) : files.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-mono">
            No receipt photo files stored in bucket.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 text-slate-500 font-mono uppercase text-[10px] border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono">
                {files.map((file) => (
                  <tr key={file.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 text-xs flex items-center gap-2 max-w-[220px] truncate">
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {new Date(file.created_at || Date.now()).toLocaleDateString('en-GB')} {new Date(file.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-bold">
                      {file.sizeKb} KB
                    </td>
                    <td className="py-3.5 px-4">
                      {file.isOrphaned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                          <AlertTriangle className="w-3 h-3" /> Orphaned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Linked to Expense
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 font-sans">
                      <a
                        href={file.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors font-mono"
                        title="View Full Receipt Photo"
                      >
                        <ExternalLink className="w-3 h-3 mr-1 text-emerald-600" /> View
                      </a>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmFile(file)}
                        className="h-7 px-2 text-xs font-mono text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200"
                        title="Delete File"
                      >
                        <Trash2 className="w-3 h-3 mr-1 text-rose-600" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SINGLE FILE DELETE CONFIRMATION DIALOG */}
      <Dialog open={!!deleteConfirmFile} onOpenChange={(open) => !open && setDeleteConfirmFile(null)}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-sm font-sans rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-lg font-black">
              <Trash2 className="w-5 h-5 text-rose-600" /> Delete Storage File?
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              This action permanently deletes receipt photo <span className="font-mono text-slate-900 font-bold">{deleteConfirmFile?.name}</span> ({deleteConfirmFile?.sizeKb} KB) from Supabase Storage.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmFile(null)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirmFile && handleDeleteFile(deleteConfirmFile)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLEANUP ORPHANED CONFIRMATION DIALOG */}
      <Dialog open={isCleanupConfirmOpen} onOpenChange={setIsCleanupConfirmOpen}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-sm font-sans rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-emerald-700 flex items-center gap-2 text-lg font-black">
              <Broom className="w-5 h-5 text-emerald-600" /> Clean Up Orphaned Receipts?
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Are you sure you want to delete <span className="font-bold text-amber-700 font-mono">{orphanedCount}</span> unlinked receipt files from storage? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsCleanupConfirmOpen(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCleanupOrphaned}
              disabled={isCleaning}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs"
            >
              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Cleanup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PURGE OLD RECEIPTS CONFIRMATION DIALOG */}
      <Dialog open={isPurgeOldConfirmOpen} onOpenChange={setIsPurgeOldConfirmOpen}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-sm font-sans rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-rose-700 flex items-center gap-2 text-lg font-black">
              <Calendar className="w-5 h-5 text-rose-600" /> Purge Old Receipts (&gt;90 Days)?
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Are you sure you want to delete all stored receipt photo files older than 90 days?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsPurgeOldConfirmOpen(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handlePurgeOldReceipts}
              disabled={isCleaning}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs"
            >
              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Purge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
