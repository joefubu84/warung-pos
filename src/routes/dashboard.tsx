import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';

import { RestaurantSetupCard } from '@/components/RestaurantSetupCard';
import { QuickStockBar } from '@/components/QuickStockBar';
import { 
  Printer, 
  RefreshCw, 
  ShoppingBag, 
  ChefHat, 
  ClipboardList, 
  Wallet, 
  UtensilsCrossed, 
  QrCode, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Banknote,
  Smartphone
} from 'lucide-react';

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
  const [todaySession, setTodaySession] = useState<any | null>(null);
  const [yesterdaySession, setYesterdaySession] = useState<any | null>(null);
  const [sevenDaysHistory, setSevenDaysHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTodayData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    
    try {
      const now = new Date();
      // Timezone-resilient Date Math matching orders.tsx with 1-hour grace margin
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      const querySince = new Date(todayStart - (2 * 3600 * 1000)).toISOString();
      const todayStr = now.toLocaleDateString('en-CA');
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('en-CA');

      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toLocaleDateString('en-CA');

      // Concurrent fetch for max performance & low latency
      const [
        { data: orderData, error: orderError },
        { data: logData, error: logError },
        { data: menuData },
        { data: tSession },
        { data: yestData },
        { data: trendData }
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, type, status, total_amount, delivery_fee, paid, payment_method, created_at, ready_at')
          .gte('created_at', querySince)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        supabase
          .from('order_edit_logs')
          .select('id, order_id, changes, created_at')
          .gte('created_at', querySince),
        supabase
          .from('menu_items')
          .select('id, name, stock_count, low_stock_threshold')
          .not('stock_count', 'is', null),
        supabase
          .from('daily_cash')
          .select('*')
          .eq('date', todayStr)
          .maybeSingle(),
        supabase
          .from('daily_cash')
          .select('*')
          .eq('date', yesterdayStr)
          .maybeSingle(),
        supabase
          .from('daily_cash')
          .select('*')
          .gte('date', sevenDaysAgoStr)
          .order('date', { ascending: true })
      ]);

      if (!orderError && orderData) {
        // Filter client-side with 1-hour margin for timezone consistency
        const validOrders = orderData.filter(o => {
          const orderTime = new Date(o.created_at).getTime();
          return orderTime >= (todayStart - 3600000);
        });
        setOrders(validOrders as any as Order[]);
      }

      if (!logError && logData) {
        setLogs(logData as any as OrderEditLog[]);
      }

      if (menuData) {
        setLowStockItems(menuData.filter(item => item.stock_count !== null && item.low_stock_threshold !== null && item.stock_count <= item.low_stock_threshold) as any);
      }

      setTodaySession(tSession || null);
      setYesterdaySession(yestData || null);
      setSevenDaysHistory(trendData || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTodayData();

    // Setup Supabase Realtime Listener for instant synchronization
    const channelName = `dashboard_realtime_${Date.now()}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchTodayData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_cash' }, () => {
        fetchTodayData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchTodayData();
      })
      .subscribe();

    // Broadcast channel listener from QR and Counter order placement
    const broadcastChannel = supabase.channel('kitchen_realtime_broadcast')
      .on('broadcast', { event: 'new_order_placed' }, () => {
        fetchTodayData();
      })
      .subscribe();

    // Safety background refresh every 10 seconds
    const interval = setInterval(() => {
      fetchTodayData();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(interval);
    };
  }, []);

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

  // Accurate payment breakdown separating Cash, QR/DuitNow, and Card
  const paymentMethods = {
    cash: { count: 0, amount: 0 },
    qr: { count: 0, amount: 0 },
    card: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 },
  };

  orders.forEach(order => {
    const amt = Number(order.total_amount || 0);
    if (order.paid) {
      const pm = (order.payment_method || '').toLowerCase();
      if (pm === 'card') {
        paymentMethods.card.count++;
        paymentMethods.card.amount += amt;
      } else if (pm === 'qr' || pm === 'toyyibpay' || pm === 'bank_transfer' || pm === 'online') {
        paymentMethods.qr.count++;
        paymentMethods.qr.amount += amt;
      } else {
        paymentMethods.cash.count++;
        paymentMethods.cash.amount += amt;
      }
    } else {
      paymentMethods.unpaid.count++;
      paymentMethods.unpaid.amount += amt;
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
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-sm font-semibold">Memuatkan data ringkasan eksekutif...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* EXECUTIVE HEADER CARD */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Papan Pemuka Eksekutif
              </h1>
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {new Date().toLocaleDateString('ms-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
            <button
              onClick={() => fetchTodayData(true)}
              disabled={isRefreshing}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Segarkan Data Terkini"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-orange-500' : ''}`} />
            </button>
            <button 
              onClick={() => window.print()} 
              className="flex-1 sm:flex-initial bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-2.5 rounded-2xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ring-1 ring-orange-400"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* QUICK POS LAUNCHPAD / EXECUTIVE ACTION BAR */}
        <div className="bg-white border border-slate-200/90 p-4 rounded-3xl shadow-xs">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Akses Pantas Operasi POS
            </span>
            <span className="text-xs text-slate-500 font-medium">1-Sentuhan ke modul utama</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <Link
              to="/counter"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-orange-50/60 border border-orange-200/80 text-orange-950 hover:bg-orange-100/70 transition-all font-black text-xs group active:scale-95 shadow-xs"
            >
              <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate">Kaunter POS</p>
                <p className="text-[10px] text-orange-700/80 font-normal">Buat Pesanan</p>
              </div>
            </Link>

            <Link
              to="/kitchen"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-amber-950 hover:bg-amber-100/70 transition-all font-black text-xs group active:scale-95 shadow-xs"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ChefHat className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate">Paparan Dapur</p>
                <p className="text-[10px] text-amber-700/80 font-normal">KDS Live</p>
              </div>
            </Link>

            <Link
              to="/orders"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-sky-50/60 border border-sky-200/80 text-sky-950 hover:bg-sky-100/70 transition-all font-black text-xs group active:scale-95 shadow-xs"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate">Semua Pesanan</p>
                <p className="text-[10px] text-sky-700/80 font-normal">{totalOrders} Hari Ini</p>
              </div>
            </Link>

            <Link
              to="/cash-management"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 text-emerald-950 hover:bg-emerald-100/70 transition-all font-black text-xs group active:scale-95 shadow-xs"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate">Peti Tunai</p>
                <p className="text-[10px] text-emerald-700/80 font-normal">Urus Shift</p>
              </div>
            </Link>

            <Link
              to="/menu"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-purple-50/60 border border-purple-200/80 text-purple-950 hover:bg-purple-100/70 transition-all font-black text-xs group active:scale-95 shadow-xs"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate">Menu & Stok</p>
                <p className="text-[10px] text-purple-700/80 font-normal">Katalog Hidangan</p>
              </div>
            </Link>

            <Link
              to="/tables"
              className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 text-rose-950 hover:bg-rose-100/70 transition-all font-black text-xs group active:scale-95 shadow-xs"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate">Meja & QR</p>
                <p className="text-[10px] text-rose-700/80 font-normal">Kod Pesanan</p>
              </div>
            </Link>
          </div>
        </div>

        {/* RESTAURANT SETUP CHECKLIST & ONBOARDING */}
        <RestaurantSetupCard />

        {/* QUICK STOCK MANAGEMENT (86 / SOLD OUT) */}
        <QuickStockBar onItemUpdated={fetchTodayData} />

        {/* TODAY'S & YESTERDAY'S REGISTER SUMMARY SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* TODAY'S ACTIVE REGISTER STATUS */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <span>Daftar Tunai Hari Ini</span>
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {todaySession ? (
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                  todaySession.closed_at
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {todaySession.closed_at ? '🔒 Shift Ditutup' : '🟢 Shift Dibuka'}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200">
                  ⚠️ Belum Dibuka
                </span>
              )}
            </div>

            {todaySession ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono">
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <span className="text-xs text-slate-500 font-sans">Baki Pembukaan (Float)</span>
                  <p className="text-lg font-black text-slate-900">RM {Number(todaySession.opening_balance || 0).toFixed(2)}</p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <span className="text-xs text-slate-500 font-sans">Tunai Terkumpul</span>
                  <p className="text-lg font-black text-emerald-700">RM {paymentMethods.cash.amount.toFixed(2)}</p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-xs text-slate-500 font-sans">Jangkaan Tunai Laci</span>
                  <p className="text-lg font-black text-slate-900">
                    RM {(Number(todaySession.opening_balance || 0) + paymentMethods.cash.amount).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 text-center space-y-2">
                <p className="text-xs text-amber-900 font-medium">
                  Sesi daftar tunai hari ini belum dibuka. Buka peti tunai untuk rekod float permulaan.
                </p>
                <Link
                  to="/cash-management"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                >
                  <span>Buka Daftar Tunai Sekarang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <div className="pt-1 flex justify-end">
              <Link
                to="/cash-management"
                className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 group"
              >
                <span>Urus Transaksi Tunai Penuh</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* YESTERDAY'S REGISTER CLOSING SUMMARY */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-600" />
                  <span>Tutup Shift Semalam</span>
                </h2>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {yesterdaySession?.date || 'Tiada rekod tutup daftar untuk semalam'}
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
                  {(yesterdaySession.variance || 0) === 0 ? '✓ Tepat (RM 0.00)' : `Varians: RM ${(yesterdaySession.variance || 0).toFixed(2)}`}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-slate-100 text-slate-500 border border-slate-200">
                  Tiada Rekod
                </span>
              )}
            </div>

            {yesterdaySession ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-sans">Baki Pembukaan</span>
                  <p className="text-base font-black text-slate-900">RM {Number(yesterdaySession.opening_balance || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-sans">Jangkaan</span>
                  <p className="text-base font-black text-slate-900">RM {Number(yesterdaySession.expected_closing || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-sans">Kiraan Sebenar</span>
                  <p className="text-base font-black text-emerald-700">RM {Number(yesterdaySession.closing_balance || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 font-sans">Perbezaan</span>
                  <p className={`text-base font-black ${(yesterdaySession.variance || 0) === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    RM {Number(yesterdaySession.variance || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-4">Tiada rekod tutup daftar tunai ditemui bagi tarikh semalam.</p>
            )}
          </div>
        </div>

        {/* LAST 7 DAYS SALES & CLOSING TREND CHART */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <span>Trend Penutupan Daftar 7 Hari Terakhir</span>
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Sejarah baki penutupan harian peti tunai</p>
            </div>
            <span className="text-xs font-mono font-bold text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
              Trend 7-Hari
            </span>
          </div>

          {sevenDaysHistory.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 border-b border-slate-100">
                {sevenDaysHistory.map((item, idx) => {
                  const amount = Number(item.closing_balance || item.expected_closing || 0);
                  const heightPercent = maxClosingBalance > 0 ? Math.max(12, Math.round((amount / maxClosingBalance) * 100)) : 12;
                  const dateFormatted = new Date(item.date).toLocaleDateString('ms-MY', { weekday: 'short', month: 'numeric', day: 'numeric' });
                  const isClosed = Boolean(item.closed_at);

                  return (
                    <div key={item.id || idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <span className="text-[10px] font-mono font-bold text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        RM {amount.toFixed(0)}
                      </span>
                      <div 
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[44px] rounded-t-xl transition-all group-hover:brightness-105 ${
                          isClosed 
                            ? 'bg-gradient-to-t from-orange-500 to-amber-400 shadow-xs' 
                            : 'bg-slate-200 border border-slate-300'
                        }`}
                      />
                      <span className="text-[11px] font-mono text-slate-600 font-bold tracking-tighter truncate w-full text-center">
                        {dateFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                <span>Bar Jingga = Baki Penutupan Sahih</span>
                <span>Maksimum: RM {maxClosingBalance.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic py-4">Tiada rekod sesi daftar tunai ditemui dalam tempoh 7 hari lepas.</p>
          )}
        </div>

        {/* METRICS & REVENUE BREAKDOWN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* FINANCIAL OVERVIEW CARD */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">
              Ringkasan Kewangan Hari Ini
            </h2>
            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-sans">Jumlah Pesanan:</span>
                <span className="font-bold text-slate-900 text-base">{totalOrders}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-sans">Jumlah Hasil Jualan:</span>
                <span className="font-black text-orange-600 text-2xl">RM {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-sans">Caj Penghantaran (Rider):</span>
                <span className="font-bold text-slate-700">RM {totalDeliveryFees.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ORDER CHANNELS BREAKDOWN */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">
              Saluran Pesanan (Channels)
            </h2>
            <div className="space-y-3 font-sans">
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-bold flex items-center gap-2">
                  <span>🍽️</span> Makan Di Sini (Dine-In)
                </span>
                <span className="font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-mono">
                  {breakdown.dine_in} pesanan
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-bold flex items-center gap-2">
                  <span>🥡</span> Bungkus / Bawa Balik (Takeaway)
                </span>
                <span className="font-black bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-mono">
                  {breakdown.takeaway} pesanan
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-bold flex items-center gap-2">
                  <span>🛵</span> Penghantaran (Delivery Rider)
                </span>
                <span className="font-black bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-full text-xs font-mono">
                  {breakdown.delivery} pesanan
                </span>
              </div>
            </div>
          </div>

          {/* PAYMENT METHODS BREAKDOWN (Cash vs QR vs Card) */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs md:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Kutipan Bayaran Mengikut Kaedah
              </h2>
              <span className="text-xs font-mono text-slate-500 font-semibold">
                Pesanan Berbayar Selesai
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
              <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-1">
                <h3 className="font-bold text-emerald-900 flex items-center gap-2 text-sm font-sans">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>Tunai (Cash Drawer)</span>
                </h3>
                <p className="text-2xl font-black text-emerald-700">RM {paymentMethods.cash.amount.toFixed(2)}</p>
                <p className="text-xs text-emerald-600/80 font-sans font-medium">{paymentMethods.cash.count} pesanan berbayar</p>
              </div>

              <div className="p-4 bg-orange-50/40 border border-orange-200/80 rounded-2xl space-y-1">
                <h3 className="font-bold text-orange-950 flex items-center gap-2 text-sm font-sans">
                  <Smartphone className="w-4 h-4 text-orange-600" />
                  <span>QR DuitNow / ToyyibPay</span>
                </h3>
                <p className="text-2xl font-black text-orange-600">RM {paymentMethods.qr.amount.toFixed(2)}</p>
                <p className="text-xs text-orange-700/80 font-sans font-medium">{paymentMethods.qr.count} pesanan berbayar</p>
              </div>

              <div className="p-4 bg-sky-50/40 border border-sky-200/80 rounded-2xl space-y-1">
                <h3 className="font-bold text-sky-950 flex items-center gap-2 text-sm font-sans">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  <span>Kad Debit / Kredit</span>
                </h3>
                <p className="text-2xl font-black text-sky-700">RM {paymentMethods.card.amount.toFixed(2)}</p>
                <p className="text-xs text-sky-700/80 font-sans font-medium">{paymentMethods.card.count} pesanan berbayar</p>
              </div>
            </div>

            {paymentMethods.unpaid.count > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Terdapat {paymentMethods.unpaid.count} pesanan belum dibayar (Unpaid / Pending)</span>
                </span>
                <span className="font-mono font-black text-amber-900">
                  RM {paymentMethods.unpaid.amount.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* KITCHEN TIMING PERFORMANCE */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs md:col-span-2 space-y-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight border-b border-slate-100 pb-3">
              Kelajuan & Prestasi Penyediaan Dapur
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Purata Masa Masak</h3>
                <p className="text-2xl font-black text-purple-700">{timingStats.avgMins.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Paling Pantas</h3>
                <p className="text-2xl font-black text-emerald-700">{timingStats.fastestMins.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Paling Lama</h3>
                <p className="text-2xl font-black text-amber-700">{timingStats.slowestMins.toFixed(1)} <span className="text-xs font-normal text-slate-500">min</span></p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
                <h3 className="font-bold text-slate-500 text-xs font-sans mb-1">Jumlah Siap Masak</h3>
                <p className="text-2xl font-black text-sky-700">{timingStats.totalReady} <span className="text-xs font-normal text-slate-500">pesanan</span></p>
              </div>
            </div>
          </div>

          {/* LOW STOCK ALERTS */}
          {lowStockItems.length > 0 && (
            <div className="bg-rose-50/60 border border-rose-200 p-6 rounded-3xl shadow-xs md:col-span-2 space-y-4">
              <div className="flex justify-between items-center border-b border-rose-200 pb-3">
                <h2 className="text-xl font-black text-rose-800 tracking-tight flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Amaran Baki Stok Rendah ({lowStockItems.length} hidangan)</span>
                </h2>
                <Link
                  to="/menu"
                  className="text-xs font-bold text-rose-700 hover:text-rose-900 underline"
                >
                  Urus Menu & Stok
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {lowStockItems.map(item => (
                  <div key={item.id} className="p-4 bg-white border border-rose-200/90 rounded-2xl flex flex-col justify-between items-start gap-2 shadow-2xs">
                    <span className="font-bold text-slate-900 text-sm truncate w-full">{item.name}</span>
                    <span className="font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-mono">
                      Tinggal {item.stock_count} unit
                    </span>
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
