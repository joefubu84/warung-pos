import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { requireCashierAuth } from '@/lib/auth-guard';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Table as TableIcon,
  QrCode,
  AlertCircle,
  Loader2,
  Clock,
  Receipt,
  Utensils,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
import { Label } from '@/components/ui/label';

export const Route = createFileRoute('/cash-management')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireCashierAuth(location, context.auth);
  },
  component: CashManagementPage,
});

function CashManagementPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dailyCash, setDailyCash] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialogs
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  
  // Forms
  const [openingBalance, setOpeningBalance] = useState('');
  const [actualClosing, setActualClosing] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      
      const { data: user } = await supabase
        .from('users')
        .select('store_id')
        .eq('id', session.user.id)
        .single();
      
      if (user) setStoreId(user.store_id);

      // Get today's local date string (YYYY-MM-DD)
      const today = new Date().toLocaleDateString('en-CA');
      
      // Fetch today's daily_cash
      const { data: cashData } = await supabase
        .from('daily_cash')
        .select('*')
        .eq('date', today)
        .maybeSingle();

      setDailyCash(cashData);

      // Fetch today's transactions
      const { data: txData } = await supabase
        .from('cash_transactions')
        .select('*')
        .eq('type', 'order') // Fallback to a valid column if shift_date is missing
        .order('created_at', { ascending: false });

      setTransactions(txData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenShift = async () => {
    if (!openingBalance) {
      toast.error('Please enter opening balance');
      return;
    }
    
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const { error } = await supabase.from('daily_cash').insert({
        date: today,
        opening_balance: parseFloat(openingBalance),
        status: 'open',
        opened_by: userId,
        store_id: storeId
      } as any);

      if (error) throw error;
      toast.success('Register Opened!');
      setIsOpeningShift(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to open register');
    }
  };

  const handleCloseShift = async () => {
    if (!actualClosing) {
      toast.error('Please enter counted cash');
      return;
    }
    
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const expectedCash = expectedClosingBalance;
      const variance = parseFloat(actualClosing) - expectedCash;
      
      const { error } = await supabase.from('daily_cash').update({
        closing_balance: expectedCash,
        actual_closing: parseFloat(actualClosing),
        variance: variance,
        status: 'closed',
        closed_by: userId
      } as any).eq('date', today);

      if (error) throw error;
      toast.success('Register Closed successfully!');
      setIsClosingShift(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to close register');
    }
  };

  if (isLoading) return <div className="p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  // Calculate expected closing
  const opening = dailyCash ? Number(dailyCash.opening_balance) : 0;
  const netTransactions = transactions.reduce((sum, tx) => {
    return sum + (tx.type === 'in' ? Number(tx.amount) : -Number(tx.amount));
  }, 0);
  const expectedClosingBalance = opening + netTransactions;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-2"><Wallet className="w-8 h-8"/> Cash Management</h1>
          <p className="text-muted-foreground">{todayStr}</p>
        </div>
        
        {!dailyCash && (
          <button 
            onClick={() => setIsOpeningShift(true)}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-emerald-700"
          >
            Open Register
          </button>
        )}
        
        {dailyCash && dailyCash.status === 'open' && (
          <button 
            onClick={() => setIsClosingShift(true)}
            className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:bg-rose-700"
          >
            Close Register
          </button>
        )}
      </div>

      {!dailyCash ? (
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
          <Wallet className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-amber-800 mb-2">Register is Closed</h2>
          <p className="text-amber-700">Open the register with a starting cash balance to begin tracking transactions for today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Opening Balance</p>
            <p className="text-4xl font-black">RM {Number(dailyCash.opening_balance).toFixed(2)}</p>
            {dailyCash.status === 'closed' && (
              <span className="mt-4 inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold w-max">
                REGISTER CLOSED
              </span>
            )}
            {dailyCash.status === 'open' && (
              <span className="mt-4 inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold w-max">
                REGISTER OPEN
              </span>
            )}
          </div>
          
          <div className="bg-card border rounded-2xl p-6 shadow-sm flex flex-col justify-center">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Net Cash (Transactions)</p>
            <p className={cn("text-4xl font-black", netTransactions >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {netTransactions >= 0 ? '+' : ''}RM {netTransactions.toFixed(2)}
            </p>
          </div>
          
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg flex flex-col justify-center relative overflow-hidden">
            <Wallet className="w-32 h-32 absolute -right-4 -bottom-4 opacity-10" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 relative z-10">Expected in Drawer</p>
            <p className="text-4xl font-black text-emerald-400 relative z-10">RM {expectedClosingBalance.toFixed(2)}</p>
            
            {dailyCash.status === 'closed' && (
              <div className="mt-4 pt-4 border-t border-slate-700 relative z-10">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Actual Counted:</span>
                  <span className="font-bold">RM {Number(dailyCash.actual_closing).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">Variance:</span>
                  <span className={cn("font-bold", Number(dailyCash.variance) === 0 ? "text-emerald-400" : "text-rose-400")}>
                    RM {Number(dailyCash.variance).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transactions List */}
      {dailyCash && (
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-muted/30 border-b">
            <h3 className="font-bold">Today's Cash Transactions</h3>
          </div>
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No cash transactions recorded yet.</div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="p-4 flex justify-between items-center hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                      tx.type === 'in' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {tx.type === 'in' ? '+' : '-'}
                    </div>
                    <div>
                      <p className="font-bold">{tx.description || 'Order Payment'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "font-black text-lg",
                    tx.type === 'in' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {tx.type === 'in' ? '+' : '-'} RM {Number(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Dialog open={isOpeningShift} onOpenChange={setIsOpeningShift}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open Register</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-bold block mb-2">Opening Cash Balance (RM)</label>
              <Input 
                type="number" 
                min="0" 
                step="0.01" 
                value={openingBalance} 
                onChange={e => setOpeningBalance(e.target.value)}
                placeholder="e.g. 150.00"
                className="text-xl"
              />
            </div>
            <p className="text-sm text-muted-foreground">Enter the amount of cash currently in the drawer to start the day.</p>
          </div>
          <DialogFooter>
            <button 
              onClick={handleOpenShift}
              className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold w-full hover:bg-emerald-700"
            >
              Confirm Open
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isClosingShift} onOpenChange={setIsClosingShift}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Register</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-slate-100 p-4 rounded-xl border">
              <p className="text-sm text-slate-500 uppercase font-bold mb-1">Expected Cash in Drawer</p>
              <p className="text-3xl font-black text-slate-800">RM {expectedClosingBalance.toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm font-bold block mb-2">Actual Cash Counted (RM)</label>
              <Input 
                type="number" 
                min="0" 
                step="0.01" 
                value={actualClosing} 
                onChange={e => setActualClosing(e.target.value)}
                placeholder="Count the drawer..."
                className="text-xl border-rose-200 focus-visible:ring-rose-500"
              />
            </div>
            {actualClosing && (
              <div className="flex justify-between items-center text-sm">
                <span>Variance:</span>
                <span className={cn("font-bold", (parseFloat(actualClosing) - expectedClosingBalance) === 0 ? "text-emerald-600" : "text-rose-600")}>
                  RM {(parseFloat(actualClosing) - expectedClosingBalance).toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <button 
              onClick={handleCloseShift}
              className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold w-full hover:bg-rose-700"
            >
              Confirm Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
