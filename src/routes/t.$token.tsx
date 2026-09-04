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
import { Phone, UserCheck, ShieldCheck, ShieldAlert, Gift, History, Percent, LogOut, RefreshCw, Split, CreditCard, Moon, Menu } from 'lucide-react';
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
import { getAddonsConfig, CustomAddon } from '@/lib/addons-config';

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

  const [availableAddons, setAvailableAddons] = useState<CustomAddon[]>([]);

  useEffect(() => {
    setAvailableAddons(getAddonsConfig());
    const handleAddonsUpdate = () => setAvailableAddons(getAddonsConfig());
    window.addEventListener('warung_addons_updated', handleAddonsUpdate);
    return () => window.removeEventListener('warung_addons_updated', handleAddonsUpdate);
  }, []);

  const handleAddonDirectToCart = (addon: CustomAddon) => {
    const newItem: CartItem = {
      id: `addon_${addon.id}_${Date.now()}`,
      menuItemId: addon.id,
      name: addon.name,
      price: addon.price,
      quantity: 1,
      fulfillmentType: globalFulfillmentType,
      notes: 'Add-on / Sampingan',
      packNotes: [''],
      spiceLevel: 'Medium',
      selectedAddons: []
    };
    setCart(prev => [...prev, newItem]);
    toast.success(`🍱 Ditambah 1x ${addon.name} (+RM ${addon.price.toFixed(2)}) ke pesanan meja!`);
  };

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
          .select('id, table_number, store_id, stores(name, settings)')
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

        // Check store online ordering toggle
        // @ts-ignore
        const storeSettings = (tableData.stores as any)?.settings || {};
        if (storeSettings.online_ordering_enabled === false) {
          setIsClosedForDay(true);
        }

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
        notes: packNotes[idx] ? `Pinggan #${idx+1}: ${packNotes[idx]}` : (target.notes ?? ''),
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
          setIsMobileCartOpen(false); // Close cart dialog so confirmation dialog is visible!
          setShowOrderDialog(true);
          setIsSubmitting(false);
          return;
        }
      }

      // 1. Rate Limiting per Device / Session (Max 5 orders per minute)
      const rateLimitRes = checkOrderRateLimit(getOrCreateDeviceId());
      if (!rateLimitRes.allowed) {
        toast.error(`⚠️ Had Laju: Sila tunggu ${rateLimitRes.remainingSeconds} saat sebelum memesan semula.`);
        setIsSubmitting(false);
        return;
      }

      // 2. Authoritative Database Price & Stock Re-Validation
      const priceVal = await validateOrderPricesAgainstDB(storeId, cart);
      if (!priceVal.isValid) {
        toast.error(`⛔ Pesanan Disekat: ${priceVal.message || 'Harga atau stok tidak sepadan.'}`);
        setIsSubmitting(false);
        return;
      }

      const finalTotalAmount = Math.max(0, priceVal.expectedTotal - (isRm8DiscountApplied ? 8.00 : 0));

      // 3. Prepare order items
      const orderItemsToPlace = cart.flatMap(item => {
        if (item.quantity > 1 && item.packNotes && item.packNotes.length > 0) {
          return item.packNotes.slice(0, item.quantity).map((pNote, pIdx) => ({
            menu_item_id: item.menuItemId,
            quantity: 1,
            price: item.price,
            price_at_order: item.price,
            fulfillment_type: item.fulfillmentType || 'dine_in',
            container_size: item.containerSize || null,
            container_charge: item.containerCharge || 0,
            notes: pNote ? `Pinggan #${pIdx + 1}: ${pNote}` : (item.notes ? `${item.notes} (Pinggan #${pIdx + 1})` : '')
          }));
        }
        return [{
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          price_at_order: item.price,
          fulfillment_type: item.fulfillmentType || 'dine_in',
          container_size: item.containerSize || null,
          container_charge: item.containerCharge || 0,
          notes: item.notes || ''
        }];
      });

      let placedOrderId: string | null = null;

      // 4. Try atomic place_order RPC first (SECURITY DEFINER)
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('place_order', {
          p_order: {
            store_id: storeId,
            type: 'dine_in',
            table_id: tableId,
            customer_phone: customerPhone || null,
            discount_type: 'fixed',
            discount_value: isRm8DiscountApplied ? 8.00 : 0,
          },
          p_items: orderItemsToPlace.map(it => ({
            menu_item_id: it.menu_item_id,
            quantity: it.quantity,
            fulfillment_type: it.fulfillment_type,
            container_size: it.container_size,
            container_charge: it.container_charge,
            notes: it.notes
          })),
          p_payments: []
        });

        if (!rpcErr && rpcRes) {
          const resObj = rpcRes as any;
          if (resObj?.success !== false) {
            placedOrderId = resObj?.order_id || resObj?.id;
          }
        }
      } catch (rpcCatch) {
        console.warn('RPC place_order fallback to direct insert:', rpcCatch);
      }

      // 5. Fallback to direct insert if RPC did not return ID
      if (!placedOrderId) {
        const newTempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
        const insertPayload: any = {
          store_id: storeId,
          type: 'dine_in',
          status: 'pending',
          table_id: tableId,
          total_amount: finalTotalAmount,
          delivery_fee: null,
          delivery_service: null,
          customer_phone: customerPhone || null,
          delivery_address: null,
        };
        if (newTempId) insertPayload.id = newTempId;

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert(insertPayload)
          .select('id')
          .maybeSingle();

        if (orderError) throw orderError;
        placedOrderId = orderData?.id || newTempId || 'new_order';

        const orderItemsToInsert = orderItemsToPlace.map(it => ({
          order_id: placedOrderId,
          menu_item_id: it.menu_item_id,
          quantity: it.quantity,
          price_at_order: it.price,
          fulfillment_type: it.fulfillment_type,
          container_size: it.container_size,
          container_charge: it.container_charge,
          notes: it.notes
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItemsToInsert);

        if (itemsError) throw itemsError;
      }

      // Auto credit 1 point per dish + handle RM 8 discount deduction
      if (customerPhone && placedOrderId) {
        const totalDishes = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        if (isRm8DiscountApplied) {
          deductMemberPoints(customerPhone, 60, `RM 8.00 Discount used on Order #${placedOrderId.slice(0, 6)}`);
        }

        const updatedMem = addMemberPoints(customerPhone, totalDishes, `Earned ${totalDishes} pts (1 pt/dish) on Order #${placedOrderId.slice(0, 6)}`);
        setMemberData(updatedMem);
        toast.success(`💎 +${totalDishes} Member Point${totalDishes > 1 ? 's' : ''} Earned! Total: ${updatedMem.points} pts`);
      }

      // Update active table session order timestamp
      if (tableNumber) {
        await updateTableSessionOrderTime(tableNumber.toString());
      }

      // Clear cart & set active order tracker ID
      setCart([]);
      if (placedOrderId) {
        setActivePlacedOrderId(placedOrderId);
      }
      setShowOrderDialog(false);
      setIsMobileCartOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success("🎉 Pesanan berjaya dihantar ke dapur! Status sedang diproses.");
    } catch (err: any) {
      console.error('Error placing order:', err);
      const errMsg = err.message || 'Gagal menghantar pesanan. Sila panggil staf atau cuba sebentar lagi.';
      setError(errMsg);
      toast.error(`⛔ ${errMsg}`);
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
            fulfillment_type: item.fulfillmentType || 'dine_in',
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
          fulfillment_type: item.fulfillmentType || 'dine_in',
          container_size: item.containerSize || null,
          container_charge: item.containerCharge || 0,
          notes: item.notes || ''
        }];
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (itemsError) throw itemsError;

      // Safe update order total if permitted
      const newTotal = (Number(existingOrder.total_amount) || 0) + cartSubtotal;
      try {
        await supabase
          .from('orders')
          .update({ total_amount: newTotal })
          .eq('id', existingOrder.id);
      } catch (updateErr) {
        console.warn('Could not update total on orders (cashier will compute from items):', updateErr);
      }

      // Auto credit member points
      if (customerPhone) {
        const totalDishes = cart.reduce((sum, item) => sum + item.quantity, 0);
        const updatedMem = addMemberPoints(customerPhone, totalDishes, `Added ${totalDishes} items to Order #${existingOrder.id.slice(0, 6)}`);
        setMemberData(updatedMem);
      }

      setCart([]);
      setActivePlacedOrderId(existingOrder.id);
      setMergedNotification(existingOrder.id);
      setShowOrderDialog(false);
      setIsMobileCartOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success("🎉 Tambahan hidangan berjaya dihantar ke dapur!");
    } catch (err: any) {
      console.error('Error adding to order:', err);
      const errMsg = err.message || 'Gagal menambah hidangan ke pesanan sedia ada.';
      setError(errMsg);
      toast.error(`⛔ ${errMsg}`);
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-28 md:pb-12 selection:bg-orange-500 selection:text-white">
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
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3 rounded-xl gap-2 shadow-lg shadow-orange-500/20"
            >
              <RefreshCw className="w-4 h-4" /> Re-check Table Status
            </Button>
          </div>
        </div>
      )}

      {/* MOBILE-FIRST WRAPPER */}
      <div className="max-w-md mx-auto min-h-screen bg-[#f8fafc] shadow-2xl sm:border-x sm:border-slate-200/80 px-4 py-5 space-y-4">

        {/* 1. TOP HEADER BAR */}
        <div className="flex items-center justify-between pt-1 pb-1">
          {/* STORE BADGE (Rounded-xl, subtle border, bold text) */}
          <div className="bg-white border border-slate-200/90 px-4 py-2 rounded-2xl shadow-sm flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-full object-cover border border-orange-400" />
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              {storeName || 'Warung J&J'}
            </span>
          </div>

          {/* RIGHT SIDE UTILITY PILL */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-1 shadow-sm flex items-center gap-1">
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="relative p-2 text-slate-700 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"
              title="View Cart / Payment"
            >
              <CreditCard className="w-4 h-4" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                if (customerPhone) {
                  setShowTxHistory(true);
                } else {
                  setIsMemberModalOpen(true);
                }
              }}
              className="p-2 text-slate-700 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"
              title="VIP Loyalty & Offers"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="p-2 text-slate-700 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors"
              title="Menu Options"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. HERO PROMO BANNER (Dark charcoal #111827, rounded-2xl, special offer badge + hero image) */}
        <div className="bg-[#111827] text-white rounded-3xl p-5 shadow-xl relative overflow-hidden flex items-center justify-between border border-slate-800">
          <div className="space-y-3 z-10 max-w-[58%]">
            {/* SPECIAL OFFER! BADGE */}
            <div className="inline-flex items-center gap-1.5 bg-[#fde047] text-slate-950 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm">
              <span>SPECIAL OFFER!</span>
            </div>

            <div>
              <p className="text-xs text-slate-300 font-semibold tracking-wide">
                {storeName || 'Warung J&J Penampang'}
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Table-{tableNumber ? String(tableNumber).padStart(2, '0') : '01'}
              </h2>
            </div>

            <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
              Freshly cooked to order • Fast kitchen delivery
            </p>
          </div>

          {/* HERO IMAGE */}
          <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse" />
            <img
              src={filteredMenuItems.find(i => i.image_url)?.image_url || '/logo.png'}
              alt="Featured Dish"
              className="w-26 h-26 rounded-full object-cover shadow-2xl border-2 border-white/20 relative z-10 hover:scale-105 transition-transform"
            />
          </div>
        </div>

        {/* ACTIVE LIVE ORDER TRACKER (IF ORDER PLACED) */}
        {activePlacedOrderId && (
          <CustomerOrderTracker 
            orderId={activePlacedOrderId} 
            onClose={() => setActivePlacedOrderId(null)} 
          />
        )}

        {/* 3. CATEGORIES TITLE & CAROUSEL TABS */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Categories
            </h3>
            <button
              onClick={() => setSelectedCategory('All')}
              className="text-xs font-bold text-orange-500 hover:text-orange-600 hover:underline"
            >
              View all
            </button>
          </div>

          {/* HORIZONTAL SCROLLABLE CATEGORY PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar text-xs">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl font-extrabold shrink-0 transition-all uppercase tracking-wide text-xs ${
                    isSelected
                      ? 'bg-[#fed7aa] text-orange-900 shadow-sm border border-orange-300'
                      : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* SEARCH BAR & FILTER */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Chicken Burger, Nasi Ayam..."
              className="bg-white border-slate-200 pl-10 text-slate-900 placeholder:text-slate-400 text-xs rounded-2xl h-11 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4. FOOD MENU ITEM CARDS (Fauna Kitchen Vertical List) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-0.5 pb-1">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              {selectedCategory}
            </h4>
            <span className="text-xs text-slate-400 font-semibold">{filteredMenuItems.length} dishes</span>
          </div>

          {filteredMenuItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-2 shadow-sm">
              <Utensils className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-semibold">No dishes found in this category.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMenuItems.map((item) => {
                const isSoldOut = item.stock_count === 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!isSoldOut) setCustomizingItem(item);
                    }}
                    className={`bg-white rounded-2xl p-3 shadow-sm border border-slate-100/90 flex items-center justify-between gap-3 hover:shadow-md transition-all cursor-pointer active:scale-[0.99] ${
                      isSoldOut ? 'opacity-50 grayscale pointer-events-none' : ''
                    }`}
                  >
                    {/* LEFT: SQUARE ROUNDED THUMBNAIL (w-20 h-20) */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100 flex items-center justify-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Utensils className="w-7 h-7 text-slate-300" />
                      )}
                      {isSoldOut && (
                        <span className="absolute inset-0 bg-black/60 text-white font-black text-[9px] flex items-center justify-center uppercase">
                          Sold Out
                        </span>
                      )}
                    </div>

                    {/* MIDDLE: TITLE, SUBTEXT & ORANGE PRICE */}
                    <div className="flex-1 min-w-0 pr-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {item.description || item.category || 'Freshly prepared specialty dish'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-orange-500">
                          $ {item.price.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT: ORANGE SQUARED "+" ADD BUTTON */}
                    <button
                      type="button"
                      disabled={isSoldOut}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomizingItem(item);
                      }}
                      className="w-8 h-8 rounded-lg border border-orange-400 text-orange-500 hover:bg-orange-500 hover:text-white flex items-center justify-center font-black transition-all shrink-0 active:scale-90 shadow-sm"
                      title="Customize & Add to order"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DESKTOP/EXPANDED CART PREVIEW */}
        {cart.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3 mt-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wide">
                Your Order ({cart.reduce((s, i) => s + i.quantity, 0)} items)
              </span>
              <button
                onClick={() => setIsMobileCartOpen(true)}
                className="text-xs font-bold text-orange-500 hover:underline"
              >
                Expand
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="py-2 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{item.quantity}x {item.name}</span>
                    <span className="block text-[10px] text-slate-400">{item.fulfillmentType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine-in'}</span>
                  </div>
                  <span className="font-black text-slate-900">$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-extrabold text-sm text-slate-900">
              <span>Total</span>
              <span className="text-orange-500 text-base">$ {cartSubtotal.toFixed(2)}</span>
            </div>

            <Button
              disabled={isSubmitting || cart.length === 0}
              onClick={() => handlePlaceOrder(false)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-3 rounded-2xl shadow-lg shadow-orange-500/20 text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isSubmitting ? 'Sending Order...' : 'Confirm & Place Order'}</span>
            </Button>
          </div>
        )}

      </div>

      {/* MOBILE STICKY BOTTOM CART BAR */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200/80 p-3 z-40 shadow-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
              Total ({cart.reduce((s, i) => s + i.quantity, 0)} items)
            </span>
            <span className="text-lg font-black text-orange-500">$ {cartSubtotal.toFixed(2)}</span>
          </div>

          <Button
            onClick={() => setIsMobileCartOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-2.5 rounded-xl shadow-lg shadow-orange-500/25 flex items-center gap-2 text-xs transition-transform active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" /> View Cart ({cart.reduce((s, i) => s + i.quantity, 0)})
          </Button>
        </div>
      )}

      {/* MOBILE CART DRAWER */}
      <Dialog open={isMobileCartOpen} onOpenChange={setIsMobileCartOpen}>
        <DialogContent className="bg-white text-slate-900 border-slate-200 max-w-md max-h-[85vh] overflow-y-auto p-5 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
              <ShoppingBag className="w-5 h-5 text-orange-500" /> Your Order Cart
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Review your customized dishes before sending to kitchen
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="divide-y divide-slate-100">
              {cart.map((item) => {
                const qty = item.quantity;
                const packNotes = item.packNotes || Array(qty).fill('');

                return (
                  <div key={item.id} className="py-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">🍱 {item.name}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => toggleCartFulfillment(item.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all inline-flex items-center gap-1 ${
                              item.fulfillmentType === 'takeaway'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {item.fulfillmentType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine In'}
                          </button>
                          <span className="text-[10px] text-orange-600 font-extrabold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                            x{qty}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-orange-500 text-xs">
                          $ {(item.price * qty).toFixed(2)}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          {qty > 1 && (
                            <button
                              type="button"
                              onClick={() => splitTableCartItem(item.id)}
                              className="text-[9px] text-sky-600 hover:text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold"
                              title="Pecahkan kepada pinggan individu"
                            >
                              <Split className="w-2.5 h-2.5" /> Pecah
                            </button>
                          )}
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-rose-500 hover:text-rose-600 text-[10px] font-bold"
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
                          <div key={pIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-slate-700 flex items-center gap-1">
                                <span>{item.fulfillmentType === 'takeaway' ? '🥡 Pek' : '🍽️ Pinggan'} #{pIdx + 1}</span>
                                {qty > 1 && <span className="text-slate-400 font-normal">({pIdx + 1}/{qty})</span>}
                              </span>
                              {curNote && <span className="text-emerald-600 font-bold text-[9px]">✓ Ada Nota</span>}
                            </div>
                            <Input
                              value={curNote}
                              onChange={(e) => updateTablePackNote(item.id, pIdx, e.target.value)}
                              placeholder={`Nota Pinggan #${pIdx + 1} (cth: Tak nak sayur, ekstra pedas...)`}
                              className="h-7 bg-white border-slate-200 text-slate-900 text-[11px] rounded-lg"
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
                                        ? 'bg-orange-500 text-white border-orange-500 font-black'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    {mod.icon} {(mod.label.split('/')[0] ?? mod.label).trim()}
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

            {/* RECOMMENDED ADD-ONS UPSELL */}
            {availableAddons.filter(a => a.available).length > 0 && (
              <div className="pt-3 pb-1 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" /> Cadangan Lauk & Sampingan
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">1-Klik Tambah</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableAddons.filter(a => a.available).map(addon => (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => handleAddonDirectToCart(addon)}
                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-orange-400 flex items-center justify-between gap-1 text-left text-xs transition-all active:scale-95 group shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-800 block text-[11px] truncate group-hover:text-orange-600">
                          {addon.name}
                        </span>
                        <span className="text-[10px] text-orange-500 font-black">
                          +$ {addon.price.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors text-xs font-black">
                        +
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal ({cart.reduce((sum, i) => sum + i.quantity, 0)} dishes)</span>
                <span className="font-bold text-slate-900">$ {cartSubtotal.toFixed(2)}</span>
              </div>

              {isRm8DiscountApplied && (
                <div className="flex justify-between text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <span className="flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-rose-500" /> Member Discount (60 pts)</span>
                  <span>-$ 8.00</span>
                </div>
              )}

              <div className="flex justify-between text-orange-600 text-[11px] font-bold">
                <span>Earned VIP Points (1 pt/dish)</span>
                <span>+{cart.reduce((sum, i) => sum + i.quantity, 0)} pts</span>
              </div>

              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                <span>Total Amount</span>
                <span className="text-orange-500 text-lg">$ {Math.max(0, cartSubtotal - (isRm8DiscountApplied ? 8.00 : 0)).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsMobileCartOpen(false)} className="border-slate-200 text-slate-700">
              Close
            </Button>
            <Button
              disabled={isSubmitting || cart.length === 0}
              onClick={() => handlePlaceOrder(false)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black"
            >
              {isSubmitting ? 'Submitting Order...' : 'Confirm & Place Order'}
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
