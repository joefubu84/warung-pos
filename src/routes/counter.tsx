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
import { Plus, Minus, Search, Trash2, ShoppingCart, CheckCircle2, Lock, Unlock, AlertTriangle, Split, Globe, Radio, Bell } from "lucide-react";
import { COMMON_MODIFIERS, detectModifierBadges } from "@/lib/kitchen-checklist-config";
import { QuickStockBar } from "@/components/QuickStockBar";
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

    // Table Service Buzzer Channel
    const buzzerChannel = supabase.channel('warung_table_buzzer')
      .on('broadcast', { event: 'call_waiter' }, (payload: any) => {
        const detail = payload?.payload;
        if (detail) {
          playBeep();
          toast.warning(`🛎️ Meja #${detail.table_number}: ${detail.message}`, {
            duration: 8000,
          });
        }
      })
      .subscribe();

    const handleLocalBuzzer = (e: any) => {
      const detail = e?.detail;
      if (detail) {
        playBeep();
        toast.warning(`🛎️ Meja #${detail.table_number}: ${detail.message}`, {
          duration: 8000,
        });
      }
    };

    window.addEventListener('warung_call_waiter_alert', handleLocalBuzzer);

    return () => {
      supabase.removeChannel(cashChannel);
      supabase.removeChannel(storeChannel);
      supabase.removeChannel(buzzerChannel);
      window.removeEventListener('warung_call_waiter_alert', handleLocalBuzzer);
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
    <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
      <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center shadow-xs border border-orange-200">
        <ShoppingCart className="w-7 h-7 text-orange-500 animate-bounce" />
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#f8fafc] text-slate-900 overflow-hidden flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      
      {/* MOBILE WARNING OVERLAY */}
      <div className="md:hidden fixed inset-0 bg-white/95 backdrop-blur-md text-white z-50 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mb-4 text-orange-400">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black mb-2 tracking-tight">Peranti Tablet Diperlukan</h1>
        <p className="text-sm text-slate-300 mb-8 max-w-xs leading-relaxed">Antaramuka POS Kaunter memerlukan skrin bersaiz 8 inci ke atas dalam mod melintang (landscape) bagi operasi pantas juruwang.</p>
        <a href="/orders" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-orange-500/30 transition-all">
          Buka Pengurusan Pesanan (/orders)
        </a>
      </div>

      {/* PORTRAIT WARNING */}
      <style dangerouslySetInnerHTML={{__html: `
        @media screen and (orientation: portrait) and (min-width: 768px) {
          #portrait-blocker { display: flex !important; }
          #pos-layout { display: none !important; }
        }
      `}} />

      <div id="portrait-blocker" className="hidden fixed inset-0 bg-white/95 backdrop-blur-md text-white z-50 flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mb-4 text-orange-400">
          <Radio className="w-8 h-8 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black mb-2 tracking-tight">Sila Putar Peranti (Landscape)</h1>
        <p className="text-sm text-slate-300">Sistem POS Kaunter direka khas untuk paparan melintang.</p>
      </div>

      {/* POS LAYOUT (LANDSCAPE ONLY) */}
      <div id="pos-layout" className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* COUNTER CLOSED BANNER */}
        {cashStatus === 'CLOSED' && (
          <div className="bg-rose-50 border-b border-rose-200 p-4 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs z-30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500 rounded-2xl text-white shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-rose-950 flex items-center gap-2">
                  ⛔ KAUNTER DITUTUP HARI INI (COUNTER CLOSED)
                  {closedAtTime && (
                    <span className="text-xs font-mono bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200 font-bold">
                      Ditutup jam {new Date(closedAtTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-rose-700 font-medium">
                  Sif daftar tunai hari ini telah ditutup. Pesanan baharu dikunci untuk mengelakkan ralat imbangan tunai.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setIsReopenModalOpen(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black px-4 py-2 rounded-xl shadow-xs flex items-center gap-2 text-xs whitespace-nowrap active:scale-95 transition-all cursor-pointer"
            >
              <Unlock className="w-4 h-4" /> Buka Semula Daftar Tunai
            </button>
          </div>
        )}

        {/* TOP ACTION BAR */}
        <div className={`h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-5 flex justify-between items-center shadow-2xs z-20 shrink-0 ${cashStatus === 'CLOSED' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Warung J&J Logo" className="w-9 h-9 rounded-full object-cover border-2 border-orange-500 shadow-2xs" />
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Warung J&J POS</h1>
              <span className="text-[11px] text-slate-400 font-semibold">Sistem Kaunter & Daftar Pesanan</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* ONLINE ORDERS LIVE TOGGLE */}
            <button
              type="button"
              onClick={handleToggleOnlineOrders}
              disabled={isUpdatingOnlineStatus}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black transition-all border shadow-2xs active:scale-95 cursor-pointer ${
                isOnlineOrderingEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 ring-2 ring-rose-300/50'
              }`}
              title="Klik untuk Buka atau Tutup Pesanan Online (Delivery & QR Order)"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnlineOrderingEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="tracking-tight">
                {isOnlineOrderingEnabled ? '🟢 Pesanan Online: BUKA' : '🔴 Pesanan Online: TUTUP'}
              </span>
            </button>

            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-full text-xs font-extrabold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Kosongkan Bakul
            </button>
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className={`flex-1 flex overflow-hidden ${cashStatus === 'CLOSED' ? 'opacity-50 pointer-events-none select-none' : ''}`}>
          
          {/* LEFT: MENU GRID (60%) */}
          <div className="w-[60%] bg-[#f8fafc] flex flex-col border-r border-slate-200/90 relative">
            
            {/* STICKY SEARCH BAR CONTAINER */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200/90 p-3 shrink-0 shadow-2xs space-y-2.5">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  placeholder="Cari hidangan (cth: Ayam Penyet, Ikan Tausi, Kopi...)"
                  value={searchMenuQuery}
                  onChange={(e) => setSearchMenuQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm font-medium focus:border-orange-500 focus:bg-white focus:ring-1 focus:ring-orange-500 outline-none transition-all shadow-2xs"
                />
              </div>

              {/* QUICK STOCK 86 / SOLD OUT ACCORDION */}
              <QuickStockBar onItemUpdated={fetchMenuItems} />
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur-xs">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    selectedCategory === cat 
                      ? 'bg-[#fed7aa] text-orange-900 shadow-2xs border border-orange-300' 
                      : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200/90'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 content-start">
              {successMsg && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 p-4 mb-4 rounded-2xl shadow-2xs flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5 pb-24">
                {filteredMenu.map(item => {
                  const isSoldOut = item.stock_count !== undefined && item.stock_count !== null && item.stock_count <= 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      disabled={isSoldOut}
                      className={`group relative flex flex-col rounded-2xl border transition-all active:scale-[0.98] text-left overflow-hidden shadow-2xs hover:shadow-md cursor-pointer ${
                        isSoldOut 
                          ? 'border-slate-200 bg-slate-100/60 opacity-50 cursor-not-allowed' 
                          : 'border-slate-200/90 bg-white hover:border-orange-300 hover:shadow-orange-500/5'
                      }`}
                    >
                      {/* BRIGHT FULL UNCROPPED DISH IMAGE */}
                      {item.image_url ? (
                        <div className="w-full h-44 sm:h-48 bg-slate-50 relative overflow-hidden flex items-center justify-center p-2.5 border-b border-slate-100">
                          <img 
                            src={item.image_url} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-xl"
                          />
                          {isSoldOut && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-xs">
                              <span className="text-xs font-black bg-rose-600 text-white px-3 py-1.5 rounded-full shadow-lg tracking-wider uppercase font-mono">HABIS (86)</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-slate-100 flex items-center justify-center text-slate-400 font-medium text-xs border-b border-slate-100">
                          TIADA GAMBAR HIDANGAN
                        </div>
                      )}

                      {/* DISH TITLE & ORANGE PRICE */}
                      <div className="p-3.5 flex flex-col justify-between flex-1 space-y-2.5 bg-white">
                        <span className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">{item.name}</span>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                          <span className="font-black text-orange-600 font-mono text-lg sm:text-xl">RM {item.price.toFixed(2)}</span>
                          <span className="text-xs font-black bg-orange-50 text-orange-600 border border-orange-200 group-hover:bg-orange-500 group-hover:text-white group-hover:border-orange-500 px-3 py-1 rounded-xl uppercase font-mono shadow-2xs transition-colors">
                            + TAMBAH
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
          <div className="w-[40%] bg-white flex flex-col h-full overflow-hidden border-l border-slate-200/90 shadow-xl">
            
            {/* Order Configuration */}
            <div className="p-4 border-b border-slate-200/90 bg-[#fafaf9] shrink-0">
              <div className="flex bg-slate-200/80 p-1 rounded-xl mb-3">
                <button
                  onClick={() => setOrderType('dine_in')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer ${orderType === 'dine_in' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🍽️ Makan Sini (Dine-in)
                </button>
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer ${orderType === 'takeaway' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🥡 Bungkus (Takeaway)
                </button>
              </div>

              <div className="flex gap-2">
                {orderType === 'dine_in' && (
                  <select 
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
                  >
                    <option value="">Pilih Meja *</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Meja {t.table_number}</option>)}
                  </select>
                )}
                <input 
                  placeholder="Nama Pelanggan (Pilihan)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]/50">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-300">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-extrabold text-slate-600">Bakul pesanan kosong</p>
                  <p className="text-xs text-slate-400">Pilih hidangan dari menu di sebelah kiri</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs flex flex-col gap-2.5 hover:border-orange-200 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="pr-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mb-1">
                          <h4 className="font-extrabold text-slate-900 leading-tight text-sm">{item.name}</h4>
                          <button 
                            onClick={() => toggleCartItemFulfillment(item.id)}
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase transition-colors self-start sm:self-auto active:scale-95 cursor-pointer ${
                              item.fulfillmentType === 'takeaway' 
                                ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {item.fulfillmentType === 'takeaway' ? '🥡 Bungkus' : '🍽️ Makan Sini'}
                          </button>
                        </div>
                        <p className="text-sm font-black text-orange-600 font-mono">RM {((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</p>
                      </div>
                      
                      {/* Qty Controls */}
                      <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 shrink-0 shadow-2xs">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-white text-slate-700 hover:text-orange-600 rounded-lg shadow-2xs active:scale-95 font-bold cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-black text-slate-900 font-mono text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-white text-slate-700 hover:text-orange-600 rounded-lg shadow-2xs active:scale-95 font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <input 
                        placeholder="Nota pinggan (cth: Kurang manis, kuah asing...)"
                        value={item.notes || ''}
                        onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-orange-500 focus:bg-white font-medium transition-all shadow-2xs"
                      />
                      {item.quantity > 1 && (
                        <button
                          type="button"
                          onClick={() => splitCartItem(item.id)}
                          className="px-2.5 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl text-[10px] font-black flex items-center gap-1 shrink-0 active:scale-95 transition-all shadow-2xs cursor-pointer"
                          title="Pecahkan kepada pinggan berasingan untuk letak nota berbeza"
                        >
                          <Split className="w-3 h-3" />
                          <span>Pecah Pinggan</span>
                        </button>
                      )}
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                        title="Padam item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* QUICK MODIFIER CHIPS (TAK NAK LADA, PEDAS, TIMUN, KANGKUNG) */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {COMMON_MODIFIERS.slice(0, 5).map(mod => {
                        const isSelected = (item.notes || '').toLowerCase().includes(mod.tag);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => toggleQuickModifier(item.id, mod.tag)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border shadow-2xs active:scale-95 cursor-pointer ${
                              isSelected 
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-black shadow-xs' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900 hover:border-slate-300'
                            }`}
                          >
                            {mod.icon} {(mod.label.split('/')[0] ?? mod.label).trim()}
                          </button>
                        );
                      })}
                    </div>

                    {item.fulfillmentType === 'takeaway' && (
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          onClick={() => updateCartItemContainerSize(item.id, 'small')}
                          className={`flex-1 text-[10px] py-1 rounded-lg font-black transition-all cursor-pointer ${item.containerSize !== 'large' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Bekas Kecil (+RM0)
                        </button>
                        <button
                          onClick={() => updateCartItemContainerSize(item.id, 'large')}
                          className={`flex-1 text-[10px] py-1 rounded-lg font-black transition-all cursor-pointer ${item.containerSize === 'large' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Bekas Besar (+RM1)
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Total & Checkout Area */}
            <div className="p-5 bg-white border-t border-slate-200/90 text-slate-900 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] shrink-0 z-20 space-y-3">
              {error && <p className="text-rose-600 text-xs font-bold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">{error}</p>}
              
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-slate-400 text-xs font-extrabold uppercase tracking-wider block">Jumlah Keseluruhan</span>
                  <span className="text-slate-500 text-sm font-medium">{cart.reduce((s, i) => s + i.quantity, 0)} item dipilih</span>
                </div>
                <span className="text-3xl font-black text-slate-900 font-mono">RM {cartTotal.toFixed(2)}</span>
              </div>
              
              <button
                onClick={handlePlaceOrderClick}
                disabled={cart.length === 0 || cashStatus === 'CLOSED'}
                className="w-full h-14 bg-orange-500 hover:bg-orange-600 active:scale-98 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl text-base sm:text-lg font-black tracking-wide transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-orange-500/25 cursor-pointer disabled:cursor-not-allowed"
              >
                {cashStatus === 'CLOSED' ? (
                  <>
                    <Lock className="w-5 h-5 text-rose-500" /> KAUNTER DITUTUP
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" /> HANTAR PESANAN & BAYAR →
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>

      
      {/* CONFIRMATION DIALOG */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-xl font-sans max-h-[90vh] overflow-y-auto bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">Pengesahan Pesanan & Bayaran</DialogTitle>
          </DialogHeader>
          
          <div className="py-2 space-y-4">
            
            {/* 1. ORDER SUMMARY */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4">
              <h3 className="font-extrabold text-slate-900 text-sm mb-3">Ringkasan Pesanan</h3>
              <div className="max-h-[25vh] overflow-y-auto mb-3 pr-2 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-start text-sm">
                    <div>
                      <span className="font-extrabold text-slate-800">{item.name}</span> <span className="text-slate-400 font-bold">x{item.quantity}</span>
                      {item.containerSize && <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-800 font-black rounded-md">🥡 {item.containerSize} (+RM{item.containerCharge})</span>}
                      {item.notes && <p className="text-xs text-orange-600 italic mt-0.5 font-medium">Nota: {item.notes}</p>}
                    </div>
                    <span className="font-mono font-black text-slate-900">RM {((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Jumlah Kasar (Subtotal):</span>
                <span className="font-mono font-bold text-slate-700">RM {cartTotal.toFixed(2)}</span>
              </div>
              
              {/* 2. DISCOUNT MODULE */}
              <div className="border-t border-slate-200 mt-2 pt-2 pb-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-slate-500 text-xs font-bold w-20">Diskaun:</span>
                  <Select 
                    value={discount.type} 
                    onValueChange={(val: 'fixed'|'percentage') => setDiscount({ ...discount, type: val })}
                  >
                    <SelectTrigger className="w-24 h-8 text-xs font-bold bg-white border-slate-200">
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
                    className="h-8 w-24 text-right bg-white border-slate-200 font-mono font-bold"
                    value={discount.value || ''}
                    onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 text-sm font-bold">
                    <span>Diskaun Ditolak:</span>
                    <span className="font-mono">- RM {effectiveDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 border-slate-200 mt-3 pt-3 flex justify-between items-center text-lg">
                <span className="font-black text-slate-900">JUMLAH PERLU BAYAR:</span>
                <span className="font-black text-orange-600 font-mono text-2xl">RM {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 3. PAYMENT TYPE TABS */}
            <Tabs value={paymentMode} onValueChange={(v) => {
              setPaymentMode(v as 'full'|'split');
              if (v === 'full') setSplitPayments([]);
            }} className="w-full">
              <TabsList className="w-full grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="full" className="font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xs rounded-lg">Bayaran Penuh</TabsTrigger>
                <TabsTrigger value="split" className="font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-xs rounded-lg">Bayaran Asing (Split)</TabsTrigger>
              </TabsList>

              <TabsContent value="full" className="mt-4 space-y-3">
                <p className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Pilih Kaedah Pembayaran:</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button 
                    variant="outline" 
                    className="h-14 font-black border-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
                    onClick={() => handleSubmitOrder('cash')}
                    disabled={isSubmitting}
                  >
                    💵 TUNAI (CASH)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-14 font-black border-2 border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 hover:text-rose-900 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
                    onClick={() => setShowDuitNowModal(true)}
                    disabled={isSubmitting}
                  >
                    📱 DUITNOW QR
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button 
                    variant="outline" 
                    className="h-12 font-black border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
                    onClick={() => handleSubmitOrder('card')}
                    disabled={isSubmitting}
                  >
                    💳 KAD (DEBIT/CREDIT)
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-12 font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
                    onClick={() => handleSubmitOrder('unpaid')}
                    disabled={isSubmitting}
                  >
                    BAYAR NANTI (Belum Bayar)
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="split" className="mt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-extrabold text-slate-900 text-sm">Pecahan Bayaran (Split)</span>
                    <Button variant="outline" size="sm" onClick={addSplitPayment} className="rounded-xl font-bold text-xs bg-white">+ Tambah Individu</Button>
                  </div>
                  
                  {splitPayments.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-3">Tekan butang tambah untuk memulakan pecahan bayaran.</p>
                  )}

                  <div className="space-y-2 mb-4">
                    {splitPayments.map((sp, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <span className="font-bold text-slate-500 text-xs w-6">{idx + 1}.</span>
                        <div className="flex-1">
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder="Jumlah (RM)" 
                            value={sp.amount || ''}
                            onChange={(e) => updateSplitPayment(idx, 'amount', parseFloat(e.target.value) || 0)}
                            className="bg-white border-slate-200 rounded-xl font-mono font-bold text-sm"
                          />
                        </div>
                        <div className="w-[110px]">
                          <Select 
                            value={sp.method} 
                            onValueChange={(val: 'cash'|'card'|'qr'|'bank_transfer') => updateSplitPayment(idx, 'method', val)}
                          >
                            <SelectTrigger className="bg-white border-slate-200 rounded-xl text-xs font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Tunai</SelectItem>
                              <SelectItem value="card">Kad</SelectItem>
                              <SelectItem value="qr">QR Pay</SelectItem>
                              <SelectItem value="bank_transfer">Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="ghost" size="icon" className="text-rose-500 hover:bg-rose-50 rounded-xl h-10 w-10 shrink-0" onClick={() => removeSplitPayment(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Baki Perbezaan:</span>
                    <span className={`font-mono font-black ${splitDeltaCents !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {splitDeltaCents > 0 ? 'Lebih bayar RM ' : splitDeltaCents < 0 ? 'Kurang bayar RM ' : '✓ Tepat Sepenuhnya'}
                      {splitDeltaCents !== 0 && (Math.abs(splitDeltaCents) / 100).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="mt-4">
                    <Button 
                      className="w-full h-12 font-black bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-md cursor-pointer"
                      onClick={() => handleSubmitOrder('cash')}
                      disabled={isSubmitting || splitPayments.length === 0 || !isSplitBalanced}
                    >
                      HANTAR BAYARAN ASING (SPLIT)
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

          </div>

          <DialogFooter className="flex gap-2 sm:justify-start pt-2">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} disabled={isSubmitting} className="text-slate-500 hover:text-slate-800 font-bold rounded-xl text-xs">
              ← Kembali Ubah Pesanan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DUITNOW QR PAYMENT MODAL */}
      <Dialog open={showDuitNowModal} onOpenChange={setShowDuitNowModal}>
        <DialogContent className="max-w-sm bg-white border border-slate-200 text-slate-900 font-sans rounded-3xl p-6 text-center shadow-2xl">
          <DialogHeader className="p-0">
            <DialogTitle className="text-xl font-black text-[#a6192e] flex items-center justify-center gap-2">
              📱 Alliance Bank DuitNow QR
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium mt-1">
              Imbas untuk bayar ke J&J Cafe & Catering melalui DuitNow FPX / eWallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="relative inline-block bg-white p-4 rounded-3xl border-4 border-[#a6192e] shadow-xl text-center">
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

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl font-mono text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block font-sans font-bold">Jumlah Tepat Pesanan</span>
              <p className="text-2xl font-black text-slate-900 mt-0.5">RM {finalTotal.toFixed(2)}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-left">
              <p className="text-xs text-amber-900 font-extrabold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                PERATURAN PENGESAHAN STAF:
              </p>
              <p className="text-[11px] text-amber-800/90 mt-1 leading-relaxed">
                Sahkan kemasukan RM {finalTotal.toFixed(2)} di aplikasi BizSmart Alliance Bank J&J sebelum tekan sah bayar. Jangan hanya bergantung pada skrin telefon pelanggan.
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setShowDuitNowModal(false);
                handleSubmitOrder('card');
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-2xl w-full text-sm shadow-md active:scale-95 transition-all cursor-pointer"
            >
              ✅ SAHKAN BAYARAN DUITNOW QR
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDuitNowModal(false)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold"
            >
              Batal
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
