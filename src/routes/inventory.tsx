import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';
import { 
  Package, 
  Flame, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Minus, 
  ArrowLeft,
  Filter,
  SlidersHorizontal,
  PackageCheck,
  UtensilsCrossed,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/inventory')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: InventoryPage,
});

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  stock_count: number | null;
  low_stock_threshold: number | null;
  image_url: string | null;
  store_id?: string;
}

function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLD_OUT' | 'LOW_STOCK' | 'AVAILABLE'>('ALL');
  const [directInputValues, setDirectInputValues] = useState<Record<string, string>>({});

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, price, is_available, stock_count, low_stock_threshold, image_url, store_id')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      if (data) {
        setItems(data as InventoryItem[]);
      }
    } catch (err: any) {
      toast.error('Gagal memuatkan data inventori: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();

    // Supabase Realtime Subscription for live updates across tabs
    const channel = supabase
      .channel('inventory_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as InventoryItem;
            setItems(prev => prev.map(it => it.id === updated.id ? { ...it, ...updated } : it));
          } else if (payload.eventType === 'INSERT') {
            const newItem = payload.new as InventoryItem;
            setItems(prev => [...prev, newItem]);
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(it => it.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInventory]);

  // Categories list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(i => i.category || 'Umum'))).sort();
    return ['ALL', ...cats];
  }, [items]);

  // KPI calculations
  const totalCount = items.length;
  const soldOutCount = items.filter(it => !it.is_available || it.stock_count === 0).length;
  const lowStockCount = items.filter(it => it.is_available && it.stock_count !== null && it.stock_count > 0 && it.stock_count <= (it.low_stock_threshold || 5)).length;
  const availableCount = totalCount - soldOutCount;

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Category filter
      if (selectedCategory !== 'ALL' && (item.category || 'Umum') !== selectedCategory) {
        return false;
      }

      const isSoldOut = !item.is_available || item.stock_count === 0;
      const threshold = item.low_stock_threshold || 5;
      const isLow = item.is_available && item.stock_count !== null && item.stock_count > 0 && item.stock_count <= threshold;

      // Status filter
      if (statusFilter === 'SOLD_OUT' && !isSoldOut) return false;
      if (statusFilter === 'LOW_STOCK' && !isLow) return false;
      if (statusFilter === 'AVAILABLE' && isSoldOut) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = (item.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }

      return true;
    });
  }, [items, selectedCategory, statusFilter, searchQuery]);

  // 1-Click Toggle Availability (86 / Sold Out)
  const toggleItemAvailability = async (item: InventoryItem) => {
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
        toast.success(`"${item.name}" kini DITANDAKAN ADA!`);
      } else {
        toast.error(`"${item.name}" kini DITANDAKAN HABIS (86 / Sold Out)!`);
      }
    } catch (err: any) {
      toast.error('Gagal mengemas kini status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Adjust stock count (+ / -)
  const adjustStock = async (item: InventoryItem, delta: number) => {
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
    } catch (err: any) {
      toast.error('Gagal mengemas kini kuantiti: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Set direct quantity
  const handleSaveDirectQuantity = async (item: InventoryItem) => {
    const rawVal = directInputValues[item.id];
    if (rawVal === undefined || rawVal === '') return;

    const parsed = parseInt(rawVal, 10);
    if (isNaN(parsed) || parsed < 0) {
      toast.error('Sila masukkan nombor kuantiti yang sah (0 atau lebih).');
      return;
    }

    setUpdatingId(item.id);
    try {
      const newAvailable = parsed > 0;
      const { error } = await supabase
        .from('menu_items')
        .update({
          stock_count: parsed,
          is_available: newAvailable
        })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(it => it.id === item.id ? {
        ...it,
        stock_count: parsed,
        is_available: newAvailable
      } : it));

      // Clear draft
      setDirectInputValues(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      toast.success(`Kuantiti untuk "${item.name}" dikemas kini ke ${parsed}.`);
    } catch (err: any) {
      toast.error('Gagal menyimpan kuantiti: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Set unlimited stock (null)
  const setUnlimitedStock = async (item: InventoryItem) => {
    setUpdatingId(item.id);
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({
          stock_count: null,
          is_available: true
        })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(it => it.id === item.id ? {
        ...it,
        stock_count: null,
        is_available: true
      } : it));

      toast.success(`"${item.name}" kini ditetapkan kepada Tanpa Had (∞).`);
    } catch (err: any) {
      toast.error('Gagal menetapkan tanpa had: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-slate-900 pb-20">
      {/* TOP HEADER */}
      <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/counter"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200/80 shadow-2xs"
              title="Kembali ke Kaunter"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Pengurusan Inventori & Kawalan Stok (86)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Kawal status ketersediaan lauk, baki unit fizikal, dan pantau hidangan hampir habis dalam masa nyata
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/counter"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
            >
              🛒 <span>Ke Kaunter POS</span>
            </Link>
            <Link
              to="/menu"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
            >
              🍱 <span>Urus Menu</span>
            </Link>
            <button
              onClick={fetchInventory}
              disabled={loading}
              className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-all shadow-2xs active:scale-95 cursor-pointer"
              title="Muat Semula Senarai"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* TOTAL */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Jumlah Hidangan
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
                {totalCount}
              </span>
            </div>
          </div>

          {/* AVAILABLE */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Sedang Ada
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-heading">
                {availableCount}
              </span>
            </div>
          </div>

          {/* SOLD OUT (86) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Habis (86 / Sold Out)
              </span>
              <span className="text-xl sm:text-2xl font-black text-rose-700 font-heading">
                {soldOutCount}
              </span>
            </div>
          </div>

          {/* LOW STOCK */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Baki Rendah (&le; 5)
              </span>
              <span className="text-xl sm:text-2xl font-black text-amber-700 font-heading">
                {lowStockCount}
              </span>
            </div>
          </div>
        </div>

        {/* CONTROLS BAR: SEARCH, STATUS FILTER, CATEGORIES */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* SEARCH */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari hidangan untuk semak stok..."
                className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium"
              />
            </div>

            {/* STATUS FILTER PILLS */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/90'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('SOLD_OUT')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'SOLD_OUT'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                🔴 Habis (86) ({soldOutCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('LOW_STOCK')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'LOW_STOCK'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                ⚠️ Baki Rendah ({lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('AVAILABLE')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                🟢 Tersedia ({availableCount})
              </button>
            </div>
          </div>

          {/* CATEGORY TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-2 border-t border-slate-100">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-orange-100 text-orange-950 border border-orange-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* INVENTORY TABLE / LIST */}
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-[#fbfbfa] flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Senarai Hidangan ({filteredItems.length} dijumpai)
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Kemas kini automatik disegerakkan dengan pangkalan data
            </span>
          </div>

          {loading && items.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-orange-500" />
              <p className="text-xs font-medium">Memuatkan data inventori...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <PackageCheck className="w-12 h-12 mx-auto mb-2 text-slate-300 stroke-1" />
              <p className="text-sm font-bold text-slate-600">Tiada hidangan sepadan dengan carian / penapis.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); setStatusFilter('ALL'); }}
                className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                Set Semula Penapis
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map(item => {
                const isSoldOut = !item.is_available || item.stock_count === 0;
                const threshold = item.low_stock_threshold || 5;
                const isLow = !isSoldOut && item.stock_count !== null && item.stock_count <= threshold;
                const isUpdating = updatingId === item.id;
                const draftVal = directInputValues[item.id] ?? '';

                return (
                  <div
                    key={item.id}
                    className={`p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isSoldOut
                        ? 'bg-rose-50/40 hover:bg-rose-50/70'
                        : isLow
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* LEFT: IMAGE & DETAILS */}
                    <div className="flex items-center gap-3.5 min-w-[280px]">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <UtensilsCrossed className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900 tracking-tight">
                            {item.name}
                          </h3>
                          {isSoldOut ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                              86 / HABIS
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                              BAKI RENDAH
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              TERSEDIA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {item.category || 'Umum'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs font-black font-mono text-slate-800">
                            RM {item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* MIDDLE: STOCK QUANTITY MANAGEMENT */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Kuantiti:
                        </span>

                        {/* +/- QUICK CONTROLLER */}
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
                          <button
                            type="button"
                            disabled={isUpdating || item.stock_count === 0}
                            onClick={() => adjustStock(item, -1)}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
                            title="Tolak 1 unit"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          
                          <span className="w-14 text-center font-mono font-black text-sm text-slate-900">
                            {item.stock_count === null ? '∞' : item.stock_count}
                          </span>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => adjustStock(item, 1)}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition-all disabled:opacity-40 cursor-pointer shadow-2xs"
                            title="Tambah 1 unit"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* DIRECT INPUT BOX FOR SPECIFIC COUNT */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={draftVal}
                          onChange={(e) => setDirectInputValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Tetap unit..."
                          className="w-24 h-9 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                        {draftVal !== '' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleSaveDirectQuantity(item)}
                            className="px-2.5 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-2xs cursor-pointer"
                          >
                            Simpan
                          </button>
                        )}
                      </div>

                      {/* UNLIMITED BUTTON */}
                      {item.stock_count !== null && (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => setUnlimitedStock(item)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                          title="Tetapkan stok hidangan ini kepada Tanpa Had (Sentiasa Ada)"
                        >
                          Jadikan Tanpa Had (∞)
                        </button>
                      )}
                    </div>

                    {/* RIGHT: 1-CLICK 86 / SOLD OUT TOGGLE */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => toggleItemAvailability(item)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 cursor-pointer shadow-2xs border ${
                          isSoldOut
                            ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${isSoldOut ? 'bg-white animate-pulse' : 'bg-white'}`} />
                        <span>{isSoldOut ? 'TANDAKAN ADA' : '86 / SOLD OUT'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
