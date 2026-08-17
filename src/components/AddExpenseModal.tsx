import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { 
  DollarSign, 
  Receipt, 
  Fuel, 
  ShoppingBag, 
  Wrench, 
  Utensils, 
  HelpCircle, 
  CheckCircle2,
  Camera,
  Upload,
  X,
  Sparkles,
  Loader2,
  FileText,
  AlertTriangle
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

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dailyCashId: string | null;
  storeId?: string | null;
}

export const EXPENSE_CATEGORIES = [
  { id: 'fuel', label: 'Fuel / Gas', icon: Fuel },
  { id: 'supplies', label: 'Supplies / Ice / Packaging', icon: ShoppingBag },
  { id: 'food', label: 'Emergency Ingredients / Food', icon: Utensils },
  { id: 'maintenance', label: 'Maintenance / Repairs', icon: Wrench },
  { id: 'other', label: 'Other Miscellaneous', icon: HelpCircle },
];

interface OcrDetectedInfo {
  vendor?: string | undefined;
  amount?: number | undefined;
  date?: string | undefined;
}

const compressImageForMobile = (rawFile: File): Promise<File> => {
  return new Promise((resolve) => {
    // If not an image or already small (< 500KB), use raw file
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

export function AddExpenseModal({ isOpen, onClose, onSuccess, dailyCashId, storeId }: AddExpenseModalProps) {
  const [expenseType, setExpenseType] = useState<string>('fuel');
  const [amountInput, setAmountInput] = useState<string>('50.00');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [staffName, setStaffName] = useState<string>('Cashier');
  const [userId, setUserId] = useState<string | null>(null);

  // Receipt & OCR states
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrDetectedInfo, setOcrDetectedInfo] = useState<OcrDetectedInfo | null>(null);

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
    if (isOpen) {
      loadUser();
      // Reset states on open
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setOcrDetectedInfo(null);
      setIsScanningOcr(false);
    }
  }, [isOpen]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setIsScanningOcr(true);
    setOcrStatus('Processing & optimizing receipt image...');

    // Compress image if taking large mobile photo
    const file = await compressImageForMobile(rawFile);

    const preview = URL.createObjectURL(file);
    setReceiptFile(file);
    setReceiptPreviewUrl(preview);
    setOcrDetectedInfo(null);

    // Run Tesseract OCR Text Extraction
    setOcrStatus('Scanning receipt text with OCR AI...');

    try {
      const worker = await Tesseract.createWorker('eng');
      setOcrStatus('Extracting amounts, dates & vendor name...');
      
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      // 1. Amount Extraction
      let detectedAmount: number | null = null;
      const totalMatch = text.match(/(?:TOTAL|TOTAL RM|AMOUNT|NET|BAL|RM)\s*:?\s*RM?\s*(\d+[.,]\d{2})/i);
      if (totalMatch && totalMatch[1]) {
        detectedAmount = parseFloat(totalMatch[1].replace(',', '.'));
      } else {
        const floatMatches = text.match(/\b(\d+[.,]\d{2})\b/g);
        if (floatMatches && floatMatches.length > 0) {
          const parsedFloats = floatMatches
            .map(f => parseFloat(f.replace(',', '.')))
            .filter(n => !isNaN(n) && n > 0 && n < 10000);
          if (parsedFloats.length > 0) {
            detectedAmount = Math.max(...parsedFloats);
          }
        }
      }

      // 2. Vendor / Shop Extraction
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let vendor = '';
      for (const l of lines.slice(0, 4)) {
        if (!/RECEIPT|TAX|INVOICE|CASH|BILL|WELCOME|TEL|DATE|THANK|SLIP/i.test(l) && l.length > 2) {
          vendor = l;
          break;
        }
      }

      // 3. Date Extraction
      const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
      const detectedDate = dateMatch && dateMatch[1] ? dateMatch[1] : '';

      // 4. Keyword Category Matching
      const lowerText = text.toLowerCase();
      let matchedCategory = 'other';
      if (/petrol|shell|petronas|caltex|bhpetrol|gas|fuel|diesel|lpg/i.test(lowerText)) {
        matchedCategory = 'fuel';
      } else if (/ice|ais|plastik|bag|box|tissue|cup|sauce|packaging|mangkuk/i.test(lowerText)) {
        matchedCategory = 'supplies';
      } else if (/ayam|ikan|sayur|telur|minyak|beras|tepung|gula|sos|daging|udang|sotong/i.test(lowerText)) {
        matchedCategory = 'food';
      } else if (/repair|hardware|paip|lampu|kunci|service|maintenance/i.test(lowerText)) {
        matchedCategory = 'maintenance';
      }

      setExpenseType(matchedCategory);

      if (detectedAmount && detectedAmount > 0) {
        setAmountInput(detectedAmount.toFixed(2));
      } else {
        toast.warning("OCR complete, but amount could not be detected. Please verify amount manually.");
      }

      let autoDesc = vendor ? `[Vendor: ${vendor}] ` : '';
      autoDesc += `Emergency petty cash expense`;
      if (detectedDate) autoDesc += ` (${detectedDate})`;
      setDescription(autoDesc);

      const infoObj: OcrDetectedInfo = {
        vendor: vendor || undefined,
        amount: detectedAmount && detectedAmount > 0 ? detectedAmount : undefined,
        date: detectedDate || undefined,
      };
      setOcrDetectedInfo(infoObj);

      toast.success("Receipt scanned via OCR! Form fields auto-populated.");
    } catch (err: any) {
      console.error("OCR Scan Error:", err);
      toast.warning("OCR partial scan. Please verify amount and details manually.");
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleDiscardReceipt = () => {
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    setOcrDetectedInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dailyCashId) {
      toast.error("Please open the cash register float for today before recording expenses.");
      return;
    }

    const numAmount = parseFloat(amountInput);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid expense amount greater than RM 0");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a brief description/reason for taking cash");
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedReceiptUrl = '';

      // Upload receipt file if attached directly to Supabase Storage
      if (receiptFile) {
        toast.info("Uploading receipt image to Supabase Storage...");
        
        const cleanName = receiptFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `expenses/${Date.now()}_${cleanName}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(filePath, receiptFile, {
            upsert: true,
            contentType: receiptFile.type || 'image/jpeg'
          });

        if (uploadErr) {
          console.error("Supabase Storage upload error:", uploadErr);
          toast.error(`Receipt upload failed: ${uploadErr.message}. Expense not saved.`);
          setIsSubmitting(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        if (publicUrlData && publicUrlData.publicUrl && !publicUrlData.publicUrl.startsWith('blob:') && !publicUrlData.publicUrl.startsWith('data:')) {
          uploadedReceiptUrl = publicUrlData.publicUrl;
        } else {
          toast.error("Failed to generate permanent public URL for uploaded receipt. Expense not saved.");
          setIsSubmitting(false);
          return;
        }
      }

      // OPTION B: 1. Insert record into `expenses` table
      try {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id')
          .limit(1)
          .maybeSingle();

        const activeStoreId = storeData?.id || (storeId || 'default-store');

        const { error: expErr } = await supabase
          .from('expenses')
          .insert({
            store_id: activeStoreId,
            amount: numAmount,
            receipt_url: uploadedReceiptUrl || null,
            ai_extracted_data: ocrDetectedInfo ? (ocrDetectedInfo as any) : { category: expenseType, description: description.trim() }
          });

        if (expErr) {
          console.warn("Expenses table insert warning:", expErr);
        }
      } catch (eErr) {
        console.warn("Expenses table insert exception:", eErr);
      }

      // OPTION B: 2. Insert transaction into `cash_transactions` table for cash drawer tracking
      const categoryLabel = EXPENSE_CATEGORIES.find(c => c.id === expenseType)?.label || 'Expense';
      const receiptTag = uploadedReceiptUrl ? ` [RECEIPT_URL: ${uploadedReceiptUrl}]` : '';
      const formattedNotes = `[Expense: ${categoryLabel}] ${description.trim()} — Recorded by ${staffName}${receiptTag}`;

      const { error } = await supabase
        .from('cash_transactions')
        .insert({
          daily_cash_id: dailyCashId,
          amount: numAmount,
          type: `expense_${expenseType}`,
          notes: formattedNotes
        });

      if (error) throw error;

      toast.success(`Expense of RM ${numAmount.toFixed(2)} recorded & saved to expenses table!`);
      setAmountInput('50.00');
      setDescription('');
      handleDiscardReceipt();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to record cash expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-400">
            <DollarSign className="w-5 h-5" /> Record Cash Drawer Expense
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Log petty cash withdrawn from the register for emergency purchases or operational costs.
          </DialogDescription>
        </DialogHeader>

        {/* RECEIPT CAPTURE & OCR SECTION */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-sans">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
              <Receipt className="w-4 h-4" /> 1. Upload / Scan Receipt (OCR AI)
            </label>
            {receiptPreviewUrl && (
              <button
                type="button"
                onClick={handleDiscardReceipt}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-mono flex items-center gap-1 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800"
              >
                <X className="w-3 h-3" /> Discard
              </button>
            )}
          </div>

          {/* Hidden File & Camera Inputs */}
          <input
            id="mobile-camera-capture-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            id="mobile-gallery-upload-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Capture / Upload Action Buttons (Native Label Touch Triggers) */}
          {!receiptPreviewUrl ? (
            <div className="grid grid-cols-2 gap-2">
              <label
                htmlFor="mobile-camera-capture-input"
                className="cursor-pointer bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-2 py-3 rounded-xl shadow active:scale-95 transition-all text-center"
              >
                <Camera className="w-4 h-4 text-amber-400" /> 📷 TAKE PHOTO
              </label>

              <label
                htmlFor="mobile-gallery-upload-input"
                className="cursor-pointer bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 py-3 rounded-xl shadow active:scale-95 transition-all text-center"
              >
                <Upload className="w-4 h-4 text-emerald-400" /> 📁 UPLOAD IMAGE
              </label>
            </div>
          ) : (
            /* Receipt Image Preview Container */
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 p-2 flex flex-col items-center gap-2">
              <img
                src={receiptPreviewUrl}
                alt="Receipt Preview"
                className="w-full max-h-48 object-contain rounded-lg border border-slate-800"
              />

              {isScanningOcr ? (
                <div className="w-full bg-slate-950 p-2.5 rounded-lg border border-amber-500/40 flex items-center justify-center gap-2 text-xs font-mono text-amber-300 animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>{ocrStatus || 'Scanning receipt with OCR...'}</span>
                </div>
              ) : ocrDetectedInfo ? (
                <div className="w-full bg-emerald-950/60 p-2 rounded-lg border border-emerald-500/40 text-[11px] font-mono text-emerald-300 space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>Vendor: {ocrDetectedInfo.vendor || 'Detected'}</span>
                    <span>Date: {ocrDetectedInfo.date || 'Auto'}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold">
                    <span>Detected Amount:</span>
                    <span className="text-emerald-400">RM {ocrDetectedInfo.amount ? ocrDetectedInfo.amount.toFixed(2) : 'Check Manual'}</span>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Receipt Attached ✓
                </span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 font-mono text-xs">
          
          {/* CATEGORY SELECT */}
          <div>
            <label className="text-slate-400 uppercase font-bold block mb-1 text-[11px]">
              Expense Type *
            </label>
            <Select value={expenseType} onValueChange={setExpenseType}>
              <SelectTrigger className="bg-slate-950 border-slate-800 text-white font-bold">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white font-bold">
                {EXPENSE_CATEGORIES.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AMOUNT INPUT */}
          <div>
            <label className="text-slate-400 uppercase font-bold block mb-1 text-[11px]">
              Withdrawn Amount (RM) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-sm">RM</span>
              <Input
                type="number"
                step="0.10"
                min="0.10"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="50.00"
                className="pl-10 bg-slate-950 border-slate-800 text-white font-mono font-bold text-base text-amber-400"
                required
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="text-slate-400 uppercase font-bold block mb-1 text-[11px]">
              Description / Reason *
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Gas cylinder refill for cooking / Emergency ice bags"
              className="bg-slate-950 border-slate-800 text-white text-xs"
              rows={2}
              required
            />
          </div>

          {/* RECORDED BY INFO */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-slate-400">
            <span>Recorded By:</span>
            <span className="font-bold text-emerald-400">{staffName}</span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
              {isSubmitting ? 'Recording Expense...' : 'Save Cash Expense'}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
