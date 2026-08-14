import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
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

export const Route = createFileRoute('/counter')({
  ssr: false,
  beforeLoad: async ({ context, location }: any) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: CounterPage,
});

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  price_at_order: number;
  fulfillment_type: 'dine_in' | 'takeaway';
  notes: string | null;
  menu_items?: {
    name: string;
  };
}

interface OrderEditLog {
  id: string;
  order_id: string;
  edited_by: string;
  action: string;
  details: any;
  reason: string;
  created_at: string;
  users?: {
    name: string | null;
  };
}

interface Order {
  id: string;
  type: 'dine_in' | 'takeaway' | 'delivery';
  status: OrderStatus;
  table_id: string | null;
  customer_name: string | null;
  total_amount: number;
  created_at: string;
  delivery_service?: string | null;
  delivery_fee?: number;
  paid?: boolean;
  payment_method?: string | null;
  payments?: Payment[];
  order_items?: OrderItem[];
}

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: 'cash' | 'card' | 'qr' | 'bank_transfer';
  paid_by: string | null;
  created_at: string;
}

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMenuQuery, setSearchMenuQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready' | 'completed' | 'all'>('pending');
  const [isPosOpen, setIsPosOpen] = useState(false);

  // Form & Cart state
  const [customerName, setCustomerName] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [itemFulfillmentType, setItemFulfillmentType] = useState<'dine_in' | 'takeaway'>('dine_in');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [containerSize, setContainerSize] = useState<'small' | 'large'>('small');

  // Edit Order state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editReason, setEditReason] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editOrderType, setEditOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [editDeliveryFee, setEditDeliveryFee] = useState<number>(0);
  const [editIsPaid, setEditIsPaid] = useState<boolean>(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Order state
  const [deletingOrder, setDeletingOrder] = useState<Order | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteNotes, setDeleteNotes] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const EDIT_REASONS = [
    "Customer request",
    "Hair/Quality issue",
    "Wrong price entered",
    "Customer complaint",
    "Staff mistake",
    "Discount/Promo",
    "Other"
  ];

  const DELETE_REASONS = [
    "Customer cancelled",
    "Duplicate entry",
    "Wrong order created",
    "Staff error",
    "System test",
    "Other"
  ];

  // History state
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [editLogs, setEditLogs] = useState<OrderEditLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchOrders(),
        fetchTables(),
        fetchMenuItems(),
      ]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        type, 
        status, 
        table_id, 
        customer_name, 
        total_amount, 
        delivery_fee,
        delivery_service,
        paid,
        payment_method,
        created_at, 
        payments (id, order_id, amount, payment_method, paid_by, created_at),
        order_items (id, order_id, menu_item_id, quantity, price_at_order, fulfillment_type, notes, menu_items(name))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      setError(error.message);
    } else if (data) {
      setOrders(data as unknown as Order[]);
    }
  };

  const handleEditClick = (order: Order) => {
    setEditingOrder(order);
    setEditItems(order.order_items ? [...order.order_items] : []);
    setEditOrderType(order.type || 'takeaway');
    setEditDeliveryFee(Number(order.delivery_fee || 0));
    setEditIsPaid(!!order.paid);
    setEditPaymentMethod((order.payment_method as 'cash' | 'card') || 'cash');
    setEditReason('');
  };

  const handleViewHistory = async (order: Order) => {
    setHistoryOrder(order);
    setIsLoadingHistory(true);
    const { data, error } = await supabase
      .from('order_edit_logs')
      .select('*, users(name)')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setEditLogs(data as any);
    }
    setIsLoadingHistory(false);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder || !editReason) {
      alert('Please provide a reason for the change.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const originalItems = editingOrder.order_items || [];
      let newTotalAmount = editItems.reduce((sum, item) => sum + (Number(item.price_at_order) * item.quantity) + (Number((item as any).container_charge || 0) * item.quantity), 0);
      
      if (editOrderType === 'delivery') {
        newTotalAmount += Number(editDeliveryFee);
      }
      
      const changesDetails: any = {
        items_modified: [],
        items_added: [],
        items_deleted: [],
        notes: editNotes
      };

      // 1. Identify Deleted Items
      const deletedItems = originalItems.filter(orig => !editItems.find(curr => curr.id === orig.id));
      for (const item of deletedItems) {
        changesDetails.items_deleted.push(`${item.menu_items?.name} (x${item.quantity})`);
        const { error: delErr } = await supabase.from('order_items').delete().eq('id', item.id);
        if (delErr) throw delErr;
      }

      // 2. Identify Changed Items
      for (const current of editItems) {
        const original = originalItems.find(orig => orig.id === current.id);
        if (original) {
          const qtyChanged = original.quantity !== current.quantity;
          const typeChanged = original.fulfillment_type !== current.fulfillment_type;
          const notesChanged = (original.notes || '') !== (current.notes || '');
          
          if (qtyChanged || typeChanged || notesChanged) {
            changesDetails.items_modified.push(
              `${current.menu_items?.name || 'Item'}: ` + 
              (qtyChanged ? `Qty ${original.quantity}->${current.quantity} ` : '') +
              (notesChanged ? `Notes changed ` : '')
            );
            const { error: upErr } = await supabase.from('order_items').update({
              quantity: current.quantity,
              fulfillment_type: current.fulfillment_type,
              notes: current.notes
            }).eq('id', current.id);
            if (upErr) throw upErr;
          }
        } else {
          // 3. New Items
          const menuItem = menuItems.find(m => m.id === current.menu_item_id);
          const { data: newItem, error: insErr } = await supabase.from('order_items').insert({
            order_id: editingOrder.id,
            menu_item_id: current.menu_item_id,
            quantity: current.quantity,
            price_at_order: menuItem?.price || 0,
            fulfillment_type: current.fulfillment_type,
            notes: current.notes || ''
          }).select('*, menu_items(name)').single();
          
          if (insErr) throw insErr;
          changesDetails.items_added.push(`${(newItem as any).menu_items?.name} (x${current.quantity})`);
        }
      }

      // 4. Update Order Total and Type
      const orderUpdatePayload: any = {
        total_amount: newTotalAmount,
        type: editOrderType,
        delivery_fee: editOrderType === 'delivery' ? editDeliveryFee : 0,
        delivery_service: editOrderType === 'delivery' ? 'grabfood' : null,
        paid: editIsPaid,
        payment_method: editPaymentMethod
      };

      const { error: orderUpErr } = await supabase.from('orders').update(orderUpdatePayload).eq('id', editingOrder.id);
      
      if (orderUpErr) throw orderUpErr;

      if (changesDetails.items_modified.length > 0 || changesDetails.items_added.length > 0 || changesDetails.items_deleted.length > 0 || editingOrder.type !== editOrderType || editingOrder.delivery_fee !== editDeliveryFee || !!editingOrder.paid !== editIsPaid || editingOrder.payment_method !== editPaymentMethod) {
        
        if (editingOrder.type !== editOrderType) {
          changesDetails.type_changed = `${editingOrder.type} -> ${editOrderType}`;
        }
        if (editOrderType === 'delivery') {
          changesDetails.delivery_fee = editDeliveryFee;
        }
        if (!!editingOrder.paid !== editIsPaid) {
          changesDetails.payment_status = editIsPaid ? 'Marked as Paid' : 'Marked as Unpaid';
        }
        if (editingOrder.payment_method !== editPaymentMethod) {
          changesDetails.payment_method = `${editingOrder.payment_method || 'cash'} -> ${editPaymentMethod}`;
        }

        const { error: logErr } = await supabase.from('order_edit_logs').insert({
          order_id: editingOrder.id,
          action: 'edit',
          reason: editReason,
          edited_by: user.id,
          before_total: editingOrder.total_amount,
          after_total: newTotalAmount,
          changes: changesDetails
        } as any);
        if (logErr) throw logErr;
      }

      setEditingOrder(null);
      await fetchOrders();
    } catch (err: any) {
      alert('Failed to save changes: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder || !deleteReason) {
      alert('Please provide a reason for deletion.');
      return;
    }

    setIsDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: orderUpErr } = await supabase.from('orders').delete().eq('id', deletingOrder.id);
      if (orderUpErr) throw orderUpErr;

      const { error: logErr } = await supabase.from('order_edit_logs').insert({
        order_id: deletingOrder.id,
        action: 'delete',
        reason: deleteReason,
        edited_by: user.id,
        before_total: deletingOrder.total_amount,
        after_total: 0,
        changes: { notes: deleteNotes }
      } as any);
      if (logErr) throw logErr;

      setDeletingOrder(null);
      await fetchOrders();
    } catch (err: any) {
      alert('Failed to delete order: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status: ' + error.message);
    } else {
      await fetchOrders();
    }
  };

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from('tables')
      .select('id, table_number')
      .order('table_number', { ascending: true });
    
    if (!error && data) {
      setTables(data as Table[]);
    }
  };

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('is_available', true)
      .order('name', { ascending: true });
    
    if (!error && data) {
      setMenuItems(data as MenuItem[]);
    }
  };

  const handleAddToCart = () => {
    if (!selectedMenuItemId) return alert('Please select a menu item');
    const selectedItem = menuItems.find(item => item.id === selectedMenuItemId);
    if (!selectedItem) return;

    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      menuItemId: selectedItem.id,
      name: selectedItem.name,
      price: selectedItem.price,
      quantity: quantity,
      fulfillmentType: itemFulfillmentType,
      containerSize: itemFulfillmentType === 'takeaway' ? containerSize : null,
      containerCharge: itemFulfillmentType === 'takeaway' ? (containerSize === 'large' ? 1 : 0) : 0,
      notes: ''
    };

    setCart([...cart, newItem]);
    setSelectedMenuItemId('');
    setQuantity(1);
  };

  const updateCartItemNotes = (cartItemId: string, notes: string) => {
    setCart(cart.map(item => item.id === cartItemId ? { ...item, notes: notes.slice(0, 100) } : item));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(cart.filter(item => item.id !== cartItemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + ((item.price + (item.containerCharge || 0)) * item.quantity), 0);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;
    if (cart.some(item => item.fulfillmentType === 'dine_in') && !selectedTableId) return alert('Please select a table');
    
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
      // For mixed orders, we label as 'dine_in' if any item is dine_in, otherwise 'takeaway'
      const hasDineIn = cart.some(item => item.fulfillmentType === 'dine_in');
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          store_id: userProfile.store_id,
          type: hasDineIn ? 'dine_in' : 'takeaway',
          status: 'pending',
          table_id: selectedTableId || null,
          customer_name: customerName || null,
          total_amount: cartTotal
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert ONE row into order_items for EACH cart item
      // linking multiple order_items to one order_id
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

      // 3. Clear cart and refresh
      setCart([]);
      setSelectedTableId('');
      setCustomerName('');
      await fetchOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  const statusOptions: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

  return (
    <div className="p-4 md:p-8 font-sans max-w-7xl mx-auto">
      
      
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">POS System</h1>
      </div>
{/* 2. CREATE NEW ORDER (Bottom - Collapsible) */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm mb-12 p-4 md:p-6">
        <div className="space-y-6 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Table Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Step 1: Select Table</label>
                  <select 
                    value={selectedTableId} 
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    className="w-full border-2 border-gray-200 p-2 rounded-lg font-medium"
                  >
                    <option value="">Select Table</option>
                    {tables.map(table => (
                      <option key={table.id} value={table.id}>Table {table.table_number}</option>
                    ))}
                  </select>
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Step 2: Customer Name (Optional)</label>
                  <input 
                    type="text"
                    placeholder="Enter name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border-2 border-gray-200 p-2 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-lg">Menu</h3>
                  <input 
                    type="text" 
                    placeholder="Search menu..." 
                    value={searchMenuQuery}
                    onChange={(e) => setSearchMenuQuery(e.target.value)}
                    className="border-2 border-gray-200 rounded-full px-4 py-1.5 text-sm w-48 shadow-sm"
                  />
                </div>
                {/* Menu Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {menuItems
                    .filter(i => !searchMenuQuery || i.name.toLowerCase().includes(searchMenuQuery.toLowerCase()) || i.category?.toLowerCase().includes(searchMenuQuery.toLowerCase()))
                    .map(item => (
                    <div 
                      key={item.id} 
                      className={`border-2 rounded-xl p-3 flex flex-col justify-between hover:border-blue-300 transition-colors bg-white shadow-sm ${item.stock_count === 0 ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div>
                        <div className="font-bold text-sm leading-tight mb-1">{item.name}</div>
                        <div className="text-blue-600 font-black text-sm mb-2">RM{item.price.toFixed(2)}</div>
                        
                        <div className="mb-2">
                          {item.stock_count === null || item.stock_count === undefined ? (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">✅ IN STOCK</span>
                          ) : item.stock_count === 0 ? (
                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">❌ Sold Out</span>
                          ) : item.stock_count <= 5 ? (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase">⚠️ {item.stock_count} left</span>
                          ) : (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">✅ {item.stock_count} left</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        {item.stock_count === 0 ? (
                          <button disabled className="w-full text-xs font-bold py-2 rounded-lg bg-gray-200 text-gray-500 cursor-not-allowed">
                            DISABLED
                          </button>
                        ) : (
                          <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                            <button 
                              onClick={() => {
                                const current = cart.find(c => c.menuItemId === item.id)?.quantity || 0;
                                if (current === 1) {
                                  removeFromCart(item.id);
                                } else if (current > 1) {
                                  const newCart = cart.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity - 1 } : c);
                                  setCart(newCart);
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center font-black text-gray-600 hover:bg-gray-200 rounded"
                            >
                              -
                            </button>
                            <div className="flex-1 text-center font-bold text-sm">
                              {cart.find(c => c.menuItemId === item.id)?.quantity || 0}
                            </div>
                            <button 
                              onClick={() => {
                                const current = cart.find(c => c.menuItemId === item.id)?.quantity || 0;
                                const max = item.stock_count != null ? item.stock_count : 99;
                                if (current < max) {
                                  if (current === 0) {
                                    setCart([...cart, {
                                      id: Date.now().toString(),
                                      menuItemId: item.id,
                                      name: item.name,
                                      price: item.price,
                                      quantity: 1,
                                      fulfillmentType: 'dine_in',
                                      notes: ''
                                    }]);
                                  } else {
                                    const newCart = cart.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
                                    setCart(newCart);
                                  }
                                }
                              }}
                              className="w-8 h-8 flex items-center justify-center font-black text-blue-600 hover:bg-blue-100 rounded"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 shadow-inner h-fit sticky top-4">
                <h3 className="font-black text-lg mb-4 flex items-center justify-between">
                  <span>Cart</span>
                  <span className="bg-black text-white text-xs px-2 py-1 rounded-full">{cart.length} items</span>
                </h3>
                
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="italic text-sm">Cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 text-sm">
                        <div className="flex justify-between items-start font-bold">
                          <span>{item.name} <span className="text-blue-600">x{item.quantity}</span></span>
                          <span>RM{((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}</span>
                        </div>
                        
                        <div className="mt-2 flex gap-2">
                          <select 
                            value={item.fulfillmentType}
                            onChange={(e) => {
                              const newCart = cart.map(c => c.id === item.id ? { ...c, fulfillmentType: e.target.value as any } : c);
                              setCart(newCart);
                            }}
                            className="text-[10px] border rounded p-1"
                          >
                            <option value="dine_in">Eat Here</option>
                            <option value="takeaway">Takeaway</option>
                          </select>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                            placeholder="Notes..."
                            className="flex-1 text-xs border rounded p-1 bg-gray-50 outline-none"
                            maxLength={100}
                          />
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 font-bold px-1">×</button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="border-t border-gray-200 pt-3 mt-4">
                      <div className="flex justify-between font-black text-xl mb-4">
                        <span>TOTAL:</span>
                        <span className="text-blue-600">RM{cartTotal.toFixed(2)}</span>
                      </div>
                      <button 
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting || cart.length === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-lg disabled:opacity-50 transition-colors shadow-md"
                      >
                        {isSubmitting ? 'SUBMITTING...' : 'PLACE ORDER'}
                      </button>
                      {error && <p className="text-red-500 text-sm mt-2 text-center font-bold bg-red-50 p-2 rounded">{error}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      
    
  );
}