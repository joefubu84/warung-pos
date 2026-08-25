import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { requireOrderingAuth } from '@/lib/auth-guard';
import { getTodayCashStatus, CashStatus } from '@/lib/cash-guard';
import { ReopenRegisterModal } from '@/components/ReopenRegisterModal';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Minus, Search, Trash2, ShoppingCart, CheckCircle2, Lock, Unlock, AlertTriangle, Split, Globe, Radio } from "lucide-react";
import { COMMON_MODIFIERS, detectModifierBadges } from "@/lib/kitchen-checklist-config";
import { toast } from 'sonner';

export const Route = createFileRoute('/counter')({
  ssr: false,
  beforeLoad: async ({ context, location }: any) => {
    return await requireOrderingAuth(location, context.auth);
  },
  component: CounterPage,
});

interface Table {
  id: string;
  table_number: string;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  stock_count?: number | null;
  image_url?: string | null;
}

interface CartItem {
  id: string; // temp id for list rendering
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  fulfillmentType: 'dine_in' | 'takeaway';
  containerSize?: 'small' | 'large' | null;
  containerCharge?: number;
  notes?: string;
}

function CounterPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Pos states
  const [searchMenuQuery, setSearchMenuQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Cart states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway'>('dine_in');
  
// Submission
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Phase 2: Discount & Split Payment
  const [discount, setDiscount] = useState<{type: 'fixed'|'percentage', value: number}>({ type: 'fixed', value: 0 });
  const [splitPayments, setSplitPayments] = useState<{amount: number, method: 'cash'|'card'|'qr'|'bank_transfer'}[]>([]);
  const [paymentMode, setPaymentMode] = useState<'full' | 'split'>('full');

const addSplitPayment = () => {
    setSplitPayments([...splitPayments, { amount: 0, method: 'cash' }]);
  };

  const updateSplitPayment = (index: number, field: 'amount' | 'method', value: any) => {
    const newSplits = [...splitPayments];
    const updated = { ...newSplits[index] };
    if (field === 'amount') updated.amount = Number(value) || 0;
    if (field === 'method') updated.method = value;
    newSplits[index] = updated as { amount: number; method: 'cash' | 'card' | 'qr' | 'bank_transfer' };
    setSplitPayments(newSplits);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };
  
  const totalSplitAmount = splitPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
  
  const cartTotal = cart.reduce((sum, item) => sum + ((item.price + (item.containerCharge || 0)) * item.quantity), 0);
  
  const rawDiscount = discount.type === 'percentage' 
    ? cartTotal * (discount.value / 100)
    : discount.value;
  const effectiveDiscount = Math.min(Math.max(0, rawDiscount), cartTotal);
  const finalTotal = cartTotal - effectiveDiscount;

  // Use cent-math for reliable split payment matching
  const toCents = (n: number) => Math.round(n * 100);
  const finalCents = toCents(finalTotal);
  const splitCents = splitPayments.reduce((s, sp) => s + toCents(Number(sp.amount) || 0), 0);
  const splitDeltaCents = splitCents - finalCents; // >0 over, <0 under, 0 exact
  const isSplitBalanced = splitDeltaCents === 0;

  const beepAudio = useRef<HTMLAudioElement | null>(null);
  const { storeId } = Route.useRouteContext();
  const [cashStatus, setCashStatus] = useState<CashStatus>('OPEN');
  const [closedAtTime, setClosedAtTime] = useState<string | null>(null);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [showDuitNowModal, setShowDuitNowModal] = useState(false);
  const [isOnlineOrderingEnabled, setIsOnlineOrderingEnabled] = useState<boolean>(true);
  const [isUpdatingOnlineStatus, setIsUpdatingOnlineStatus] = useState<boolean>(false);

  const fetchCashStatus = useCallback(async () => {
    const res = await getTodayCashStatus(storeId);
    setCashStatus(res.status);
    setClosedAtTime(res.closedAt);
  }, [storeId]);

  const fetchStoreSettings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('stores')
        .select('id, settings')
        .eq('id', storeId)
        .maybeSingle();

      if (data) {
        const settings = (data.settings as any) || {};
        setIsOnlineOrderingEnabled(settings.online_ordering_enabled !== false);
      }
    } catch (e) {
      console.warn('Failed to fetch store settings:', e);
    }
  }, [storeId]);

  const handleToggleOnlineOrders = async () => {
    if (!storeId) return;
    setIsUpdatingOnlineStatus(true);
    const newStatus = !isOnlineOrderingEnabled;
    try {
      const { data: currentStore } = await supabase
        .from('stores')
        .select('settings')
        .eq('id', storeId)
        .single();

      const existingSettings = (currentStore?.settings as any) || {};
      const { error } = await supabase
        .from('stores')
        .update({
          settings: {
            ...existingSettings,
            online_ordering_enabled: newStatus
          }
        })
        .eq('id', storeId);

      if (error) throw error;
      setIsOnlineOrderingEnabled(newStatus);
      if (newStatus) {
        toast.success('🟢 Pesanan Online kini DIBUKA (Delivery & Meja QR Aktif)!');
      } else {
        toast.error('🔴 Pesanan Online kini DITUTUP (Pesanan pelanggan disekat).');
      }
    } catch (err: any) {
      console.error('Failed to toggle online ordering status:', err);
      toast.error('Gagal mengemas kini status pesanan online.');
    } finally {
      setIsUpdatingOnlineStatus(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
    fetchCashStatus();
    fetchStoreSettings();
    beepAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');

    const cashChannel = supabase.channel(`counter_cash_guard_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_cash' }, () => {
        fetchCashStatus();
      })
      .subscribe();

    const storeChannel = supabase.channel(`counter_store_settings_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => {
        fetchStoreSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cashChannel);
      supabase.removeChannel(storeChannel);
    };
  }, [fetchCashStatus, fetchStoreSettings]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    await Promise.all([fetchTables(), fetchMenuItems()]);
    setIsLoading(false);
  };

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('table_number', { ascending: true });
    
    if (!error && data) {
      setTables(data as Table[]);
    }
  };

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, price, category, stock_count, image_url')
      .eq('is_available', true)
      .order('name', { ascending: true });
    
    if (!error && data) {
      setMenuItems(data as MenuItem[]);
    }
  };

  const playBeep = () => {
    if (beepAudio.current) {
      beepAudio.current.currentTime = 0;
      beepAudio.current.play().catch((e: any) => console.log('Audio play failed:', e));
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (cashStatus === 'CLOSED') {
      alert("Counter is CLOSED for the day. New orders are locked.");
      return;
    }
    if (item.stock_count !== undefined && item.stock_count !== null && item.stock_count <= 0) {
      return; // Sold out
    }

    playBeep();

    // Check if item already exists in cart with same fulfillment type
    const existingIndex = cart.findIndex(c => c.menuItemId === item.id && c.fulfillmentType === orderType && c.notes === '');
    
    if (existingIndex >= 0) {
      const newCart = [...cart];
      const itemToUpdate = newCart[existingIndex];
      if (itemToUpdate) {
        itemToUpdate.quantity += 1;
        setCart(newCart);
      }
    } else {
      const newItem: CartItem = {
        id: Math.random().toString(36).substr(2, 9),
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        fulfillmentType: orderType,
        containerCharge: 0,
        notes: ''
      };
      setCart([...cart, newItem]);
    }
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    if (cashStatus === 'CLOSED') return;
    setCart(cart.map(item => {
      if (item.id === cartItemId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateCartItemNotes = (cartItemId: string, notes: string) => {
    setCart(cart.map(item => item.id === cartItemId ? { ...item, notes: notes.slice(0, 100) } : item));
  };

  const toggleQuickModifier = (cartItemId: string, tag: string) => {
    setCart(cart.map(item => {
      if (item.id === cartItemId) {
        const currentNotes = (item.notes || '').trim();
        let newNotes = currentNotes;
        if (currentNotes.toLowerCase().includes(tag.toLowerCase())) {
          newNotes = currentNotes.replace(new RegExp(tag, 'gi'), '').replace(/,\s*,/g, ',').trim();
        } else {
          newNotes = currentNotes ? `${currentNotes}, ${tag}` : tag;
        }
        return { ...item, notes: newNotes.slice(0, 100) };
      }
      return item;
    }));
  };

  const splitCartItem = (cartItemId: string) => {
    const targetItem = cart.find(c => c.id === cartItemId);
    if (!targetItem || targetItem.quantity <= 1) return;

    const qty = targetItem.quantity;
    const itemIndex = cart.findIndex(c => c.id === cartItemId);
    
    const individualItems: CartItem[] = Array.from({ length: qty }).map((_, idx) => ({
      ...targetItem,
      id: Math.random().toString(36).substr(2, 9),
      quantity: 1,
      notes: targetItem.notes ? `${targetItem.notes} (Pek #${idx + 1})` : ''
    }));

    const nextCart = [...cart];
    nextCart.splice(itemIndex, 1, ...individualItems);
    setCart(nextCart);
  };


  const toggleCartItemFulfillment = (cartItemId: string) => {
    setCart(cart.map(item => {
      if (item.id === cartItemId) {
        const isNowTakeaway = item.fulfillmentType === 'dine_in';
        return { 
          ...item, 
          fulfillmentType: isNowTakeaway ? 'takeaway' : 'dine_in',
          containerSize: isNowTakeaway ? 'small' : null,
          containerCharge: isNowTakeaway ? 0 : 0
        };
      }
      return item;
    }));
  };

  const updateCartItemContainerSize = (cartItemId: string, size: 'small' | 'large') => {
    setCart(cart.map(item => item.id === cartItemId ? { 
      ...item, 
      containerSize: size,
      containerCharge: size === 'large' ? 1.00 : 0
    } : item));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.id !== cartItemId));
  };

  const clearCart = () => {
    if (window.confirm('Clear all items from cart?')) {
      setCart([]);
      setCustomerName('');
      setSelectedTableId('');
    }
  };


  const getCategoryPriority = (category: string): number => {
    const cat = (category || '').toLowerCase().trim();
    if (cat === 'all') return 0;
    if (cat.includes('chicken') || cat.includes('ayam')) return 1;
    if (cat.includes('fish') || cat.includes('ikan')) return 2;
    if (cat.includes('special') || cat.includes('today')) return 3;
    if (cat.includes('food') || cat.includes('main') || cat.includes('makanan')) return 4;
    if (cat.includes('new') || cat.includes('baru')) return 5;
    if (cat.includes('drink') || cat.includes('minum') || cat.includes('beverage')) return 8;
    if (cat.includes('addon') || cat.includes('add-on') || cat.includes('sampingan') || cat.includes('extra')) return 9;
    return 6;
  };

  const rawCats = Array.from(new Set(menuItems.map(m => m.category || 'Uncategorized'))).sort((a, b) => {
    const prioA = getCategoryPriority(a);
    const prioB = getCategoryPriority(b);
    if (prioA !== prioB) return prioA - prioB;
    return a.localeCompare(b);
  });
  const categories = ['All', ...rawCats];

  const filteredMenu = menuItems.filter(item => {
    if (selectedCategory !== 'All' && (item.category || 'Uncategorized') !== selectedCategory) return false;
    if (searchMenuQuery && !item.name.toLowerCase().includes(searchMenuQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const prioA = getCategoryPriority(a.category || '');
    const prioB = getCategoryPriority(b.category || '');
    if (prioA !== prioB) return prioA - prioB;
    return a.name.localeCompare(b.name);
  });

const handlePlaceOrderClick = () => {
    if (cashStatus === 'CLOSED') {
      setError('Counter is CLOSED for the day. Cannot place new orders.');
      return;
    }
    if (cart.length === 0) {
      setError('Cart is empty.');
      return;
    }
    if (orderType === 'dine_in' && !selectedTableId) {
      setError('Please select a table for Dine-in orders.');
      return;
    }
    setError(null);
    setDiscount({ type: 'fixed', value: 0 });
    setPaymentMode('full');
    setSplitPayments([]);
    setIsConfirmOpen(true);
  };

const handleSubmitOrder = async (paymentMethod: 'cash' | 'card' | 'unpaid' = 'unpaid') => {
    if (cashStatus === 'CLOSED') {
      setError('Counter is CLOSED for the day. Cannot place new orders.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      if (paymentMode === 'split') {
        if (splitPayments.length === 0) throw new Error('No split payments entered.');
        if (splitCents !== finalCents) throw new Error('Split total does not match final total.');
      }

      const { data: rpcRes, error: rpcError } = await supabase.rpc('place_order', {
        p_order: {
          store_id: storeId,
          type: orderType,
          table_id: selectedTableId || null,
          customer_name: customerName || null,
          discount_type: discount.type,
          discount_value: discount.value,
        },
        p_items: cart.map(item => ({
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          fulfillment_type: item.fulfillmentType,
          container_size: item.containerSize || null,
          container_charge: item.containerCharge || 0,
          notes: item.notes || ''
        })),
        p_payments:
          paymentMode === 'full'
            ? (paymentMethod === 'unpaid'
                ? []
                : [{ amount: Math.round(finalTotal * 100) / 100, payment_method: paymentMethod, paid_by: 'Counter Staff' }])
            : splitPayments.map(sp => ({ amount: Math.round(sp.amount * 100) / 100, payment_method: sp.method, paid_by: 'Counter Staff' })),
      });

      if (rpcError) throw rpcError;
      const resObj = (rpcRes as any);
      if (resObj?.success === false) {
        throw new Error(resObj.message || 'Order failed validation.');
      }

      const newOrderId = resObj?.order_id || resObj || 'order';

      // 4. Success handling
      setIsConfirmOpen(false);
      setSuccessMsg(`Order #${String(newOrderId).slice(0,8)} placed successfully!`);
      
      // Clear cart
      setCart([]);
      setSelectedTableId('');
      setCustomerName('');
      
      // Clear success msg after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-gray-100 overflow-hidden flex flex-col font-sans">
      
      {/* MOBILE WARNING OVERLAY */}
      <div className="md:hidden fixed inset-0 bg-red-600 text-white z-50 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-black mb-4">Tablet Required</h1>
        <p className="text-lg mb-8">The POS interface requires a larger screen (8+ inches) and landscape orientation to prevent ordering mistakes.</p>
        <a href="/orders" className="bg-white text-red-600 px-6 py-3 rounded-full font-bold text-lg shadow-lg">Go to Order Management</a>
      </div>

      {/* PORTRAIT WARNING (via CSS Media Query approach but done in JS logic below for simplicity, or we rely on the above if they flip a tablet? Actually, we'll just use a pure CSS portrait blocker) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media screen and (orientation: portrait) and (min-width: 768px) {
          #portrait-blocker { display: flex !important; }
          #pos-layout { display: none !important; }
        }
      `}} />

      <div id="portrait-blocker" className="hidden fixed inset-0 bg-gray-900 text-white z-50 flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl font-black mb-4">Please Rotate Device</h1>
        <p className="text-xl text-gray-300">The POS interface is locked to landscape mode.</p>
      </div>

      {/* POS LAYOUT (LANDSCAPE ONLY) */}
      <div id="pos-layout" className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* COUNTER CLOSED BANNER */}
        {cashStatus === 'CLOSED' && (
          <div className="bg-rose-950 border-b border-rose-800 p-4 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg z-30">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-600 rounded-lg text-white">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  ⛔ COUNTER IS CLOSED FOR THE DAY
                  {closedAtTime && (
                    <span className="text-xs font-mono bg-rose-900 text-rose-200 px-2.5 py-0.5 rounded border border-rose-700">
                      Closed at {new Date(closedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-rose-300">
                  The cash register shift is closed. Placing new orders is locked across all devices.
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

        {/* TOP ACTION BAR */}
        <div className={`h-16 bg-slate-900 border-b border-slate-800 px-4 flex justify-between items-center shadow-sm z-20 shrink-0 ${cashStatus === 'CLOSED' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Warung J&J Logo" className="w-9 h-9 rounded-full object-cover border border-amber-500 shadow-sm" />
            <div>
              <h1 className="text-xl font-black text-white tracking-tight leading-none">Warung J&J POS</h1>
              <span className="text-[10px] text-slate-400 font-mono">Counter Register System</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* ONLINE ORDERS LIVE TOGGLE */}
            <button
              type="button"
              onClick={handleToggleOnlineOrders}
              disabled={isUpdatingOnlineStatus}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm active:scale-95 cursor-pointer ${
                isOnlineOrderingEnabled
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70 hover:bg-emerald-900/90'
                  : 'bg-rose-950/90 text-rose-300 border-rose-500/70 hover:bg-rose-900/90 ring-2 ring-rose-500/50'
              }`}
              title="Klik untuk Buka atau Tutup Pesanan Online (Delivery & QR Order)"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnlineOrderingEnabled ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span className="font-heading tracking-tight">
                {isOnlineOrderingEnabled ? '🟢 Pesanan Online: BUKA' : '🔴 Pesanan Online: TUTUP'}
              </span>
            </button>

            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-rose-400 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 rounded-full text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Cart
            </button>
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className={`flex-1 flex overflow-hidden ${cashStatus === 'CLOSED' ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          
          {/* LEFT: MENU GRID (60%) */}
          <div className="w-[60%] bg-slate-950 flex flex-col border-r border-slate-800 relative">
            
            {/* STICKY SEARCH BAR CONTAINER */}
            <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-3 shrink-0 shadow-md">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  placeholder="Search menu items by name..."
                  value={searchMenuQuery}
                  onChange={(e) => setSearchMenuQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide shrink-0 border-b border-slate-800 bg-slate-900">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400' : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 content-start">
              {successMsg && (
                <div className="bg-emerald-950 border-l-4 border-emerald-500 text-emerald-200 p-4 mb-4 rounded-xl shadow-sm flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-24">
                {filteredMenu.map(item => {
                  const isSoldOut = item.stock_count !== undefined && item.stock_count !== null && item.stock_count <= 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      disabled={isSoldOut}
                      className={`group relative flex flex-col rounded-2xl border transition-all active:scale-95 text-left overflow-hidden shadow-md hover:shadow-2xl ${
                        isSoldOut ? 'border-slate-800 bg-slate-900/40 opacity-50 cursor-not-allowed' : 'border-slate-800 bg-slate-900 hover:border-emerald-500/60 active:border-emerald-500'
                      }`}
                    >
                      {/* BRIGHT FULL UNCROPPED DISH IMAGE */}
                      {item.image_url ? (
                        <div className="w-full h-48 md:h-52 bg-slate-950 relative overflow-hidden flex items-center justify-center p-2 border-b border-slate-800/60">
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300 rounded-xl"
                          />
                          {isSoldOut && (
                            <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center backdrop-blur-sm">
                              <span className="text-xs font-black bg-rose-600 text-white px-3 py-1.5 rounded-full shadow-lg tracking-wider uppercase font-mono">SOLD OUT</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-slate-950/80 flex items-center justify-center text-slate-600 font-mono text-xs border-b border-slate-800">
                          NO DISH IMAGE AVAILABLE
                        </div>
                      )}

                      {/* DISH TITLE & MONOSPACE PRICE */}
                      <div className="p-4 flex flex-col justify-between flex-1 space-y-3 bg-slate-900">
                        <span className="font-bold text-white text-base leading-snug line-clamp-2">{item.name}</span>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                          <span className="font-black text-emerald-400 font-mono text-lg sm:text-xl">RM{item.price.toFixed(2)}</span>
                          <span className="text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-3 py-1 rounded-lg uppercase font-mono shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            + ADD
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: CART & ACTIONS (40%) */}
          <div className="w-[40%] bg-slate-900 flex flex-col h-full overflow-hidden">
            
            {/* Order Configuration */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3">
                <button
                  onClick={() => setOrderType('dine_in')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${orderType === 'dine_in' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Dine-in
                </button>
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${orderType === 'takeaway' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Takeaway
                </button>
              </div>

              <div className="flex gap-2">
                {orderType === 'dine_in' && (
                  <select 
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 text-white rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Table *</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Table {t.table_number}</option>)}
                  </select>
                )}
                <input 
                  placeholder="Customer Name (Opt)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p className="text-base font-bold">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-md flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="pr-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mb-1">
                          <h4 className="font-bold text-white leading-tight text-sm">{item.name}</h4>
                          <button 
                            onClick={() => toggleCartItemFulfillment(item.id)}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase transition-colors self-start sm:self-auto active:scale-95 ${item.fulfillmentType === 'takeaway' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}
                          >
                            {item.fulfillmentType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine-in'}
                          </button>
                        </div>
                        <p className="text-sm font-black text-emerald-400 font-mono">RM{((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</p>
                      </div>
                      
                      {/* Qty Controls */}
                      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 shrink-0">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-800 text-slate-200 rounded hover:bg-slate-700 active:scale-95"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-white font-mono text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-800 text-slate-200 rounded hover:bg-slate-700 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input 
                        placeholder="Nota pinggan (cth: Tak nak lada, ekstra pedas)"
                        value={item.notes || ''}
                        onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 font-medium"
                      />
                      {item.quantity > 1 && (
                        <button
                          type="button"
                          onClick={() => splitCartItem(item.id)}
                          className="px-2 py-1.5 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 rounded text-[10px] font-bold flex items-center gap-1 shrink-0"
                          title="Pecahkan kepada pinggan berasingan untuk letak nota berbeza"
                        >
                          <Split className="w-3 h-3" />
                          <span>Pecah Pinggan</span>
                        </button>
                      )}
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* QUICK MODIFIER CHIPS (TAK NAK LADA, PEDAS, TIMUN, KANGKUNG) */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {COMMON_MODIFIERS.slice(0, 5).map(mod => {
                        const isSelected = (item.notes || '').toLowerCase().includes(mod.tag);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => toggleQuickModifier(item.id, mod.tag)}
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all border ${
                              isSelected 
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm' 
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            {mod.icon} {mod.label.split('/')[0].trim()}
                          </button>
                        );
                      })}
                    </div>
                    {item.fulfillmentType === 'takeaway' && (
                      <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => updateCartItemContainerSize(item.id, 'small')}
                          className={`flex-1 text-[10px] py-1 rounded font-bold transition-colors ${item.containerSize !== 'large' ? 'bg-amber-500 text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                        >
                          Small (+RM0)
                        </button>
                        <button
                          onClick={() => updateCartItemContainerSize(item.id, 'large')}
                          className={`flex-1 text-[10px] py-1 rounded font-bold transition-colors ${item.containerSize === 'large' ? 'bg-amber-500 text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                        >
                          Large (+RM1)
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Total & Checkout Area */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 text-white shadow-2xl shrink-0 z-20">
              {error && <p className="text-rose-400 text-xs font-bold mb-2 bg-rose-950/60 border border-rose-800 p-2 rounded-lg">{error}</p>}
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-slate-400 text-lg font-medium">Total</span>
                <span className="text-3xl font-black text-emerald-400 font-mono">RM {cartTotal.toFixed(2)}</span>
              </div>
              
              <button
                onClick={handlePlaceOrderClick}
                disabled={cart.length === 0 || cashStatus === 'CLOSED'}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-lg font-black tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {cashStatus === 'CLOSED' ? (
                  <>
                    <Lock className="w-5 h-5 text-rose-400" /> COUNTER CLOSED
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" /> PLACE ORDER
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>

      
      {/* CONFIRMATION DIALOG */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-xl font-sans max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white">Confirm Order & Payment</DialogTitle>
          </DialogHeader>
          
          <div className="py-2 space-y-4">
            
            {/* 1. ORDER SUMMARY */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <h3 className="font-bold text-slate-300 mb-2">Order Summary</h3>
              <div className="max-h-[25vh] overflow-y-auto mb-3 pr-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-start mb-2 last:mb-0 text-sm">
                    <div>
                      <span className="font-bold">{item.name}</span> <span className="text-gray-500">x{item.quantity}</span>
                      {item.containerSize && <span className="ml-1 text-xs px-1 bg-orange-100 text-orange-700 rounded-sm">🥡 {item.containerSize} (+RM{item.containerCharge})</span>}
                      {item.notes && <p className="text-xs text-red-500 italic mt-0.5">Notes: {item.notes}</p>}
                    </div>
                    <span className="font-bold">RM{((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-300 pt-2 flex justify-between items-center">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-bold text-gray-700">RM {cartTotal.toFixed(2)}</span>
              </div>
              
              {/* 2. DISCOUNT MODULE */}
              <div className="border-t border-gray-300 mt-2 pt-2 pb-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500 w-20">Discount:</span>
                  <Select 
                    value={discount.type} 
                    onValueChange={(val: 'fixed'|'percentage') => setDiscount({ ...discount, type: val })}
                  >
                    <SelectTrigger className="w-24 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">RM</SelectItem>
                      <SelectItem value="percentage">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    min="0"
                    step="0.1"
                    className="h-8 w-24 text-right"
                    value={discount.value || ''}
                    onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Discount Applied:</span>
                    <span>- RM {effectiveDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center text-xl">
                <span className="font-black text-gray-900">FINAL TOTAL:</span>
                <span className="font-black text-blue-600">RM {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 3. PAYMENT TYPE TABS */}
            <Tabs value={paymentMode} onValueChange={(v) => {
              setPaymentMode(v as 'full'|'split');
              if (v === 'full') setSplitPayments([]);
            }} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="full" className="font-bold">Full Payment</TabsTrigger>
                <TabsTrigger value="split" className="font-bold">Split Payment</TabsTrigger>
              </TabsList>

              <TabsContent value="full" className="mt-4 space-y-3">
                <p className="font-bold text-gray-900">Select Payment Method:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="h-14 font-bold border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                    onClick={() => handleSubmitOrder('cash')}
                    disabled={isSubmitting}
                  >
                    💵 PAID CASH
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-14 font-bold border-2 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                    onClick={() => setShowDuitNowModal(true)}
                    disabled={isSubmitting}
                  >
                    📱 DUITNOW QR
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    className="h-12 font-bold border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                    onClick={() => handleSubmitOrder('card')}
                    disabled={isSubmitting}
                  >
                    💳 PAID CARD
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-12 font-bold bg-gray-100 hover:bg-gray-200 text-gray-600"
                    onClick={() => handleSubmitOrder('unpaid')}
                    disabled={isSubmitting}
                  >
                    PAY LATER (Unpaid)
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="split" className="mt-4">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold">Split Breakdown</span>
                    <Button variant="outline" size="sm" onClick={addSplitPayment}>+ Add Person</Button>
                  </div>
                  
                  {splitPayments.length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-2">Add a split payment to begin.</p>
                  )}

                  <div className="space-y-2 mb-4">
                    {splitPayments.map((sp, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="font-bold text-gray-500 w-6">{idx + 1}.</span>
                        <div className="flex-1">
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="Amount (RM)" 
                            value={sp.amount || ''}
                            onChange={(e) => updateSplitPayment(idx, 'amount', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="w-[100px]">
                          <Select 
                            value={sp.method} 
                            onValueChange={(val: 'cash'|'card'|'qr'|'bank_transfer') => updateSplitPayment(idx, 'method', val)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="qr">QR</SelectItem>
                              <SelectItem value="bank_transfer">Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="ghost" size="icon" className="text-red-500 h-10 w-10 shrink-0" onClick={() => removeSplitPayment(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-sm">
                    <span className="text-gray-500">Difference:</span>
                    <span className={`font-bold ${splitDeltaCents !== 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {splitDeltaCents > 0 ? 'Overpaid by RM ' : splitDeltaCents < 0 ? 'Remaining RM ' : 'Exact amount'}
                      {splitDeltaCents !== 0 && (Math.abs(splitDeltaCents) / 100).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="mt-4">
                    <Button 
                      className="w-full h-12 font-bold"
                      onClick={() => handleSubmitOrder('cash')} // Payment method arg is ignored for split payments in handleSubmitOrder
                      disabled={isSubmitting || splitPayments.length === 0 || !isSplitBalanced}
                    >
                      SUBMIT SPLIT PAYMENT
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

          </div>

          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting}>
              ← Back to Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DUITNOW QR PAYMENT MODAL */}
      <Dialog open={showDuitNowModal} onOpenChange={setShowDuitNowModal}>
        <DialogContent className="max-w-sm bg-slate-900 border border-slate-800 text-white font-sans rounded-3xl p-6 text-center">
          <DialogHeader className="p-0">
            <DialogTitle className="text-xl font-black text-rose-400 flex items-center justify-center gap-2">
              📱 Alliance Bank DuitNow QR
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-mono mt-1">
              Scan to pay J&J Cafe & Catering via DuitNow FPX / eWallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="relative inline-block bg-white p-4 rounded-3xl border-4 border-[#a6192e] shadow-2xl text-center">
              {/* DuitNow Header */}
              <div className="bg-[#a6192e] text-white text-xs font-black py-1.5 px-4 rounded-t-xl tracking-wider uppercase flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5 font-sans">💳 DuitNow QR</span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full">Alliance Bank</span>
              </div>

              {/* QR Code Container with Centered Warung J&J Logo */}
              <div className="relative inline-block">
                <img src="/duitnow-qr.png" alt="Alliance Bank DuitNow QR" className="w-60 h-auto mx-auto rounded-lg" />
                
                {/* Centered Warung J&J Logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white p-1 rounded-xl shadow-md border-2 border-[#a6192e]">
                    <img src="/warung-logo.png" alt="Warung J&J Logo" className="w-10 h-10 object-contain rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Merchant Details Footer */}
              <div className="mt-3 pt-2 border-t border-gray-100 font-mono text-center">
                <p className="text-xs font-black text-[#a6192e] uppercase tracking-wide">J&J CAFE & CATERING</p>
                <p className="text-[10px] text-gray-500 font-bold">Alliance Bank Malaysia Berhad</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl font-mono text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Exact Order Total</span>
              <p className="text-2xl font-black text-emerald-400 mt-0.5">RM {finalTotal.toFixed(2)}</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-left font-mono">
              <p className="text-[11px] text-amber-300 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                STAFF VERIFICATION RULE:
              </p>
              <p className="text-[10px] text-amber-200/80 mt-0.5">
                Confirm incoming RM {finalTotal.toFixed(2)} on J&J's Alliance Bank BizSmart App before clicking confirm. Never rely on customer phone screens.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setShowDuitNowModal(false);
                handleSubmitOrder('card');
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl w-full text-sm shadow-lg active:scale-95"
            >
              ✅ CONFIRM DUITNOW QR PAID
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDuitNowModal(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
          </DialogFooter>
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
  );
}
