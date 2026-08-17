import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, memo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
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
  Utensils
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { requireOrderingAuth } from '@/lib/auth-guard';
import { getTodayCashStatus, CashStatus } from '@/lib/cash-guard';
import { ReopenRegisterModal } from '@/components/ReopenRegisterModal';
import { Lock, Unlock } from 'lucide-react';
import { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- Route Definition ---

export const Route = createFileRoute('/tables')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireOrderingAuth(location, context.auth);
  },
  errorComponent: ({ error }) => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full p-8 bg-card border rounded-3xl shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-8">{error.message}</p>
        <a href="/" className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
          Back to Home
        </a>
      </motion.div>
    </div>
  ),
  component: TablesPage,
});

type TableStatus = 'available' | 'occupied' | 'reserved';

interface Table {
  id: string;
  table_number: string;
  status: TableStatus;
  qr_token: string;
  store_id: string;
}

const TableCard = memo(({ 
  table, 
  activeOrder, 
  onClick 
}: { 
  table: Table, 
  activeOrder: any, 
  onClick: (t: Table, o: any) => void 
}) => {
  const isOccupied = !!activeOrder;
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(table, activeOrder)}
      className={cn(
        "p-4 rounded-2xl border text-left flex flex-col h-32 relative overflow-hidden transition-all duration-300 ease-in-out shadow-md",
        isOccupied 
          ? "bg-amber-950/30 border-amber-500/40" 
          : "bg-slate-900 border-slate-800 hover:border-emerald-500/50"
      )}
    >
      <div className="flex justify-between items-start w-full">
        <span className="text-2xl font-black text-white">
          {table.table_number}
        </span>
        <div className={cn("w-3 h-3 rounded-full transition-colors duration-300", isOccupied ? "bg-amber-400 animate-pulse" : "bg-emerald-500")} />
      </div>
      
      <div className="mt-auto">
        {isOccupied ? (
          <>
            <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Occupied</p>
            <p className="text-[10px] text-slate-400 font-mono">#{activeOrder.id.slice(0,8).toUpperCase()}</p>
          </>
        ) : (
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Available</p>
        )}
      </div>
    </motion.button>
  );
});

