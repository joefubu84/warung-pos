import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTodayCashStatus } from '@/lib/cash-guard';
import { 
  Lock, 
  Search, 
  Sparkles, 
  Flame, 
  Star, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag, 
  Utensils, 
  Award, 
  ChevronRight,
  Clock,
  Check,
  CheckCircle2,
  X
} from 'lucide-react';
import { 
  findMemberByPhone, 
  fetchMembersFromSupabase,
  addMemberPoints, 
  deductMemberPoints, 
  getMembershipTransactions, 
  registerOrIdentifyMemberSupabase,
  MembershipTransaction, 
  LoyaltyMember 
} from '@/lib/loyalty-config';
import { sanitizePhone } from '@/lib/whatsapp-otp';
import { Phone, UserCheck, ShieldCheck, ShieldAlert, Gift, History, Percent, LogOut, RefreshCw, Split } from 'lucide-react';
import { DishCustomizationModal, CustomizedCartItem } from '@/components/DishCustomizationModal';
import { 
  validateAndStartTableSession, 
  updateTableSessionOrderTime, 
  checkOrderRateLimit, 
  validateOrderPricesAgainstDB, 
  getOrCreateDeviceId 
} from '@/lib/table-sessions';
import { CustomerOrderTracker } from '@/components/CustomerOrderTracker';
import { toast } from 'sonner';
import { COMMON_MODIFIERS } from '@/lib/kitchen-checklist-config';

export const Route = createFileRoute('/t/$token')({
  component: TableQRPage,
});

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string | null;
  stock_count?: number | null;
  description?: string;
}

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  fulfillmentType: 'dine_in' | 'takeaway';
  containerSize?: 'small' | 'large' | null;
  containerCharge?: number;
  notes?: string;
  packNotes?: string[];
  portionSize?: string;
  spiceLevel?: string;
  selectedAddons?: { name: string; price: number }[];
}

import { getPromoConfig, getDishBadgesMap, DishBadgeConfig } from '@/lib/addons-config';

