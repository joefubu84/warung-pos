import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Minus, Search, Trash2, ShoppingCart, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute('/counter')({
  ssr: false,
  beforeLoad: async ({ context, location }: any) => {
    return await requireStaffAuth(location, context.auth);
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
    newSplits[index] = updated;
    setSplitPayments(newSplits);
  };

  const removeSplitPayment = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };
  
  const totalSplitAmount = splitPayments.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
  
  const cartTotal = cart.reduce((sum, item) => sum + ((item.price + (item.containerCharge || 0)) * item.quantity), 0);
  
  const discountAmount = discount.type === 'percentage' 
    ? cartTotal * (discount.value / 100)
    : discount.value;
  const finalTotal = Math.max(0, cartTotal - discountAmount);

  const remainingSplitAmount = Math.max(0, finalTotal - totalSplitAmount);

  // Audio ref for beep
  const beepAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchInitialData();
    beepAudio.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
  }, []);

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
      beepAudio.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const handleAddToCart = (item: MenuItem) => {
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


  const categories = ['All', ...Array.from(new Set(menuItems.map(m => m.category || 'Uncategorized')))];

  const filteredMenu = menuItems.filter(item => {
    if (selectedCategory !== 'All' && (item.category || 'Uncategorized') !== selectedCategory) return false;
    if (searchMenuQuery && !item.name.toLowerCase().includes(searchMenuQuery.toLowerCase())) return false;
    return true;
  });

const handlePlaceOrderClick = () => {
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
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('store_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.store_id) throw new Error('Store not found for user');

      // 1. Insert ONE row into orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: userProfile.store_id,
          type: orderType,
          status: 'pending',
          table_id: selectedTableId || null,
          customer_name: customerName || null,
          total_amount: finalTotal,
          discount_amount: discountAmount,
          discount_type: discount.type
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert ONE row into order_items for EACH cart item
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        price_at_order: item.price,
        fulfillment_type: item.fulfillmentType,
        container_size: item.containerSize || null,
        container_charge: item.containerCharge || 0,
        notes: item.notes || ''
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Process payments
      if (paymentMode === 'full' && paymentMethod !== 'unpaid') {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: orderData.id,
            amount: finalTotal,
            payment_method: paymentMethod,
            paid_by: 'Counter Staff'
          });
        if (paymentError) throw paymentError;
      } else if (paymentMode === 'split' && splitPayments.length > 0) {
        const { error: paymentError } = await supabase
          .from('payments')
          .insert(
            splitPayments.map(sp => ({
              order_id: orderData.id,
              amount: sp.amount,
              payment_method: sp.method,
              paid_by: 'Counter Staff'
            }))
          );
        if (paymentError) throw paymentError;
      }

      // 4. Success handling
      setIsConfirmOpen(false);
      setSuccessMsg(`Order #${orderData.id.slice(0,8)} placed successfully!`);
      
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
      <div id="pos-layout" className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP ACTION BAR */}
        <div className="h-16 bg-white border-b border-gray-200 px-4 flex justify-between items-center shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">Warung POS</h1>
            <div className="relative w-64 ml-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                placeholder="Search menu..."
                value={searchMenuQuery}
                onChange={(e) => setSearchMenuQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          </div>
        </div>

        {/* MAIN SPLIT VIEW */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: MENU GRID (60%) */}
          <div className="w-[60%] bg-gray-50 flex flex-col border-r border-gray-200">
            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto p-4 scrollbar-hide shrink-0 border-b border-gray-200 bg-white">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 content-start">
              {successMsg && (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-24">
                {filteredMenu.map(item => {
                  const isSoldOut = item.stock_count !== undefined && item.stock_count !== null && item.stock_count <= 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      disabled={isSoldOut}
                      className={`relative flex flex-col h-32 rounded-xl border-2 transition-all active:scale-95 text-left overflow-hidden shadow-sm hover:shadow-md ${isSoldOut ? 'border-gray-200 bg-gray-100 opacity-70 cursor-not-allowed' : 'border-transparent bg-white hover:border-blue-300 active:border-blue-500 active:bg-blue-50'}`}
                    >
                      {item.image_url && (
                        <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{backgroundImage: `url('${item.image_url}')`}} />
                      )}
                      <div className="relative z-10 p-3 flex flex-col h-full justify-between">
                        <span className="font-bold text-gray-800 text-base leading-tight line-clamp-2">{item.name}</span>
                        <div className="flex justify-between items-end">
                          <span className="font-black text-blue-700 text-lg">RM{item.price.toFixed(2)}</span>
                          {isSoldOut && <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded">SOLD OUT</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: CART & ACTIONS (40%) */}
          <div className="w-[40%] bg-white flex flex-col">
            
            {/* Order Configuration */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <div className="flex bg-gray-200 p-1 rounded-lg mb-3">
                <button
                  onClick={() => setOrderType('dine_in')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${orderType === 'dine_in' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:bg-gray-300/50'}`}
                >
                  Dine-in
                </button>
                <button
                  onClick={() => setOrderType('takeaway')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${orderType === 'takeaway' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:bg-gray-300/50'}`}
                >
                  Takeaway
                </button>
              </div>

              <div className="flex gap-2">
                {orderType === 'dine_in' && (
                  <select 
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Table *</option>
                    {tables.map(t => <option key={t.id} value={t.id}>Table {t.table_number}</option>)}
                  </select>
                )}
                <input 
                  placeholder="Customer Name (Opt)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p className="text-lg font-medium">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="pr-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 mb-1">
                          <h4 className="font-bold text-gray-800 leading-tight">{item.name}</h4>
                          <button 
                            onClick={() => toggleCartItemFulfillment(item.id)}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase transition-colors self-start sm:self-auto active:scale-95 ${item.fulfillmentType === 'takeaway' ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-blue-50 text-blue-500 border border-blue-100'}`}
                          >
                            {item.fulfillmentType === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine-in'}
                          </button>
                        </div>
                        <p className="text-sm font-bold text-blue-600">RM{((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</p>
                      </div>
                      
                      {/* Qty Controls */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 active:scale-95"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-bold text-gray-800">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input 
                        placeholder="Add note (e.g., less spicy)"
                        value={item.notes || ''}
                        onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-xs outline-none focus:border-blue-400"
                      />
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {item.fulfillmentType === 'takeaway' && (
                      <div className="flex bg-orange-50 p-1 rounded border border-orange-100">
                        <button
                          onClick={() => updateCartItemContainerSize(item.id, 'small')}
                          className={`flex-1 text-[10px] py-1 rounded font-bold transition-colors ${item.containerSize !== 'large' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-100'}`}
                        >
                          Small (+RM0)
                        </button>
                        <button
                          onClick={() => updateCartItemContainerSize(item.id, 'large')}
                          className={`flex-1 text-[10px] py-1 rounded font-bold transition-colors ${item.containerSize === 'large' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-600 hover:bg-orange-100'}`}
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
            <div className="p-4 bg-gray-900 text-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] shrink-0 z-20">
              {error && <p className="text-red-400 text-sm font-bold mb-2 bg-red-900/30 p-2 rounded">{error}</p>}
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-400 text-lg font-medium">Total</span>
                <span className="text-3xl font-black">RM {cartTotal.toFixed(2)}</span>
              </div>
              
              <button
                onClick={handlePlaceOrderClick}
                disabled={cart.length === 0}
                className="w-full h-16 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-gray-700 text-white rounded-xl text-xl font-black tracking-wide transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <ShoppingCart className="w-6 h-6" /> PLACE ORDER
              </button>
            </div>

          </div>
        </div>
      </div>

      
      {/* CONFIRMATION DIALOG */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-xl font-sans max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Confirm Order & Payment</DialogTitle>
          </DialogHeader>
          
          <div className="py-2 space-y-4">
            
            {/* 1. ORDER SUMMARY */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <h3 className="font-bold text-gray-700 mb-2">Order Summary</h3>
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
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span>Discount Applied:</span>
                    <span>- RM {discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center text-xl">
                <span className="font-black text-gray-900">FINAL TOTAL:</span>
                <span className="font-black text-blue-600">RM {finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* 3. PAYMENT TYPE TABS */}
            <Tabs value={paymentMode} onValueChange={(v) => setPaymentMode(v as 'full'|'split')} className="w-full">
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
                    className="h-14 font-bold border-2 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                    onClick={() => handleSubmitOrder('card')}
                    disabled={isSubmitting}
                  >
                    💳 PAID CARD/QR
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full h-12 font-bold bg-gray-100 hover:bg-gray-200 text-gray-600"
                  onClick={() => handleSubmitOrder('unpaid')}
                  disabled={isSubmitting}
                >
                  PAY LATER (Unpaid)
                </Button>
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
                    <span className="text-gray-500">Remaining to split:</span>
                    <span className={`font-bold ${remainingSplitAmount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      RM {remainingSplitAmount.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="mt-4">
                    <Button 
                      className="w-full h-12 font-bold"
                      onClick={() => handleSubmitOrder('cash')} // Payment method arg is ignored for split payments in handleSubmitOrder
                      disabled={isSubmitting || splitPayments.length === 0 || remainingSplitAmount > 0.01}
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
    </div>
  );
}
