// src/routes/delivery.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { createToyyibPayCheckout } from '@/lib/toyyibpay';

export const Route = createFileRoute('/delivery')({
  component: CustomerDeliveryPage,
});

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock_count?: number;
  is_available: boolean;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  containerCharge?: number;
}

// Base Coordinates for Warung J&J (Kuala Lumpur)
const WARUNG_LAT = 3.1390;
const WARUNG_LNG = 101.6869;

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
  
  // Customer & Delivery Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [custLat, setCustLat] = useState<number>(3.1420);
  const [custLng, setCustLng] = useState<number>(101.6900);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'cart' | 'checkout'>('menu');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Distance & Fee Calculations
  const distanceKm = calculateHaversineKm(WARUNG_LAT, WARUNG_LNG, custLat, custLng);
  const isOutOfZone = distanceKm > 15.0;
  const deliveryFee = Math.max(Math.round(distanceKm * 1.00 * 100) / 100, 2.00);

  const foodSubtotal = cart.reduce((sum, item) => sum + (item.price + (item.containerCharge || 0)) * item.quantity, 0);
  const grandTotal = foodSubtotal + (cart.length > 0 ? deliveryFee : 0);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category', { ascending: true });

    if (!error && data) {
      setMenuItems(data as MenuItem[]);
    }
    setLoadingItems(false);
  };

  const handleAddToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.menuItemId === item.id);
      if (existing) {
        return prev.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, containerCharge: 1.00 }];
    });
    toast.success(`Added ${item.name} to cart 🛒`);
  };

  const handleQuantityChange = (menuItemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.menuItemId === menuItemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCustLat(pos.coords.latitude);
        setCustLng(pos.coords.longitude);
        toast.success(`GPS Location acquired: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      }, () => {
        toast.error("Could not fetch GPS location automatically.");
      });
    }
  };

  const handlePlaceDeliveryOrder = async () => {
    if (!customerName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    const phoneClean = customerPhone.replace(/\D/g, '');
    if (!phoneClean.startsWith('01') || phoneClean.length < 10 || phoneClean.length > 11) {
      toast.error('Please enter a valid Malaysian mobile number (e.g. 0198887766)');
      return;
    }
    if (!deliveryAddress.trim()) {
      toast.error('Please enter your complete delivery address');
      return;
    }
    if (foodSubtotal < 15.00) {
      toast.error('Minimum food subtotal for delivery is RM 15.00');
      return;
    }
    if (isOutOfZone) {
      toast.error(`Sorry, your address (${distanceKm}km) is outside our 15km delivery zone.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Call place_order RPC with delivery order_type
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('place_order', {
        p_order: {
          type: 'delivery',
          customer_name: customerName,
          customer_phone: customerPhone,
          delivery_address: deliveryAddress,
          delivery_lat: custLat,
          delivery_lng: custLng,
          discount_type: 'fixed',
          discount_value: 0
        },
        p_items: cart.map(item => ({
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          fulfillment_type: 'delivery',
          container_charge: item.containerCharge || 1.00,
          notes: item.notes || ''
        })),
        p_payments: [] // Unpaid until ToyyibPay FPX webhook completes
      });

      if (rpcErr) throw rpcErr;

      const resObj = (rpcRes as any);
      if (resObj?.success === false) {
        throw new Error(resObj.message || 'Delivery order placement failed validation.');
      }

      const newOrderId = resObj.order_id;
      setActiveOrderId(newOrderId);

      // Create ToyyibPay Checkout Session
      const checkoutRes = await createToyyibPayCheckout({
        orderId: newOrderId,
        totalAmount: resObj.total_amount || grandTotal,
        customerName: customerName,
        customerPhone: customerPhone,
      });

      if (checkoutRes.success && checkoutRes.paymentUrl) {
        toast.success('Order created! Redirecting to ToyyibPay FPX Payment Gateway...');
        setTimeout(() => {
          window.location.href = checkoutRes.paymentUrl!;
        }, 1500);
      } else {
        toast.error(checkoutRes.message || 'Order saved, but payment gateway connection failed.');
      }
    } catch (err: any) {
      toast.error(`Order Failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-24">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-b border-slate-800 p-4 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 p-2.5 rounded-2xl border border-emerald-500/30">
              <Truck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
                Warung J&J Delivery 🛵
              </h1>
              <p className="text-[11px] text-emerald-400 font-mono">RM1.00 / km • Prepaid FPX / DuitNow</p>
            </div>
          </div>

          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono text-xs px-3 py-1">
            Max 15km Zone
          </Badge>
        </div>
      </div>

      <main className="max-w-md mx-auto p-4 space-y-5">
        {/* ACTIVE ORDER TRACKER BANNER */}
        {activeOrderId && (
          <div className="bg-slate-900 border-2 border-emerald-500 p-4 rounded-3xl space-y-3 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">Live Delivery Order</span>
              <Badge className="bg-emerald-500 text-slate-950 font-black"># {activeOrderId.slice(0, 8)}</Badge>
            </div>
            <p className="text-sm font-semibold text-slate-200">
              ⏳ Awaiting ToyyibPay FPX payment confirmation. Order will automatically send to kitchen once payment completes!
            </p>
          </div>
        )}

        {/* DELIVERY ADDRESS & ZONE CHECK CARD */}
        <Card className="bg-slate-900 border-slate-800 text-white rounded-3xl shadow-xl overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" /> Delivery Address & Zone
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGetLocation} 
                className="bg-slate-950 border-slate-800 text-emerald-400 text-xs font-mono rounded-xl hover:bg-slate-800"
              >
                📍 GPS Location
              </Button>
            </div>

            <Textarea
              placeholder="Enter complete delivery address (Street, Unit #, City, Postcode)..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 rounded-2xl text-sm font-mono min-h-[70px]"
            />

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex justify-between items-center font-mono text-xs">
              <span className="text-slate-400">Distance from Warung J&J:</span>
              <span className={`font-black ${isOutOfZone ? 'text-rose-400' : 'text-emerald-400'}`}>
                {distanceKm} km {isOutOfZone ? '⚠️ (OUT OF ZONE)' : '✓'}
              </span>
            </div>

            {isOutOfZone && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl text-xs text-rose-300 flex items-start gap-2 font-mono">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>Sorry, we only deliver within 15km of Warung J&J. Please choose a closer delivery address.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MENU CATEGORY SECTION */}
        <div className="space-y-3">
          <h2 className="font-black text-lg text-white flex items-center justify-between">
            <span>Select Dishes 🍜</span>
            <span className="text-xs font-mono text-slate-400 font-normal">{menuItems.length} items available</span>
          </h2>

          {loadingItems ? (
            <div className="text-center py-10 text-slate-500 font-mono flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span>Loading Warung J&J Menu...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {menuItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <Card key={item.id} className="bg-slate-900 border-slate-800 text-white rounded-3xl overflow-hidden hover:border-slate-700 transition-all">
                    <CardContent className="p-4 flex gap-3 items-center">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-800" />
                      ) : (
                        <div className="w-20 h-20 bg-slate-950 rounded-2xl shrink-0 border border-slate-800 flex items-center justify-center text-slate-700 font-black">
                          J&J
                        </div>
                      )}

                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-white text-base leading-tight">{item.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 capitalize font-mono">{item.category}</p>
                        <p className="font-black text-emerald-400 text-base font-mono">RM {item.price.toFixed(2)}</p>
                      </div>

                      {inCart ? (
                        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl">
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-slate-300 font-bold" onClick={() => handleQuantityChange(item.id, -1)}>-</Button>
                          <span className="font-mono font-bold text-sm text-emerald-400 w-4 text-center">{inCart.quantity}</span>
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-slate-300 font-bold" onClick={() => handleQuantityChange(item.id, 1)}>+</Button>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => handleAddToCart(item)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl px-4 py-2 text-xs shadow-md shrink-0 active:scale-95"
                        >
                          + Add
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* CUSTOMER CONTACT & CHECKOUT FORM */}
        {cart.length > 0 && (
          <Card className="bg-slate-900 border-2 border-emerald-500/40 text-white rounded-3xl shadow-2xl">
            <CardContent className="p-5 space-y-4">
              <h2 className="font-black text-base text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <User className="w-4 h-4 text-emerald-400" /> Customer Details
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Your Full Name</label>
                  <Input
                    placeholder="e.g. Encik Farhan"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-2xl text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Mobile Phone Number</label>
                  <Input
                    placeholder="e.g. 0198887766"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white rounded-2xl font-mono text-sm"
                  />
                </div>
              </div>

              {/* SUMMARY BREAKDOWN */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl font-mono space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Food Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items):</span>
                  <span className={foodSubtotal < 15.00 ? 'text-amber-400 font-bold' : 'text-slate-200'}>RM {foodSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Delivery Fee ({distanceKm}km @ RM1/km):</span>
                  <span>RM {deliveryFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-black text-white">
                  <span>Grand Total (Prepaid):</span>
                  <span className="text-emerald-400">RM {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {foodSubtotal < 15.00 && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl text-xs text-amber-300 font-mono">
                  ⚠️ Minimum food subtotal for delivery is RM 15.00. Add RM {(15.00 - foodSubtotal).toFixed(2)} more items to proceed.
                </div>
              )}

              <Button
                onClick={handlePlaceDeliveryOrder}
                disabled={isSubmitting || isOutOfZone}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl py-4 text-base shadow-xl active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing Payment...
                  </span>
                ) : (
                  `PAY RM ${grandTotal.toFixed(2)} VIA TOYYIBPAY FPX 💳`
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
