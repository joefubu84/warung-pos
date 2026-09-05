import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';

import { RestaurantSetupCard } from '@/components/RestaurantSetupCard';
import { QuickStockBar } from '@/components/QuickStockBar';

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
  },
  component: DashboardPage,
});

interface Order {
  id: string;
  type: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  total_amount: number;
  delivery_fee: number;
  paid: boolean;
  payment_method: string | null;
  created_at: string;
  ready_at?: string | null;
}

interface OrderEditLog {
  id: string;
  order_id: string;
  changes: any;
  created_at: string;
}

function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<OrderEditLog[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [yesterdaySession, setYesterdaySession] = useState<any | null>(null);
  const [sevenDaysHistory, setSevenDaysHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTodayData();
  }, []);

  const fetchTodayData = async () => {
    setIsLoading(true);
    
    // Get start and end of today in local time
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Fetch orders
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, type, status, total_amount, delivery_fee, paid, payment_method, created_at, ready_at')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .neq('status', 'cancelled');
      
    // Fetch logs to calculate discounts if needed (optional for basic summary)
    const { data: logData, error: logError } = await supabase
      .from('order_edit_logs')
      .select('id, order_id, changes, created_at')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    if (!orderError && orderData) {
      setOrders(orderData as any as Order[]);
    }
    
    if (!logError && logData) {
      setLogs(logData as any as OrderEditLog[]);
    }
    
    // Fetch low stock items
    const { data: menuData } = await supabase
      .from('menu_items')
      .select('id, name, stock_count, low_stock_threshold')
      .not('stock_count', 'is', null);
      
    if (menuData) {
      setLowStockItems(menuData.filter(item => item.stock_count !== null && item.low_stock_threshold !== null && item.stock_count <= item.low_stock_threshold) as any);
    }

    // Fetch yesterday's daily_cash session
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    const { data: yestData } = await supabase
      .from('daily_cash')
      .select('*')
      .eq('date', yesterdayStr)
      .maybeSingle();
    setYesterdaySession(yestData || null);

    // Fetch last 7 days daily_cash trend
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');
    const { data: trendData } = await supabase
      .from('daily_cash')
      .select('*')
      .gte('date', sevenDaysAgoStr)
      .order('date', { ascending: true });
    setSevenDaysHistory(trendData || []);
    
    setIsLoading(false);
  };

  // Calculate metrics
  const totalOrders = orders.length;
  
  const totalRevenue = orders.reduce((sum, order) => {
    return sum + Number(order.total_amount || 0);
  }, 0);
  
  const totalDeliveryFees = orders.reduce((sum, order) => {
    return sum + Number(order.delivery_fee || 0);
  }, 0);

  const breakdown = {
    dine_in: orders.filter(o => o.type === 'dine_in').length,
    takeaway: orders.filter(o => o.type === 'takeaway').length,
    delivery: orders.filter(o => o.type === 'delivery').length,
  };

  const paymentMethods = {
    cash: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
  };

  orders.forEach(order => {
    if (order.paid) {
      const method = order.payment_method === 'card' ? 'card' : 'cash';
      paymentMethods[method].count++;
      paymentMethods[method].amount += Number(order.total_amount || 0);
    }
  });

  const timingStats = {
    totalReady: 0,
    avgMins: 0,
    fastestMins: Infinity,
    slowestMins: 0,
  };

  let totalPrepTimeMins = 0;
  orders.forEach(order => {
    if (order.ready_at) {
      const diffMs = new Date(order.ready_at).getTime() - new Date(order.created_at).getTime();
      const diffMins = diffMs / 60000;
      totalPrepTimeMins += diffMins;
      timingStats.totalReady++;
      if (diffMins < timingStats.fastestMins) timingStats.fastestMins = diffMins;
      if (diffMins > timingStats.slowestMins) timingStats.slowestMins = diffMins;
    }
  });
  
  if (timingStats.totalReady > 0) {
    timingStats.avgMins = totalPrepTimeMins / timingStats.totalReady;
  } else {
    timingStats.fastestMins = 0;
  }

  // Calculate maximum closing balance for scaling bar chart
  const maxClosingBalance = Math.max(
    ...sevenDaysHistory.map(d => Number(d.closing_balance || d.expected_closing || 0)),
    100
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-8 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-sm">Loading today's business summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* HEADER CARD */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Today's Executive Summary</h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button 
            onClick={() => window.print()} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl shadow-xs active:scale-95 transition-all text-sm flex items-center gap-2 cursor-pointer"
          >
            🖨️ Print Executive Report
          </button>
        </div>

        {/* RESTAURANT SETUP CHECKLIST & ONBOARDING */}
        <RestaurantSetupCard />

        {/* QUICK STOCK MANAGEMENT (86 / SOLD OUT) */}
        <QuickStockBar onItemUpdated={fetchTodayData} />

        {/* YESTERDAY'S REGISTER CLOSING SUMMARY */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                💵 Yesterday's Register Closing
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {yesterdaySession?.date || 'No closed register recorded for yesterday'}
              </p>
            </div>
            {yesterdaySession ? (
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                (yesterdaySession.variance || 0) === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : (yesterdaySession.variance || 0) < 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {(yesterdaySession.variance || 0) === 0 ? '✓ Balanced (RM 0.00)' : `Variance: RM ${(yesterdaySession.variance || 0).toFixed(2)}`}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-slate-100 text-slate-500 border border-slate-200">
                No Record
              </span>
            )}
          </div>

          {yesterdaySession ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-sans">Opening Float</span>
                <p className="text-lg font-black text-slate-900">RM {Number(yesterdaySession.opening_balance || 0).toFixed(2)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-sans">Expected Closing</span>
                <p className="text-lg font-black text-slate-900">RM {Number(yesterdaySession.expected_closing || 0).toFixed(2)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-sans">Actual Counted</span>
                <p className="text-lg font-black text-emerald-700">RM {Number(yesterdaySession.closing_balance || 0).toFixed(2)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-sans">Discrepancy</span>
                <p className={`text-lg font-black ${(yesterdaySession.variance || 0) === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  RM {Number(yesterdaySession.variance || 0).toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No shift register was closed on yesterday's date.</p>
          )}
        </div>

        {/* LAST 7 DAYS SALES & CLOSING TREND CHART */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                📊 Last 7 Days Register Closing Trend
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Daily cash register closing balances</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              7-Day Register History
            </span>
          </div>

          {sevenDaysHistory.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-100">
                {sevenDaysHistory.map((item, idx) => {
                  const amount = Number(item.closing_balance || item.expected_closing || 0);
                  const heightPercent = maxClosingBalance > 0 ? Math.max(12, Math.round((amount / maxClosingBalance) * 100)) : 12;
                  const dateFormatted = new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
                  const isClosed = Boolean(item.closed_at);

                  return (
                    <div key={item.id || idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <span className="text-[10px] font-mono font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        RM {amount.toFixed(0)}
                      </span>
                      <div 
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[40px] rounded-t-lg transition-all group-hover:brightness-105 ${
                          isClosed ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-slate-200 border border-slate-300'
                        }`}
                      />
                      <span className="text-[11px] font-mono text-slate-500 font-bold tracking-tighter truncate w-full text-center">
                        {dateFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                <span>Green Bars = Closed Register Balances</span>
                <span>Max: RM {maxClosingBalance.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No past register session records found in the last 7 days.</p>
          )}
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* OVERVIEW CARD */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">Today's Financial Overview</h2>
            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-sans">Total Orders:</span>
                <span className="font-bold text-slate-900 text-base">{totalOrders}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-sans">Total Revenue:</span>
                <span className="font-black text-emerald-700 text-xl">RM {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-sans">Delivery Fees:</span>
                <span className="font-bold text-slate-700">RM {totalDeliveryFees.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ORDER TYPES BREAKDOWN */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">Order Channels</h2>
            <div className="space-y-3 font-sans">
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-bold">🍽️ Dine-In</span>
                <span className="font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-mono">{breakdown.dine_in} orders</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-bold">🥡 Takeaway</span>
                <span className="font-black bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-mono">{breakdown.takeaway} orders</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-bold">🛵 Delivery (Grab)</span>
                <span className="font-black bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-xs font-mono">{breakdown.delivery} orders</span>
              </div>
            </div>
          </div>

          {/* PAYMENT METHODS */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs md:col-span-2 space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">Payment Collection (Paid Orders)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm font-sans">💵 Cash Payments</h3>
                <p className="text-2xl font-black text-emerald-700">RM {paymentMethods.cash.amount.toFixed(2)}</p>
                <p className="text-xs text-slate-500 font-sans">{paymentMethods.cash.count} orders</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm font-sans">💳 Card / QR Payments</h3>
                <p className="text-2xl font-black text-sky-700">RM {paymentMethods.card.amount.toFixed(2)}</p>
                <p className="text-xs text-slate-500 font-sans">{paymentMethods.card.count} orders</p>
              </div>
            </div>
          </div>

          {/* KITCHEN TIMING PERFORMANCE */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs md:col-span-2 space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">Kitchen Speed & Prep Time</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Avg Prep Time</h3>
                <p className="text-2xl font-black text-purple-700">{timingStats.avgMins.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Fastest Order</h3>
                <p className="text-2xl font-black text-emerald-700">{timingStats.fastestMins.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Slowest Order</h3>
                <p className="text-2xl font-black text-amber-700">{timingStats.slowestMins.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Total Prepared</h3>
                <p className="text-2xl font-black text-sky-700">{timingStats.totalReady} <span className="text-xs font-normal text-slate-500">orders</span></p>
              </div>
            </div>
          </div>

          {/* LOW STOCK ALERTS */}
          {lowStockItems.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl shadow-xs md:col-span-2 space-y-4">
              <h2 className="text-xl font-black text-rose-800 tracking-tight flex items-center gap-2">
                ⚠️ Low Stock Inventory Alerts
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {lowStockItems.map(item => (
                  <div key={item.id} className="p-4 bg-white border border-rose-200 rounded-2xl flex flex-col justify-between items-start gap-2 shadow-2xs">
                    <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                    <span className="font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-mono">{item.stock_count} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
