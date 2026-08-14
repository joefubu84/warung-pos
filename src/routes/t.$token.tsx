import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

function TableQRPage() {
  const { token } = Route.useParams();
  const [storeName, setStoreName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Ordering state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [mergedNotification, setMergedNotification] = useState<string | null>(null);
  const [globalFulfillmentType, setGlobalFulfillmentType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [globalContainerSize, setGlobalContainerSize] = useState<'small' | 'large'>('small');
  
  // Order Level settings
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const deliveryFee = 8.00;
  
  // Mobile Cart State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  
  // Dialog state
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [existingOrder, setExistingOrder] = useState<any | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // 1. Look up table by qr_token
        const { data: tableData, error: tableError } = await supabase
          .from('tables')
          .select('id, store_id, stores(name)')
          .eq('qr_token', token)
          .single();

        if (tableError || !tableData) {
          setError('Invalid QR code');
          setLoading(false);
          return;
        }

        const sId = tableData.store_id;
        setStoreId(sId);
        setTableId(tableData.id);
        
        // @ts-ignore - Supabase type for joined relation might be tricky
        const name = tableData.stores?.name || 'Restaurant';
        setStoreName(name);

        // 2. Query menu_items for that store_id
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('id, name, category, price, image_url, stock_count')
          .eq('store_id', sId)
          .eq('is_available', true)
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (menuError) {
          throw menuError;
        }

        const items = menuData || [];
        setMenuItems(items);
        
        // Initialize quantities to 1
        const initialQtys: Record<string, number> = {};
        items.forEach(item => {
          initialQtys[item.id] = 1;
        });
        setItemQuantities(initialQtys);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  const handleQtyChange = (itemId: string, qty: number) => {
    setItemQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, qty)
    }));
  };

  const handleAddToCart = (item: MenuItem) => {
    const qty = itemQuantities[item.id] || 1;
    
    // Check against available stock
    if (item.stock_count !== null && item.stock_count !== undefined) {
      const currentInCart = cart.filter(c => c.menuItemId === item.id).reduce((sum, c) => sum + c.quantity, 0);
      if (currentInCart + qty > item.stock_count) {
        alert(`Sorry, only ${Math.max(0, item.stock_count - currentInCart)} more available in stock.`);
        return;
      }
    }

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: qty,
      fulfillmentType: globalFulfillmentType,
      containerSize: globalFulfillmentType === 'takeaway' ? globalContainerSize : null,
      containerCharge: globalFulfillmentType === 'takeaway' ? (globalContainerSize === 'large' ? 1 : 0) : 0,
      notes: ''
    };
    setCart([...cart, newItem]);
    // Reset individual item qty field after adding? User didn't specify, but often good. 
    // Let's keep it as is or reset to 1.
    handleQtyChange(item.id, 1);
  };

  const updateCartItemNotes = (cartItemId: string, notes: string) => {
    setCart(cart.map(item => item.id === cartItemId ? { ...item, notes: notes.slice(0, 100) } : item));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.id !== cartItemId));
  };

  const subTotal = cart.reduce((sum, item) => sum + ((item.price + (item.containerCharge || 0)) * item.quantity), 0);
  const cartTotal = subTotal + (orderType === 'delivery' ? deliveryFee : 0);

  const handlePlaceOrder = async (forceNew: boolean = false) => {
    if (cart.length === 0 || !storeId || !tableId) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      if (orderType === 'delivery') {
        if (!/^60\d{8,10}$/.test(customerPhone)) {
          throw new Error('Please enter a valid Malaysian phone number starting with 60');
        }
        if (deliveryAddress.length < 10) {
          throw new Error('Please enter a complete delivery address (min 10 characters)');
        }
      }

      if (!forceNew) {
        // Step 1: Check for existing order on this table
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
          // Unpaid active order exists, show dialog
          setExistingOrder(existingData);
          setShowOrderDialog(true);
          setIsSubmitting(false);
          return;
        }
      }

      // a. & b. Insert ONE row into orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: storeId,
          type: orderType,
          status: 'pending',
          table_id: tableId,
          total_amount: cartTotal,
          delivery_fee: orderType === 'delivery' ? deliveryFee : null,
          delivery_service: orderType === 'delivery' ? 'grabfood' : null,
          customer_phone: orderType === 'delivery' ? customerPhone : null,
          delivery_address: orderType === 'delivery' ? deliveryAddress : null,
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // c. Insert one order_items row per cart item
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

      // d. Clear cart and show confirmation
      setCart([]);
      setOrderPlaced(true);
      setShowOrderDialog(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      // 1. Insert order items pointing to existing order
      const orderItems = cart.map(item => ({
        order_id: existingOrder.id,
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

      // 2. Update total_amount on existing order
      const newTotal = existingOrder.total_amount + cartTotal;
      const { error: updateError } = await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', existingOrder.id);
      
      if (updateError) throw updateError;

      // 3. Complete
      setCart([]);
      setMergedNotification(existingOrder.id);
      setShowOrderDialog(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('Error adding to order:', err);
      setError(err.message || 'Failed to add to order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error && !orderPlaced) return <div className="p-8 text-red-500">{error}</div>;

  if (orderPlaced) {
    return (
      <div className="p-8 font-sans text-center">
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <h2 className="text-xl font-bold mb-2">Order placed!</h2>
          <p>The kitchen has received your order.</p>
        </div>
        <button 
          onClick={() => setOrderPlaced(false)}
          className="bg-blue-600 text-white px-6 py-2 rounded font-bold"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 font-sans max-w-4xl mx-auto">
      {mergedNotification && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 relative shadow-sm">
          <button 
            onClick={() => setMergedNotification(null)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 font-bold px-2 py-1 text-lg leading-none"
            title="Dismiss this message"
          >
            ✕
          </button>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-600 font-bold text-xl leading-none">✓</span>
            <h2 className="text-lg font-bold">Items Added to Existing Order</h2>
          </div>
          <div className="border-t border-blue-200 my-2"></div>
          <p className="font-semibold mb-1">Order ID: #{mergedNotification.slice(0, 8).toUpperCase()}</p>
          <p className="text-sm">Your items will be prepared after current items (est. 10-15 min).</p>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{storeName}</h1>
        {orderType !== 'delivery' && <p className="text-gray-500 italic mt-1">Table Menu</p>}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Menu List */}
        <div className="md:col-span-2">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Our Menu</h2>
          {menuItems.length === 0 ? (
            <p>No items available right now.</p>
          ) : (
            <div className="space-y-6">
              {menuItems.map((item) => (
                <div key={item.id} className={`flex gap-4 p-2 border rounded-lg hover:shadow-sm transition-shadow ${item.stock_count === 0 ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex-shrink-0 relative w-24 h-24 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name} 
                        className="w-full h-full object-cover relative z-0"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs text-center p-2 relative z-0">
                        No Image
                      </div>
                    )}
                    
                    {/* SOLD OUT BANNER */}
                    {Number(item.stock_count) === 0 && (
                      <div className="absolute top-0 left-0 w-full h-full bg-black/60 z-50 flex items-center justify-center">
                        <span className="bg-red-600 text-white text-[11px] font-black px-2 py-1 uppercase tracking-widest transform -rotate-12 border border-red-700 shadow-2xl">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-blue-600 font-bold">RM{item.price.toFixed(2)}</p>
                        {item.stock_count !== null && item.stock_count > 0 && item.stock_count <= 5 && (
                          <span className="text-yellow-700 text-xs font-bold bg-yellow-100 px-2 py-0.5 rounded">⚠️ {item.stock_count} Left</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col">
                          <label className="text-xs text-gray-500 uppercase font-bold mb-1">Type</label>
                          <select 
                            value={globalFulfillmentType}
                            onChange={(e) => setGlobalFulfillmentType(e.target.value as 'dine_in' | 'takeaway')}
                            className="text-sm border rounded px-2 py-1 bg-white"
                            disabled={item.stock_count === 0}
                          >
                            <option value="dine_in">Eat here</option>
                            <option value="takeaway">Takeaway</option>
                          </select>
                        </div>
                        {globalFulfillmentType === 'takeaway' && (
                          <div className="flex flex-col">
                            <label className="text-xs text-gray-500 uppercase font-bold mb-1">Box</label>
                            <select 
                              value={globalContainerSize}
                              onChange={(e) => setGlobalContainerSize(e.target.value as 'small' | 'large')}
                              className="text-sm border rounded px-2 py-1 bg-white"
                              disabled={item.stock_count === 0}
                            >
                              <option value="small">Small (free)</option>
                              <option value="large">Large (+RM1)</option>
                            </select>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <label className="text-xs text-gray-500 uppercase font-bold mb-1">Qty</label>
                          <div className="flex items-center border rounded bg-white overflow-hidden shadow-sm">
                            <button
                              type="button"
                              disabled={item.stock_count === 0}
                              onClick={() => handleQtyChange(item.id, Math.max(1, (itemQuantities[item.id] || 1) - 1))}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer touch-manipulation active:bg-gray-200"
                            >
                              -
                            </button>
                            <span className="w-10 text-center text-sm font-bold bg-white">
                              {itemQuantities[item.id] || 1}
                            </span>
                            <button
                              type="button"
                              disabled={item.stock_count === 0}
                              onClick={() => {
                                const current = itemQuantities[item.id] || 1;
                                const max = item.stock_count != null ? item.stock_count : 99;
                                handleQtyChange(item.id, Math.min(max, current + 1));
                              }}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer touch-manipulation active:bg-gray-200"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {item.stock_count === 0 ? (
                        <button 
                          type="button"
                          disabled
                          className="bg-gray-200 text-gray-500 px-4 py-2 rounded text-sm font-bold w-full cursor-not-allowed uppercase"
                        >
                          Add to Cart Disabled
                        </button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 w-full relative z-10 cursor-pointer touch-manipulation"
                        >
                          + Add to Cart
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Sidebar */}
        <div className={`md:col-span-1 fixed md:static inset-y-0 right-0 z-50 w-80 md:w-auto bg-white md:bg-transparent shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          <div className="border rounded-lg p-4 bg-gray-50 h-full md:h-auto overflow-y-auto md:sticky md:top-4">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h2 className="text-xl font-bold">Your Cart</h2>
              <button 
                onClick={() => setIsMobileCartOpen(false)}
                className="md:hidden text-gray-500 hover:text-gray-700 font-bold text-xl px-2 leading-none"
                title="Close Cart"
              >
                ✕
              </button>
            </div>
            
            {cart.length === 0 ? (
              <p className="text-gray-500 italic text-center py-4">Your cart is empty.</p>
            ) : (
              <div className="space-y-4">
                <ul className="divide-y divide-gray-200">
                  {cart.map((item) => (
                    <li key={item.id} className="py-3 flex flex-col gap-2 border-b last:border-b-0 border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">
                            {item.quantity} x RM{(item.price + (item.containerCharge || 0)).toFixed(2)}
                            {item.fulfillmentType === 'takeaway' && ` (Pack - ${item.containerSize})`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">RM{((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500 text-xs mt-1 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 w-full max-w-sm">
                        <label className="text-[10px] font-semibold text-gray-500 uppercase">Special Requests:</label>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                          placeholder="Special Requests / Max 100 characters"
                          className="w-full text-xs border rounded p-1.5 mt-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          maxLength={100}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                
                <div className="border-t pt-4">
                  <div className="mb-4">
                    <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Order Type</label>
                    <select 
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as any)}
                      className="w-full border rounded p-2 text-sm bg-white"
                    >
                      <option value="dine_in">Dine-in (Eat here)</option>
                      <option value="takeaway">Takeaway</option>
                      <option value="delivery">Delivery (Grab)</option>
                    </select>
                  </div>
                  
                  {orderType === 'delivery' && (
                    <div className="mb-4 space-y-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div>
                        <label className="text-xs font-bold text-blue-900 mb-1 block">Customer Phone *</label>
                        <input 
                          type="tel" 
                          placeholder="60xxxxxxxxxx"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full text-sm border rounded p-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-blue-900 mb-1 block">Delivery Address *</label>
                        <textarea 
                          placeholder="123 Jalan Merdeka..."
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          className="w-full text-sm border rounded p-2 h-16 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 mb-6">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal:</span>
                      <span>RM{subTotal.toFixed(2)}</span>
                    </div>
                    {orderType === 'delivery' && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Delivery Fee:</span>
                        <span>RM{deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t font-bold">
                      <span className="text-lg">Total:</span>
                      <span className="text-2xl text-blue-600">RM{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handlePlaceOrder(false)}
                    disabled={isSubmitting || cart.length === 0}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? 'Placing Order...' : 'Place Order'}
                  </button>
                  {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Cart Button for Mobile */}
      <button 
        onClick={() => setIsMobileCartOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 bg-blue-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center font-bold hover:bg-blue-700 active:scale-95 transition-transform"
      >
        🛒 CART {cart.length > 0 && (
          <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs">
            {cart.length}
          </span>
        )}
      </button>

      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Existing Order Found</DialogTitle>
            <DialogDescription>
              There is already an active order for this table. Would you like to add your items to the existing bill, or create a new separate bill?
            </DialogDescription>
          </DialogHeader>
          
          {existingOrder && (
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 my-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-gray-500 font-medium">Order ID:</span>
                <span className="font-semibold text-right">#{existingOrder.id.slice(0, 8)}</span>
                
                <span className="text-gray-500 font-medium">Status:</span>
                <span className="font-semibold text-right capitalize text-blue-600">{existingOrder.status}</span>
                
                <span className="text-gray-500 font-medium">Items Count:</span>
                <span className="font-semibold text-right">{existingOrder.order_items?.length || 0} items</span>
                
                <span className="text-gray-500 font-medium border-t pt-2 mt-1">Current Total:</span>
                <span className="font-bold text-right border-t pt-2 mt-1">RM {existingOrder.total_amount?.toFixed(2)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => handlePlaceOrder(true)}
              disabled={isSubmitting}
            >
              Create New Order
            </Button>
            <Button 
              onClick={handleAddToExisting}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Add to Existing Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
