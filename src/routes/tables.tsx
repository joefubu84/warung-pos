import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Table as TableIcon,
  QrCode,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { requireStaffAuth } from '@/lib/auth-guard';

// --- 21st.dev Inspired Components (Simulated MCP fetch) ---

const Badge = ({ children, variant = 'default', className }: { 
  children: React.ReactNode; 
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}) => {
  const variants = {
    default: 'bg-muted text-muted-foreground border-border',
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    error: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-card border border-border/50 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden", className)}>
    {children}
  </div>
);

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

function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [appBaseUrl, setAppBaseUrl] = useState('');

  useEffect(() => {
    // We use the stable preview/production domain provided by the environment 
    // or fallback to window.location.origin
    const origin = window.location.origin.replace("-preview--", "--");
    setAppBaseUrl(origin);
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('table_number', { ascending: true });

    if (error) {
      toast.error('Failed to fetch tables');
    } else {
      setTables(data as Table[]);
    }
    setIsLoading(false);
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
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', table.id);

      if (error) {
        toast.error('Failed to delete table');
      } else {
        setTables(tables.filter(t => t.id !== table.id));
        toast.success('Table deleted');
      }
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: TableStatus) => {
    const { error } = await supabase
      .from('tables')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
    } else {
      setTables(tables.map(t => t.id === id ? { ...t, status: newStatus } : t));
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    const { error } = await supabase
      .from('tables')
      .update({ table_number: editValue })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update table number');
    } else {
      setTables(tables.map(t => t.id === id ? { ...t, table_number: editValue } : t));
      setEditingId(null);
      toast.success('Table updated');
    }
  };

  return (
    <div className="p-8">
      <form onSubmit={handleAddTable} className="mb-8 flex gap-2">
        <input
          type="text"
          value={newTableNumber}
          onChange={(e) => setNewTableNumber(e.target.value)}
          placeholder="Table number"
          className="border p-2 rounded"
          disabled={isAdding}
        />
        <button 
          type="submit" 
          className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50"
          disabled={isAdding}
        >
          {isAdding ? 'Adding...' : 'Add Table'}
        </button>
      </form>

      {isLoading ? (
        <p>Loading...</p>
      ) : tables.length === 0 ? (
        <p>No tables yet</p>
      ) : (
        <div className="space-y-1">
          {tables.map((table) => (
            <div key={table.id} className="text-sm font-mono flex items-center gap-2">
              {editingId === table.id ? (
                <>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="border p-1 rounded"
                  />
                  <button onClick={() => handleSaveEdit(table.id)} className="underline">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="underline">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span>{table.table_number}</span>
                  <select 
                    value={table.status} 
                    onChange={(e) => handleUpdateStatus(table.id, e.target.value as TableStatus)}
                    className="border rounded p-0.5"
                  >
                    <option value="available">available</option>
                    <option value="occupied">occupied</option>
                    <option value="reserved">reserved</option>
                  </select>
                  <div className="bg-white p-1 border inline-block">
                    <QRCodeSVG 
                      value={`${appBaseUrl}/t/${table.qr_token}`} 
                      size={48}
                    />
                  </div>
                  <button
                    onClick={() => {
                      setEditingId(table.id);
                      setEditValue(table.table_number);
                    }}
                    className="underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDeleteTable(table)} className="underline">
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
