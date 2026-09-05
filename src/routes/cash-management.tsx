import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useCallback } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  History, 
  TrendingUp, 
  Receipt, 
  DollarSign, 
  Lock, 
  Unlock,
  RefreshCw,
  Plus,
  Printer,
  Share2,
  MessageSquare,
  Image as ImageIcon,
  Pencil,
  Trash2,
  HardDrive,
  Broom,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { toBlob, toPng } from 'html-to-image';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { EditExpenseModal, extractReceiptUrlFromNotes, extractCleanDescriptionFromNotes } from '@/components/EditExpenseModal';
import { StorageManagementCard } from '@/components/StorageManagementCard';
import { AuditLogsFeed } from '@/components/AuditLogsFeed';
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

import { ReopenRegisterModal } from '@/components/ReopenRegisterModal';

interface CashManagementSearch {
  reason?: string | undefined;
}

export const Route = createFileRoute('/cash-management')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): CashManagementSearch => {
    return {
      reason: search['reason'] ? String(search['reason']) : undefined,
    };
  },
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: CashManagementPage,
});

export function CashManagementPage() {
  const searchParams = useSearch({ strict: false }) as any;
  const [dailyCash, setDailyCash] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>('Staff');

  // Dialog states
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expense Management & Storage Tab Navigation
  const [activeTab, setActiveTab] = useState<'register' | 'storage' | 'audit'>('register');
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<any | null>(null);

  // History filtering & detail modal states
  const [historyPreset, setHistoryPreset] = useState<'7days' | '30days' | 'all' | 'custom'>('7days');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [selectedHistoricalSession, setSelectedHistoricalSession] = useState<any | null>(null);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);

  // Historical Session Editing & Audit Log states
  const [editClosingInput, setEditClosingInput] = useState<string>('');
  const [editNotesInput, setEditNotesInput] = useState<string>('');
  const [editChangeReason, setEditChangeReason] = useState<string>('');
  const [sessionEditLogs, setSessionEditLogs] = useState<any[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpense) return;
    try {
      // 1. Delete receipt from Supabase Storage if linked
      const receiptUrl = extractReceiptUrlFromNotes(deletingExpense.notes);
      if (receiptUrl && receiptUrl.includes('receipts/')) {
        const filePath = receiptUrl.split('receipts/').pop();
        if (filePath) {
          await supabase.storage.from('receipts').remove([filePath]);
        }
      }

      // 2. Delete row from cash_transactions
      await supabase.from('cash_transactions').delete().eq('id', deletingExpense.id);

      // 3. Delete row from expenses table if matching amount
      try {
        await supabase.from('expenses').delete().eq('amount', deletingExpense.amount);
      } catch (e) {
        console.warn("Expenses table delete notice:", e);
      }

      // 4. Log Audit Trail Entry
      await supabase.from('daily_cash_edit_logs').insert({
        daily_cash_id: dailyCash?.id || 'system',
        edited_by: userId,
        edited_by_name: staffName,
        previous_values: deletingExpense,
        change_reason: `Staff ${staffName} deleted petty cash expense (RM ${Number(deletingExpense.amount).toFixed(2)}) + receipt file`
      });

      toast.success(`Expense of RM ${Number(deletingExpense.amount).toFixed(2)} & receipt deleted!`);
      setDeletingExpense(null);
      fetchData();
    } catch (err: any) {
      toast.error(`Failed to delete expense: ${err.message}`);
    }
  };

  useEffect(() => {
    if (selectedHistoricalSession) {
      setEditClosingInput((selectedHistoricalSession.closing_balance || selectedHistoricalSession.actual_closing || 0).toString());
      setEditNotesInput(selectedHistoricalSession.notes || '');
      setEditChangeReason('');
      fetchSessionEditLogs(selectedHistoricalSession.id);
    }
  }, [selectedHistoricalSession]);

  const fetchSessionEditLogs = async (dailyCashId: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_cash_edit_logs')
        .select('*')
        .eq('daily_cash_id', dailyCashId)
        .order('edited_at', { ascending: false });
      if (!error && data) {
        setSessionEditLogs(data);
      }
    } catch (err) {
      console.error('Error fetching edit logs:', err);
    }
  };

  const handleSaveHistoricalEdit = async () => {
    if (!selectedHistoricalSession) return;
    const newClosing = parseFloat(editClosingInput);
    if (isNaN(newClosing) || newClosing < 0) {
      toast.error("Please enter a valid closing balance amount");
      return;
    }
    if (!editChangeReason) {
      toast.error("Please select a mandatory Change Reason before saving");
      return;
    }

    setIsSavingEdit(true);
    try {
      const expected = Number(selectedHistoricalSession.expected_closing || 0);
      const newVariance = newClosing - expected;

      // 1. Update daily_cash record
      const { error: updateErr } = await supabase
        .from('daily_cash')
        .update({
          closing_balance: newClosing,
          variance: newVariance,
          notes: editNotesInput
        })
        .eq('id', selectedHistoricalSession.id);

      if (updateErr) throw updateErr;

      // 2. Insert audit log into daily_cash_edit_logs
      const previousValues = {
        closing_balance: selectedHistoricalSession.closing_balance,
        variance: selectedHistoricalSession.variance,
        notes: selectedHistoricalSession.notes
      };
      const newValues = {
        closing_balance: newClosing,
        variance: newVariance,
        notes: editNotesInput
      };

      const { error: logErr } = await supabase
        .from('daily_cash_edit_logs')
        .insert({
          daily_cash_id: selectedHistoricalSession.id,
          edited_by: userId,
          edited_by_name: staffName || 'Manager',
          previous_values: previousValues,
          new_values: newValues,
          change_reason: editChangeReason,
          edited_at: new Date().toISOString()
        });

      if (logErr) throw logErr;

      toast.success("Historical register session updated & audit log created!");
      
      const updatedSession = {
        ...selectedHistoricalSession,
        closing_balance: newClosing,
        variance: newVariance,
        notes: editNotesInput
      };
      setSelectedHistoricalSession(updatedSession);
      fetchSessionEditLogs(selectedHistoricalSession.id);
      fetchData(); // Refresh history list
    } catch (err: any) {
      toast.error(err.message || "Failed to update historical record");
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    if (searchParams?.reason === 'not_opened') {
      toast.warning("Morning Float Required: Please open cash register to start today's ordering shift.");
    }
  }, [searchParams]);

  // Form states
  const [openingBalanceInput, setOpeningBalanceInput] = useState('100.00');
  const [actualCashInput, setActualCashInput] = useState('');
  const [closeNotesInput, setCloseNotesInput] = useState('');

  const todayDateStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from('users')
          .select('name, store_id')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (profile) {
          setStoreId(profile.store_id);
          if (profile.name) setStaffName(profile.name);
        }
      }

      // Fetch today's daily_cash session
      const { data: cashData } = await supabase
        .from('daily_cash')
        .select('*')
        .eq('date', todayDateStr)
        .maybeSingle();

      setDailyCash(cashData);

      // Fetch today's cash orders (from midnight today)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, created_at, total_amount, payment_method, paid, status')
        .gte('created_at', startOfDay.toISOString())
        .eq('paid', true)
        .order('created_at', { ascending: false });

      // Filter cash orders
      const cashOrders = (ordersData || []).filter(o => 
        o.payment_method === 'cash' || !o.payment_method
      ).map(o => ({
        id: o.id,
        order_id: o.id,
        created_at: o.created_at,
        amount: Number(o.total_amount),
        type: 'payment', // payment (+) or refund (-)
        notes: `Cash Order #${o.id.slice(0, 8)}`
      }));

      // Fetch recorded drawer expenses for today
      let expTransactions: any[] = [];
      if (cashData?.id) {
        const { data: expData } = await supabase
          .from('cash_transactions')
          .select('*')
          .eq('daily_cash_id', cashData.id)
          .order('created_at', { ascending: false });

        if (expData) {
          expTransactions = expData.map(e => ({
            id: e.id,
            order_id: e.order_id || null,
            created_at: e.created_at || new Date().toISOString(),
            amount: Number(e.amount),
            type: e.type || 'expense',
            notes: e.notes || 'Cash Expense'
          }));
        }
      }

      const combinedTransactions = [...cashOrders, ...expTransactions].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(combinedTransactions);

      // Fetch past daily_cash sessions for history view based on filter preset
      let historyQuery = supabase
        .from('daily_cash')
        .select('*')
        .neq('date', todayDateStr);

      const now = new Date();
      if (historyPreset === '7days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        historyQuery = historyQuery.gte('date', d.toLocaleDateString('en-CA'));
      } else if (historyPreset === '30days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 30);
        historyQuery = historyQuery.gte('date', d.toLocaleDateString('en-CA'));
      } else if (historyPreset === 'custom') {
        if (historyStartDate) historyQuery = historyQuery.gte('date', historyStartDate);
        if (historyEndDate) historyQuery = historyQuery.lte('date', historyEndDate);
      }

      const { data: historyData } = await historyQuery
        .order('date', { ascending: false })
        .limit(50);

      setPastSessions(historyData || []);

    } catch (err: any) {
      console.error('Error fetching cash management data:', err);
      toast.error('Failed to load cash management data');
    } finally {
      setIsLoading(false);
    }
  }, [todayDateStr, historyPreset, historyStartDate, historyEndDate]);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates for daily_cash and cash_transactions
    const dailyCashChannel = supabase
      .channel('daily_cash_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_cash' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_transactions' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(dailyCashChannel);
    };
  }, [fetchData]);

  // Handle Open Register
  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(openingBalanceInput);
    if (isNaN(balance) || balance < 0) {
      toast.error('Please enter a valid opening balance amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('daily_cash')
        .insert({
          date: todayDateStr,
          opening_balance: balance
        });

      if (error) throw error;
      toast.success(`Register opened with RM ${balance.toFixed(2)}`);
      setIsOpeningModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to open register');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations
  const openingBalance = dailyCash ? Number(dailyCash.opening_balance) : 0;
  
  const cashSalesTotal = transactions
    .filter(t => t.type === 'payment')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const cashRefundsTotal = transactions
    .filter(t => t.type === 'refund')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const cashExpensesTotal = transactions
    .filter(t => t.type?.startsWith('expense'))
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netCashIn = cashSalesTotal - cashExpensesTotal - cashRefundsTotal;
  const expectedClosing = openingBalance + netCashIn;

  // Reconcile calculations inside Close Modal
  const actualCounted = parseFloat(actualCashInput) || 0;
  const calculatedVariance = actualCounted - expectedClosing;

  // Handle Close Shift & Reconciliation
  const handleCloseRegister = async () => {
    if (!actualCashInput || isNaN(actualCounted)) {
      toast.error('Please enter the actual counted cash amount');
      return;
    }

    if (calculatedVariance !== 0 && !closeNotesInput.trim()) {
      toast.error('A note explaining the discrepancy is required when variance is non-zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('daily_cash')
        .update({
          closing_balance: actualCounted,
          expected_closing: expectedClosing,
          variance: calculatedVariance,
          notes: closeNotesInput || null,
          closed_at: new Date().toISOString(),
          closed_by: userId
        })
        .eq('date', todayDateStr);

      if (error) throw error;

      toast.success('Register closed and shift reconciled!');
      setIsClosingModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to close register');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!dailyCash) {
      toast.error("No cash register session available to share.");
      return;
    }

    const actualCountedVal = Number(dailyCash.closing_balance) || 0;
    const calculatedVarianceVal = Number(dailyCash.variance) || (actualCountedVal - expectedClosing);
    const isShiftClosed = dailyCash.closed_at !== null;

    const varianceStatus = isShiftClosed 
      ? (calculatedVarianceVal === 0 ? 'Perfect Match ✓' : calculatedVarianceVal > 0 ? `+RM ${calculatedVarianceVal.toFixed(2)} (Over)` : `-RM ${Math.abs(calculatedVarianceVal).toFixed(2)} (Short)`)
      : 'Active Shift (Open)';

    const expenseTransactions = transactions.filter(t => t.type?.startsWith('expense'));
    const expenseTextDetails = expenseTransactions.length > 0
      ? expenseTransactions.map(e => `  └ ${e.notes || 'Expense'}: -RM ${Number(e.amount).toFixed(2)}`).join('\n')
      : '  └ None recorded';

    let imageUrlText = '';

    // Option C: Generate PNG & upload to storage if bucket exists
    try {
      if (!isPrintModalOpen) {
        setIsPrintModalOpen(true);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      const node = document.getElementById('printable-sales-report');
      if (node) {
        const blob = await toBlob(node, { pixelRatio: 2 });
        if (blob) {
          const filePath = `daily-reports/${todayDateStr}_${Date.now()}.png`;
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('receipts')
            .upload(filePath, blob, { contentType: 'image/png', upsert: true });

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
            if (urlData?.publicUrl) {
              imageUrlText = `\n🖼️ *FULL RECEIPT IMAGE:*\n${urlData.publicUrl}\n`;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Storage receipt URL upload skipped:", e);
    }

    const message = `📊 *WARUNG J&J - DAILY SALES REPORT*
📅 *Date:* ${todayDateStr}

💰 *FINANCIAL SUMMARY*
• *Gross Cash Sales:* RM ${cashSalesTotal.toFixed(2)}
• *Cash Expenses:* -RM ${cashExpensesTotal.toFixed(2)}
${expenseTextDetails}
• *Refunds / Returns:* -RM ${cashRefundsTotal.toFixed(2)}
• *Net Cash In:* RM ${netCashIn.toFixed(2)}

💵 *CASH DRAWER RECONCILIATION*
• *Opening Float:* RM ${openingBalance.toFixed(2)}
• *Net Cash In:* RM ${netCashIn.toFixed(2)}
• *Expected Drawer:* RM ${expectedClosing.toFixed(2)}
${isShiftClosed ? `• *Actual Counted:* RM ${actualCountedVal.toFixed(2)}\n• *Shift Variance:* ${varianceStatus}` : '• *Shift Status:* ACTIVE (Open)'}${imageUrlText}
📋 *OPERATIONS SUMMARY*
• *Total Transactions:* ${transactions.length}
• *Avg Transaction:* RM ${(transactions.length > 0 ? cashSalesTotal / transactions.length : 0).toFixed(2)}

_Report generated by ${staffName} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}_`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyOrShareReceiptImage = async () => {
    if (!isPrintModalOpen) {
      setIsPrintModalOpen(true);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const node = document.getElementById('printable-sales-report');
    if (!node) {
      toast.error("Receipt preview element not ready");
      return;
    }

    try {
      toast.loading("Generating thermal receipt image...", { id: 'img-gen' });
      const blob = await toBlob(node, { pixelRatio: 2 });
      if (!blob) throw new Error("Failed to generate image blob");

      const file = new File([blob], `Warung_JJ_Daily_Report_${todayDateStr}.png`, { type: 'image/png' });

      // Mobile/Tablet Web Share API file sharing
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        toast.dismiss('img-gen');
        await navigator.share({
          files: [file],
          title: `Warung J&J Daily Report - ${todayDateStr}`,
          text: `Warung J&J Daily Sales Report`
        });
        toast.success("Receipt image shared successfully!");
        return;
      }

      // Desktop: Copy to clipboard + launch WhatsApp Web
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        toast.dismiss('img-gen');
        toast.success("Receipt Image COPIED to Clipboard! Paste (Ctrl+V) into WhatsApp chat.", { duration: 5000 });
        
        setTimeout(() => {
          window.open('https://web.whatsapp.com', '_blank');
        }, 1200);
      } else {
        const dataUrl = await toPng(node, { pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `Warung_JJ_Daily_Report_${todayDateStr}.png`;
        link.href = dataUrl;
        link.click();
        toast.dismiss('img-gen');
        toast.success("Receipt image downloaded!");
      }
    } catch (err: any) {
      toast.dismiss('img-gen');
      console.error("Error sharing receipt image:", err);
      toast.error(err.message || "Failed to share receipt image");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8fafc] text-slate-900">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
          <p className="font-mono text-sm text-slate-500">Loading Cash Drawer...</p>
        </div>
      </div>
    );
  }

  const isClosed = dailyCash && dailyCash.closed_at !== null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-12 h-12 rounded-full object-cover border border-orange-200 shadow-xs" />
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cash Management & Drawer</h1>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* REGISTER ACTION BUTTONS */}
          <div className="flex items-center gap-3 flex-wrap">
            {dailyCash && (
              <>
                {!isClosed && (
                  <Button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" /> Record Expense
                  </Button>
                )}

                <Button
                  onClick={() => setIsPrintModalOpen(true)}
                  variant="outline"
                  className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-emerald-600" /> Print Report
                </Button>

                <Button
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" /> Share via WhatsApp
                </Button>
              </>
            )}

            {!dailyCash && (
              <Button
                onClick={() => setIsOpeningModal(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" /> Open Register
              </Button>
            )}

            {dailyCash && !isClosed && (
              <Button
                onClick={() => {
                  setActualCashInput(expectedClosing.toFixed(2));
                  setIsClosingModal(true);
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Close Register
              </Button>
            )}

            {isClosed && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs">
                  <Lock className="w-4 h-4 text-rose-600" /> REGISTER CLOSED TODAY
                </div>
                <Button
                  onClick={() => setIsReopenModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl shadow-xs flex items-center gap-2 text-xs"
                >
                  <Unlock className="w-4 h-4" /> Reopen Register for Corrections
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* TOP NAVIGATION TABS */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 font-mono">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'register' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Wallet className="w-4 h-4" /> 💵 Cash Register & Transactions
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'storage' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <HardDrive className="w-4 h-4" /> 📦 Receipt Storage & Files
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> 📜 Action Audit Feed
          </button>
        </div>

        {/* TAB 2: RECEIPT STORAGE MANAGEMENT */}
        {activeTab === 'storage' && (
          <StorageManagementCard onRefreshExpenses={fetchData} dailyCashId={dailyCash?.id || null} />
        )}

        {/* TAB 3: AUDIT TRAIL LOGS FEED */}
        {activeTab === 'audit' && (
          <AuditLogsFeed />
        )}

        {/* TAB 1: CASH REGISTER CONTENT */}
        {activeTab === 'register' && (
          <>
            {/* IF NO REGISTER OPEN TODAY */}
            {!dailyCash ? (
          <div className="bg-white border-2 border-dashed border-slate-300 p-12 rounded-3xl text-center flex flex-col items-center justify-center shadow-xs">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-full text-amber-600 mb-4">
              <Lock className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Register is Currently Closed</h2>
            <p className="text-slate-500 max-w-md text-sm mb-6">
              Open the register with a starting opening balance to start processing cash sales and track reconciliation for today's shift.
            </p>
            <Button
              onClick={() => setIsOpeningModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl shadow-xs flex items-center gap-2 text-base"
            >
              <Plus className="w-5 h-5" /> Open Register Now
            </Button>
          </div>
        ) : (
          <>
            {/* GRID SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* CARD 1: SESSION BREAKDOWN */}
              <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cash Register Session</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      !isClosed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {!isClosed ? '● OPEN' : '🔒 CLOSED'}
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Opening Balance</span>
                      <span className="font-bold text-slate-900">RM {openingBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Cash Sales Today</span>
                      <span className="font-bold text-emerald-700">+RM {cashSalesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Refunds / Out</span>
                      <span className="font-bold text-rose-700">-RM {cashRefundsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex justify-between items-center">
                  <span className="text-xs text-slate-500">Opened by {staffName}</span>
                  <span className="text-xs text-slate-500 font-mono">
                    {dailyCash.created_at ? new Date(dailyCash.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>

              {/* CARD 2: EXPECTED CLOSING DRAWER */}
              <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 text-emerald-600 pointer-events-none">
                  <Wallet className="w-32 h-32" />
                </div>

                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Expected Closing in Drawer</span>
                  <div className="text-4xl font-black text-slate-900 mt-2 tabular-nums tracking-tight">
                    RM {expectedClosing.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">Formula: Opening + Cash Sales - Refunds</p>
                </div>

                {isClosed && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Actual Counted:</span>
                      <span className="font-bold text-slate-900">RM {Number(dailyCash.closing_balance || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Variance:</span>
                      <span className={`font-bold ${Number(dailyCash.variance || 0) === 0 ? 'text-emerald-700' : Number(dailyCash.variance || 0) > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                        RM {Number(dailyCash.variance || 0).toFixed(2)} ({Number(dailyCash.variance || 0) === 0 ? '✓ MATCH' : Number(dailyCash.variance || 0) > 0 ? '⚠️ OVER' : '❌ SHORT'})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 3: TODAY'S STATS */}
              <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Shift Statistics</span>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 font-mono">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Cash Orders</span>
                      <span className="text-xl font-bold text-slate-900">{transactions.length}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase block font-bold">Avg Order Size</span>
                      <span className="text-xl font-bold text-emerald-700">
                        RM {transactions.length > 0 ? (cashSalesTotal / transactions.length).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Reconciliation Status</span>
                  {isClosed ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Shift Completed
                    </span>
                  ) : (
                    <span className="font-bold text-amber-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Shift Active
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* TRANSACTIONS LIST SECTION */}
            <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-lg font-black text-slate-900">Today's Cash Transactions</h3>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                  Total: RM {cashSalesTotal.toFixed(2)}
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-mono text-sm">
                  No cash transactions recorded for today yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-mono border-b border-slate-200">
                        <th className="py-3 px-5">Time</th>
                        <th className="py-3 px-5">Reference / Order</th>
                        <th className="py-3 px-5">Type</th>
                        <th className="py-3 px-5 text-right">Amount</th>
                        <th className="py-3 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-mono">
                      {transactions.map((tx, idx) => {
                        const receiptMatch = tx.notes?.match(/\[RECEIPT_URL:\s*([^\]]+)\]/);
                        const receiptUrl = receiptMatch ? receiptMatch[1].trim() : null;
                        const cleanNotes = tx.notes ? tx.notes.replace(/\[RECEIPT_URL:\s*([^\]]+)\]/, '').trim() : '';

                        return (
                          <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-5 text-slate-500 text-xs">
                              {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3.5 px-5 font-bold text-slate-900">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                                  {tx.order_id ? `#${tx.order_id.slice(0, 8)}` : (cleanNotes || 'EXPENSE')}
                                </span>
                                {receiptUrl && (
                                  <button
                                    onClick={() => setViewReceiptUrl(receiptUrl)}
                                    className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition-colors"
                                  >
                                    <Receipt className="w-3 h-3" /> Receipt Attached ✓
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-5">
                              {tx.type === 'payment' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                  <ArrowDownLeft className="w-3 h-3" /> Payment Received
                                </span>
                              ) : tx.type?.startsWith('expense') ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                  <ArrowUpRight className="w-3 h-3" /> Cash Expense
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-700 text-xs font-bold bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                                  <ArrowUpRight className="w-3 h-3" /> Refund / Out
                                </span>
                              )}
                            </td>
                            <td className={`py-3.5 px-5 text-right font-bold text-base ${tx.type === 'payment' ? 'text-emerald-600' : tx.type?.startsWith('expense') ? 'text-amber-600' : 'text-rose-600'}`}>
                              {tx.type === 'payment' ? '+' : '-'}RM {Number(tx.amount).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {tx.type?.startsWith('expense') && (
                                <div className="flex items-center justify-end gap-1.5 font-sans">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingExpense(tx)}
                                    className="h-7 px-2 text-xs font-mono text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200"
                                    title="Edit Expense Details & Receipt"
                                  >
                                    <Pencil className="w-3 h-3 mr-1 text-amber-600" /> Edit
                                  </Button>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeletingExpense(tx)}
                                    className="h-7 px-2 text-xs font-mono text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200"
                                    title="Delete Expense & Receipt"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1 text-rose-600" /> Delete
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

        {/* PAST SESSIONS HISTORY */}
        <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs mt-8">
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              <h3 className="text-lg font-black text-slate-900">Past Register Sessions History</h3>
            </div>

            {/* PRESET FILTER BUTTONS & DATE RANGE PICKER */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setHistoryPreset('7days')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  historyPreset === '7days' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setHistoryPreset('30days')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  historyPreset === '30days' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setHistoryPreset('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  historyPreset === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setHistoryPreset('custom')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  historyPreset === 'custom' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                📅 Custom Range
              </button>
            </div>
          </div>

          {historyPreset === 'custom' && (
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">From:</span>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">To:</span>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900"
                />
              </div>
            </div>
          )}

          {pastSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-mono text-sm">
              No historical register sessions found for the selected filter range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-mono border-b border-slate-200">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Opening</th>
                    <th className="py-3 px-5">Expected</th>
                    <th className="py-3 px-5">Actual Counted</th>
                    <th className="py-3 px-5">Variance</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-mono">
                  {pastSessions.map((session) => {
                    const variance = Number(session.variance || 0);
                    return (
                      <tr key={session.id || session.date} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 text-slate-900 font-bold">{session.date}</td>
                        <td className="py-3.5 px-5 text-slate-600">RM {Number(session.opening_balance || 0).toFixed(2)}</td>
                        <td className="py-3.5 px-5 text-slate-600">RM {Number(session.expected_closing || 0).toFixed(2)}</td>
                        <td className="py-3.5 px-5 text-slate-900 font-bold">RM {Number(session.closing_balance || session.actual_closing || 0).toFixed(2)}</td>
                        <td className={`py-3.5 px-5 font-bold ${variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                          RM {variance.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          {variance === 0 ? (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                              ✓ MATCH
                            </span>
                          ) : variance > 0 ? (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                              ⚠️ OVER
                            </span>
                          ) : (
                            <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold">
                              ❌ SHORT
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedHistoricalSession(session);
                              setIsHistoricalModalOpen(true);
                            }}
                            className="bg-white hover:bg-slate-50 text-emerald-700 border-slate-200 text-xs font-bold shadow-xs"
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    )}
  </>
)}

      {/* HISTORICAL SESSION DETAIL MODAL */}
      <Dialog open={isHistoricalModalOpen} onOpenChange={setIsHistoricalModalOpen}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
              <History className="w-5 h-5 text-emerald-600" /> Historical Session Audit & Edit ({selectedHistoricalSession?.date})
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              View, edit, or reprint closing record for {selectedHistoricalSession?.date}. Any edits will be logged with your staff identity.
            </DialogDescription>
          </DialogHeader>

          {selectedHistoricalSession && (
            <div className="space-y-4 py-2 font-mono text-sm">
              {/* CURRENT STATS CARD */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 block font-sans">Opening Float</span>
                  <span className="font-bold text-slate-800">RM {Number(selectedHistoricalSession.opening_balance || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-sans">Expected Closing</span>
                  <span className="font-bold text-slate-800">RM {Number(selectedHistoricalSession.expected_closing || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-sans">Actual Counted</span>
                  <span className="font-bold text-emerald-600">RM {Number(selectedHistoricalSession.closing_balance || selectedHistoricalSession.actual_closing || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-sans">Variance</span>
                  <span className={`font-bold ${Number(selectedHistoricalSession.variance || 0) === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    RM {Number(selectedHistoricalSession.variance || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* EDIT FORM SECTION */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 font-sans">
                <h4 className="text-xs uppercase tracking-wider font-bold text-amber-700 font-mono flex items-center gap-1.5">
                  ✏️ Edit Closing Record & Audit Log
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 font-bold block mb-1">Actual Counted Balance (RM)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editClosingInput}
                      onChange={(e) => setEditClosingInput(e.target.value)}
                      className="bg-white border-slate-200 text-slate-900 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold block mb-1">Change Reason (Mandatory)*</label>
                    <select
                      value={editChangeReason}
                      onChange={(e) => setEditChangeReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 font-mono shadow-xs"
                    >
                      <option value="">Select Reason...</option>
                      <option value="Correction / Recount">Correction / Recount</option>
                      <option value="Late Entry / Adjustment">Late Entry / Adjustment</option>
                      <option value="Manager Override">Manager Override</option>
                      <option value="Data Entry Error">Data Entry Error</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-bold block mb-1">Audit Notes / Explanation</label>
                  <Input
                    value={editNotesInput}
                    onChange={(e) => setEditNotesInput(e.target.value)}
                    placeholder="Provide details on why this record was modified..."
                    className="bg-white border-slate-200 text-slate-900 text-xs"
                  />
                </div>

                <Button
                  onClick={handleSaveHistoricalEdit}
                  disabled={isSavingEdit}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs py-2 shadow-xs"
                >
                  {isSavingEdit ? 'Saving Audit Record...' : '💾 [SAVE EDIT] & Record Audit Log'}
                </Button>
              </div>

              {/* EDIT HISTORY TIMELINE */}
              <div className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 font-mono">
                  📋 Edit History Timeline ({sessionEditLogs.length})
                </h4>
                {sessionEditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    No edits have been recorded for this session.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sessionEditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 font-sans text-xs">
                        <div className="flex justify-between items-center font-mono">
                          <span className="font-bold text-emerald-700">Edited by {log.edited_by_name || 'Staff'}</span>
                          <span className="text-[10px] text-slate-400">{new Date(log.edited_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700">
                          <strong className="text-slate-600">Reason:</strong> {log.change_reason}
                        </p>
                        {log.previous_values && log.new_values && (
                          <div className="text-[11px] font-mono text-slate-500">
                            Closing: RM {Number(log.previous_values.closing_balance || 0).toFixed(2)} → <span className="text-slate-900 font-bold">RM {Number(log.new_values.closing_balance || 0).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={() => {
                setIsHistoricalModalOpen(false);
                setIsPrintModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              🖨️ Reprint Report & Edit Footer
            </Button>
            <Button variant="outline" onClick={() => setIsHistoricalModalOpen(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs rounded-xl">
              Close Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 1: OPEN REGISTER */}
      <Dialog open={isOpeningModal} onOpenChange={setIsOpeningModal}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-md rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-900">
              <Unlock className="w-5 h-5 text-emerald-600" /> Open Cash Register
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Enter the starting cash float present in the drawer for today's shift.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 font-mono">
            <div>
              <label className="text-xs text-slate-600 uppercase font-bold block mb-1.5">Starting Opening Balance (RM)</label>
              <Input
                type="number"
                step="0.01"
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                placeholder="100.00"
                className="bg-slate-50 border-slate-200 text-slate-900 text-lg font-bold rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpeningModal(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleOpenRegister} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs">
              {isSubmitting ? 'Opening...' : 'Confirm Open Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CLOSE REGISTER & RECONCILIATION */}
      <Dialog open={isClosingModal} onOpenChange={setIsClosingModal}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-lg rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-rose-600">
              <Lock className="w-5 h-5" /> Close Register & Reconcile Shift
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Count the physical cash in the drawer and record reconciliation variance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 font-mono">
            
            {/* SESSION SUMMARY BREAKDOWN */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Opening Balance:</span>
                <span className="font-bold text-slate-900">RM {openingBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Cash Sales Today:</span>
                <span className="font-bold text-emerald-600">+RM {cashSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Refunds / Out:</span>
                <span className="font-bold text-rose-600">-RM {cashRefundsTotal.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-emerald-700">
                <span>EXPECTED IN DRAWER:</span>
                <span>RM {expectedClosing.toFixed(2)}</span>
              </div>
            </div>

            {/* ACTUAL CASH INPUT */}
            <div>
              <label className="text-xs text-slate-600 uppercase font-bold block mb-1">
                Actual Physical Cash Counted (RM) *
              </label>
              <Input
                type="number"
                step="0.01"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                placeholder="0.00"
                className="bg-slate-50 border-slate-200 text-slate-900 text-xl font-bold rounded-xl"
              />
            </div>

            {/* VARIANCE RESULT BANNER */}
            <div className={`p-4 rounded-2xl border font-bold flex items-center justify-between ${
              calculatedVariance === 0 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : calculatedVariance > 0 
                ? 'bg-blue-50 border-blue-200 text-blue-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                {calculatedVariance === 0 && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {calculatedVariance > 0 && <AlertTriangle className="w-5 h-5 text-blue-600" />}
                {calculatedVariance < 0 && <XCircle className="w-5 h-5 text-rose-600" />}
                <div>
                  <div className="text-xs uppercase">Reconciliation Status</div>
                  <div className="text-sm font-black">
                    {calculatedVariance === 0 ? 'PERFECT MATCH ✓' : calculatedVariance > 0 ? 'OVERAGE ⚠️ (Extra Cash)' : 'SHORTAGE ❌ (Missing Cash)'}
                  </div>
                </div>
              </div>

              <div className="text-right text-lg font-black tabular-nums">
                {calculatedVariance > 0 ? '+' : ''}RM {calculatedVariance.toFixed(2)}
              </div>
            </div>

            {/* REASON / NOTES INPUT */}
            <div>
              <label className="text-xs text-slate-600 uppercase font-bold block mb-1">
                Discrepancy Reason / Notes {calculatedVariance !== 0 && <span className="text-rose-600">* (Required)</span>}
              </label>
              <Textarea
                value={closeNotesInput}
                onChange={(e) => setCloseNotesInput(e.target.value)}
                placeholder={calculatedVariance !== 0 ? 'e.g., Coin shortage, small error in change' : 'Optional shift closing comments...'}
                className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-xl"
                rows={2}
              />
            </div>

          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsClosingModal(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Back
            </Button>
            <Button onClick={handleCloseRegister} disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs">
              {isSubmitting ? 'Closing...' : 'Confirm & Save Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REOPEN REGISTER MODAL */}
      <ReopenRegisterModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        onSuccess={fetchData}
        closedAt={dailyCash?.closed_at}
      />

      {/* PRINT REPORT MODAL */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-md font-mono rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Printer className="w-5 h-5 text-emerald-600" /> Daily Sales Print Preview
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Preview 80mm thermal receipt report format.
            </DialogDescription>
          </DialogHeader>

          {/* THERMAL RECEIPT CONTAINER */}
          <div id="printable-sales-report" className="bg-white text-black p-6 rounded-2xl font-mono text-xs space-y-3 shadow-sm border border-slate-200">
            <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-black">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-16 h-16 rounded-full object-cover mx-auto mb-1 border border-black shadow-xs" />
              <h2 className="text-base font-black uppercase tracking-wider">WARUNG J&J</h2>
              <p className="text-[10px] uppercase font-extrabold text-amber-900 tracking-wide">AYAM GORENG & IKAN GORENG</p>
              <p className="text-[10px] uppercase font-bold text-gray-600 pt-0.5">Daily Sales & Shift Report</p>
              <p className="text-[10px] text-gray-500">Date: {todayDateStr} • Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-[10px] text-gray-500">Staff: {staffName}</p>
            </div>

            <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
              <p className="font-bold text-[11px] uppercase tracking-wider text-gray-800">Financial Summary</p>
              <div className="flex justify-between">
                <span>Gross Cash Sales:</span>
                <span className="font-bold">RM {cashSalesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-800 font-bold">
                <span>• Cash Expenses:</span>
                <span>-RM {cashExpensesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>• Refunds / Returns:</span>
                <span>-RM {cashRefundsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black border-t border-gray-200 pt-1 text-emerald-900">
                <span>Net Cash In:</span>
                <span>RM {netCashIn.toFixed(2)}</span>
              </div>
            </div>

            {/* ITEMIZED CASH EXPENSES BREAKDOWN */}
            {transactions.filter(t => t.type?.startsWith('expense')).length > 0 && (
              <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
                <p className="font-bold text-[11px] uppercase tracking-wider text-amber-900">
                  Itemized Expenses ({transactions.filter(t => t.type?.startsWith('expense')).length})
                </p>
                {transactions.filter(t => t.type?.startsWith('expense')).map((exp, i) => (
                  <div key={exp.id || i} className="text-[10px] pl-1.5 border-l-2 border-amber-400 py-0.5 my-1 bg-amber-50/50">
                    <div className="flex justify-between font-bold text-gray-900">
                      <span className="truncate max-w-[200px]">{exp.notes || 'Cash Expense'}</span>
                      <span className="text-amber-900 font-mono">-RM {Number(exp.amount).toFixed(2)}</span>
                    </div>
                    <div className="text-[9px] text-gray-500">
                      Time: {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
              <p className="font-bold text-[11px] uppercase tracking-wider text-gray-800">Drawer Reconciliation</p>
              <div className="flex justify-between">
                <span>Opening Balance:</span>
                <span>RM {openingBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Closing:</span>
                <span className="font-bold">RM {expectedClosing.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Actual Counted:</span>
                <span className="font-bold">RM {actualCashCount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-1">
                <span>Variance:</span>
                <span>{calculatedVariance > 0 ? '+' : ''}RM {calculatedVariance.toFixed(2)}</span>
              </div>
            </div>

            {/* CLOSING NOTES IF ANY */}
            {closeNotesInput && (
              <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
                <p className="font-bold text-[11px] uppercase tracking-wider text-gray-800">Closing Notes / Reason</p>
                <p className="italic text-gray-700 text-[10px] whitespace-pre-wrap">{closeNotesInput}</p>
              </div>
            )}

            {/* FOOTER MESSAGE EDIT AREA */}
            <div className="pt-2 text-center text-[10px] text-gray-500">
              <input
                type="text"
                value={printFooterNote}
                onChange={(e) => setPrintFooterNote(e.target.value)}
                placeholder="Custom footer message (click to edit)..."
                className="w-full text-center border-b border-gray-300 bg-transparent py-1 text-[10px] focus:outline-none focus:border-black font-mono text-gray-600"
              />
              <p className="pt-1 text-[9px] text-gray-400">Printed from Warung POS System</p>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Close
            </Button>
            <Button onClick={handleCopyOrShareReceiptImage} className="bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 rounded-xl shadow-xs">
              <ImageIcon className="w-4 h-4" /> Share Receipt Image
            </Button>
            <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 rounded-xl shadow-xs">
              <Printer className="w-4 h-4" /> Print Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD EXPENSE MODAL */}
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSuccess={fetchData}
        dailyCashId={dailyCash?.id || null}
        storeId={storeId}
      />

      {/* EDIT EXPENSE MODAL */}
      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSuccess={fetchData}
        expense={editingExpense}
        dailyCashId={dailyCash?.id || null}
      />

      {/* DELETE EXPENSE CONFIRMATION DIALOG */}
      <Dialog open={!!deletingExpense} onOpenChange={(open) => !open && setDeletingExpense(null)}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-md font-sans rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2 text-lg font-black">
              <Trash2 className="w-5 h-5 text-rose-600" /> Delete Petty Cash Expense?
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Are you sure you want to delete this cash expense of <span className="font-bold text-slate-900 font-mono">RM {Number(deletingExpense?.amount || 0).toFixed(2)}</span>?
            </DialogDescription>
          </DialogHeader>

          {deletingExpense && (
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2 text-xs font-mono text-slate-700">
              <div><strong>Transaction Notes:</strong> {extractCleanDescriptionFromNotes(deletingExpense.notes) || deletingExpense.notes}</div>
              <div><strong>Recorded At:</strong> {new Date(deletingExpense.created_at).toLocaleString()}</div>
              {extractReceiptUrlFromNotes(deletingExpense.notes) && (
                <div className="text-emerald-700 flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" /> Attached receipt photo will also be permanently deleted from Supabase Storage.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setDeletingExpense(null)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleConfirmDeleteExpense} className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-xs">
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ATTACHED EXPENSE RECEIPT IMAGE VIEW MODAL */}
      <Dialog open={!!viewReceiptUrl} onOpenChange={(open) => !open && setViewReceiptUrl(null)}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-lg font-sans rounded-3xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-emerald-700">
              <Receipt className="w-5 h-5" /> Attached Expense Receipt
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Scanned / uploaded paper receipt proof for petty cash withdrawal
            </DialogDescription>
          </DialogHeader>

          {viewReceiptUrl && (
            <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center font-sans">
              <img
                src={viewReceiptUrl}
                alt="Expense Receipt Proof"
                className="max-h-[60vh] w-auto object-contain rounded-xl shadow-sm border border-slate-200"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewReceiptUrl(null)} className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl">
              Close Receipt View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}
