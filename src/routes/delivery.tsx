// src/routes/delivery.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ShoppingBag, 
  MapPin, 
  Phone, 
  User, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  ChevronRight, 
  ShieldCheck, 
  MessageCircle, 
  Download, 
  Copy, 
  Check, 
  QrCode, 
  Receipt, 
  Building2, 
  CreditCard, 
  Globe, 
  Split, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  SlidersHorizontal,
  Flame,
  ArrowRight,
  Clock,
  Navigation
} from 'lucide-react';
import { toast } from 'sonner';
import { createToyyibPayCheckout } from '@/lib/toyyibpay';
import { COMMON_MODIFIERS } from '@/lib/kitchen-checklist-config';
import { DishCustomizationModal, CustomizedCartItem } from '@/components/DishCustomizationModal';

export const Route = createFileRoute('/delivery')({
  component: CustomerDeliveryPage,
});

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string | null;
  stock_count?: number | null;
  is_available: boolean;
  description?: string;
}

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  packNotes?: string[];
  containerCharge?: number;
  selectedAddons?: { name: string; price: number }[];
  spiceLevel?: string;
}

// Base Coordinates for Warung J&J (de Baxters Café, a17, Jln Datuk Panglima Banting, 89500 Penampang, Sabah)
const WARUNG_LAT = 5.9284138;
const WARUNG_LNG = 116.1145036;

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100;
}

function CustomerDeliveryPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Search and Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Customer & Delivery Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [custLat, setCustLat] = useState<number>(5.9141659);
  const [custLng, setCustLng] = useState<number>(116.085516);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number>(6.6);
  const [travelTimeMins, setTravelTimeMins] = useState<number>(12);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showDuitNowModal, setShowDuitNowModal] = useState(false);

  // Distance & Fee Calculations (Based on actual road driving distance)
  const isOutOfZone = roadDistanceKm > 15.0;
  const deliveryFee = Math.max(Math.round(roadDistanceKm * 1.00 * 100) / 100, 2.00);

  const foodSubtotal = cart.reduce((sum, item) => sum + (item.price + (item.containerCharge || 0)) * item.quantity, 0);
  const grandTotal = foodSubtotal + (cart.length > 0 ? deliveryFee : 0);
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const [storeId, setStoreId] = useState<string | null>(null);
  const [storePhone, setStorePhone] = useState<string>('60172221784');
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [isFPXLoading, setIsFPXLoading] = useState(false);

  // Calculate actual road distance via OSRM Routing Engine
  const fetchRoadRoute = async (destLat: number, destLng: number) => {
    setIsCalculatingRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${WARUNG_LNG},${WARUNG_LAT};${destLng},${destLat}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distKm = Math.round((route.distance / 1000) * 10) / 10;
        const durMins = Math.max(5, Math.ceil(route.duration / 60) + 3);
        setRoadDistanceKm(distKm);
        setTravelTimeMins(durMins);
      } else {
        // Fallback to Haversine * 1.35 (standard urban road detour multiplier)
        const straightKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, destLat, destLng);
        const estimatedRoadKm = Math.round(straightKm * 1.35 * 10) / 10;
        setRoadDistanceKm(estimatedRoadKm);
        setTravelTimeMins(Math.max(5, Math.ceil(estimatedRoadKm * 2)));
      }
    } catch (e) {
      const straightKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, destLat, destLng);
      const estimatedRoadKm = Math.round(straightKm * 1.35 * 10) / 10;
      setRoadDistanceKm(estimatedRoadKm);
      setTravelTimeMins(Math.max(5, Math.ceil(estimatedRoadKm * 2)));
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchStore();
    fetchRoadRoute(custLat, custLng);

    // Check for ToyyibPay FPX redirect return params
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const statusId = searchParams.get('status_id');
      const orderIdParam = searchParams.get('order_id');

      if (statusId === '1') {
        toast.success('🎉 Pembayaran FPX berjaya disahkan! Pesanan anda sedang diproses.', { duration: 6000 });
        if (orderIdParam) {
          supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
            })
            .eq('id', orderIdParam)
            .then(() => {});
        }
        setCart([]);
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (statusId === '3') {
        toast.error('❌ Pembayaran FPX tidak berjaya atau dibatalkan. Sila cuba lagi.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const fetchStore = async () => {
    const { data } = await supabase.from('stores').select('id, phone_number, phone_number_2').limit(1).single();
    if (data) {
      setStoreId(data.id);
      if (data.phone_number) setStorePhone(data.phone_number);
    }
  };

  const fetchMenuItems = async () => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category', { ascending: true });

    if (!error && data) {
      setMenuItems(data as MenuItem[]);
      if (data.length > 0 && (data[0] as any).store_id) {
        setStoreId((data[0] as any).store_id);
      }
    }
    setLoadingItems(false);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return ['all', ...Array.from(set)];
  }, [menuItems]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  // Handle adding customized item from modal
  const handleAddToCartCustomized = (custItem: CustomizedCartItem) => {
    const newItem: CartItem = {
      id: custItem.id,
      menuItemId: custItem.menuItemId,
      name: custItem.name,
      price: custItem.basePrice,
      quantity: custItem.quantity,
      containerCharge: 1.00, // standard packaging fee
      notes: custItem.notes,
      packNotes: custItem.packNotes || Array(custItem.quantity).fill(''),
      selectedAddons: custItem.selectedAddons,
      spiceLevel: custItem.spiceLevel
    };

    setCart(prev => [...prev, newItem]);
    toast.success(`🛒 Ditambah ${custItem.quantity}x ${custItem.name} ke troli!`);
  };

  // Fast quick-add without modal
  const handleQuickAdd = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) {
        const nextQty = existing.quantity + 1;
        const currentPackNotes = [...(existing.packNotes || Array(existing.quantity).fill(''))];
        while (currentPackNotes.length < nextQty) currentPackNotes.push('');
        return prev.map(i => i.menuItemId === item.id ? { 
          ...i, 
          quantity: nextQty,
          packNotes: currentPackNotes
        } : i);
      }
      return [...prev, { 
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1, 
        containerCharge: 1.00,
        notes: '',
        packNotes: ['']
      }];
    });
    toast.success(`Ditambah 1x ${item.name} 🛒`);
  };

  const handleQuantityChange = (cartItemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === cartItemId || item.menuItemId === cartItemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
          while (currentPackNotes.length < newQty) {
            currentPackNotes.push('');
          }
          return { 
            ...item, 
            quantity: newQty,
            packNotes: currentPackNotes.slice(0, newQty)
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
    toast.info('Item dipadam dari troli.');
  };

  const updatePackNote = (cartItemId: string, packIndex: number, note: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId || item.menuItemId === cartItemId) {
        const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
        currentPackNotes[packIndex] = note;
        return {
          ...item,
          packNotes: currentPackNotes,
          notes: currentPackNotes.map((n, i) => `Pek #${i+1}: ${n || 'Standard'}`).join(' | ')
        };
      }
      return item;
    }));
  };

  const togglePackQuickModifier = (cartItemId: string, packIndex: number, tag: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId || item.menuItemId === cartItemId) {
        const currentPackNotes = [...(item.packNotes || Array(item.quantity).fill(''))];
        const currentNote = currentPackNotes[packIndex] || '';
        let nextNote = currentNote;
        if (currentNote.toLowerCase().includes(tag.toLowerCase())) {
          nextNote = currentNote.replace(new RegExp(tag, 'gi'), '').replace(/,\s*,/g, ',').trim();
        } else {
          nextNote = currentNote ? `${currentNote}, ${tag}` : tag;
        }
        currentPackNotes[packIndex] = nextNote;
        return {
          ...item,
          packNotes: currentPackNotes,
          notes: currentPackNotes.map((n, i) => `Pek #${i+1}: ${n || 'Standard'}`).join(' | ')
        };
      }
      return item;
    }));
  };

  const splitDeliveryItem = (cartItemId: string) => {
    setCart(prev => {
      const target = prev.find(i => i.id === cartItemId || i.menuItemId === cartItemId);
      if (!target || target.quantity <= 1) return prev;
      const targetIndex = prev.findIndex(i => i.id === cartItemId || i.menuItemId === cartItemId);
      const packNotes = target.packNotes || Array(target.quantity).fill('');
      const individualItems: CartItem[] = Array.from({ length: target.quantity }).map((_, idx) => ({
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: target.menuItemId,
        name: target.name,
        price: target.price,
        quantity: 1,
        containerCharge: target.containerCharge || 1.00,
        notes: packNotes[idx] ? `Pek #${idx+1}: ${packNotes[idx]}` : target.notes,
        packNotes: [packNotes[idx] || ''],
        selectedAddons: target.selectedAddons,
        spiceLevel: target.spiceLevel
      }));
      const nextCart = [...prev];
      nextCart.splice(targetIndex, 1, ...individualItems);
      return nextCart;
    });
    toast.success('Bungkusan dipecahkan kepada pek individu untuk pengkhususan berasingan.');
  };

  const handleSearchAddress = async (addrText?: string) => {
    const textToSearch = addrText || deliveryAddress;
    if (!textToSearch || textToSearch.trim().length < 3) return;

    setIsSearchingAddress(true);
    try {
      // Search Nominatim within Sabah/Malaysia context
      const query = encodeURIComponent(`${textToSearch}, Sabah, Malaysia`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setCustLat(lat);
        setCustLng(lon);
        await fetchRoadRoute(lat, lon);
        toast.success(`Lokasi dikesan: ${data[0].display_name.split(',')[0]} 📍`);
      } else {
        // Fallback: estimate route with current coordinates
        await fetchRoadRoute(custLat, custLng);
      }
    } catch (e) {
      await fetchRoadRoute(custLat, custLng);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustLat(lat);
        setCustLng(lng);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          if (data && data.display_name) {
            setDeliveryAddress(data.display_name);
            toast.success("Alamat lokasi GPS berjaya dikesan! 📍");
          } else {
            toast.success(`Koordinat GPS dikesan: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (e) {
          toast.success(`Koordinat GPS dikesan: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }

        // Calculate accurate road route distance from Warung J&J
        await fetchRoadRoute(lat, lng);
      }, () => {
        toast.error("Tidak dapat mengesan lokasi GPS secara automatik. Sila taip alamat manual.");
      });
    }
  };

  const handleSendWhatsAppProof = () => {
    const cleanPhone = (storePhone || '60172221784').replace(/\D/g, '');
    const shortId = activeOrderId ? activeOrderId.slice(0, 8).toUpperCase() : 'NEW';
    const message = `*HALO WARUNG J&J, SAYA TELAH MEMBUAT BAYARAN DELIVERY:*

🆔 *Order ID:* #${shortId}
👤 *Nama:* ${customerName}
📞 *Telefon:* ${customerPhone}
📍 *Alamat:* ${deliveryAddress}
💰 *Jumlah Bayaran:* RM ${grandTotal.toFixed(2)}

(Sila semak resit pembayaran yang saya lampirkan ini 🙏)`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = '/duitnow-qr.png';
    link.download = 'Warung_JJ_DuitNow_QR.png';
    link.click();
    toast.success('DuitNow QR dimuat turun! Buka aplikasi bank anda untuk imbas.');
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(grandTotal.toFixed(2));
    setCopiedAmount(true);
    toast.success(`Jumlah RM ${grandTotal.toFixed(2)} disalin!`);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleCopyBankAcc = (accNum: string) => {
    navigator.clipboard.writeText(accNum);
    setCopiedBankAcc(true);
    toast.success('No. Akaun Alliance Bank disalin! 📋');
    setTimeout(() => setCopiedBankAcc(false), 2000);
  };

  const handleProceedToFPX = async () => {
    setIsFPXLoading(true);
    try {
      const orderRefId = activeOrderId || 'ORD-' + Date.now().toString().slice(-6);
      const res = await createToyyibPayCheckout({
        orderId: orderRefId,
        totalAmount: grandTotal,
        customerName: customerName,
        customerPhone: customerPhone,
      });
      if (res.success && res.paymentUrl) {
        toast.success('Membuka portal FPX Online Banking...');
        setTimeout(() => {
          window.location.href = res.paymentUrl!;
        }, 1000);
      } else {
        toast.error(res.message || 'Sesi FPX tidak dapat dimulakan.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Ralat pembayaran FPX.');
    } finally {
      setIsFPXLoading(false);
    }
  };

  const handlePlaceDeliveryOrder = async () => {
    if (!customerName.trim()) {
      toast.error('Sila masukkan nama penuh anda');
      return;
    }
    const phoneClean = customerPhone.replace(/\D/g, '');
    if (!phoneClean.startsWith('01') || phoneClean.length < 10 || phoneClean.length > 11) {
      toast.error('Sila masukkan nombor telefon bimbit Malaysia yang sah (cth: 0198887766)');
      return;
    }
    if (!deliveryAddress.trim()) {
      toast.error('Sila masukkan alamat penghantaran lengkap');
      return;
    }
    if (foodSubtotal < 15.00) {
      toast.error('Pesanan minimum makanan untuk delivery adalah RM 15.00');
      return;
    }
    if (isOutOfZone) {
      toast.error(`Maaf, alamat anda (${roadDistanceKm}km) berada di luar zon penghantaran 15km.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('place_order', {
        p_order: {
          type: 'delivery',
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          delivery_lat: custLat,
          delivery_lng: custLng,
          delivery_fee: deliveryFee,
          discount_type: 'fixed',
          discount_value: 0,
          store_id: storeId
        },
        p_items: cart.flatMap(item => {
          if (item.quantity > 1 && item.packNotes && item.packNotes.length > 0) {
            return item.packNotes.slice(0, item.quantity).map((pNote, pIdx) => ({
              menu_item_id: item.menuItemId,
              quantity: 1,
              fulfillment_type: 'takeaway',
              container_charge: item.containerCharge || 1.00,
              notes: pNote ? pNote : (item.notes ? `${item.notes} (Pek #${pIdx + 1})` : '')
            }));
          }
          return [{
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            fulfillment_type: 'takeaway',
            container_charge: item.containerCharge || 1.00,
            notes: item.notes || ''
          }];
        }),
        p_payments: []
      });

      if (rpcErr) throw rpcErr;

      const resObj = (rpcRes as any);
      if (resObj?.success === false) {
        throw new Error(resObj.message || 'Gagal menghantar pesanan penghantaran.');
      }

      const newOrderId = resObj.order_id;
      if (newOrderId) {
        // Guarantee delivery_fee, coords and delivery_service are saved accurately in database
        await supabase
          .from('orders')
          .update({
            delivery_fee: deliveryFee,
            delivery_address: deliveryAddress,
            customer_name: customerName,
            customer_phone: customerPhone,
            delivery_service: 'jnj',
            total_amount: grandTotal,
          })
          .eq('id', newOrderId);
      }

      setActiveOrderId(newOrderId);
      setIsCartDrawerOpen(false);
      setShowDuitNowModal(true);
      toast.success('Pesanan disimpan! Sila teruskan dengan bayaran.');
    } catch (err: any) {
      toast.error(`Pesanan Gagal: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-32">
      {/* HEADER BANNER */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30 text-emerald-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl tracking-tight text-white flex items-center gap-1.5">
                Warung J&J Delivery 🛵
              </h1>
              <p className="text-[11px] text-emerald-400 font-mono flex items-center gap-2">
                <span>⚡ RM1.00 / km</span>
                <span>•</span>
                <span>⏱️ 25-40 minit</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono text-xs px-3 py-1 hidden sm:inline-flex">
              Zon 15km Penampang
            </Badge>

            {cart.length > 0 && (
              <Button
                onClick={() => setIsCartDrawerOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-lg"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Troli</span>
                <span className="bg-emerald-950 px-1.5 py-0.5 rounded-md text-[10px]">{totalCartCount}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        {/* ACTIVE ORDER TRACKER BANNER */}
        {activeOrderId && (
          <div className="bg-slate-900 border-2 border-emerald-500 p-4 rounded-3xl space-y-2 shadow-2xl animate-fade-in font-mono">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 animate-spin" /> Pesanan Delivery Aktif
              </span>
              <Badge className="bg-emerald-500 text-slate-950 font-black"># {activeOrderId.slice(0, 8)}</Badge>
            </div>
            <p className="text-xs text-slate-200">
              ⏳ Menunggu pengesahan bayaran DuitNow / FPX. Pesanan akan terus dimasak di dapur sebaik bayaran disahkan!
            </p>
          </div>
        )}

        {/* DELIVERY ADDRESS & ZONE CHECK CARD */}
        <Card className="bg-slate-900 border-slate-800 text-white rounded-3xl shadow-xl overflow-hidden font-mono">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" /> 1. Alamat Penghantaran & Jarak Laluan
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGetLocation} 
                className="bg-slate-950 border-slate-800 text-emerald-400 text-xs rounded-xl hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Kesan Lokasi GPS</span>
              </Button>
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Masukkan alamat lengkap (Nama Jalan, Bangunan / Pejabat, Bandar, Poskod)..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                onBlur={() => handleSearchAddress()}
                className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 rounded-2xl text-xs sm:text-sm min-h-[60px]"
              />

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isSearchingAddress || isCalculatingRoute}
                  onClick={() => handleSearchAddress()}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 h-7 px-2.5 rounded-lg border border-emerald-500/20"
                >
                  {isSearchingAddress || isCalculatingRoute ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" /> Mengira Laluan...
                    </>
                  ) : (
                    <>
                      <Search className="w-3 h-3 mr-1" /> Sahkan Lokasi & Kira Jarak
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
                <span className="text-slate-400 text-[10px] block mb-0.5">Jarak Laluan Sebenar:</span>
                <span className={`font-black text-sm ${isOutOfZone ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {roadDistanceKm} km {isOutOfZone ? '⚠️ (Luar Zon)' : '✓'}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
                <span className="text-slate-400 text-[10px] block mb-0.5">Anggaran Masa Rider:</span>
                <span className="font-black text-sm text-sky-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> ~{travelTimeMins} minit
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
                <span className="text-slate-400 text-[10px] block mb-0.5">Caj Penghantaran:</span>
                <span className="font-black text-sm text-amber-400">
                  RM {deliveryFee.toFixed(2)}
                </span>
              </div>
            </div>

            {isOutOfZone && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Maaf, kami hanya menghantar dalam zon 15km dari Warung J&J (de Baxters Café Penampang). Sila pilih alamat yang lebih hampir.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SEARCH AND CATEGORY FILTER BAR */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Cari makanan kegemaran anda (cth: Nasi Goreng, Sup Tulang, Tomyam)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border-slate-800 text-white pl-10 h-11 rounded-2xl text-xs sm:text-sm placeholder:text-slate-500 font-mono shadow-inner"
            />
          </div>

          {/* CATEGORY FILTER CHIPS */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none font-mono">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg scale-105'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {cat === 'all' ? '🍽️ Semua Menu' : `🥘 ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* MENU ITEMS GRID */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono">
            <h2 className="font-black text-lg text-white flex items-center gap-2">
              <span>Pilihan Menu Makanan 🍜</span>
            </h2>
            <span className="text-xs text-slate-400">{filteredMenuItems.length} hidangan</span>
          </div>

          {loadingItems ? (
            <div className="text-center py-12 text-slate-500 font-mono flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <span>Memuat turun menu Warung J&J...</span>
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 text-slate-500 font-mono text-xs">
              Tiada menu dijumpai untuk carian ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {filteredMenuItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                const isSoldOut = item.stock_count !== null && item.stock_count !== undefined && item.stock_count <= 0;

                return (
                  <Card key={item.id} className="bg-slate-900 border-slate-800 text-white rounded-3xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg">
                    <CardContent className="p-4 flex gap-3.5 items-center">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-slate-800 shadow-md" 
                        />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-950 rounded-2xl shrink-0 border border-slate-800 flex items-center justify-center text-slate-700 font-black font-mono text-sm">
                          J&J
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-white text-sm sm:text-base leading-tight truncate">{item.name}</h3>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{item.description}</p>
                        )}
                        <p className="text-[10px] text-slate-500 capitalize font-mono">{item.category}</p>
                        <p className="font-black text-emerald-400 text-sm sm:text-base font-mono">RM {item.price.toFixed(2)}</p>
                      </div>
                    </CardContent>

                    {/* ACTION BUTTONS */}
                    <div className="p-3 pt-0 border-t border-slate-800/60 bg-slate-950/40 flex items-center justify-between gap-2 font-mono">
                      {inCart ? (
                        <div className="w-full flex items-center justify-between bg-slate-900 border border-slate-800 p-1 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="w-7 h-7 text-slate-300 hover:bg-slate-800" 
                              onClick={() => handleQuantityChange(inCart.id, -1)}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>
                            <span className="font-mono font-bold text-xs text-emerald-400 w-5 text-center">
                              {inCart.quantity}
                            </span>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="w-7 h-7 text-slate-300 hover:bg-slate-800" 
                              onClick={() => handleQuantityChange(inCart.id, 1)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCustomizingItem(item)}
                            className="text-[10px] text-amber-400 hover:text-amber-300 px-2 h-7"
                          >
                            ✏️ Kustom
                          </Button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center gap-2">
                          <Button
                            disabled={isSoldOut}
                            onClick={() => setCustomizingItem(item)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-8 text-xs shadow-md active:scale-95 flex items-center justify-center gap-1"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>Pilih & Kustom</span>
                          </Button>
                          <Button
                            disabled={isSoldOut}
                            onClick={() => handleQuickAdd(item)}
                            variant="outline"
                            className="border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 h-8 px-2.5 rounded-xl text-xs"
                            title="Tambah terus 1x"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* CUSTOMER CONTACT & IN-PAGE CHECKOUT CARD */}
        {cart.length > 0 && (
          <Card className="bg-slate-900 border-2 border-emerald-500/40 text-white rounded-3xl shadow-2xl font-mono">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="font-black text-base text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" /> 2. Maklumat Penerima Pesanan
                </h2>
                <span className="text-[10px] text-emerald-400 font-bold">Wajib Diisi</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nama Penuh Penerima</label>
                  <Input
                    placeholder="Contoh: Encik Farhan / Puan Siti"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl text-xs h-10"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">No. Telefon Bimbit (WhatsApp)</label>
                  <Input
                    placeholder="Contoh: 0198887766"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl text-xs h-10"
                  />
                </div>
              </div>

              {/* CART ITEMS SUMMARY & PER-PACK SPECIFICATION IN MAIN PAGE */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" /> 3. Semakan Bungkusan ({totalCartCount} Pek)
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCartDrawerOpen(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 h-7"
                  >
                    Buka Troli Terperinci ↗
                  </Button>
                </div>

                <div className="space-y-3">
                  {cart.map((cItem) => {
                    const qty = cItem.quantity;
                    const packNotes = cItem.packNotes || Array(qty).fill('');

                    return (
                      <div key={cItem.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 shadow-inner">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800/80 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white">🍱 {cItem.name}</span>
                            <span className="font-black text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                              x{qty} (RM {(cItem.price * qty).toFixed(2)})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {qty > 1 && (
                              <button
                                type="button"
                                onClick={() => splitDeliveryItem(cItem.id)}
                                className="px-2 py-1 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1"
                                title="Pecahkan kepada entri berasingan"
                              >
                                <Split className="w-3 h-3" /> Pecah
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeFromCart(cItem.id)}
                              className="text-rose-400 hover:text-rose-300 text-[10px]"
                            >
                              Padam
                            </button>
                          </div>
                        </div>

                        {/* PER-PACK BREAKDOWN */}
                        <div className="space-y-2">
                          {Array.from({ length: qty }).map((_, pIdx) => {
                            const currentNote = packNotes[pIdx] || '';
                            return (
                              <div key={pIdx} className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-xs">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-bold text-amber-400 flex items-center gap-1">
                                    <span>🥡 Bungkusan #{pIdx + 1}</span>
                                    {qty > 1 && <span className="text-slate-500 font-normal">({pIdx + 1}/{qty})</span>}
                                  </span>
                                  {currentNote && <span className="text-emerald-400 text-[9px]">✓ Ada Nota</span>}
                                </div>

                                <Input
                                  placeholder={`Nota Bungkusan #${pIdx + 1} (cth: Tak nak lada, ekstra pedas...)`}
                                  value={currentNote}
                                  onChange={(e) => updatePackNote(cItem.id, pIdx, e.target.value)}
                                  className="h-7 bg-slate-950 border-slate-800 text-white text-[11px] rounded-lg"
                                />

                                {/* QUICK MODIFIER CHIPS */}
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {COMMON_MODIFIERS.slice(0, 5).map(mod => {
                                    const isSelected = currentNote.toLowerCase().includes(mod.tag);
                                    return (
                                      <button
                                        key={mod.id}
                                        type="button"
                                        onClick={() => togglePackQuickModifier(cItem.id, pIdx, mod.tag)}
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all border ${
                                          isSelected
                                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
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
              </div>

              {/* PRICE SUMMARY CARD */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal Makanan ({totalCartCount} pek):</span>
                  <span className="font-bold text-white">RM {foodSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Caj Penghantaran ({roadDistanceKm}km @ RM1/km):</span>
                  <span className="font-bold text-white">RM {deliveryFee.toFixed(2)}</span>
                </div>

                {/* MINIMUM ORDER PROGRESS BAR */}
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Pesanan Minimum Delivery (RM 15.00)</span>
                    <span className={foodSubtotal >= 15.00 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {foodSubtotal >= 15.00 ? '✓ Tercapai' : `Kurang RM ${(15.00 - foodSubtotal).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full transition-all duration-300 ${foodSubtotal >= 15.00 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, (foodSubtotal / 15.00) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 flex justify-between text-base font-black text-white">
                  <span>Jumlah Keseluruhan:</span>
                  <span className="text-emerald-400">RM {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-98 transition-all"
                onClick={handlePlaceDeliveryOrder}
                disabled={isSubmitting || cart.length === 0 || isOutOfZone || foodSubtotal < 15.00}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Memproses Pesanan...
                  </>
                ) : (
                  <>
                    <span>TERUSKAN KE BAYARAN (RM {grandTotal.toFixed(2)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* FLOATING STICKY BOTTOM CART BAR */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 sm:p-4 z-40 shadow-2xl font-mono">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Jumlah ({totalCartCount} Bungkusan)</span>
                <span className="text-base sm:text-lg font-black text-emerald-400">
                  RM {grandTotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsCartDrawerOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2.5 rounded-xl text-xs border border-slate-700 flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Semak Troli</span>
                </Button>

                <Button 
                  onClick={handlePlaceDeliveryOrder}
                  disabled={isSubmitting || isOutOfZone || foodSubtotal < 15.00}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-xl flex items-center gap-2 active:scale-95 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Bayar Sekarang</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* DISH CUSTOMIZATION MODAL (REUSED FROM TABLE QR MODAL) */}
        <DishCustomizationModal
          isOpen={!!customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleAddToCartCustomized}
          menuItem={customizingItem}
        />

        {/* CART DRAWER DIALOG */}
        <Dialog open={isCartDrawerOpen} onOpenChange={setIsCartDrawerOpen}>
          <DialogContent className="bg-slate-900 text-white border-slate-800 max-w-lg max-h-[85vh] overflow-y-auto font-mono p-5 rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-400">
                <ShoppingBag className="w-5 h-5" /> Troli Pesanan Delivery ({totalCartCount} Pek)
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Semak spesifikasi bungkusan sebelum menghantar pesanan
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
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              x{qty}
                            </span>
                            {item.spiceLevel && (
                              <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/20">
                                🌶️ {item.spiceLevel}
                              </span>
                            )}
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
                                onClick={() => splitDeliveryItem(item.id)}
                                className="text-[9px] text-sky-400 hover:text-sky-300 bg-sky-950/60 border border-sky-500/30 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                title="Pecahkan kepada entri berasingan"
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

                      {/* PER-PACK SPECIFICATION ROWS */}
                      <div className="space-y-1.5 pt-1">
                        {Array.from({ length: qty }).map((_, pIdx) => {
                          const curNote = packNotes[pIdx] || '';
                          return (
                            <div key={pIdx} className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-amber-400 flex items-center gap-1">
                                  <span>🥡 Pek #{pIdx + 1}</span>
                                  {qty > 1 && <span className="text-slate-500 font-normal">({pIdx + 1}/{qty})</span>}
                                </span>
                                {curNote && <span className="text-emerald-400 text-[9px]">✓ Ada Nota</span>}
                              </div>

                              <Input
                                value={curNote}
                                onChange={(e) => updatePackNote(item.id, pIdx, e.target.value)}
                                placeholder={`Nota Pek #${pIdx + 1} (cth: Tak nak lada, sambal asing...)`}
                                className="h-7 bg-slate-900 border-slate-800 text-white text-[11px] rounded-lg"
                              />

                              {/* QUICK CHIPS */}
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {COMMON_MODIFIERS.slice(0, 5).map(mod => {
                                  const isSelected = curNote.toLowerCase().includes(mod.tag);
                                  return (
                                    <button
                                      key={mod.id}
                                      type="button"
                                      onClick={() => togglePackQuickModifier(item.id, pIdx, mod.tag)}
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
                  <span>Subtotal Makanan:</span>
                  <span className="font-bold text-white">RM {foodSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Caj Penghantaran:</span>
                  <span className="font-bold text-white">RM {deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-emerald-400 pt-2 border-t border-slate-800">
                  <span>Jumlah Keseluruhan:</span>
                  <span>RM {grandTotal.toFixed(2)}</span>
                </div>

                <Button
                  onClick={() => {
                    setIsCartDrawerOpen(false);
                    handlePlaceDeliveryOrder();
                  }}
                  disabled={isSubmitting || cart.length === 0 || foodSubtotal < 15.00}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-xl flex items-center justify-center gap-2 text-xs mt-2"
                >
                  <Check className="w-4 h-4" /> {isSubmitting ? 'Memproses...' : 'Teruskan ke Pembayaran'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 3-IN-1 MALAYSIAN PAYMENT MODAL */}
        <Dialog open={showDuitNowModal} onOpenChange={setShowDuitNowModal}>
          <DialogContent className="sm:max-w-[420px] bg-slate-900 text-white border-slate-800 p-4 sm:p-5 rounded-3xl max-h-[92vh] overflow-y-auto">
            <DialogHeader className="text-center sm:text-center pb-1">
              <DialogTitle className="text-xl font-black flex items-center justify-center gap-2 text-rose-400">
                <CreditCard className="w-5 h-5 text-rose-500" /> Kaedah Pembayaran
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="duitnow" className="w-full">
              {/* PAYMENT TABS SELECTOR */}
              <TabsList className="grid grid-cols-3 bg-slate-950 p-1 rounded-2xl border border-slate-800 h-10 w-full mb-3">
                <TabsTrigger value="duitnow" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                  📱 DuitNow
                </TabsTrigger>
                <TabsTrigger value="bank" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-sky-600 data-[state=active]:text-white">
                  🏦 Transfer
                </TabsTrigger>
                <TabsTrigger value="fpx" className="text-[11px] font-bold rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  🌐 FPX Pay
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: DUITNOW QR */}
              <TabsContent value="duitnow" className="space-y-3 mt-0 focus-visible:outline-none">
                <div className="flex flex-col items-center justify-center space-y-2.5">
                  <div className="relative group bg-white p-2.5 rounded-2xl shadow-2xl border-4 border-[#a6192e] w-full max-w-[230px] flex flex-col items-center text-center">
                    {/* Header */}
                    <div className="w-full bg-[#a6192e] text-white text-[10px] font-black py-1 px-2.5 rounded-lg tracking-wider uppercase flex items-center justify-between mb-1.5">
                      <span className="font-sans font-bold">WARUNG JNJ</span>
                      <span className="text-[9px] font-mono bg-white/20 px-1.5 py-0.5 rounded-full">DuitNow QR</span>
                    </div>

                    {/* QR Code with Centered Warung Logo */}
                    <div className="relative w-full flex items-center justify-center">
                      <img 
                        src="/duitnow-qr.png" 
                        alt="Warung JNJ DuitNow QR" 
                        className="w-full h-auto rounded-lg object-contain max-h-[160px]"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white p-0.5 rounded-lg shadow-md border-2 border-[#a6192e]">
                          <img src="/warung-logo.png" alt="Warung JNJ Logo" className="w-7 h-7 object-contain rounded-md" />
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="w-full mt-1.5 pt-1.5 border-t border-gray-100 font-mono text-center">
                      <p className="text-[10px] font-black text-[#a6192e] uppercase tracking-wide">Alliance Bank</p>
                      <p className="text-[8px] text-gray-500 font-semibold leading-none">Alliance Bank Malaysia Berhad</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadQR}
                    className="bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white rounded-xl text-xs gap-1.5 h-7 px-3"
                  >
                    <Download className="w-3 h-3 text-rose-400" />
                    Simpan / Download QR
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 2: DIRECT BANK TRANSFER (ALLIANCE BANK) */}
              <TabsContent value="bank" className="space-y-3 mt-0 focus-visible:outline-none">
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 text-left">
                  <div className="flex items-center gap-2.5 border-b border-slate-800 pb-2.5">
                    <div className="bg-sky-500/20 p-2 rounded-xl text-sky-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Alliance Bank Malaysia</h4>
                      <p className="text-[11px] text-slate-400 font-mono">Instant Online Transfer (Free)</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Nama Pemegang Akaun:</span>
                      <span className="text-white font-bold text-xs">J&J CAFE & CATERING</span>
                    </div>

                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 block text-[10px]">No. Akaun Alliance Bank:</span>
                        <span className="text-sky-300 font-mono font-bold text-sm">101960010088888</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleCopyBankAcc('101960010088888')}
                        className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs gap-1 h-8 px-2.5"
                      >
                        {copiedBankAcc ? <Check className="w-3 h-3 text-sky-400" /> : <Copy className="w-3 h-3" />}
                        {copiedBankAcc ? 'Disalin!' : 'Salin No'}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 3: TOYYIBPAY FPX ONLINE BANKING */}
              <TabsContent value="fpx" className="space-y-3 mt-0 focus-visible:outline-none">
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-400">
                    <Globe className="w-6 h-6 animate-pulse" />
                    <span className="font-bold text-sm">FPX Online Banking Malaysia</span>
                  </div>
                  
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Bayar terus melalui portal perbankan rasmi (Maybank2u, CIMB Clicks, Bank Islam, RHB, Public Bank, dll).
                  </p>

                  <Button
                    onClick={handleProceedToFPX}
                    disabled={isFPXLoading}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 gap-2 flex items-center justify-center transition-all"
                  >
                    {isFPXLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Membuka FPX...
                      </>
                    ) : (
                      `Buka FPX Gateway (RM ${grandTotal.toFixed(2)}) 🌐`
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* TOTAL AMOUNT BAR */}
            <div className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 px-3.5 flex items-center justify-between mt-1">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Jumlah Perlu Dibayar</p>
                <p className="text-xl font-black text-emerald-400 tracking-tight">
                  RM {grandTotal.toFixed(2)}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleCopyAmount}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs gap-1 h-8 px-2.5"
              >
                {copiedAmount ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedAmount ? 'Tersalin!' : 'Salin RM'}
              </Button>
            </div>

            {/* ACTIONS */}
            <div className="w-full space-y-2 pt-1">
              {/* WHATSAPP SEND PROOF BUTTON */}
              <Button 
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/30 gap-2 flex items-center justify-center transition-all active:scale-[0.98]"
                onClick={handleSendWhatsAppProof}
              >
                <MessageCircle className="w-4 h-4 fill-current" />
                Hantar Resit Bayaran via WhatsApp 💬
              </Button>

              {/* I HAVE PAID CONFIRMATION BUTTON */}
              <Button 
                variant="outline"
                className="w-full h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border-slate-700 rounded-xl"
                onClick={() => {
                  setShowDuitNowModal(false);
                  toast.success('🎉 Pesanan diterima! Warung J&J sedang memproses pesanan anda.');
                  setCart([]);
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                ✅ Saya Dah Selesai Bayar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
