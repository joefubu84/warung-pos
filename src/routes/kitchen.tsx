import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';
import { playKitchenSound } from '@/lib/sounds';

export const Route = createFileRoute('/kitchen')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: KitchenPage,
});

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface OrderItem {
  id: string;
  quantity: number;
  fulfillment_type: 'dine_in' | 'takeaway';
  container_size: 'small' | 'large' | null;
  menu_items: {
    name: string;
  };
  notes?: string;
}

interface Order {
  id: string;
  status: OrderStatus;
  type: 'dine_in' | 'takeaway' | 'delivery';
  delivery_service?: 'jnj' | 'grabfood' | 'shopeefood' | 'custom' | null;
  customer_name: string | null;
  table_id: string | null;
  tables: {
    table_number: string;
  } | null;
  order_items: OrderItem[];
  created_at: string;
}

function KitchenPage() {
  const { storeId } = Route.useRouteContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [printerSettings, setPrinterSettings] = useState<any>(null);
  const settingsRef = useRef<any>(null);

  // Real-time highlight states
  const [highlightedOrders, setHighlightedOrders] = useState<Record<string, { type: 'new' | 'updated', timestamp: number }>>({});
  const [highlightedItems, setHighlightedItems] = useState<Record<string, number>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  
  const ordersRef = useRef<Order[]>([]);
  const isInitialLoad = useRef(true);

  const fetchPrinterSettings = async () => {
    const { data } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (data) {
      setPrinterSettings(data);
      settingsRef.current = data;
    }
  };

  const acknowledgeOrder = (orderId: string) => {
    setHighlightedOrders(prev => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    
    const order = ordersRef.current.find(o => o.id === orderId);
    if (order) {
      setHighlightedItems(prev => {
        const next = { ...prev };
        order.order_items.forEach(item => {
          delete next[item.id];
        });
        return next;
      });
    }
  };

  useEffect(() => {
    console.log('Fetching initial orders...');
    fetchPrinterSettings();
    fetchActiveOrders();

    const pollInterval = setInterval(() => {
      fetchActiveOrders(true);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  const fetchActiveOrders = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        type,
        delivery_service,
        customer_name,
        table_id,
        created_at,
        tables (table_number),
        order_items (
          id,
          quantity,
          fulfillment_type,
          container_size,
          notes,
          menu_items (name)
        )
      `)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching kitchen orders:', error);
    } else if (data) {
      const newOrdersData = data as unknown as Order[];
      const now = Date.now();
      let hasNewOrder = false;
      let hasUpdatedOrder = false;
      const newHighlights: Record<string, any> = {};
      const newItemHighlights: Record<string, number> = {};
      
      if (!isInitialLoad.current) {
        newOrdersData.forEach(newOrder => {
          const oldOrder = ordersRef.current.find(o => o.id === newOrder.id);
          
          if (!oldOrder) {
            newHighlights[newOrder.id] = { type: 'new', timestamp: now };
            hasNewOrder = true;
          } 
          else if (newOrder.order_items.length > oldOrder.order_items.length) {
            newHighlights[newOrder.id] = { type: 'updated', timestamp: now };
            hasUpdatedOrder = true;
            
            const oldItemIds = new Set(oldOrder.order_items.map(i => i.id));
            newOrder.order_items.forEach(item => {
              if (!oldItemIds.has(item.id)) {
                newItemHighlights[item.id] = now;
              }
            });
          }
        });
      }

      const hasChanges = hasNewOrder || hasUpdatedOrder;

      if (hasChanges) {
        setHighlightedOrders(prev => ({ ...prev, ...newHighlights }));
        setHighlightedItems(prev => ({ ...prev, ...newItemHighlights }));
        
        const settings = settingsRef.current;
        if (settings && settings.sound_choice) {
          playKitchenSound(settings.sound_choice, settings.sound_file_url);
        } else {
          playKitchenSound('kitchen_bell');
        }
      }
      
      const hasContentChanged = JSON.stringify(newOrdersData) !== JSON.stringify(ordersRef.current);
      
      if (hasContentChanged || hasChanges) {
        ordersRef.current = newOrdersData;
        setOrders(newOrdersData);
      }
      
      isInitialLoad.current = false;
    }
    setIsLoading(false);
  };

  const advanceStatus = async (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus;
    if (currentStatus === 'pending') {
      nextStatus = 'preparing';
    } else if (currentStatus === 'preparing') {
      nextStatus = 'ready';
    } else {
      return; 
    }

    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } else {
      await fetchActiveOrders();
    }
  };

  if (isLoading) return <div className="p-8">Loading Kitchen...</div>;

  const badgeColors = printerSettings?.badge_colors || {
    dineIn: '#3B82F6',
    takeaway: '#F97316',
    delivery: '#8B5CF6',
    specialRequests: '#EC4899'
  };

  const deliveryServiceColors: Record<string, string> = {
    'jnj': '#22C55E',
    'grabfood': '#EF4444',
    'shopeefood': '#FBBF24',
    'custom': '#6B7280'
  };
  
  const deliveryServiceNames: Record<string, string> = {
    'jnj': 'J&J Delivery',
    'grabfood': 'GrabFood',
    'shopeefood': 'ShopeeFood',
    'custom': 'Custom Delivery'
  };

  return (
    <div className="p-8 font-sans min-h-screen bg-slate-900 text-slate-100">
      <h1 className="text-2xl font-bold mb-6 text-white">Kitchen Display</h1>
      
      {orders.length === 0 ? (
        <p className="text-slate-400">No active orders</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const highlight = highlightedOrders[order.id];
            const hasNotes = order.order_items.some(item => item.notes);
            let cardClasses = "border-2 p-4 rounded shadow-sm flex flex-col justify-between transition-colors duration-1000 ";
            
            if (highlight?.type === 'new') {
              cardClasses += "border-red-500 bg-red-950/40 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse";
            } else if (highlight?.type === 'updated') {
              cardClasses += "border-yellow-500 bg-yellow-950/40 shadow-[0_0_15px_rgba(234,179,8,0.2)]";
            } else {
              cardClasses += "border-slate-700 bg-slate-800";
            }

            return (
              <div key={order.id} className={cardClasses}>
                <div>
                  <div className="flex flex-col gap-1 mb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 items-center flex-wrap">
                          <span 
                            className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: order.type === 'dine_in' ? badgeColors.dineIn : 
                                               order.type === 'takeaway' ? badgeColors.takeaway : 
                                               badgeColors.delivery 
                            }}
                          >
                            {order.type === 'dine_in' ? 'DINE-IN' : order.type === 'takeaway' ? 'TAKEAWAY' : 'DELIVERY'}
                          </span>
                          
                          {order.type === 'delivery' && order.delivery_service && (
                            <span 
                              className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: deliveryServiceColors[order.delivery_service] || deliveryServiceColors.custom }}
                            >
                              🚚 {deliveryServiceNames[order.delivery_service] || 'DELIVERY'}
                            </span>
                          )}

                          {highlight?.type === 'new' && (
                            <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce">
                              🆕 NEW ORDER
                            </span>
                          )}
                          {highlight?.type === 'updated' && (
                            <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-bounce">
                              🔔 ORDER UPDATED
                            </span>
                          )}
                          
                          {hasNotes && (
                            <button 
                              onClick={() => setExpandedNotes(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                              style={{ backgroundColor: badgeColors.specialRequests || '#EC4899' }}
                              className="text-[10px] text-white px-2 py-0.5 rounded-full uppercase tracking-wider hover:opacity-80 transition-opacity"
                            >
                              📌 SPECIAL REQUESTS {expandedNotes[order.id] ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                        
                        <h2 className="text-lg font-bold leading-tight flex items-center gap-2 text-white">
                          {order.type === 'dine_in' 
                            ? `Table ${order.tables?.table_number || '?'}` 
                            : (order.customer_name || 'Anonymous Customer')}
                        </h2>
                      </div>
                      
                      <div className="flex flex-col gap-2 items-end">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                          order.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {order.status}
                        </span>
                        
                        {highlight && (
                          <button 
                            onClick={() => acknowledgeOrder(order.id)}
                            className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded shadow hover:bg-gray-200 transition-colors"
                          >
                            ✅ ACKNOWLEDGE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4 mt-4">
                    {(() => {
                      if (highlight?.type === 'updated') {
                        const newCount = order.order_items.filter(i => highlightedItems[i.id]).length;
                        if (newCount > 0) {
                          return (
                            <div className="text-xs font-bold text-yellow-300 bg-yellow-500/20 border border-yellow-500/30 p-1.5 rounded text-center mb-2 shadow-sm">
                              (+{newCount} new items added)
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {order.order_items.map((item) => {
                      const isNewItem = highlightedItems[item.id];
                      return (
                        <div key={item.id} className={`flex flex-col p-1 rounded transition-colors duration-1000 ${isNewItem ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold' : ''}`}>
                          <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center gap-2">
                              {item.menu_items.name}
                              {item.fulfillment_type === 'dine_in' ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
                                  Eat here
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold uppercase">
                                  TAKEAWAY - PACK {item.container_size ? `(${item.container_size.charAt(0).toUpperCase() + item.container_size.slice(1)})` : ''}
                                </span>
                              )}
                            </span>
                            <span className="font-bold">x{item.quantity}</span>
                          </div>
                          {item.notes && expandedNotes[order.id] && (
                            <div 
                              className="text-xs text-black italic py-2 px-3 mt-2 rounded border border-yellow-400 ml-1" 
                              style={{ backgroundColor: '#FEF08A' }}
                            >
                              ✏️ {item.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-700 pt-4 mt-4">
                  <p className="text-xs text-slate-400 mb-2">
                    Ordered: {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                  {order.status !== 'ready' && (
                    <button
                      onClick={() => advanceStatus(order.id, order.status)}
                      className="w-full bg-green-600 text-white py-2 font-bold rounded hover:bg-green-700"
                    >
                      {order.status === 'pending' ? 'Start Preparing' : 'Mark as Ready'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
