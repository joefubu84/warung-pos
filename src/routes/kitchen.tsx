import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { requireChefAuth } from '@/lib/auth-guard';
import { playKitchenSound } from '@/lib/sounds';

export const Route = createFileRoute('/kitchen')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireChefAuth(location, context.auth);
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
  paid?: boolean;
  payment_status?: string | null;
  payment_method: string | null;
  tables: {
    table_number: string;
  } | null;
  order_items: OrderItem[];
  order_edit_logs?: { id: string }[];
  customer_phone?: string | null;
  delivery_address?: string | null;
  created_at: string;
  ready_at?: string | null;
}

const WaitTimer = ({ createdAt }: { createdAt: string }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const diffMs = Date.now() - new Date(createdAt).getTime();
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${mins}m ${secs.toString().padStart(2, '0')}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return <span className="text-yellow-300 ml-auto tabular-nums font-mono">⏱️ {elapsed}</span>;
};

const OrderCard = memo(({ 
  order, 
  highlight, 
  highlightedItems, 
  badgeColors, 
  deliveryServiceColors, 
  deliveryServiceNames, 
  tablesMap,
  menuMap,
  onAcknowledge, 
  onAdvanceStatus 
}: any) => {
  const isModified = highlight?.type === 'updated';
  let cardClasses = "border-2 p-4 rounded-2xl shadow-sm flex flex-col justify-between transition-all duration-300 ease-in-out relative overflow-hidden ";
  
  if (highlight?.type === 'new') {
    cardClasses += "border-4 border-emerald-500 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse";
  } else if (isModified) {
    cardClasses += "border-4 border-rose-500 bg-rose-950/70 shadow-[0_0_30px_rgba(244,63,94,0.8)] animate-pulse ring-4 ring-rose-500/50";
  } else {
    cardClasses += "border-slate-800 bg-slate-900";
  }

  const tableNumber = order.tables?.table_number || (order.table_id && tablesMap?.[order.table_id]) || null;

  return (
    <div className={cardClasses}>
      <div>
        {/* FLASHING RED & WHITE MODIFICATION ALERT BANNER */}
        {isModified && (
          <div className="bg-rose-600 border-2 border-white text-white font-black text-xs px-3 py-2 rounded-xl flex items-center justify-between shadow-xl animate-bounce mb-3">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              🚨 PERUBAHAN PESANAN / MODIFIED!
            </span>
            <span className="bg-black/50 text-[10px] px-2 py-0.5 rounded text-white font-mono font-bold">
              SEMAK ITEM BARU
            </span>
          </div>
        )}

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
                  <span className="text-[10px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider font-black animate-bounce shadow">
                    🆕 PESANAN BARU
                  </span>
                )}
                {isModified && (
                  <span className="text-[10px] bg-rose-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider font-black animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.9)] border border-white">
                    🚨 PERUBAHAN PESANAN
                  </span>
                )}
                {order.order_edit_logs && order.order_edit_logs.length > 0 && !highlight && (
                  <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-[0_0_8px_rgba(234,88,12,0.6)]">
                    ✏️ PERNAH DIUBAH
                  </span>
                )}
              </div>
              
              <h2 className="text-lg font-black leading-tight flex items-center gap-2 text-white flex-wrap w-full">
                {order.type === 'dine_in' 
                  ? `Meja ${tableNumber || '?'}` 
                  : (order.customer_name || 'Pelanggan Walk-In')}
                
                {order.paid || order.payment_status === 'paid' ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 whitespace-nowrap font-bold">
                    ✓ DAH BAYAR {order.payment_method === 'card' ? '💳' : '📱/💵'}
                  </span>
                ) : (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md border border-rose-500/30 whitespace-nowrap font-bold">
                    ❌ BELUM BAYAR
                  </span>
                )}
                <WaitTimer createdAt={order.created_at} />
              </h2>
              {order.type === 'delivery' && (order.customer_phone || order.delivery_address) && (
                <div className="bg-slate-950/80 p-2.5 rounded-xl text-xs text-slate-300 mt-1 border border-slate-800 w-full space-y-0.5 font-mono">
                  {order.customer_phone && <p><span className="opacity-70">📞</span> {order.customer_phone}</p>}
                  {order.delivery_address && <p className="text-emerald-300"><span className="opacity-70">📍</span> {order.delivery_address}</p>}
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2 items-end">
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                order.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
              }`}>
                {order.status}
              </span>
              
              {highlight && (
                <button 
                  onClick={() => onAcknowledge(order.id)}
                  className={`${isModified ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse border-2 border-white' : 'bg-white hover:bg-slate-200 text-black'} text-xs font-black px-3.5 py-1.5 rounded-xl shadow-lg transition-all active:scale-95 whitespace-nowrap`}
                >
                  {isModified ? '🚨 SAHKAN PERUBAHAN' : '✅ TERIMA ORDER'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* ORDER ITEMS LIST WITH MODIFICATION HIGHLIGHTING */}
        <div className="space-y-2 mb-4 mt-3">
          {isModified && (
            <div className="text-xs font-black text-rose-200 bg-rose-600/30 border border-rose-500/50 p-2 rounded-xl text-center mb-2 shadow-inner flex items-center justify-center gap-1.5">
              <span>⚠️ Perhatian Dapur: Semak hidangan yang dikemas kini di bawah:</span>
            </div>
          )}

          {order.order_items.map((item: any) => {
            const isNewItem = highlightedItems[item.id];
            const itemName = item.menu_items?.name || (item.menu_item_id && menuMap?.[item.menu_item_id]) || 'Hidangan Makanan';
            return (
              <div 
                key={item.id} 
                className={`flex flex-col p-2.5 rounded-xl border transition-all duration-300 ${
                  isNewItem 
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/60 font-black shadow-[0_0_12px_rgba(244,63,94,0.3)] scale-[1.02]' 
                    : 'bg-slate-950/60 text-slate-200 border-slate-800/80'
                }`}
              >
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 flex-wrap font-semibold">
                    <span className="text-white font-bold">{itemName}</span>
                    {isNewItem && (
                      <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-md font-black uppercase">
                        BARU / DIUBAH ✨
                      </span>
                    )}
                    {item.fulfillment_type === 'dine_in' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                        Makan Sini (Dine-In)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black uppercase">
                        BUNGKUS (TAKEAWAY) {item.container_size ? `[${item.container_size.toUpperCase()}]` : ''}
                      </span>
                    )}
                  </span>
                  <span className="font-black text-base font-mono text-emerald-400">x{item.quantity}</span>
                </div>
                {item.notes && (
                  <div 
                    className="text-xs text-slate-900 font-bold py-1.5 px-2.5 mt-2 rounded-lg border border-amber-400 bg-amber-200 flex items-start gap-1"
                  >
                    <span>✏️</span>
                    <span>{item.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3 mt-3">
        <p className="text-[11px] text-slate-400 mb-2 font-mono">
          Masa Pesanan: {new Date(order.created_at).toLocaleTimeString()}
        </p>
        {order.status !== 'ready' && (
          <button
            onClick={() => onAdvanceStatus(order.id, order.status)}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all active:scale-98 uppercase tracking-wider"
          >
            {order.status === 'pending' ? '🍳 MULA MASAK (START PREPARING)' : '🍽️ SIAP DIHIDANG (MARK AS READY)'}
          </button>
        )}
      </div>
    </div>
  );
}, (prevProps: any, nextProps: any) => {
  return prevProps.order.status === nextProps.order.status &&
         prevProps.order.order_items.length === nextProps.order.order_items.length &&
         prevProps.highlight?.type === nextProps.highlight?.type &&
         prevProps.highlight?.timestamp === nextProps.highlight?.timestamp;
});

function KitchenPage() {
  const { storeId } = Route.useRouteContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [printerSettings, setPrinterSettings] = useState<any>(null);
  const settingsRef = useRef<any>(null);

  // Real-time highlight states
  const [highlightedOrders, setHighlightedOrders] = useState<Record<string, { type: 'new' | 'updated', timestamp: number }>>({});
  const [highlightedItems, setHighlightedItems] = useState<Record<string, number>>({});
  
  const ordersRef = useRef<Order[]>([]);
  const isInitialLoad = useRef(true);

  const fetchPrinterSettings = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from('printer_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle();
    if (data) {
      setPrinterSettings(data);
      settingsRef.current = data;
    }
  }, [storeId]);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tablesMap, setTablesMap] = useState<Record<string, string>>({});
  const [menuMap, setMenuMap] = useState<Record<string, string>>({});

  const fetchLookupData = useCallback(async () => {
    try {
      const [{ data: tablesData }, { data: menuData }] = await Promise.all([
        supabase.from('tables').select('id, table_number'),
        supabase.from('menu_items').select('id, name')
      ]);
      if (tablesData) {
        const tMap: Record<string, string> = {};
        tablesData.forEach((t: any) => { tMap[t.id] = t.table_number; });
        setTablesMap(tMap);
      }
      if (menuData) {
        const mMap: Record<string, string> = {};
        menuData.forEach((m: any) => { mMap[m.id] = m.name; });
        setMenuMap(mMap);
      }
    } catch (e) {
      console.warn('Lookup data warning:', e);
    }
  }, []);

  const acknowledgeOrder = useCallback((orderId: string) => {
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
  }, []);

  const fetchActiveOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setFetchError(null);

    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          store_id,
          status,
          type,
          delivery_service,
          customer_name,
          table_id,
          paid,
          payment_status,
          payment_method,
          customer_phone,
          delivery_address,
          created_at,
          ready_at,
          order_items (
            id,
            menu_item_id,
            quantity,
            fulfillment_type,
            notes,
            menu_items (name)
          )
        `)
        .in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true });

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching kitchen orders:', error);
        setFetchError(error.message);
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
            else {
              // Check for modified items via ID map
              let isModified = false;
              if (newOrder.order_items.length !== oldOrder.order_items.length) {
                isModified = true;
              } else {
                const oldItemsMap = new Map(oldOrder.order_items.map((i: any) => [i.id, i]));
                for (const newItem of newOrder.order_items as any[]) {
                  const oldItem = oldItemsMap.get(newItem.id);
                  if (!oldItem || 
                      oldItem.quantity !== newItem.quantity || 
                      oldItem.notes !== newItem.notes) {
                    isModified = true;
                    newItemHighlights[newItem.id] = now;
                  }
                }
              }
              if (isModified) {
                newHighlights[newOrder.id] = { type: 'updated', timestamp: now };
                hasUpdatedOrder = true;
              }
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
    } catch (err: any) {
      console.error('Kitchen fetch fatal error:', err);
      setFetchError(err.message || 'Ralat memuatkan pesanan dapur');
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchLookupData();
    fetchPrinterSettings();
    fetchActiveOrders();

    const channelName = `kitchen_orders_${Date.now()}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        console.log('⚡ Realtime event received: orders table', payload);
        fetchActiveOrders(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        console.log('⚡ Realtime event received: order_items table', payload);
        fetchActiveOrders(true);
      })
      .subscribe((status, err) => {
        console.log('📡 Kitchen Realtime Status:', status, err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPrinterSettings, fetchActiveOrders]);


  const advanceStatus = useCallback(async (orderId: string, currentStatus: OrderStatus) => {
    let nextStatus: OrderStatus;
    if (currentStatus === 'pending') {
      nextStatus = 'preparing';
    } else if (currentStatus === 'preparing') {
      nextStatus = 'ready';
    } else {
      return; 
    }

    // Optimistically update UI to prevent flicker and layout shifts
    setOrders(prevOrders => {
      const newOrders = prevOrders.map(order => 
        order.id === orderId ? { ...order, status: nextStatus } : order
      );
      ordersRef.current = newOrders;
      return newOrders;
    });

    const payload: any = { status: nextStatus };
    if (nextStatus === 'ready') payload.ready_at = new Date().toISOString();
    if (nextStatus === ('completed' as any)) payload.completed_at = new Date().toISOString();

    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
      // Revert optimistic update by fully fetching
      fetchActiveOrders(true);
    }
  }, []);

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
    <div className="p-6 md:p-8 font-sans min-h-screen bg-slate-950 text-slate-100">
      {/* KITCHEN HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <span>👨‍🍳</span>
            <span>Paparan Dapur (Kitchen Display)</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              LIVE REALTIME
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pesanan aktif masuk secara automatik. Skrin akan berbunyi dan berkelip merah jika ada pesanan diubah.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              playKitchenSound('kitchen_bell');
            }}
            className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow"
            title="Klik untuk membuka kebenaran audio pelayar"
          >
            <span>🔔</span>
            <span>Uji Loceng Dapur</span>
          </button>

          <button
            onClick={() => {
              fetchActiveOrders();
              fetchLookupData();
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow active:scale-95"
          >
            <span>🔄</span>
            <span>Muat Semula (Refresh)</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER IF OCCURRED */}
      {fetchError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border-2 border-rose-500 text-rose-200 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <p className="font-bold text-sm">⚠️ Ralat Mendapatkan Pesanan:</p>
            <p className="text-xs opacity-90 font-mono mt-0.5">{fetchError}</p>
          </div>
          <button
            onClick={() => fetchActiveOrders()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
          >
            Cuba Semula
          </button>
        </div>
      )}
      
      {orders.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30 my-4">
          <p className="text-4xl mb-3">🍳</p>
          <h3 className="text-lg font-bold text-white mb-1">Tiada Pesanan Aktif Buat Masa Ini</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Sistem sedia menerima pesanan. Sebarang pesanan baru dari kaunter atau penghantaran akan muncul secara automatik di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              highlight={highlightedOrders[order.id]}
              highlightedItems={highlightedItems}
              badgeColors={badgeColors}
              deliveryServiceColors={deliveryServiceColors}
              deliveryServiceNames={deliveryServiceNames}
              tablesMap={tablesMap}
              menuMap={menuMap}
              onAcknowledge={acknowledgeOrder}
              onAdvanceStatus={advanceStatus}
            />
          ))}
        </div>
      )}

      {/* Kitchen Stats Footer */}
      <div className="mt-8 pt-4 border-t border-slate-800">
        <KitchenStats activeOrders={orders} />
      </div>
    </div>
  );
}

