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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6 font-sans">
      {/* HEADER & METRICS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-emerald-400" /> Receipt Storage & File Manager
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Monitor Supabase Storage usage, inspect receipt image files, and purge orphaned data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStorageFiles}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 h-9 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCleanupConfirmOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs flex items-center gap-1.5"
          >
            <Broom className="w-3.5 h-3.5" /> Cleanup Orphaned ({orphanedCount})
          </Button>
        </div>
      </div>

      {/* STORAGE GAUGES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gauge 1: Used Capacity */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">Storage Capacity Used</span>
            <span className="text-emerald-400 font-bold">{totalMb} MB / {STORAGE_LIMIT_MB} MB</span>
          </div>
          <Progress value={usedPercentage} className="h-2 bg-slate-900" />
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
            <span>Quota: {STORAGE_LIMIT_MB} MB</span>
            <span>{usedPercentage}% Used</span>
          </div>
        </div>

        {/* Gauge 2: Total Files Count */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-mono">Total Receipt Files</span>
            <div className="text-2xl font-bold font-mono text-white mt-1">{files.length} <span className="text-xs text-slate-500 font-normal">photos</span></div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Gauge 3: Orphaned Receipts */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-mono">Orphaned Unlinked Files</span>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">{orphanedCount} <span className="text-xs text-slate-500 font-normal">files</span></div>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
          <Broom className="w-4 h-4 text-emerald-400" /> Quick Storage Maintenance Tools
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPurgeOldConfirmOpen(true)}
            className="border-slate-800 text-amber-300 hover:bg-amber-950/30 text-xs h-8"
          >
            <Calendar className="w-3.5 h-3.5 mr-1" /> Purge Old Receipts (&gt;90 Days)
          </Button>
        </div>
      </div>

      {/* STORAGE FILES LIST TABLE */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
          <span>Receipt Files in Supabase Storage ({files.length})</span>
          <span className="text-[10px] text-slate-500 font-normal">Sorted by Upload Date</span>
        </h4>

        {isLoading ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Loading storage files...
          </div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs font-mono">
            No receipt photo files stored in bucket.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Uploaded Date</th>
                  <th className="p-3">File Size</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                {files.map((file) => (
                  <tr key={file.name} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-white text-xs flex items-center gap-2 max-w-[200px] truncate">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {new Date(file.created_at || Date.now()).toLocaleDateString('en-GB')} {new Date(file.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 font-mono text-slate-300 font-semibold">
                      {file.sizeKb} KB
                    </td>
                    <td className="p-3">
                      {file.isOrphaned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/60">
                          <AlertTriangle className="w-3 h-3" /> Orphaned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3" /> Linked to Expense
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <a
                        href={file.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        title="View Full Receipt Photo"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmFile(file)}
                        className="h-7 w-7 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50"
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-sm font-sans">
          <DialogHeader>
            <DialogTitle className="text-rose-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Delete Storage File?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              This action permanently deletes receipt photo <span className="font-mono text-white font-bold">{deleteConfirmFile?.name}</span> ({deleteConfirmFile?.sizeKb} KB) from Supabase Storage.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmFile(null)} className="border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={() => deleteConfirmFile && handleDeleteFile(deleteConfirmFile)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CLEANUP ORPHANED CONFIRMATION DIALOG */}
      <Dialog open={isCleanupConfirmOpen} onOpenChange={setIsCleanupConfirmOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-sm font-sans">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <Broom className="w-5 h-5" /> Clean Up Orphaned Receipts?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Are you sure you want to delete <span className="font-bold text-amber-400 font-mono">{orphanedCount}</span> unlinked receipt files from storage? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsCleanupConfirmOpen(false)} className="border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handleCleanupOrphaned}
              disabled={isCleaning}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Cleanup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PURGE OLD RECEIPTS CONFIRMATION DIALOG */}
      <Dialog open={isPurgeOldConfirmOpen} onOpenChange={setIsPurgeOldConfirmOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-sm font-sans">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Purge Old Receipts (&gt;90 Days)?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Are you sure you want to delete all stored receipt photo files older than 90 days?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setIsPurgeOldConfirmOpen(false)} className="border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button
              onClick={handlePurgeOldReceipts}
              disabled={isCleaning}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Purge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
