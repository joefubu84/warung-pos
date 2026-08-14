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
import { requireStaffAuth } from '@/lib/auth-guard';
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
    return await requireStaffAuth(location, context.auth);
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
        "p-4 rounded-2xl border text-left flex flex-col h-32 relative overflow-hidden transition-all duration-300 ease-in-out",
        isOccupied 
          ? "bg-rose-50 border-rose-200" 
          : "bg-emerald-50 border-emerald-200"
      )}
    >
      <div className="flex justify-between items-start w-full">
        <span className={cn("text-2xl font-black transition-colors duration-300", isOccupied ? "text-rose-900" : "text-emerald-900")}>
          {table.table_number}
        </span>
        <div className={cn("w-3 h-3 rounded-full transition-colors duration-300", isOccupied ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
      </div>
      
      <div className="mt-auto">
        {isOccupied ? (
          <>
            <p className="text-xs font-bold text-rose-700 uppercase">Occupied</p>
            <p className="text-[10px] text-rose-600 font-mono">#{activeOrder.id.slice(0,8).toUpperCase()}</p>
          </>
        ) : (
          <p className="text-xs font-bold text-emerald-700 uppercase">Available</p>
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

  useEffect(() => {
    const origin = window.location.origin.replace("-preview--", "--");
    setAppBaseUrl(origin);
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Table Management</h1>
          <p className="text-muted-foreground">Monitor and manage dine-in tables</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('grid')}
            className={cn("px-6 py-2 rounded-lg text-sm font-semibold transition-all", activeTab === 'grid' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Live Grid
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={cn("px-6 py-2 rounded-lg text-sm font-semibold transition-all", activeTab === 'manage' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
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
        <div className="bg-card border rounded-2xl p-6">
          <form onSubmit={handleAddTable} className="mb-8 flex gap-2 max-w-sm">
            <input
              type="text"
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              placeholder="New table number (e.g. A1)"
              className="border px-4 py-2 rounded-xl flex-1 text-sm font-medium focus:ring-2 focus:ring-primary outline-none transition-all"
              disabled={isAdding}
            />
            <button 
              type="submit" 
              className="bg-primary text-primary-foreground px-6 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              disabled={isAdding}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>

          <div className="space-y-3">
            {tables.map((table) => (
              <div key={table.id} className="flex items-center justify-between p-4 bg-muted/30 border rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-background border rounded-lg flex items-center justify-center font-black text-lg">
                    {table.table_number}
                  </div>
                  <div className="bg-white p-1 rounded shadow-sm">
                    <QRCodeSVG value={`${appBaseUrl}/t/${table.qr_token}`} size={40} />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    const newNum = prompt("Enter new table number:", table.table_number);
                    if (newNum) {
                      setEditValue(newNum);
                      handleSaveEdit(table.id);
                    }
                  }} className="p-2 hover:bg-black/5 rounded-lg text-muted-foreground transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteTable(table)} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors">
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
        <DialogContent className="max-w-md sm:rounded-3xl p-0 overflow-hidden border-0">
          {selectedTable && (
            <>
              <div className={cn(
                "p-6 text-white relative overflow-hidden",
                tableOrder ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"
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
              
              <div className="p-6 bg-background">
                {tableOrder ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted rounded-xl p-4">
                        <p className="text-xs text-muted-foreground font-bold uppercase mb-1 flex items-center gap-1"><Receipt className="w-3 h-3"/> Order ID</p>
                        <p className="font-mono text-sm font-medium">#{tableOrder.id.slice(0,8).toUpperCase()}</p>
                      </div>
                      <div className="bg-muted rounded-xl p-4">
                        <p className="text-xs text-muted-foreground font-bold uppercase mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Wait Time</p>
                        <p className="font-mono text-sm font-medium">{getWaitTime(tableOrder.created_at)} min</p>
                      </div>
                      <div className="bg-muted rounded-xl p-4">
                        <p className="text-xs text-muted-foreground font-bold uppercase mb-1 flex items-center gap-1"><Utensils className="w-3 h-3"/> Status</p>
                        <p className="font-mono text-sm font-medium uppercase text-rose-500">{tableOrder.status}</p>
                      </div>
                      <div className="bg-muted rounded-xl p-4">
                        <p className="text-xs text-muted-foreground font-bold uppercase mb-1">Total</p>
                        <p className="font-mono text-sm font-medium">RM {tableOrder.total_amount.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-4">
                      <a href="/orders" className="w-full text-center bg-secondary text-secondary-foreground py-3 rounded-xl font-bold hover:bg-secondary/80 transition-colors">
                        View Orders Page
                      </a>
                      {tableOrder.status !== 'ready' && (
                        <button onClick={() => handleMarkReady(tableOrder.id)} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold hover:bg-amber-600 transition-colors">
                          Mark Ready
                        </button>
                      )}
                      <button onClick={() => handleCloseTable(tableOrder.id)} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20">
                        Complete Order & Close Table
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <QrCode className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="mb-2">This table is currently free.</p>
                    <p className="text-sm">Customers can scan the QR code to begin ordering.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
