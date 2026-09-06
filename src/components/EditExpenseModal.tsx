import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Pencil, 
  Receipt, 
  Camera, 
  Upload, 
  X, 
  Loader2,
  Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EXPENSE_CATEGORIES } from './AddExpenseModal';

interface EditExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: any | null;
  dailyCashId: string | null;
}

const compressImageForMobile = (rawFile: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!rawFile.type.startsWith('image/') || rawFile.size < 500 * 1024) {
      return resolve(rawFile);
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(rawFile);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], rawFile.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(rawFile);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(rawFile);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(rawFile);
    reader.readAsDataURL(rawFile);
  });
};

// Utility to parse receipt URL from formatted transaction notes
export function extractReceiptUrlFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/\[RECEIPT_URL:\s*([^\]]+)\]/i);
  return match && match[1] ? match[1].trim() : null;
}

// Utility to parse clean description without tags
export function extractCleanDescriptionFromNotes(notes: string | null | undefined): string {
  if (!notes) return '';
  return notes
    .replace(/^\[Expense:[^\]]+\]\s*/i, '')
    .replace(/\s*—\s*Recorded by.*$/i, '')
    .replace(/\[RECEIPT_URL:[^\]]+\]/gi, '')
    .trim();
}

export function EditExpenseModal({ isOpen, onClose, onSuccess, expense, dailyCashId }: EditExpenseModalProps) {
  const [expenseType, setExpenseType] = useState<string>('fuel');
  const [amountInput, setAmountInput] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  
  // New replacement receipt photo
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [newReceiptPreview, setNewReceiptPreview] = useState<string | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState<boolean>(false);
  
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [staffName, setStaffName] = useState<string>('Staff');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.name) setStaffName(profile.name);
      }
    }

    if (isOpen && expense) {
      loadUser();
      
      // Parse category from type ("expense_fuel" -> "fuel")
      const cat = (expense.type || '').replace('expense_', '');
      setExpenseType(EXPENSE_CATEGORIES.some(c => c.id === cat) ? cat : 'other');
      setAmountInput(Number(expense.amount || 0).toFixed(2));
      
      const cleanDesc = extractCleanDescriptionFromNotes(expense.notes);
      setDescription(cleanDesc);

      const currentUrl = extractReceiptUrlFromNotes(expense.notes) || expense.receipt_url || null;
      setExistingReceiptUrl(currentUrl);

      setNewReceiptFile(null);
      setNewReceiptPreview(null);
      setRemoveExistingReceipt(false);
    }
  }, [isOpen, expense]);

  const handleNewFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    toast.info("Processing replacement receipt photo...");
    const compressed = await compressImageForMobile(rawFile);
    const preview = URL.createObjectURL(compressed);

    setNewReceiptFile(compressed);
    setNewReceiptPreview(preview);
    setRemoveExistingReceipt(false);
  };

  const handleDiscardNewPhoto = () => {
    setNewReceiptFile(null);
    setNewReceiptPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!expense) return;

    const numAmount = parseFloat(amountInput);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid expense amount greater than RM 0");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a brief description for this expense");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalReceiptUrl = existingReceiptUrl;

      // 1. If replacing or removing receipt photo
      if (newReceiptFile) {
        // Delete old receipt from storage if exists
        if (existingReceiptUrl && existingReceiptUrl.includes('receipts/')) {
          const oldPath = existingReceiptUrl.split('receipts/').pop();
          if (oldPath) {
            await supabase.storage.from('receipts').remove([oldPath]);
          }
        }

        // Upload new receipt photo directly to Supabase Storage
        toast.info("Uploading replacement receipt to Supabase Storage...");
        const cleanName = newReceiptFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `expenses/${Date.now()}_${cleanName}`;

        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(filePath, newReceiptFile, {
            upsert: true,
            contentType: newReceiptFile.type || 'image/jpeg',
          });

        if (uploadErr) {
          toast.error(`Failed to upload replacement receipt: ${uploadErr.message}. Edit not saved.`);
          setIsSubmitting(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl && !publicUrlData.publicUrl.startsWith('blob:')) {
          finalReceiptUrl = publicUrlData.publicUrl;
        } else {
          toast.error("Failed to generate permanent storage URL. Edit not saved.");
          setIsSubmitting(false);
          return;
        }
      } else if (removeExistingReceipt) {
        // Delete old receipt from storage
        if (existingReceiptUrl && existingReceiptUrl.includes('receipts/')) {
          const oldPath = existingReceiptUrl.split('receipts/').pop();
          if (oldPath) {
            await supabase.storage.from('receipts').remove([oldPath]);
          }
        }
        finalReceiptUrl = null;
      }

      // 2. Format notes with audit timestamp & receipt URL
      const categoryLabel = EXPENSE_CATEGORIES.find(c => c.id === expenseType)?.label || 'Expense';
      const receiptTag = finalReceiptUrl ? ` [RECEIPT_URL: ${finalReceiptUrl}]` : '';
      const auditTag = ` (Edited by ${staffName} on ${new Date().toLocaleDateString('en-GB')})`;
      const formattedNotes = `[Expense: ${categoryLabel}] ${description.trim()}${auditTag} — Recorded by ${staffName}${receiptTag}`;

      // 3. Update cash_transactions table row
      try {
        const { error: txErr } = await supabase
          .from('cash_transactions')
          .update({
            amount: numAmount,
            type: `expense_${expenseType}`,
            notes: formattedNotes,
          })
          .eq('id', expense.id);

        if (txErr && txErr.code !== 'PGRST205') console.warn("cash_transactions warning:", txErr);
      } catch (e) {
        console.warn("cash_transactions notice:", e);
      }

      // 4. Update expenses table row if linked
      try {
        await supabase
          .from('expenses')
          .update({
            amount: numAmount,
            receipt_url: finalReceiptUrl,
            ai_extracted_data: {
              category: expenseType,
              description: description.trim(),
              last_edited_by: staffName,
              last_edited_at: new Date().toISOString()
            }
          })
          .eq('amount', expense.amount); // match expense amount
      } catch (eErr) {
        console.warn("Expenses table update notice:", eErr);
      }

      // 5. Insert Audit Log into daily_cash_edit_logs
      try {
        const targetDailyCashId = expense.daily_cash_id || dailyCashId || 'system';
        await supabase
          .from('daily_cash_edit_logs')
          .insert({
            daily_cash_id: targetDailyCashId,
            edited_by: userId,
            edited_by_name: staffName,
            previous_values: {
              amount: expense.amount,
              type: expense.type,
              notes: expense.notes,
              receipt_url: existingReceiptUrl
            },
            new_values: {
              amount: numAmount,
              type: `expense_${expenseType}`,
              notes: formattedNotes,
              receipt_url: finalReceiptUrl
            },
            change_reason: `Staff ${staffName} edited expense (RM ${Number(expense.amount).toFixed(2)} → RM ${numAmount.toFixed(2)})`
          });
      } catch (logErr) {
        console.warn("daily_cash_edit_logs notice:", logErr);
      }

      toast.success(`Expense updated!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!expense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white text-slate-900 border-slate-200/90 max-w-md font-sans rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
            <Pencil className="w-5 h-5 text-amber-600" /> Kemaskini Perbelanjaan Tunai (Petty Cash)
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Ubahsuai jumlah wang, kategori, atau gantikan bukti gambar resit. Semua perubahan direkodkan ke jejak audit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* EXPENSE CATEGORY */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs font-bold text-slate-700">Kategori Perbelanjaan</label>
            <Select value={expenseType} onValueChange={setExpenseType}>
              <SelectTrigger className="bg-white border-slate-200 text-slate-900 font-bold h-10 rounded-xl shadow-2xs">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900 font-bold rounded-xl shadow-xl">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const IconComp = cat.icon;
                  return (
                    <SelectItem key={cat.id} value={cat.id} className="hover:bg-slate-50 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <IconComp className="w-4 h-4 text-amber-600" />
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* AMOUNT INPUT */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs font-bold text-slate-700">Jumlah Dikeluarkan (RM)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">RM</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="bg-white border-slate-200 pl-11 text-slate-900 font-mono text-base font-black h-10 rounded-xl shadow-2xs"
                required
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-1.5 font-sans">
            <label className="text-xs font-bold text-slate-700">Penerangan / Sebab</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white border-slate-200 text-slate-900 text-xs min-h-[70px] resize-none rounded-xl shadow-2xs"
              placeholder="cth: Beli 2 tong gas dari stesen minyak Shell"
              required
            />
          </div>

          {/* RECEIPT MANAGEMENT SECTION */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5 font-sans">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 font-mono">
              <Receipt className="w-4 h-4 text-amber-600" /> Gambar Bukti Resit
            </label>

            {/* Existing Receipt Preview */}
            {existingReceiptUrl && !removeExistingReceipt && !newReceiptPreview && (
              <div className="flex flex-col items-center gap-2 p-2 bg-white rounded-xl border border-slate-200">
                <img
                  src={existingReceiptUrl}
                  alt="Existing Receipt"
                  className="w-full max-h-40 object-contain rounded-lg border border-slate-100"
                />
                <div className="flex items-center gap-2 w-full justify-between pt-1">
                  <span className="text-[10px] text-emerald-700 font-mono font-bold flex items-center gap-1">
                    <Receipt className="w-3 h-3" /> Resit Semasa Dilampirkan
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveExistingReceipt(true)}
                    className="h-7 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold"
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Padam
                  </Button>
                </div>
              </div>
            )}

            {/* New Replacement Receipt Preview */}
            {newReceiptPreview && (
              <div className="flex flex-col items-center gap-2 p-2 bg-white rounded-xl border border-amber-300">
                <img
                  src={newReceiptPreview}
                  alt="New Replacement Receipt"
                  className="w-full max-h-40 object-contain rounded-lg border border-slate-100"
                />
                <div className="flex items-center gap-2 w-full justify-between pt-1">
                  <span className="text-[10px] text-amber-800 font-mono font-bold">Foto Pengganti Sedia Dilampirkan</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscardNewPhoto}
                    className="h-7 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold"
                  >
                    <X className="w-3 h-3 mr-1" /> Batal
                  </Button>
                </div>
              </div>
            )}

            {/* Hidden Input Triggers for Replacement Photo */}
            <input
              id="edit-camera-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleNewFileSelect}
            />
            <input
              id="edit-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleNewFileSelect}
            />

            {!newReceiptPreview && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label
                  htmlFor="edit-camera-input"
                  className="cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-center transition-all shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-600" /> AMBIL FOTO BARU
                </label>

                <label
                  htmlFor="edit-file-input"
                  className="cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-center transition-all shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" /> MUAT NAIK BARU
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl"
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-sm shadow-amber-600/20"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan Perubahan...
                </span>
              ) : (
                'Simpan Kemaskini'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