export function TableQRPage() {
  const { token } = Route.useParams();
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClosedForDay, setIsClosedForDay] = useState(false);
  
  // Search & Category Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [promoBanners, setPromoBanners] = useState<string[]>(getPromoConfig());
  const [promoBannerIdx, setPromoBannerIdx] = useState(0);
  const [dishBadgesMap, setDishBadgesMap] = useState<Record<string, DishBadgeConfig>>(getDishBadgesMap());

  useEffect(() => {
    const handlePromoUpdate = () => setPromoBanners(getPromoConfig());
    const handleBadgeUpdate = () => setDishBadgesMap(getDishBadgesMap());
    window.addEventListener('warung_promos_updated', handlePromoUpdate);
    window.addEventListener('warung_dish_badges_updated', handleBadgeUpdate);
    return () => {
      window.removeEventListener('warung_promos_updated', handlePromoUpdate);
      window.removeEventListener('warung_dish_badges_updated', handleBadgeUpdate);
    };
  }, []);

  // Customization & Ordering state
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePlacedOrderId, setActivePlacedOrderId] = useState<string | null>(null);
  const [mergedNotification, setMergedNotification] = useState<string | null>(null);
  const [globalFulfillmentType, setGlobalFulfillmentType] = useState<'dine_in' | 'takeaway'>('dine_in');

  const toggleCartFulfillment = (itemId: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const nextType = item.fulfillmentType === 'dine_in' ? 'takeaway' : 'dine_in';
        let updatedNotes = item.notes || '';
        if (updatedNotes.includes('DINE IN (Makan Sini 🍽️)')) {
          updatedNotes = updatedNotes.replace('DINE IN (Makan Sini 🍽️)', 'TAKEAWAY (Bungkus 🥡)');
        } else if (updatedNotes.includes('TAKEAWAY (Bungkus 🥡)')) {
          updatedNotes = updatedNotes.replace('TAKEAWAY (Bungkus 🥡)', 'DINE IN (Makan Sini 🍽️)');
        } else {
          updatedNotes = (nextType === 'takeaway' ? 'TAKEAWAY (Bungkus 🥡)' : 'DINE IN (Makan Sini 🍽️)') + (updatedNotes ? ` | ${updatedNotes}` : '');
        }
        return {
          ...item,
          fulfillmentType: nextType,
          notes: updatedNotes
        };
      }
      return item;
    }));
  };

  // Mobile Cart Drawer State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Existing Active Order Dialog
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [existingOrder, setExistingOrder] = useState<any | null>(null);

  // Device + GPS Table Session Validation State
  const [sessionBlockedMessage, setSessionBlockedMessage] = useState<string | null>(null);

  // VIP Customer Member Recognition State
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('warung_customer_phone') || '';
    return '';
  });
  const [isRm8DiscountApplied, setIsRm8DiscountApplied] = useState(false);
  const [showTxHistory, setShowTxHistory] = useState(false);

  const [memberData, setMemberData] = useState<LoyaltyMember | undefined>(() => {
    if (typeof window !== 'undefined') {
      const p = localStorage.getItem('warung_customer_phone');
      if (p) return findMemberByPhone(p);
    }
    return undefined;
  });

  // Auto-recognize returning VIP member on any QR table scan!
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = customerPhone || localStorage.getItem('warung_customer_phone');
    if (stored) {
      const found = findMemberByPhone(stored);
      if (found) {
        setMemberData(found);
      } else {
        fetchMembersFromSupabase().then((members: LoyaltyMember[]) => {
          const cleanStored = stored.replace(/\D/g, '');
          const fresh = members.find((m: LoyaltyMember) => m.phone === stored || m.phone.replace(/\D/g, '') === cleanStored);
          if (fresh) {
            setCustomerPhone(fresh.phone);
            setMemberData(fresh);
          }
        });
      }
    }
  }, [customerPhone]);

  // Direct Supabase Member Registration & Identification State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);

  // Pure Supabase Direct Member Registration / Login Handler
  const handleRegisterOrIdentifyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      toast.error("Please enter your mobile phone number (+601XXXXXXXX).");
      return;
    }

    setIsSubmittingMember(true);
    try {
      const res = await registerOrIdentifyMemberSupabase(nameInput, phoneInput);
      localStorage.setItem('warung_customer_phone', res.member.phone);
      setCustomerPhone(res.member.phone);
      setMemberData(res.member);
      setIsMemberModalOpen(false);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message || "Failed to process member registration.");
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // Rotate promo banner every 4s
  useEffect(() => {
    if (promoBanners.length === 0) return;
    const timer = setInterval(() => {
      setPromoBannerIdx((prev) => (prev + 1) % promoBanners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [promoBanners]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // 1. Look up table by qr_token
        const { data: tableData, error: tableError } = await supabase
          .from('tables')
          .select('id, table_number, store_id, stores(name)')
          .eq('qr_token', token)
          .single();

        if (tableError || !tableData) {
          setError('Invalid QR code scanned');
          setLoading(false);
          return;
        }

        const sId = tableData.store_id;
        setStoreId(sId);
        setTableId(tableData.id);
        setTableNumber(tableData.table_number);
        
        // @ts-ignore - Supabase type for joined relation
        const name = tableData.stores?.name || 'Warung J&J';
        setStoreName(name);

        // Validate Device + GPS Table Session
        const sessionRes = await validateAndStartTableSession(tableData.table_number.toString());
        if (!sessionRes.allowed) {
          setSessionBlockedMessage(sessionRes.message || `Table #${tableData.table_number} is currently occupied by an active customer.`);
        } else {
          setSessionBlockedMessage(null);
        }

        // 2. Query menu_items for store
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('id, name, category, price, image_url, stock_count')
          .eq('store_id', sId)
          .eq('is_available', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (menuError) throw menuError;

        setMenuItems(menuData || []);

        // Check if cash register is explicitly closed for today
        const cashRes = await getTodayCashStatus(sId);
        if (cashRes.status === 'CLOSED') {
          setIsClosedForDay(true);
        }
      } catch (err: any) {
        console.error('Error loading customer menu:', err);
        setError('Failed to load menu. Please ask staff for assistance.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  // Category Priority: Chicken -> Fish -> Main Food -> Drinks -> Add-ons / Sampingan
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

  // Unique categories list (Main dishes first, Add-ons last)
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach(i => i.category && set.add(i.category));
    const sortedList = Array.from(set).sort((a, b) => {
      const prioA = getCategoryPriority(a);
      const prioB = getCategoryPriority(b);
      if (prioA !== prioB) return prioA - prioB;
      return a.localeCompare(b);
    });
    return ['All', ...sortedList];
  }, [menuItems]);

  // Filtered menu items (Main dishes first, Add-ons / Sampingan at bottom)
  const filteredMenuItems = useMemo(() => {
    const items = menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });

    return items.sort((a, b) => {
      const prioA = getCategoryPriority(a.category || '');
      const prioB = getCategoryPriority(b.category || '');
      if (prioA !== prioB) return prioA - prioB;
      return a.name.localeCompare(b.name);
    });
  }, [menuItems, searchQuery, selectedCategory]);

  // Add customized dish from modal into cart
  const handleAddToCartCustomized = (custItem: CustomizedCartItem) => {
    const newItem: CartItem = {
      id: custItem.id,
      menuItemId: custItem.menuItemId,
      name: custItem.name,
      price: custItem.basePrice,
      quantity: custItem.quantity,
      fulfillmentType: globalFulfillmentType,
      notes: custItem.notes,
      packNotes: custItem.packNotes || Array(custItem.quantity).fill(''),
      spiceLevel: custItem.spiceLevel,
      selectedAddons: custItem.selectedAddons
    };

    setCart(prev => [...prev, newItem]);
    toast.success(`🛒 Added ${custItem.quantity}x ${custItem.name} to cart!`);
  };

  const updateTablePackNote = (cartItemId: string, packIdx: number, note: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
        currentPackNotes[packIdx] = note;
        const specified = currentPackNotes.map((n, i) => `Pinggan #${i+1}: ${n || 'Standard'}`).join(' | ');
        return {
          ...item,
          packNotes: currentPackNotes,
          notes: specified
        };
      }
      return item;
    }));
  };

  const toggleTablePackQuickModifier = (cartItemId: string, packIdx: number, tag: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
        const cur = (currentPackNotes[packIdx] || '').trim();
        let nextVal = cur;
        if (cur.toLowerCase().includes(tag.toLowerCase())) {
          nextVal = cur.replace(new RegExp(tag, 'gi'), '').replace(/,\s*,/g, ',').trim();
        } else {
          nextVal = cur ? `${cur}, ${tag}` : tag;
        }
        currentPackNotes[packIdx] = nextVal;
        const specified = currentPackNotes.map((n, i) => `Pinggan #${i+1}: ${n || 'Standard'}`).join(' | ');
        return {
          ...item,
          packNotes: currentPackNotes,
          notes: specified
        };
      }
      return item;
    }));
  };

  const splitTableCartItem = (cartItemId: string) => {
    setCart(prev => {
      const target = prev.find(i => i.id === cartItemId);
      if (!target || target.quantity <= 1) return prev;
      const targetIdx = prev.findIndex(i => i.id === cartItemId);
      const packNotes = target.packNotes || Array(target.quantity).fill('');
      const individual: CartItem[] = Array.from({ length: target.quantity }).map((_, idx) => ({
        ...target,
        id: `${target.menuItemId}_${Date.now()}_${idx}`,
        quantity: 1,
        notes: packNotes[idx] ? `Pinggan #${idx+1}: ${packNotes[idx]}` : target.notes,
        packNotes: [packNotes[idx] || '']
      }));
      const nextCart = [...prev];
      nextCart.splice(targetIdx, 1, ...individual);
      return nextCart;
    });
    toast.success('Hidangan dipecahkan kepada pinggan individu.');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const pointsEarned = Math.floor(cartSubtotal * 2);

  const handlePlaceOrder = async (forceNew: boolean = false) => {
    if (cart.length === 0 || !storeId || !tableId) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      if (!forceNew) {
        // Check for existing active unpaid order on table
        const { data: existingData, error: checkError } = await supabase
          .from('orders')
          .select(`
            id, 
            total_amount, 
            status,
            order_items ( id )
          `)
          .eq('table_id', tableId)
          .in('status', ['pending', 'preparing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingData) {
          setExistingOrder(existingData);
          setShowOrderDialog(true);
          setIsSubmitting(false);
          return;
        }
      }

      // 1. Rate Limiting per Device / Session (Max 5 orders per minute)
      const rateLimitRes = checkOrderRateLimit(getOrCreateDeviceId());
      if (!rateLimitRes.allowed) {
        toast.error(`⚠️ Rate Limit Exceeded: Max 5 orders/min. Please wait ${rateLimitRes.remainingSeconds}s.`);
        setIsSubmitting(false);
        return;
      }

      // 2. Authoritative Database Price & Stock Re-Validation
      const priceVal = await validateOrderPricesAgainstDB(storeId, cart);
      if (!priceVal.isValid) {
        toast.error(`⛔ Order Rejected: ${priceVal.message || 'Menu price or stock mismatch.'}`);
        setIsSubmitting(false);
        return;
      }

      const finalTotalAmount = Math.max(0, priceVal.expectedTotal - (isRm8DiscountApplied ? 8.00 : 0));

      // 3. Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: storeId,
          type: 'dine_in',
          status: 'pending',
          table_id: tableId,
          total_amount: finalTotalAmount,
          delivery_fee: null,
          delivery_service: null,
          customer_phone: customerPhone || null,
          delivery_address: null,
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // Auto credit 1 point per dish + handle RM 8 discount deduction
      if (customerPhone) {
        const totalDishes = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        if (isRm8DiscountApplied) {
          deductMemberPoints(customerPhone, 60, `RM 8.00 Discount used on Order #${orderData.id.slice(0, 6)}`);
        }

        const updatedMem = addMemberPoints(customerPhone, totalDishes, `Earned ${totalDishes} pts (1 pt/dish) on Order #${orderData.id.slice(0, 6)}`);
        setMemberData(updatedMem);
        toast.success(`💎 +${totalDishes} Member Point${totalDishes > 1 ? 's' : ''} Earned! Total: ${updatedMem.points} pts`);
      }

      // 2. Insert order items (Flattened per plate so kitchen receives individual numbered plates)
      const orderItemsToInsert = cart.flatMap(item => {
        if (item.quantity > 1 && item.packNotes && item.packNotes.length > 0) {
          return item.packNotes.slice(0, item.quantity).map((pNote, pIdx) => ({
            order_id: orderData.id,
            menu_item_id: item.menuItemId,
            quantity: 1,
            price_at_order: item.price,
            fulfillment_type: item.fulfillmentType,
            container_size: item.containerSize || null,
            container_charge: item.containerCharge || 0,
            notes: pNote ? `Pinggan #${pIdx + 1}: ${pNote}` : (item.notes ? `${item.notes} (Pinggan #${pIdx + 1})` : '')
          }));
        }
        return [{
          order_id: orderData.id,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          price_at_order: item.price,
          fulfillment_type: item.fulfillmentType,
          container_size: item.containerSize || null,
          container_charge: item.containerCharge || 0,
          notes: item.notes || ''
        }];
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Update active table session order timestamp
      if (tableNumber) {
        await updateTableSessionOrderTime(tableNumber.toString());
      }

      // 4. Clear cart & set active order tracker ID
      setCart([]);
      setActivePlacedOrderId(orderData.id);
      setShowOrderDialog(false);
      setIsMobileCartOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success("🎉 Order placed successfully! Live progress tracker active.");
    } catch (err: any) {
      console.error('Error placing order:', err);
      setError(err.message || 'Failed to place order. Please ask staff for assistance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddToExisting = async () => {
    if (!existingOrder) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const orderItemsToInsert = cart.flatMap(item => {
        if (item.quantity > 1 && item.packNotes && item.packNotes.length > 0) {
          return item.packNotes.slice(0, item.quantity).map((pNote, pIdx) => ({
            order_id: existingOrder.id,
            menu_item_id: item.menuItemId,
            quantity: 1,
            price_at_order: item.price,
            fulfillment_type: item.fulfillmentType,
            container_size: item.containerSize || null,
            container_charge: item.containerCharge || 0,
            notes: pNote ? `Pinggan #${pIdx + 1}: ${pNote}` : (item.notes ? `${item.notes} (Pinggan #${pIdx + 1})` : '')
          }));
        }
        return [{
          order_id: existingOrder.id,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          price_at_order: item.price,
          fulfillment_type: item.fulfillmentType,
          container_size: item.containerSize || null,
          container_charge: item.containerCharge || 0,
          notes: item.notes || ''
        }];
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      const newTotal = existingOrder.total_amount + cartSubtotal;
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', existingOrder.id);
      
      if (updateError) throw updateError;

      setCart([]);
      setActivePlacedOrderId(existingOrder.id);
      setMergedNotification(existingOrder.id);
      setShowOrderDialog(false);
      setIsMobileCartOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success("🎉 Items added to your active bill!");
    } catch (err: any) {
      console.error('Error adding to order:', err);
      setError(err.message || 'Failed to add to existing order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 font-mono">
        <Utensils className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
        <p className="text-sm text-slate-400">Loading Warung J&J Digital Menu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 md:pb-12">
      {/* CLOSED OVERLAY */}
      {isClosedForDay && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="p-5 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 mb-4 animate-pulse">
            <Lock className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black mb-2 text-rose-400">⛔ ORDERS ARE CLOSED TODAY</h2>
          <p className="text-slate-300 max-w-sm text-sm mb-6 font-mono">
            Our cash register for today is closed. Please ask our friendly staff for assistance!
          </p>
          <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-full text-xs font-mono text-slate-400">
            Shift Closed • {storeName || 'Warung J&J'}
          </div>
        </div>
      )}

      {/* OCCUPIED TABLE SESSION BLOCKED OVERLAY */}
      {sessionBlockedMessage && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center text-white font-mono">
          <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 mb-4 animate-pulse">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black mb-2 text-amber-400">⛔ TABLE CURRENTLY OCCUPIED</h2>
          <p className="text-slate-300 max-w-md text-sm mb-6 leading-relaxed">
            {sessionBlockedMessage}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Re-check Table Status
            </Button>
          </div>
        </div>
      )}

      {/* CONTAINER */}
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* HERO SECTION - MOBILE OPTIMIZED & RESPONSIVE */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex items-center sm:items-start gap-3.5 sm:gap-5 text-left z-10 relative">
            <img 
              src="/logo.png" 
              alt="Warung J&J Logo" 
              className="w-12 h-12 sm:w-24 sm:h-24 rounded-full object-cover border-2 sm:border-4 border-amber-400 shadow-xl shadow-amber-500/10 shrink-0" 
            />
            <div className="space-y-1 sm:space-y-2 flex-grow min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                  Malay Cuisine
                </span>
                {tableNumber && (
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full">
                    📍 Table #{tableNumber}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-3xl font-black text-white tracking-tight truncate">
                Welcome to {storeName || 'Warung J&J'}! 👋
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 max-w-lg hidden sm:block">
                Freshly cooked to order. Scan, customize your dish, and enjoy instant kitchen progress updates!
              </p>
            </div>
          </div>

          {/* ROTATING PROMO BANNER */}
          {promoBanners.length > 0 && (
            <div className="mt-5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 font-mono text-xs text-amber-300 animate-fadeIn">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <span className="font-bold truncate">{promoBanners[promoBannerIdx % promoBanners.length]}</span>
            </div>
          )}
        </div>

        {/* ACTIVE LIVE ORDER TRACKER (IF ORDER PLACED) */}
        {activePlacedOrderId && (
          <CustomerOrderTracker 
            orderId={activePlacedOrderId} 
            onClose={() => setActivePlacedOrderId(null)} 
          />
        )}

        {/* STICKY SEARCH BAR & CATEGORY PILLS */}
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 py-3 space-y-3 shadow-xl -mx-4 px-4">
          <div className="relative max-w-md mx-auto">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Nasi Ayam, Mee Goreng, Teh C, Satay..."
              className="bg-slate-900 border-slate-800 pl-10 text-white placeholder:text-slate-500 text-xs rounded-xl focus:border-emerald-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* CATEGORY PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar font-mono text-xs">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl font-bold shrink-0 transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.02]'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN LAYOUT: MENU GRID (LEFT) & CART SIDEBAR (RIGHT) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* MENU GRID (2 COLUMNS MOBILE/TABLET) */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between font-mono">
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Utensils className="w-5 h-5 text-emerald-400" />
                <span>{selectedCategory} Menu</span>
              </h2>
              <span className="text-xs text-slate-500 font-bold">{filteredMenuItems.length} dishes available</span>
            </div>

            {filteredMenuItems.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
                <Utensils className="w-10 h-10 mx-auto text-slate-700" />
                <p className="text-sm font-mono">No dishes matching your search filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-4">
                {filteredMenuItems.map((item) => {
                  const isSoldOut = item.stock_count === 0;
                  const badge = dishBadgesMap[item.id] || { isPopular: true, isHalal: true, isChefSpecial: false };

                  return (
                    <div 
                      key={item.id} 
                      className={`bg-slate-900 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3.5 flex flex-col justify-between hover:border-emerald-500/50 transition-all duration-300 shadow-xl group ${
                        isSoldOut ? 'opacity-50 grayscale' : ''
                      }`}
                    >
                      {/* UNCROPPED FOOD IMAGE CONTAINER */}
                      <div className="relative h-28 sm:h-52 bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden flex items-center justify-center p-1.5 mb-2 sm:mb-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-700">
                            <Utensils className="w-6 h-6 sm:w-8 sm:h-8" />
                            <span className="text-[9px] font-mono">No Image</span>
                          </div>
                        )}

                        {/* BADGES */}
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
                          {badge.isPopular && (
                            <span className="bg-amber-500 text-slate-950 text-[8px] sm:text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-md flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5 fill-slate-950" /> <span className="hidden sm:inline">Popular</span>
                            </span>
                          )}
                        </div>

                        {/* RATING */}
                        <div className="absolute bottom-1.5 right-1.5 bg-slate-950/90 border border-slate-800 text-amber-400 font-mono font-bold text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-md">
                          <Star className="w-2.5 h-2.5 fill-amber-400" /> 4.8
                        </div>

                        {/* SOLD OUT OVERLAY */}
                        {isSoldOut && (
                          <div className="absolute inset-0 bg-slate-950/80 z-20 flex items-center justify-center">
                            <span className="bg-rose-600 text-white font-mono font-black text-[10px] sm:text-xs px-2 py-0.5 sm:px-3 sm:py-1 rounded-full uppercase tracking-widest transform -rotate-6 border border-rose-500 shadow-2xl">
                              Sold Out
                            </span>
                          </div>
                        )}
                      </div>

                      {/* DISH DETAILS */}
                      <div className="space-y-1 flex-grow">
                        <h3 className="font-bold text-white text-xs sm:text-base tracking-tight group-hover:text-emerald-400 transition-colors line-clamp-1">
                          {item.name}
                        </h3>

                        <div className="flex items-center justify-between font-mono">
                          <span className="text-xs sm:text-base font-black text-emerald-400">
                            RM {item.price.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* CUSTOMIZE & ADD BUTTON */}
                      <div className="pt-2 mt-1.5 border-t border-slate-800/60">
                        <Button
                          disabled={isSoldOut}
                          onClick={() => setCustomizingItem(item)}
                          className="w-full bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-bold text-[11px] sm:text-xs py-2 sm:py-2.5 rounded-xl border border-emerald-500/30 hover:border-emerald-500 flex items-center justify-center gap-1 transition-all active:scale-95 touch-manipulation h-9"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" /> Add
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DESKTOP CART SIDEBAR */}
          <div className="hidden md:block col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 sticky top-24 shadow-2xl font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" /> Your Order Cart
                </h3>
                <span className="text-xs bg-slate-950 text-emerald-400 border border-slate-800 px-2.5 py-0.5 rounded-full font-bold">
                  {cart.length} items
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                  <ShoppingBag className="w-8 h-8 mx-auto text-slate-700" />
                  <p>Your cart is currently empty.</p>
                  <p className="text-[10px] text-slate-600">Select dishes from the menu to add to your order.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="divide-y divide-slate-800 max-h-[420px] overflow-y-auto pr-1 space-y-2">
                    {cart.map((item) => {
                      const qty = item.quantity;
                      const packNotes = item.packNotes || Array(qty).fill('');

                      return (
                        <div key={item.id} className="py-3 space-y-2">
                          {/* DISH TITLE & PRICE BAR */}
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <span className="font-bold text-white text-xs">🍱 {item.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => toggleCartFulfillment(item.id)}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all inline-flex items-center gap-1 ${
                                    item.fulfillmentType === 'takeaway'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                                  }`}
                                >
                                  {item.fulfillmentType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine In'}
                                </button>
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  x{qty}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-emerald-400 text-xs">
                                RM {(item.price * qty).toFixed(2)}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1 justify-end">
                                {qty > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => splitTableCartItem(item.id)}
                                    className="text-[9px] text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                    title="Pecahkan kepada pinggan individu"
                                  >
                                    <Split className="w-2.5 h-2.5" /> Pecah
                                  </button>
                                )}
                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-rose-400 hover:text-rose-300 text-[10px]"
                                >
                                  Padam
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* PER-PLATE SPECIFICATION ROWS */}
                          <div className="space-y-1.5 pt-1">
                            {Array.from({ length: qty }).map((_, pIdx) => {
                              const curNote = packNotes[pIdx] || '';
                              return (
                                <div key={pIdx} className="p-2 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1 text-[11px]">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-bold text-amber-400 flex items-center gap-1">
                                      <span>{item.fulfillmentType === 'takeaway' ? '🥡 Pek' : '🍽️ Pinggan'} #{pIdx + 1}</span>
                                      {qty > 1 && <span className="text-slate-500 font-normal">({pIdx + 1}/{qty})</span>}
                                    </span>
                                    {curNote && <span className="text-emerald-400 text-[9px]">✓ Ada Nota</span>}
                                  </div>
                                  <Input
                                    value={curNote}
                                    onChange={(e) => updateTablePackNote(item.id, pIdx, e.target.value)}
                                    placeholder={`Nota Pinggan #${pIdx + 1} (cth: Tak nak lada, ekstra pedas...)`}
                                    className="h-7 bg-slate-900 border-slate-800 text-white text-[11px] rounded-lg"
                                  />
                                  {/* QUICK CHIPS */}
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {COMMON_MODIFIERS.slice(0, 4).map(mod => {
                                      const isSelected = curNote.toLowerCase().includes(mod.tag);
                                      return (
                                        <button
                                          key={mod.id}
                                          type="button"
                                          onClick={() => toggleTablePackQuickModifier(item.id, pIdx, mod.tag)}
                                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all border ${
                                            isSelected
                                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                          }`}
                                        >
                                          {mod.icon} {mod.label.split('/')[0].trim()}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal ({cart.reduce((sum, i) => sum + i.quantity, 0)} dishes)</span>
                      <span className="font-bold text-white">RM {cartSubtotal.toFixed(2)}</span>
                    </div>

                    {isRm8DiscountApplied && (
                      <div className="flex justify-between text-rose-400 font-bold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                        <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-rose-400" /> Member Discount (60 pts)</span>
                        <span>-RM 8.00</span>
                      </div>
                    )}

                    <div className="flex justify-between text-amber-400 text-[11px] font-bold">
                      <span>Earned VIP Points (1 pt/dish)</span>
                      <span>+{cart.reduce((sum, i) => sum + i.quantity, 0)} pts</span>
                    </div>

                    <div className="flex justify-between text-sm font-black text-emerald-400 pt-2 border-t border-slate-800">
                      <span>Total Amount</span>
                      <span>RM {Math.max(0, cartSubtotal - (isRm8DiscountApplied ? 8.00 : 0)).toFixed(2)}</span>
                    </div>

                    <Button
                      disabled={isSubmitting || cart.length === 0}
                      onClick={() => handlePlaceOrder(false)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 text-xs"
                    >
                      <Check className="w-4 h-4" /> {isSubmitting ? 'Submitting Order...' : 'CONFIRM & PLACE ORDER'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* MOBILE STICKY BOTTOM CART BAR */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 z-40 shadow-2xl flex items-center justify-between font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Total ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
            <span className="text-lg font-black text-emerald-400">RM {cartSubtotal.toFixed(2)}</span>
          </div>

          <Button
            onClick={() => setIsMobileCartOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs"
          >
            <ShoppingBag className="w-4 h-4" /> View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
          </Button>
        </div>
      )}

      {/* MOBILE CART DRAWER */}
      <Dialog open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md max-h-[85vh] overflow-y-auto font-mono p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-400">
              <ShoppingBag className="w-5 h-5" /> Your Order Cart
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Review your customized dishes before sending to kitchen
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="divide-y divide-slate-800">
              {cart.map((item) => {
                const qty = item.quantity;
                const packNotes = item.packNotes || Array(qty).fill('');

                return (
                  <div key={item.id} className="py-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-bold text-white text-xs">🍱 {item.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => toggleCartFulfillment(item.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all inline-flex items-center gap-1 ${
                              item.fulfillmentType === 'takeaway'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                            }`}
                          >
                            {item.fulfillmentType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine In'}
                          </button>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            x{qty}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-emerald-400 text-xs">
                          RM {(item.price * qty).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          {qty > 1 && (
                            <button
                              type="button"
                              onClick={() => splitTableCartItem(item.id)}
                              className="text-[9px] text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                              title="Pecahkan kepada pinggan individu"
                            >
                              <Split className="w-2.5 h-2.5" /> Pecah
                            </button>
                          )}
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-rose-400 hover:text-rose-300 text-[10px]"
                          >
                            Padam
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* MOBILE PER-PLATE SPECIFICATION ROWS */}
                    <div className="space-y-1.5 pt-1">
                      {Array.from({ length: qty }).map((_, pIdx) => {
                        const curNote = packNotes[pIdx] || '';
                        return (
                          <div key={pIdx} className="p-2 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1 text-[11px]">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-amber-400 flex items-center gap-1">
                                <span>{item.fulfillmentType === 'takeaway' ? '🥡 Pek' : '🍽️ Pinggan'} #{pIdx + 1}</span>
                                {qty > 1 && <span className="text-slate-500 font-normal">({pIdx + 1}/{qty})</span>}
                              </span>
                              {curNote && <span className="text-emerald-400 text-[9px]">✓ Ada Nota</span>}
                            </div>
                            <Input
                              value={curNote}
                              onChange={(e) => updateTablePackNote(item.id, pIdx, e.target.value)}
                              placeholder={`Nota Pinggan #${pIdx + 1} (cth: Tak nak lada, ekstra pedas...)`}
                              className="h-7 bg-slate-900 border-slate-800 text-white text-[11px] rounded-lg"
                            />
                            {/* QUICK CHIPS */}
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {COMMON_MODIFIERS.slice(0, 4).map(mod => {
                                const isSelected = curNote.toLowerCase().includes(mod.tag);
                                return (
                                  <button
                                    key={mod.id}
                                    type="button"
                                    onClick={() => toggleTablePackQuickModifier(item.id, pIdx, mod.tag)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all border ${
                                      isSelected
                                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    {mod.icon} {mod.label.split('/')[0].trim()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal ({cart.reduce((sum, i) => sum + i.quantity, 0)} dishes)</span>
                <span className="font-bold text-white">RM {cartSubtotal.toFixed(2)}</span>
              </div>

              {isRm8DiscountApplied && (
                <div className="flex justify-between text-rose-400 font-bold bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                  <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-rose-400" /> Member Discount (60 pts)</span>
                  <span>-RM 8.00</span>
                </div>
              )}

              <div className="flex justify-between text-amber-400 font-bold">
                <span>Earned VIP Points (1 pt/dish)</span>
                <span>+{cart.reduce((sum, i) => sum + i.quantity, 0)} pts</span>
              </div>

              <div className="flex justify-between text-base font-black text-emerald-400 pt-2 border-t border-slate-800">
                <span>Total Amount</span>
                <span>RM {Math.max(0, cartSubtotal - (isRm8DiscountApplied ? 8.00 : 0)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsMobileCartOpen(false)} className="border-slate-800 text-slate-300">
              Close
            </Button>
            <Button
              disabled={isSubmitting || cart.length === 0}
              onClick={() => handlePlaceOrder(false)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Confirm & Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MEMBER POINT TRANSACTION HISTORY MODAL */}
      <Dialog open={showTxHistory} onOpenChange={setShowTxHistory}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md max-h-[80vh] overflow-y-auto font-mono p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-400">
              <History className="w-5 h-5 text-emerald-400" /> Point Activity & Recent Orders
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Loyalty transactions & points log for +{customerPhone}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2 text-xs">
            {getMembershipTransactions(customerPhone).length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-1">
                <Gift className="w-8 h-8 mx-auto text-slate-700" />
                <p>No transactions recorded yet.</p>
                <p className="text-[10px] text-slate-600">Order dishes to earn 1 point per dish!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {getMembershipTransactions(customerPhone).map((tx) => (
                  <div key={tx.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white text-xs">{tx.description}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tx.type.replace('_', ' ')}
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-sm ${tx.pointsChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.pointsChange >= 0 ? `+${tx.pointsChange}` : tx.pointsChange} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTxHistory(false)} className="border-slate-800 text-slate-300">
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DISH CUSTOMIZATION MODAL */}
      <DishCustomizationModal
        isOpen={!!customizingItem}
        onClose={() => setCustomizingItem(null)}
        onAddToCart={handleAddToCartCustomized}
        menuItem={customizingItem}
      />

      {/* EXISTING ORDER CONFIRMATION DIALOG */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2 text-lg font-bold">
              <Utensils className="w-5 h-5" /> Existing Order Found on Table #{tableNumber}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs font-mono">
              There is already an active order for this table. Would you like to add these items to the existing bill or start a new bill?
            </DialogDescription>
          </DialogHeader>

          {existingOrder && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="font-bold text-white">#{existingOrder.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-bold text-amber-400 uppercase">{existingOrder.status}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">Current Bill Total:</span>
                <span className="font-bold text-emerald-400">RM {Number(existingOrder.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2 font-mono">
            <Button 
              variant="outline" 
              onClick={() => handlePlaceOrder(true)}
              disabled={isSubmitting}
              className="border-slate-800 text-slate-300"
            >
              Start New Order
            </Button>
            <Button 
              onClick={handleAddToExisting}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Add to Existing Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