const KitchenStats = ({ activeOrders }: { activeOrders: Order[] }) => {
  const [stats, setStats] = useState({ avg: 0, fast: 0, slow: 0, count: 0 });

  useEffect(() => {
    const fetchTodayStats = async () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const { data } = await supabase
        .from('orders')
        .select('created_at, ready_at, status')
        .gte('created_at', today.toISOString())
        .not('ready_at', 'is', null);

      if (data && data.length > 0) {
        let total = 0;
        let fast = Infinity;
        let slow = 0;
        
        data.forEach(order => {
          if (order.ready_at) {
            const diff = (new Date(order.ready_at).getTime() - new Date(order.created_at).getTime()) / 60000;
            total += diff;
            if (diff < fast) fast = diff;
            if (diff > slow) slow = diff;
          }
        });
        
        setStats({
          avg: total / data.length,
          fast: fast === Infinity ? 0 : fast,
          slow,
          count: data.length
        });
      }
    };
    
    fetchTodayStats();
    
    // Subscribe to realtime orders that become 'ready' to update stats without polling
    const statsChannel = supabase.channel('kitchen_stats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.ready' }, () => {
        fetchTodayStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statsChannel);
    };
  }, []); // Run on mount only

  const readyCount = activeOrders.filter(o => o.status === 'ready').length;

  return (
    <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-400 justify-center">
      <div className="bg-slate-800 px-3 py-2 rounded border border-slate-700">
        <span className="opacity-50">Currently Ready:</span> <span className="text-white font-bold">{readyCount}</span>
      </div>
      <div className="bg-slate-800 px-3 py-2 rounded border border-slate-700">
        <span className="opacity-50">Today's Avg Prep:</span> <span className="text-white font-bold">{stats.avg.toFixed(1)}m</span>
      </div>
      <div className="bg-slate-800 px-3 py-2 rounded border border-slate-700">
        <span className="opacity-50">Fastest:</span> <span className="text-emerald-400 font-bold">{stats.fast.toFixed(1)}m</span>
      </div>
      <div className="bg-slate-800 px-3 py-2 rounded border border-slate-700">
        <span className="opacity-50">Slowest:</span> <span className="text-rose-400 font-bold">{stats.slow.toFixed(1)}m</span>
      </div>
      <div className="bg-slate-800 px-3 py-2 rounded border border-slate-700">
        <span className="opacity-50">Total Prepped:</span> <span className="text-white font-bold">{stats.count}</span>
      </div>
    </div>
  );
};
