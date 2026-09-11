import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogClose 
} from '@/components/ui/dialog';
import { 
  Search, 
  Flame, 
  Check, 
  X, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink,
  Plus,
  Minus,
  PackageCheck
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';

export interface StockItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  stock_count: number | null;
  image_url: string | null;
}

interface QuickStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated?: () => void;
}

export const QuickStockModal = React.memo(function QuickStockModal({ 
  isOpen, 
  onClose, 
  onItemUpdated 
}: QuickStockModalProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sold_out' | 'available'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchStockItems();
    }
  }, [isOpen]);

  const fetchStockItems = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const soldOutCount = items.filter(it => !it.is_available || it.stock_count === 0).length;
  const lowStockCount = items.filter(it => it.stock_count !== null && it.stock_count > 0 && it.stock_count <= 5).length;

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const isSoldOut = !it.is_available || itemIsSoldOut(it);
      if (filterType === 'sold_out' && !isSoldOut) return false;
      if (filterType === 'available' && isSoldOut) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return it.name.toLowerCase().includes(q) || (it.category && it.category.toLowerCase().includes(q));
    });
  }, [items, searchTerm, filterType]);

  function itemIsSoldOut(it: StockItem) {
    return !it.is_available || it.stock_count === 0;
  }

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
        toast.success(`${item.name} kini DITANDAKAN ADA!`);
      } else {
        toast.error(`${item.name} kini DITANDAKAN HABIS (86 / Sold Out)!`);
      }

      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      toast.error('Gagal mengemas kini status stok: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const adjustStockCount = async (item: StockItem, delta: number) => {
    const current = item.stock_count === null ? 10 : item.stock_count;
    const newCount = Math.max(0, current + delta);
    const newAvailable = newCount > 0;

    setUpdatingId(item.id);
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ 
          stock_count: newCount,
          is_available: newAvailable
        })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(it => it.id === item.id ? { 
        ...it, 
        stock_count: newCount,
        is_available: newAvailable
      } : it));

      if (onItemUpdated) onItemUpdated();
    } catch (err: any) {
      toast.error('Gagal mengemas kini kuantiti: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border border-slate-200/90 rounded-3xl shadow-2xl">
        {/* HEADER */}
        <div className="p-5 border-b border-slate-100 bg-[#fbfbfa] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center font-black shadow-xs shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Pantau Stok Pantas (86 / Sold Out)
                {soldOutCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                    {soldOutCount} Habis
                  </span>
                )}
                {lowStockCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                    {lowStockCount} Hampir Habis
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                1-Klik untuk buka atau tutup hidangan tanpa mengganggu pesanan semasa di kaunter
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/inventory"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-orange-800 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-all active:scale-95 shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-orange-600" />
              <span className="hidden sm:inline">Halaman Inventori</span>
            </Link>
            <DialogClose className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </div>

        {/* SEARCH & FILTERS TOOLBAR */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama makanan atau kategori..."
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'all' 
                  ? 'bg-slate-900 text-white shadow-2xs' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/90'
              }`}
            >
              Semua ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('sold_out')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'sold_out' 
                  ? 'bg-rose-600 text-white shadow-2xs' 
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              Habis ({soldOutCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('available')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'available' 
                  ? 'bg-emerald-600 text-white shadow-2xs' 
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              Ada ({items.length - soldOutCount})
            </button>
            <button
              type="button"
              onClick={fetchStockItems}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
              title="Muat semula senarai stok"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ITEMS LIST (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium">
              <PackageCheck className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-sm">Tiada hidangan dijumpai.</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const isSoldOut = !item.is_available || item.stock_count === 0;
              const isLow = !isSoldOut && item.stock_count !== null && item.stock_count <= 5;
              const isUpdating = updatingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                    isSoldOut 
                      ? 'bg-rose-50/60 border-rose-200/90' 
                      : isLow
                      ? 'bg-amber-50/50 border-amber-200/80'
                      : 'bg-white border-slate-200/80 hover:border-orange-200 shadow-2xs'
                  }`}
                >
                  {/* LEFT: INFO */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-black text-slate-400 uppercase">
                          {item.name.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
                        {item.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          {item.category}
                        </span>
                        <span className="text-[11px] font-bold font-mono text-slate-700">
                          RM {item.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MIDDLE: QUANTITY CONTROLLER */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                      Baki:
                    </span>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                      <button
                        type="button"
                        disabled={isUpdating || item.stock_count === 0}
                        onClick={() => adjustStockCount(item, -1)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                        title="Tolak 1 unit"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-12 text-center text-xs font-mono font-black text-slate-900">
                        {item.stock_count === null ? '∞' : item.stock_count}
                      </span>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => adjustStockCount(item, 1)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
                        title="Tambah 1 unit"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* RIGHT: 1-CLICK TOGGLE STATUS BUTTON */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => toggleAvailability(item)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-2xs border ${
                        isSoldOut
                          ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSoldOut ? 'bg-white animate-pulse' : 'bg-white'}`} />
                      <span>{isSoldOut ? 'HABIS (86)' : 'SEDANG ADA'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3.5 border-t border-slate-100 bg-[#fbfbfa] flex items-center justify-between text-xs text-slate-500 font-medium px-5">
          <span>Perubahan status akan dipaparkan secara langsung di Kaunter, Kitchen KDS, dan Menu Digital QR pelanggan.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
          >
            Tutup & Sambung POS
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
