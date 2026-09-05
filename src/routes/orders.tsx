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
import { toast } from 'sonner';

export const Route = createFileRoute('/orders')({
  ssr: false,
  beforeLoad: async ({ context, location }: any) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: OrdersPage,
});

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'pending_payment' | 'pending_verification';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'ready' | 'completed' | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last7days' | 'all' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>('');

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

    // Setup Supabase Realtime Listener for instant synchronization
    const channelName = `orders_page_realtime_${Date.now()}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        fetchOrders();
      })
      .subscribe();

    // Table broadcast listener for instant cross-tab updates
    const broadcastChannel = supabase.channel('kitchen_realtime_broadcast')
      .on('broadcast', { event: 'new_order_placed' }, () => {
        fetchOrders();
      })
      .subscribe();

    // Periodic safety sync every 5 seconds
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(interval);
    };
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

  const handleVerifyDeliveryPayment = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          paid: true,
          status: 'preparing',
        } as any)
        .eq('id', orderId);

      if (error) throw error;
      toast.success('🎉 Bayaran disahkan! Pesanan kini dibuka ke dapur dan rider di /rider.');
      await fetchOrders();
    } catch (e: any) {
      toast.error('Gagal mengesahkan bayaran: ' + e.message);
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

      if (changesDetails.items_modified.length > 0 || changesDetails.items_added.length > 0 || changesDetails.items_deleted.length > 0 || !!editingOrder.paid !== editIsPaid || editingOrder.payment_method !== editPaymentMethod) {
        
        
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
      
      {/* ORDER MANAGEMENT HEADER */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>Order Management</span>
              <span className="text-xs font-mono font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full border border-orange-200">
                POS
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">Live order tracking, kitchen status & payment processing</p>
          </div>
          <div className="relative w-full md:w-72">
            <input 
              placeholder="Search by ID, Name, or Table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-full px-4 py-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all shadow-xs"
            />
          </div>
        </div>

        {/* DATE SCOPE FILTER ROW */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
            <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              📅 Date View:
            </span>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                dateFilter === 'today'
                  ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400 font-black'
                  : 'bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-700 border border-slate-200 shadow-xs'
              }`}
            >
              <span>⚡ Today / Shift</span>
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                dateFilter === 'yesterday'
                  ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-400 font-black'
                  : 'bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-700 border border-slate-200 shadow-xs'
              }`}
            >
              <span>📅 Yesterday</span>
            </button>
            <button
              onClick={() => setDateFilter('last7days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                dateFilter === 'last7days'
                  ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400 font-black'
                  : 'bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 shadow-xs'
              }`}
            >
              <span>🗓️ Last 7 Days</span>
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                dateFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-sm font-black'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-xs'
              }`}
            >
              <span>📜 All Time History</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-500 font-bold">Pick Date:</span>
            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                if (e.target.value) setDateFilter('custom');
              }}
              className="bg-white border border-slate-200 text-xs text-slate-800 px-2.5 py-1.5 rounded-xl font-mono outline-none focus:ring-1 focus:ring-orange-500 shadow-xs"
            />
          </div>
        </div>

        {/* Tab Navigation with Live Counts */}
        {(() => {
          const countPending = orders.filter(o => o.status === 'pending').length;
          const countPreparing = orders.filter(o => o.status === 'preparing').length;
          const countReady = orders.filter(o => o.status === 'ready').length;
          const countCompleted = orders.filter(o => o.status === 'completed').length;
          const countAll = orders.length;

          return (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button 
                onClick={() => setActiveTab('all')}
                className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'all' 
                    ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400 font-black' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-xs'
                }`}
              >
                <span>📋 All Orders</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'all' ? 'bg-white/20 text-white font-black' : 'bg-slate-100 text-slate-600 font-bold'}`}>{countAll}</span>
              </button>
              <button 
                onClick={() => setActiveTab('pending')}
                className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'pending' 
                    ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-400 font-black' 
                    : 'bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-800 border border-slate-200 shadow-xs'
                }`}
              >
                <span>🟡 Pending</span>
                {countPending > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'pending' ? 'bg-white/20 text-white font-black' : 'bg-amber-100 text-amber-800 font-black'}`}>{countPending}</span>}
              </button>
              <button 
                onClick={() => setActiveTab('preparing')}
                className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'preparing' 
                    ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400 font-black' 
                    : 'bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-800 border border-slate-200 shadow-xs'
                }`}
              >
                <span>🔵 Preparing</span>
                {countPreparing > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'preparing' ? 'bg-white/20 text-white font-black' : 'bg-sky-100 text-sky-800 font-black'}`}>{countPreparing}</span>}
              </button>
              <button 
                onClick={() => setActiveTab('ready')}
                className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'ready' 
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400 font-black' 
                    : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 shadow-xs'
                }`}
              >
                <span>🟢 Ready</span>
                {countReady > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'ready' ? 'bg-white/20 text-white font-black' : 'bg-emerald-100 text-emerald-800 font-black'}`}>{countReady}</span>}
              </button>
              <button 
                onClick={() => setActiveTab('completed')}
                className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'completed' 
                    ? 'bg-slate-800 text-white shadow-sm font-black' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-xs'
                }`}
              >
                <span>⚪ Completed</span>
                {countCompleted > 0 && <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${activeTab === 'completed' ? 'bg-white/20 text-white font-black' : 'bg-slate-100 text-slate-600 font-black'}`}>{countCompleted}</span>}
              </button>
            </div>
          );
        })()}
      </div>

        {/* Orders Grid */}
        {(() => {
          const sq = searchQuery.toLowerCase();

          // Timezone resilient Date Math
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
          const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
          const last7DaysStart = todayStart - (7 * 24 * 60 * 60 * 1000);

          const filteredOrders = orders.filter(o => {
            if (activeTab !== 'all' && o.status !== activeTab) return false;

            const orderTime = new Date(o.created_at).getTime();

            if (dateFilter === 'today') {
              // Grace margin of 1 hour to handle local timezone shifts safely
              if (orderTime < (todayStart - 3600000)) return false;
            } else if (dateFilter === 'yesterday') {
              if (orderTime < yesterdayStart || orderTime >= todayStart) return false;
            } else if (dateFilter === 'last7days') {
              if (orderTime < last7DaysStart) return false;
            } else if (dateFilter === 'custom' && customDate) {
              const selectedTime = new Date(customDate).getTime();
              const selStart = new Date(new Date(selectedTime).setHours(0,0,0,0)).getTime();
              const selEnd = selStart + (24 * 60 * 60 * 1000);
              if (orderTime < selStart || orderTime >= selEnd) return false;
            }

            if (!sq) return true;
            const matchesId = o.id.toLowerCase().includes(sq);
            const matchesName = o.customer_name?.toLowerCase().includes(sq);
            const tableName = o.table_id ? tables.find(t => t.id === o.table_id)?.table_number?.toLowerCase() : null;
            const matchesTable = tableName?.includes(sq);
            return matchesId || matchesName || matchesTable;
          });

          if (filteredOrders.length === 0) {
            return (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-500 border border-slate-200/90 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3 font-bold text-xl">
                  📋
                </div>
                <p className="text-base font-extrabold text-slate-800">No orders found in this section.</p>
                <p className="text-xs text-slate-400 font-mono mt-1">Orders placed via QR menu or POS counter will appear here.</p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrders.map((order) => {
                const isFullyPaid = !!order.paid || (order as any).payment_status === 'paid';
                const totalPaid = isFullyPaid ? order.total_amount : 0;
                const remainingBalance = isFullyPaid ? 0 : order.total_amount;
                
                // Color coding based on status in Fauna Kitchen theme
                let bgClass = "bg-white";
                let borderClass = "border-slate-200/90";
                
                if (order.status === 'pending') { bgClass = "bg-white"; borderClass = "border-amber-300 ring-1 ring-amber-200/60"; }
                if (order.status === 'preparing') { bgClass = "bg-white"; borderClass = "border-sky-300 ring-1 ring-sky-200/60"; }
                if (order.status === 'ready') { bgClass = "bg-white"; borderClass = "border-emerald-300 ring-1 ring-emerald-200/60"; }
                if (order.status === 'completed') { bgClass = "bg-slate-50/70"; borderClass = "border-slate-200/80"; }

                return (
                  <div key={order.id} className={`border ${borderClass} ${bgClass} rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between`}>
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-start gap-2 mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-black text-lg text-slate-900">
                              {order.type === 'delivery' ? `DELIVERY (Grab)` : (order.type === 'takeaway' ? `TAKEAWAY` : `TABLE ${tables.find(t => t.id === order.table_id)?.table_number || 'N/A'}`)}
                            </span>
                            {isFullyPaid ? (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">✓ PAID</span>
                            ) : (
                              <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold">❌ NOT PAID</span>
                            )}
                            {(order.order_items || []).some(i => i.fulfillment_type === 'takeaway') && (
                              <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-0.5 rounded-full font-bold">
                                🥡 Has Takeaway Items (Deliver to Table)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 font-mono">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5 font-mono">
                            <span>📍 Opened: {new Date(order.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' })}, {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="text-slate-400">({Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)}m ago)</span>
                          </p>
                          {order.customer_name && <p className="text-xs text-slate-700 font-semibold mt-1">👤 Customer: {order.customer_name}</p>}
                        </div>
                        
                        {/* Status Select */}
                        <div className="flex flex-col items-end gap-1">
                          <select 
                            value={order.status} 
                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="text-xs border border-slate-200 bg-slate-50 text-slate-800 p-1.5 rounded-xl font-bold shadow-xs outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            {statusOptions.map(status => (
                              <option key={status} value={status}>{status.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="mb-4 space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Items</p>
                        {(order.order_items || []).map((item, idx) => {
                          const itemName = item.menu_items?.name || menuItems.find(m => m.id === item.menu_item_id)?.name || 'Menu Item';
                          return (
                            <div key={idx} className="text-sm">
                              <p className="font-semibold text-slate-800">
                                • {itemName} <span className="text-slate-500 font-bold">x{item.quantity}</span>
                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${item.fulfillment_type === 'takeaway' ? 'bg-orange-50 text-orange-800 border border-orange-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                  {item.fulfillment_type === 'takeaway' ? '🥡 Takeaway' : '🍽️ Dine-in'}
                                </span> 
                                <span className="text-orange-600 font-mono font-black ml-2">RM{Number(item.price_at_order * item.quantity).toFixed(2)}</span>
                              </p>
                              {(item as any).notes && (
                                <p className="text-xs text-amber-800 font-medium italic ml-3 mt-0.5 flex items-start gap-1 bg-amber-50/80 px-2 py-0.5 rounded-md border border-amber-200/70 inline-flex">
                                  <span>↳</span> Notes: {(item as any).notes}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer */}
                    <div>
                      {/* Financials */}
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm justify-between text-slate-800">
                        <div>
                          <span className="text-slate-500 mr-1 text-xs">Total:</span> 
                          <span className="font-black text-orange-600 font-mono text-base">RM{order.total_amount.toFixed(2)}</span>
                        </div>
                        {!isFullyPaid && (
                          <div>
                            <span className="text-slate-500 mr-1 text-xs">Paid:</span> 
                            <span className="font-bold text-slate-400 font-mono">RM0.00</span>
                          </div>
                        )}
                        {!isFullyPaid && (
                          <div className="w-full mt-1 pt-1 border-t border-slate-200/60 flex justify-between">
                            <span className="text-slate-500 text-xs">Balance Due:</span> 
                            <span className="text-rose-600 font-black font-mono">RM{order.total_amount.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {/* Payment form if not paid */}
                      {!isFullyPaid && (
                        <div className="mb-3">
                          <form 
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const formData = new FormData(form);
                              const method = (formData.get('method') as string) || 'cash';

                              const { error } = await supabase
                                .from('orders')
                                .update({
                                  paid: true,
                                  payment_method: method,
                                  payment_status: 'paid'
                                } as any)
                                .eq('id', order.id);

                              if (error) {
                                toast.error('Payment failed: ' + error.message);
                              } else {
                                toast.success('🎉 Bayaran berjaya direkod!');
                                await fetchOrders();
                              }
                            }}
                            className="flex gap-2 items-center flex-wrap bg-orange-50/60 p-2.5 rounded-2xl border border-orange-200/70"
                          >
                            <span className="text-xs text-orange-950 font-bold">Terima Bayaran:</span>
                            <select name="method" className="bg-white border border-slate-200 text-slate-800 p-1.5 text-xs rounded-xl shadow-xs font-bold outline-none">
                              <option value="cash">💵 Cash</option>
                              <option value="card">💳 Card</option>
                              <option value="qr">📱 QR / Transfer</option>
                            </select>
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-black rounded-xl shadow-xs active:scale-95 transition-all">
                              ✓ TANDA BAYAR
                            </button>
                          </form>
                        </div>
                      )}

                      {/* ANTI-SCAM: STAFF ONE-CLICK VERIFY DELIVERY PAYMENT */}
                      {order.type === 'delivery' && (!order.paid || (order as any).payment_status === 'pending' || order.status === 'pending_payment' || order.status === 'pending_verification') && (
                        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                            <span>🛡️ Delivery Menunggu Pengesahan Resit</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleVerifyDeliveryPayment(order.id)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                          >
                            <span>✓ Sahkan Bayaran & Buka Job Rider</span>
                          </button>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap border-t border-slate-100 pt-3">
                        <button 
                          onClick={() => handleEditClick(order)}
                          className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-slate-50 shadow-xs active:scale-95 transition-all"
                        >
                          EDIT
                        </button>
                        <button 
                          onClick={() => {
                            setDeletingOrder(order);
                            setDeleteReason('');
                            setDeleteNotes('');
                          }}
                          className="bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-50 shadow-xs active:scale-95 transition-all"
                        >
                          DELETE
                        </button>
                        <div className="flex-1"></div>
                        <button 
                          onClick={() => handleViewHistory(order)}
                          className="text-slate-500 hover:text-slate-900 text-xs font-semibold px-2 py-1.5 transition-colors"
                        >
                          History
                        </button>
                        <button 
                          onClick={() => {
                            import('@/lib/receipt').then(({ generateReceiptHTML }) => {
                              const store = { name: "Warung J&J", logo_url: window.location.origin + "/favicon.png", phone_number: "60172221784", phone_number_2: "60178284578" };
                              const itemsForPrint = (order.order_items || []).map(i => ({
                                name: i.menu_items?.name || 'Item', price: i.price_at_order, quantity: i.quantity, container_size: (i as any).container_size, container_charge: (i as any).container_charge, notes: (i as any).notes
                              }));
                              const html = generateReceiptHTML(order as any, store, "Staff", itemsForPrint);
                              const printWindow = window.open('', '_blank');
                              if (printWindow) { printWindow.document.write(html); printWindow.document.close(); }
                            });
                          }}
                          className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all"
                        >
                          PRINT
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Edit Order Dialog */}
      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">Edit Order #{editingOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Order Type */}
            <div className="space-y-4 border-b border-slate-100 pb-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono">Order Type</h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                    <input type="radio" name="edit_type" value="dine_in" checked={editOrderType === 'dine_in'} onChange={() => setEditOrderType('dine_in')} className="text-orange-500 focus:ring-orange-400" /> Dine-In
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                    <input type="radio" name="edit_type" value="takeaway" checked={editOrderType === 'takeaway'} onChange={() => setEditOrderType('takeaway')} className="text-orange-500 focus:ring-orange-400" /> Takeaway
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                    <input type="radio" name="edit_type" value="delivery" checked={editOrderType === 'delivery'} onChange={() => setEditOrderType('delivery')} className="text-orange-500 focus:ring-orange-400" /> Delivery (Grab)
                  </label>
                </div>
                {editOrderType === 'delivery' && (
                  <div className="mt-2 pl-4 border-l-2 border-orange-500">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Fee (RM)</label>
                    <Input 
                      type="number" 
                      min="0"
                      step="0.10"
                      value={editDeliveryFee} 
                      onChange={(e) => setEditDeliveryFee(parseFloat(e.target.value) || 0)}
                      className="w-32 bg-white border-slate-200 text-slate-900 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Existing & Modified Items */}
            <div className="space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono">Items</h3>
              {editItems.map((item, index) => (
                <div key={item.id || index} className="flex gap-4 items-end bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl flex-wrap">
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-sm font-bold text-slate-900">{item.menu_items?.name || menuItems.find(m => m.id === item.menu_item_id)?.name}</p>
                    <p className="text-xs text-orange-600 font-mono font-bold">RM{Number(item.price_at_order || menuItems.find(m => m.id === item.menu_item_id)?.price || 0).toFixed(2)} each</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Qty</label>
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
                      className="w-20 h-8 bg-white border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Notes</label>
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
                      className="w-32 h-8 text-xs bg-white border-slate-200 rounded-xl"
                      placeholder="Requests..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-500">Fulfillment</label>
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
                      className="border border-slate-200 bg-white rounded-xl h-8 text-xs px-2"
                    >
                      <option value="dine_in">Eat here</option>
                      <option value="takeaway">Takeaway</option>
                    </select>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setEditItems(editItems.filter((_, i) => i !== index))}
                    className="h-8 rounded-xl"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            {/* Add New Item */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono mb-2">Add New Item</h3>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <select 
                    id="edit-new-item"
                    className="w-full border border-slate-200 bg-white rounded-xl h-9 text-sm px-3 shadow-xs"
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
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Add Item
                </Button>
              </div>
            </div>

            {/* Payment Section */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono mb-2">Payment Status</h3>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editIsPaid}
                    onChange={(e) => setEditIsPaid(e.target.checked)}
                    className="w-4 h-4 text-orange-500 rounded focus:ring-orange-400"
                  />
                  Mark as Paid
                </label>
                
                {editIsPaid && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                      <input
                        type="radio"
                        checked={editPaymentMethod === 'cash'}
                        onChange={() => setEditPaymentMethod('cash')}
                      />
                      💵 Cash
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                      <input
                        type="radio"
                        checked={editPaymentMethod === 'card'}
                        onChange={() => setEditPaymentMethod('card')}
                      />
                      💳 Card
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 font-mono mb-2">Summary</h3>
              <div className="space-y-1 text-sm bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">RM {editItems.reduce((sum, item) => sum + (Number(item.price_at_order) * item.quantity), 0).toFixed(2)}</span>
                </div>
                {(() => {
                  const containerTotal = editItems.reduce((sum, item) => sum + (Number((item as any).container_charge || 0) * item.quantity), 0);
                  if (containerTotal > 0) {
                    return (
                      <div className="flex justify-between text-slate-600">
                        <span>Container Fee:</span>
                        <span className="font-mono font-bold text-slate-900">RM {containerTotal.toFixed(2)}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {editOrderType === 'delivery' && (
                  <div className="flex justify-between text-orange-600 font-medium">
                    <span>Delivery Fee:</span>
                    <span className="font-mono font-bold">RM {Number(editDeliveryFee || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-lg pt-2 border-t border-slate-200 mt-2 text-slate-900">
                  <span>TOTAL:</span>
                  <span className="text-orange-600 font-mono">RM {(
                    editItems.reduce((sum, item) => sum + (Number(item.price_at_order) * item.quantity) + (Number((item as any).container_charge || 0) * item.quantity), 0)
                  ).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Reason for Change */}
            <div className="border-t border-slate-100 pt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-1">Reason for change (Mandatory)</label>
              <select 
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full border border-slate-200 bg-white p-2.5 rounded-xl mb-2 text-sm shadow-xs"
              >
                <option value="" disabled>Select a reason...</option>
                {EDIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-1 mt-2">Notes (Optional)</label>
              <Textarea 
                placeholder="Additional details..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="h-16 bg-white border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingOrder(null)} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={isSavingEdit || !editReason}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xs"
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View History Dialog */}
      <Dialog open={!!historyOrder} onOpenChange={(open) => !open && setHistoryOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">Edit History - Order #{historyOrder?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {isLoadingHistory ? (
              <p className="text-center italic py-8 text-slate-500 font-mono">Loading history...</p>
            ) : editLogs.length === 0 ? (
              <p className="text-center italic py-8 text-slate-500 font-mono">No edits recorded for this order.</p>
            ) : (
              <div className="space-y-4">
                {editLogs.map(log => (
                  <div key={log.id} className="border-l-4 border-orange-500 bg-orange-50/40 border border-orange-100 p-3.5 rounded-2xl">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-xs uppercase tracking-wider text-orange-800 font-mono">{log.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{log.details?.item_name || 'Order Item'}</p>
                    {log.action === 'item_updated' && log.details?.changes && (
                      <div className="text-xs text-slate-600 mt-1 font-mono">
                        {Object.entries(log.details.changes).map(([field, vals]: [string, any]) => (
                          <div key={field}>{field}: <span className="line-through text-slate-400">{vals.old}</span> → <span className="font-bold text-slate-900">{vals.new}</span></div>
                        ))}
                      </div>
                    )}
                    {log.action === 'item_added' && (
                      <p className="text-xs text-emerald-700 font-mono font-bold">Added quantity: {log.details?.quantity}</p>
                    )}
                    {log.action === 'item_deleted' && (
                      <p className="text-xs text-rose-700 font-mono font-bold">Deleted quantity: {log.details?.old_quantity}</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-orange-100">
                      <p className="text-xs italic text-slate-600">"{log.reason}"</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">— {log.users?.name || 'Staff'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setHistoryOrder(null)} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Order Dialog */}
      <Dialog open={!!deletingOrder} onOpenChange={(open) => !open && setDeletingOrder(null)}>
        <DialogContent className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-rose-600">DELETE ORDER?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl mb-4">
              <p className="font-black text-slate-900">
                Order #{deletingOrder?.id.slice(0, 8)}
              </p>
              <p className="text-xs font-mono text-slate-600 mt-0.5">
                {deletingOrder?.type === 'dine_in' ? `Table ${tables.find(t => t.id === deletingOrder?.table_id)?.table_number || 'N/A'}` : 'Takeaway'} | RM {deletingOrder?.total_amount.toFixed(2)}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-1">Reason for deletion (Mandatory)</label>
              <select 
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full border border-slate-200 bg-white p-2.5 rounded-xl mb-2 text-sm shadow-xs"
              >
                <option value="" disabled>Select a reason...</option>
                {DELETE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono mb-1 mt-2">Notes (Optional)</label>
              <Textarea 
                placeholder="Additional details..."
                value={deleteNotes}
                onChange={(e) => setDeleteNotes(e.target.value)}
                className="h-16 bg-white border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingOrder(null)} className="rounded-xl">NO, CANCEL</Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteOrder} 
              disabled={isDeleting || !deleteReason}
              className="rounded-xl font-bold"
            >
              {isDeleting ? 'Deleting...' : 'YES, DELETE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
