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

export const Route = createFileRoute('/orders')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: OrdersPage,
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

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        delivery_service: editOrderType === 'delivery' ? 'grab' : null
      };

      const { error: orderUpErr } = await supabase.from('orders').update(orderUpdatePayload).eq('id', editingOrder.id);
      
      if (orderUpErr) throw orderUpErr;

      if (changesDetails.items_modified.length > 0 || changesDetails.items_added.length > 0 || changesDetails.items_deleted.length > 0 || editingOrder.type !== editOrderType || editingOrder.delivery_fee !== editDeliveryFee) {
        
        if (editingOrder.type !== editOrderType) {
          changesDetails.type_changed = `${editingOrder.type} -> ${editOrderType}`;
        }
        if (editOrderType === 'delivery') {
          changesDetails.delivery_fee = editDeliveryFee;
        }

        const { error: logErr } = await supabase.from('order_edit_logs').insert({
          order_id: editingOrder.id,
          action: 'edit',
          reason: editReason,
          edited_by: user.id,
          before_total: editingOrder.total_amount,
          after_total: newTotalAmount,
          changes: changesDetails
        });
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
      });
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
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Order Management</h1>

      <div className="mb-8 border p-4">
        <h2 className="text-lg font-bold mb-4">Create New Order</h2>
        
        <div className="space-y-4">
          {/* Table Selection */}
          <div>
            <label className="block font-medium">Step 1: Select Table (Required for all walk-ins)</label>
            <select 
              value={selectedTableId} 
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="border p-1 mt-1"
            >
              <option value="">Select Table</option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>
                  Table {table.table_number}
                </option>
              ))}
            </select>
          </div>

          {/* Table Selection or Customer Name */}
          <div>
            <label className="block font-medium">Step 2: Customer Name (Optional)</label>
            <input 
              type="text"
              placeholder="Enter name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="border p-1 mt-1 w-full max-w-xs"
            />
          </div>

          {/* Item Selector */}
          <div className="border-t pt-4">
            <label className="block font-medium">Step 3: Add Items</label>
            <div className="flex gap-4 items-end mt-1 flex-wrap">
              <div>
                <label className="block text-sm">Item</label>
                <select 
                  value={selectedMenuItemId} 
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  className="border p-1"
                >
                  <option value="">Select Item</option>
                  {menuItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (RM{item.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm">Qty</label>
                <input 
                  type="number" 
                  min="1" 
                  value={quantity} 
                  onChange={(e) => setQuantity(parseInt(e.target.value))} 
                  className="border p-1 w-16"
                />
              </div>
              <div>
                <label className="block text-sm">Fulfillment</label>
                <select 
                  value={itemFulfillmentType}
                  onChange={(e) => setItemFulfillmentType(e.target.value as 'dine_in' | 'takeaway')}
                  className="border p-1"
                >
                  <option value="dine_in">Eat here</option>
                  <option value="takeaway">Takeaway</option>
                </select>
              </div>
              {itemFulfillmentType === 'takeaway' && (
                <div>
                  <label className="block text-sm">Container</label>
                  <select 
                    value={containerSize}
                    onChange={(e) => setContainerSize(e.target.value as 'small' | 'large')}
                    className="border p-1"
                  >
                    <option value="small">Small (free)</option>
                    <option value="large">Large (+RM1)</option>
                  </select>
                </div>
              )}
              <button 
                onClick={handleAddToCart}
                className="bg-green-600 text-white px-4 py-1"
              >
                Add to Cart
              </button>
            </div>
          </div>

          {/* Cart Display */}
          <div className="border-t pt-4">
            <label className="block font-medium mb-2">Step 4: Cart List</label>
            {cart.length === 0 ? (
              <p className="text-gray-500 italic text-sm">Cart is empty</p>
            ) : (
              <div className="space-y-1">
                {cart.map(item => (
                  <div key={item.id} className="flex flex-col bg-gray-50 p-2 text-sm border-b">
                    <div className="flex justify-between items-start">
                      <span>
                        {item.name} x {item.quantity} ({item.fulfillmentType === 'dine_in' ? 'Eat here' : `Takeaway - ${item.containerSize}`}) = RM{((item.price + (item.containerCharge || 0)) * item.quantity).toFixed(2)}
                      </span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 font-bold ml-4"
                      >
                        [Remove]
                      </button>
                    </div>
                    <div className="mt-1 w-full max-w-sm">
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateCartItemNotes(item.id, e.target.value)}
                        placeholder="Special Requests (e.g., less spicy)"
                        className="w-full text-xs border rounded p-1"
                        maxLength={100}
                      />
                    </div>
                  </div>
                ))}
                <div className="font-bold border-t mt-2 pt-2 flex justify-between">
                  <span>Running Total:</span>
                  <span>RM{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="border-t pt-4">
            <button 
              onClick={handleSubmitOrder}
              disabled={isSubmitting || cart.length === 0}
              className="bg-blue-600 text-white px-8 py-2 font-bold disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Order'}
            </button>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </div>
      </div>
      
      <h2 className="text-lg font-bold mb-2">Recent Orders</h2>
      {orders.length === 0 ? (
        <p>No orders yet</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const totalPaid = (order.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            const remainingBalance = Math.max(0, order.total_amount - totalPaid);
            const isFullyPaid = remainingBalance <= 0;

            return (
              <div key={order.id} className="border-b pb-4 mb-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <p className="font-bold">
                      {order.type === 'dine_in' ? `DINE-IN` : `TAKEAWAY`} {order.table_id ? `(Table ${tables.find(t => t.id === order.table_id)?.table_number || 'N/A'})` : ''} {order.customer_name ? `- ${order.customer_name}` : ''}
                    </p>
                    <p className="text-sm text-gray-600">
                      ID: {order.id.slice(0, 8)} | {new Date(order.created_at).toLocaleString()}
                    </p>
                    <div className="flex gap-4 mt-1">
                      <button 
                        onClick={() => handleEditClick(order)}
                        className="text-blue-600 text-xs font-semibold hover:underline"
                      >
                        Edit Order
                      </button>
                      <button 
                        onClick={() => {
                          setDeletingOrder(order);
                          setDeleteReason('');
                          setDeleteNotes('');
                        }}
                        className="text-red-600 text-xs font-semibold hover:underline"
                      >
                        Delete Order
                      </button>
                      <button 
                        onClick={() => handleViewHistory(order)}
                        className="text-gray-600 text-xs font-semibold hover:underline"
                      >
                        View Edit History
                      </button>
                      <button 
                        onClick={() => {
                          import('@/lib/receipt').then(({ generateReceiptHTML }) => {
                            const store = {
                              name: "Warung J&J",
                              logo_url: window.location.origin + "/favicon.png",
                              phone_number: "60172221784",
                              phone_number_2: "60178284578"
                            };
                            
                            const itemsForPrint = (order.order_items || []).map(i => ({
                              name: i.menu_items?.name || 'Item',
                              price: i.price_at_order,
                              quantity: i.quantity,
                              container_size: (i as any).container_size,
                              container_charge: (i as any).container_charge,
                              notes: (i as any).notes
                            }));

                            const html = generateReceiptHTML(order as any, store, "Staff", itemsForPrint);
                            const printWindow = window.open('', '_blank');
                            if (printWindow) {
                              printWindow.document.write(html);
                              printWindow.document.close();
                            }
                          });
                        }}
                        className="text-green-600 text-xs font-semibold hover:underline"
                      >
                        Print Receipt
                      </button>
                      <button 
                        onClick={() => {
                          import('@/lib/receipt').then(({ shareReceiptWhatsApp }) => {
                            const store = {
                              name: "Warung J&J",
                              logo_url: window.location.origin + "/favicon.png",
                              phone_number: "60172221784",
                              phone_number_2: "60178284578"
                            };
                            
                            const itemsForPrint = (order.order_items || []).map(i => ({
                              name: i.menu_items?.name || 'Item',
                              price: i.price_at_order,
                              quantity: i.quantity,
                              container_size: (i as any).container_size,
                              container_charge: (i as any).container_charge,
                              notes: (i as any).notes
                            }));

                            shareReceiptWhatsApp(order as any, store, "Staff", itemsForPrint);
                          });
                        }}
                        className="text-emerald-500 text-xs font-semibold hover:underline"
                      >
                        Share via WhatsApp
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm">Status:</span>
                    <select 
                      value={order.status} 
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      className="border p-1 text-sm"
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="mt-2 text-sm">
                  <span className="mr-4">Total: <span className="font-semibold">RM{order.total_amount.toFixed(2)}</span></span>
                  <span className="mr-4">Paid: <span className="text-green-600 font-semibold">RM{totalPaid.toFixed(2)}</span></span>
                  <span>Balance: <span className={`${remainingBalance > 0 ? 'text-red-600' : 'text-blue-600'} font-bold`}>
                    {isFullyPaid ? 'FULLY PAID' : `RM${remainingBalance.toFixed(2)}`}
                  </span></span>
                </div>

                {!isFullyPaid && (
                  <div className="mt-3 bg-gray-50 p-2 rounded">
                    <p className="text-xs font-bold mb-1 uppercase text-gray-500">Record Payment</p>
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const formData = new FormData(form);
                        const amount = parseFloat(formData.get('amount') as string);
                        const method = formData.get('method') as string;
                        const paidBy = formData.get('paid_by') as string;

                        if (isNaN(amount) || amount <= 0) return alert('Invalid amount');

                        const { error } = await supabase
                          .from('payments')
                          .insert({
                            order_id: order.id,
                            amount: amount,
                            payment_method: method as any,
                            paid_by: paidBy || null
                          });

                        if (error) {
                          alert('Payment failed: ' + error.message);
                        } else {
                          // Optional: If fully paid after this, could auto-update status to 'completed'
                          // but instructions say "optionally update status", I'll stick to refresh for now.
                          await fetchOrders();
                        }
                      }}
                      className="flex gap-2 items-end flex-wrap"
                    >
                      <div>
                        <label className="block text-[10px]">Amount</label>
                        <input name="amount" type="number" step="0.01" defaultValue={remainingBalance.toFixed(2)} className="border p-1 text-sm w-20" required />
                      </div>
                      <div>
                        <label className="block text-[10px]">Method</label>
                        <select name="method" className="border p-1 text-sm">
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="qr">QR</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px]">Paid By (Optional)</label>
                        <input name="paid_by" type="text" className="border p-1 text-sm w-24" placeholder="Name" />
                      </div>
                      <button type="submit" className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700">
                        Add Payment
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order {editingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Order Type */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="font-bold text-sm uppercase text-gray-500">Order Type</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="edit_type" value="dine_in" checked={editOrderType === 'dine_in'} onChange={() => setEditOrderType('dine_in')} /> Dine-In
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="edit_type" value="takeaway" checked={editOrderType === 'takeaway'} onChange={() => setEditOrderType('takeaway')} /> Takeaway
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="edit_type" value="delivery" checked={editOrderType === 'delivery'} onChange={() => setEditOrderType('delivery')} /> Delivery (Grab)
                  </label>
                </div>
                {editOrderType === 'delivery' && (
                  <div className="mt-2 pl-4 border-l-2 border-blue-500">
                    <label className="block text-sm font-bold mb-1">Delivery Fee (RM)</label>
                    <Input 
                      type="number" 
                      min="0"
                      step="0.10"
                      value={editDeliveryFee} 
                      onChange={(e) => setEditDeliveryFee(parseFloat(e.target.value) || 0)}
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Existing & Modified Items */}
            <div className="space-y-4">
              <h3 className="font-bold text-sm uppercase text-gray-500">Items</h3>
              {editItems.map((item, index) => (
                <div key={item.id || index} className="flex gap-4 items-end bg-gray-50 p-3 rounded flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-sm font-medium">{item.menu_items?.name || menuItems.find(m => m.id === item.menu_item_id)?.name}</p>
                    <p className="text-xs text-gray-500">RM{Number(item.price_at_order || menuItems.find(m => m.id === item.menu_item_id)?.price || 0).toFixed(2)} each</p>
                  </div>
                  <div>
                    <label className="block text-[10px]">Qty</label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={item.quantity} 
                      onChange={(e) => {
                        const newItems = [...editItems];
                        const itemToUpdate = newItems[index];
                        if (itemToUpdate) {
                          newItems[index] = {
                            ...itemToUpdate,
                            quantity: parseInt(e.target.value) || 1
                          };
                          setEditItems(newItems);
                        }
                      }}
                      className="w-20 h-8"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px]">Notes</label>
                    <Input 
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => {
                        const newItems = [...editItems];
                        const itemToUpdate = newItems[index];
                        if (itemToUpdate) {
                          newItems[index] = {
                            ...itemToUpdate,
                            notes: e.target.value.slice(0, 100)
                          };
                          setEditItems(newItems);
                        }
                      }}
                      className="w-32 h-8 text-xs"
                      placeholder="Requests..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px]">Fulfillment</label>
                    <select 
                      value={item.fulfillment_type}
                      onChange={(e) => {
                        const newItems = [...editItems];
                        const itemToUpdate = newItems[index];
                        if (itemToUpdate) {
                          newItems[index] = {
                            ...itemToUpdate,
                            fulfillment_type: e.target.value as 'dine_in' | 'takeaway'
                          };
                          setEditItems(newItems);
                        }
                      }}
                      className="border rounded h-8 text-sm px-2"
                    >
                      <option value="dine_in">Eat here</option>
                      <option value="takeaway">Takeaway</option>
                    </select>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setEditItems(editItems.filter((_, i) => i !== index))}
                    className="h-8"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            {/* Add New Item */}
            <div className="border-t pt-4">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">Add New Item</h3>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <select 
                    id="edit-new-item"
                    className="w-full border rounded h-9 text-sm px-2"
                    defaultValue=""
                  >
                    <option value="" disabled>Select Menu Item</option>
                    {menuItems.map(m => <option key={m.id} value={m.id}>{m.name} (RM{m.price.toFixed(2)})</option>)}
                  </select>
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    const select = document.getElementById('edit-new-item') as HTMLSelectElement | null;
                    const val = select?.value;
                    if (!val) return;
                    const m = menuItems.find(item => item.id === val);
                    if (!m) return;
                    setEditItems([...editItems, {
                      id: '', // Empty ID signifies new item
                      order_id: editingOrder?.id || '',
                      menu_item_id: m.id,
                      quantity: 1,
                      price_at_order: m.price,
                      fulfillment_type: 'dine_in',
                      notes: '',
                      menu_items: { name: m.name }
                    }]);
                    if (select) select.value = '';
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="border-t pt-4">
              <h3 className="font-bold text-sm uppercase text-gray-500 mb-2">Summary</h3>
              <div className="space-y-1 text-sm bg-gray-50 p-3 rounded">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>RM {editItems.reduce((sum, item) => sum + (Number(item.price_at_order) * item.quantity), 0).toFixed(2)}</span>
                </div>
                {(() => {
                  const containerTotal = editItems.reduce((sum, item) => sum + (Number((item as any).container_charge || 0) * item.quantity), 0);
                  if (containerTotal > 0) {
                    return (
                      <div className="flex justify-between">
                        <span>Container Fee:</span>
                        <span>RM {containerTotal.toFixed(2)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {editOrderType === 'delivery' && (
                  <div className="flex justify-between text-blue-600 font-medium">
                    <span>Delivery Fee:</span>
                    <span>RM {Number(editDeliveryFee || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                  <span>TOTAL:</span>
                  <span>RM {(
                    editItems.reduce((sum, item) => sum + (Number(item.price_at_order) * item.quantity) + (Number((item as any).container_charge || 0) * item.quantity), 0)
                    + (editOrderType === 'delivery' ? Number(editDeliveryFee || 0) : 0)
                  ).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Reason for Change */}
            <div className="border-t pt-4">
              <label className="block text-sm font-bold mb-1">Reason for change (Mandatory)</label>
              <select 
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full border p-2 rounded mb-2"
              >
                <option value="" disabled>Select a reason...</option>
                {EDIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="block text-sm font-bold mb-1 mt-2">Notes (Optional)</label>
              <Textarea 
                placeholder="Additional details..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={isSavingEdit || !editReason}
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View History Dialog */}
      <Dialog open={!!historyOrder} onOpenChange={(open) => !open && setHistoryOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit History - Order {historyOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {isLoadingHistory ? (
              <p className="text-center italic py-8">Loading history...</p>
            ) : editLogs.length === 0 ? (
              <p className="text-center italic py-8 text-gray-500">No edits recorded for this order.</p>
            ) : (
              <div className="space-y-4">
                {editLogs.map(log => (
                  <div key={log.id} className="border-l-4 border-blue-500 bg-gray-50 p-3 rounded">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm uppercase text-blue-700">{log.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium">{log.details?.item_name || 'Order Item'}</p>
                    {log.action === 'item_updated' && log.details?.changes && (
                      <div className="text-xs text-gray-600 mt-1">
                        {Object.entries(log.details.changes).map(([field, vals]: [string, any]) => (
                          <div key={field}>{field}: <span className="line-through">{vals.old}</span> → <span className="font-bold">{vals.new}</span></div>
                        ))}
                      </div>
                    )}
                    {log.action === 'item_added' && (
                      <p className="text-xs text-gray-600">Added quantity: {log.details?.quantity}</p>
                    )}
                    {log.action === 'item_deleted' && (
                      <p className="text-xs text-gray-600">Deleted quantity: {log.details?.old_quantity}</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs italic text-gray-500">" {log.reason} "</p>
                      <p className="text-[10px] text-gray-400 mt-1">— {log.users?.name || 'Staff'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setHistoryOrder(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Order Dialog */}
      <Dialog open={!!deletingOrder} onOpenChange={(open) => !open && setDeletingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>DELETE ORDER?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="font-bold mb-2">
              Order {deletingOrder?.id.slice(0, 8)} <br/>
              {deletingOrder?.type === 'dine_in' ? `Table ${tables.find(t => t.id === deletingOrder?.table_id)?.table_number || 'N/A'}` : 'Takeaway'} | RM {deletingOrder?.total_amount.toFixed(2)}
            </p>
            <div className="mt-4">
              <label className="block text-sm font-bold mb-1">Reason for deletion (Mandatory)</label>
              <select 
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full border p-2 rounded mb-2"
              >
                <option value="" disabled>Select a reason...</option>
                {DELETE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="block text-sm font-bold mb-1 mt-2">Notes (Optional)</label>
              <Textarea 
                placeholder="Additional details..."
                value={deleteNotes}
                onChange={(e) => setDeleteNotes(e.target.value)}
                className="h-16"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOrder(null)}>NO, CANCEL</Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteOrder} 
              disabled={isDeleting || !deleteReason}
            >
              {isDeleting ? 'Deleting...' : 'YES, DELETE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
