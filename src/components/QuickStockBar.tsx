import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Flame, Check, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface StockItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  stock_count: number | null;
  image_url: string | null;
}

export function QuickStockBar({ onItemUpdated }: { onItemUpdated?: () => void }) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStockItems();
  }, []);

  const fetchStockItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, price, is_available, stock_count, image_url')
        .order('name', { ascending: true });

      if (!error && data) {
        setItems(data as StockItem[]);
      }
    } catch (e) {
      console.error('Failed to load stock items:', e);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items.slice(0, 8);
    const q = searchTerm.toLowerCase();
    return items.filter(it => it.name.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q)));
  }, [items, searchTerm]);

  const soldOutCount = items.filter(it => !it.is_available || it.stock_count === 0).length;

  const toggleAvailability = async (item: StockItem) => {
    const newAvailable = !item.is_available;
    setUpdatingId(item.id);

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ 
          is_available: newAvailable,
          stock_count: newAvailable ? (item.stock_count === 0 ? null : item.stock_count) : 0
        })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(it => it.id === item.id ? { 
        ...it, 
        is_available: newAvailable,
        stock_count: newAvailable ? (it.stock_count === 0 ? null : it.stock_count) : 0 
      } : it));

      if (newAvailable) {
        toast.success(item.name + ' kini DITANDAKAN ADA!');
      } else {
        toast.error(item.name + ' kini DITANDAKAN HABIS (86 / Sold Out)!');
      }

      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      toast.error('Gagal mengemas kini status stok: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center font-black text-xs">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
              Pantau Stok Cepat (86 / Sold Out)
              {soldOutCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {soldOutCount} Habis
                </span>
              )}
            </span>
            <p className="text-[10px] text-slate-400">1-Klik untuk buka atau tutup hidangan yang kehabisan ramuan</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari hidangan untuk tukar status stok..."
              className="w-full h-8 pl-8 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="button"
            onClick={fetchStockItems}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Muat semula senarai stok"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* QUICK ITEMS ROW */}
      <div className="mt-3 flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
        {filteredItems.map(item => {
          const isSoldOut = !item.is_available || item.stock_count === 0;
          const isUpdating = updatingId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              disabled={isUpdating}
              onClick={() => toggleAvailability(item)}
              className={'flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ' + (
                isSoldOut
                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-900/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              )}
            >
              <span className={'w-2 h-2 rounded-full shrink-0 ' + (isSoldOut ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400')} />
              <span className="truncate max-w-[140px]">{item.name}</span>
              <span className={'text-[10px] px-1.5 py-0.2 rounded font-black ' + (
                isSoldOut ? 'bg-rose-900 text-rose-200' : 'bg-slate-800 text-slate-400'
              )}>
                {isSoldOut ? 'HABIS' : 'ADA'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