function TablesPage() {
  const [activeTab, setActiveTab] = useState<'grid' | 'manage'>('grid');
  
  const [tables, setTables] = useState<Table[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Manage state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [appBaseUrl, setAppBaseUrl] = useState('');

  // Modal state
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableOrder, setTableOrder] = useState<any>(null);
  const { storeId } = Route.useRouteContext();
  const [cashStatus, setCashStatus] = useState<CashStatus>('OPEN');
  const [closedAtTime, setClosedAtTime] = useState<string | null>(null);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  const fetchCashStatus = useCallback(async () => {
    const res = await getTodayCashStatus(storeId);
    setCashStatus(res.status);
    setClosedAtTime(res.closedAt);
  }, [storeId]);

  useEffect(() => {
    fetchCashStatus();
    const cashChannel = supabase.channel(`tables_cash_guard_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_cash' }, () => {
        fetchCashStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cashChannel);
    };
  }, [fetchCashStatus]);

  useEffect(() => {
    const savedDomain = localStorage.getItem('warung_custom_qr_domain');
    if (savedDomain) {
      setAppBaseUrl(savedDomain.replace(/\/$/, ''));
    } else {
      const origin = window.location.origin.replace("-preview--", "--");
      if (origin.includes('localhost')) {
        // Fallback to active devtunnels domain for phone camera scanning
        setAppBaseUrl('https://p6x6tkn4-8080.asse.devtunnels.ms');
      } else {
        setAppBaseUrl(origin);
      }
    }
    fetchData();
    
    // Realtime subscription instead of polling
    const channel = supabase
      .channel('tables-orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        setActiveOrders(prev => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (payload.eventType === 'INSERT' && newRow.type === 'dine_in' && newRow.status !== 'completed' && newRow.status !== 'cancelled') {
            return [...prev, newRow];
          } else if (payload.eventType === 'UPDATE') {
            if (newRow.status === 'completed' || newRow.status === 'cancelled') {
              return prev.filter(o => o.id !== newRow.id);
            }
            const exists = prev.find(o => o.id === newRow.id);
            if (exists) {
              return prev.map(o => o.id === newRow.id ? newRow : o);
            } else if (newRow.type === 'dine_in') {
              return [...prev, newRow];
            }
          } else if (payload.eventType === 'DELETE') {
            return prev.filter(o => o.id !== oldRow.id);
          }
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, payload => {
        setTables(prev => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (payload.eventType === 'INSERT') return [...prev, newRow as Table].sort((a,b) => a.table_number.localeCompare(b.table_number));
          if (payload.eventType === 'UPDATE') return prev.map(t => t.id === newRow.id ? newRow as Table : t);
          if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== oldRow.id);
          return prev;
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    // We intentionally don't set isLoading(true) for background polling
    if (tables.length === 0) setIsLoading(true);
    
    try {
      const [{ data: tablesData }, { data: ordersData }] = await Promise.all([
        supabase.from('tables').select('*').order('table_number', { ascending: true }),
        supabase.from('orders')
          .select('id, table_id, status, total_amount, created_at')
          .eq('type', 'dine_in')
          .neq('status', 'completed')
      ]);

      if (tablesData) setTables(tablesData as Table[]);
      if (ordersData) setActiveOrders(ordersData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    setIsAdding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const { data: user } = await supabase
        .from('users')
        .select('store_id')
        .eq('id', session.user.id)
        .single();
      
      if (!user) throw new Error('User store not found');

      const qrToken = crypto.randomUUID();

      const { data, error } = await supabase
        .from('tables')
        .insert([{
          table_number: newTableNumber,
          qr_token: qrToken,
          store_id: user.store_id,
          status: 'available'
        }])
        .select()
        .single();

      if (error) throw error;
      
      setTables([...tables, data as Table]);
      setNewTableNumber('');
      toast.success(`Table ${newTableNumber} added`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add table');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTable = async (table: Table) => {
    if (confirm('Are you sure you want to delete this table?')) {
      const { error } = await supabase.from('tables').delete().eq('id', table.id);
      if (error) {
        toast.error('Failed to delete table');
      } else {
        setTables(tables.filter(t => t.id !== table.id));
        toast.success('Table deleted');
      }
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    const { error } = await supabase.from('tables').update({ table_number: editValue }).eq('id', id);
    if (error) {
      toast.error('Failed to update table number');
    } else {
      setTables(tables.map(t => t.id === id ? { ...t, table_number: editValue } : t));
      setEditingId(null);
      toast.success('Table updated');
    }
  };
  
  const handleMarkReady = async (orderId: string) => {
    try {
      const { error } = await supabase.from('orders').update({ 
        status: 'ready',
        ready_at: new Date().toISOString()
      } as any).eq('id', orderId);
      if (error) throw error;
      toast.success('Order marked ready');
      setSelectedTable(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to update order');
    }
  };

  const handleCloseTable = async (orderId: string) => {
    try {
      const { error } = await supabase.from('orders').update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      } as any).eq('id', orderId);
      if (error) throw error;
      toast.success('Table closed and order completed');
      setSelectedTable(null);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to close table');
    }
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    return Math.floor(diff / 60000); // minutes
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center h-[50vh]"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
      {cashStatus === 'CLOSED' && (
        <div className="bg-rose-950 border border-rose-800 p-4 rounded-xl text-white flex flex-col md:flex-row justify-between items-center gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-600 rounded-lg text-white">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                ⛔ ORDERS CLOSED FOR THE DAY
                {closedAtTime && (
                  <span className="text-xs font-mono bg-rose-900 text-rose-200 px-2.5 py-0.5 rounded border border-rose-700">
                    Closed at {new Date(closedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </h2>
              <p className="text-xs text-rose-300">
                The cash register shift is closed. Table creation and dine-in ordering are currently locked.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsReopenModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm whitespace-nowrap active:scale-95 transition-all"
          >
            <Unlock className="w-4 h-4" /> Reopen Register for Corrections
          </button>
        </div>
      )}

      {/* HEADER CARD */}
      <div className={`bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${cashStatus === 'CLOSED' ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Table Management</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Monitor live dine-in table status & QR ordering codes</p>
        </div>
        
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setActiveTab('grid')}
            className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'grid' ? "bg-emerald-600 shadow-sm text-white font-black" : "text-slate-400 hover:text-white")}
          >
            Live Grid
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all", activeTab === 'manage' ? "bg-emerald-600 shadow-sm text-white font-black" : "text-slate-400 hover:text-white")}
          >
            Manage Setup
          </button>
        </div>
      </div>

      {activeTab === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tables.map(table => {
            const activeOrder = activeOrders.find(o => o.table_id === table.id);
            const isOccupied = !!activeOrder;
            
            return (
              <TableCard 
                key={table.id}
                table={table}
                activeOrder={activeOrder}
                onClick={(t, o) => {
                  setSelectedTable(t);
                  setTableOrder(o);
                }}
              />
            )
          })}
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          
          {/* PHONE CAMERA QR CODE DOMAIN CONFIG */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-mono">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-400" /> Phone Camera QR Code Domain URL
                </h3>
                <p className="text-[11px] text-slate-400">
                  URL embedded in QR codes: <strong className="text-emerald-400">{appBaseUrl || 'Loading...'}</strong>
                </p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="e.g. https://p6x6tkn4-8080.asse.devtunnels.ms"
                  value={appBaseUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAppBaseUrl(val);
                    localStorage.setItem('warung_custom_qr_domain', val);
                  }}
                  className="bg-slate-900 border border-slate-800 text-xs text-white px-3 py-2 rounded-lg font-mono outline-none focus:ring-1 focus:ring-emerald-500 flex-1 sm:w-80"
                />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('warung_custom_qr_domain');
                    const origin = window.location.origin.replace("-preview--", "--");
                    if (origin.includes('localhost')) {
                      setAppBaseUrl('https://p6x6tkn4-8080.asse.devtunnels.ms');
                    } else {
                      setAppBaseUrl(origin);
                    }
                    toast.success("QR Domain reset to devtunnels/public URL.");
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono px-3 py-2 rounded-lg border border-slate-700 shrink-0"
                >
                  Reset
                </button>
              </div>
            </div>
            
            {appBaseUrl.includes('localhost') ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-sans">
                ⚠️ <strong>Notice for Physical Phone Cameras:</strong> Your QR code URL is set to <code className="font-mono text-white">localhost</code>. Physical smartphones cannot connect to "localhost". Enter your <strong>DevTunnels URL</strong> above (e.g. <code className="font-mono text-emerald-300">https://p6x6tkn4-8080.asse.devtunnels.ms</code>) or local Wi-Fi IP address!
              </div>
            ) : (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs font-sans flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ready for physical phone cameras! Scanned QR codes will connect directly to <strong className="font-mono text-white">{appBaseUrl}</strong>.</span>
              </div>
            )}
          </div>

          <form onSubmit={handleAddTable} className="flex gap-2 max-w-sm">
            <input
              type="text"
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              placeholder="New table number (e.g. A1)"
              className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl flex-1 text-sm font-medium text-white placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              disabled={isAdding}
            />
            <button 
              type="submit" 
              className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2 active:scale-95 transition-all"
              disabled={isAdding}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>

          <div className="space-y-3">
            {tables.map((table) => (
              <div key={table.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center font-black text-lg text-white">
                    {table.table_number}
                  </div>
                  <div className="bg-white p-1.5 rounded-lg shadow-sm">
                    <QRCodeSVG value={`${appBaseUrl}/t/${table.qr_token}`} size={42} />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    const newNum = prompt("Enter new table number:", table.table_number);
                    if (newNum) {
                      setEditValue(newNum);
                      handleSaveEdit(table.id);
                    }
                  }} className="p-2.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteTable(table)} className="p-2.5 hover:bg-rose-950 text-rose-400 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {tables.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                <TableIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No tables configured yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Detail Modal */}
      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-md sm:rounded-3xl p-0 overflow-hidden border border-slate-800 bg-slate-900 text-white">
          {selectedTable && (
            <>
              <div className={cn(
                "p-6 text-white relative overflow-hidden",
                tableOrder ? "bg-gradient-to-br from-amber-600 to-amber-800" : "bg-gradient-to-br from-emerald-600 to-emerald-800"
              )}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <TableIcon className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-4xl font-black mb-1">Table {selectedTable.table_number}</h2>
                  <p className="text-white/80 font-medium uppercase tracking-widest text-xs">
                    {tableOrder ? 'Occupied' : 'Available'}
                  </p>
                </div>
              </div>
              
              <div className="p-6 bg-slate-900 text-white">
                {tableOrder ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Receipt className="w-3 h-3 text-emerald-400"/> Order ID</p>
                        <p className="font-mono text-sm font-bold text-white">#{tableOrder.id.slice(0,8).toUpperCase()}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400"/> Wait Time</p>
                        <p className="font-mono text-sm font-bold text-white">{getWaitTime(tableOrder.created_at)} min</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1 flex items-center gap-1"><Utensils className="w-3 h-3 text-sky-400"/> Status</p>
                        <p className="font-mono text-sm font-bold uppercase text-amber-400">{tableOrder.status}</p>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                        <p className="text-xs text-slate-400 font-bold uppercase mb-1">Total</p>
                        <p className="font-mono text-sm font-bold text-emerald-400">RM {tableOrder.total_amount.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-4">
                      <a href="/orders" className="w-full text-center bg-slate-800 text-slate-200 hover:text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors">
                        View Orders Page
                      </a>
                      {tableOrder.status !== 'ready' && (
                        <button onClick={() => handleMarkReady(tableOrder.id)} className="w-full bg-amber-500 text-slate-950 font-black py-3 rounded-xl hover:bg-amber-400 transition-colors">
                          Mark Ready
                        </button>
                      )}
                      <button onClick={() => handleCloseTable(tableOrder.id)} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-500/20">
                        Complete Order & Close Table
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 text-center">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-3 tracking-widest">Digital Menu QR Code</p>
                      <div className="bg-white p-3 rounded-xl shadow-md mb-4">
                        <QRCodeSVG value={`${appBaseUrl}/t/${selectedTable.qr_token}`} size={160} />
                      </div>
                      <p className="text-xs text-slate-400 font-mono">Scan for customer self-ordering</p>
                    </div>
                    
                    <a href={`/t/${selectedTable.qr_token}`} target="_blank" rel="noreferrer" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black transition-colors shadow-md">
                      Open Digital Menu
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* REOPEN REGISTER MODAL */}
      <ReopenRegisterModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        onSuccess={fetchCashStatus}
        closedAt={closedAtTime}
      />
      </div>
    </div>
  );
}
