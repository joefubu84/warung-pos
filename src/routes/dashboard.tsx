import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';

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
      .select('id, type, status, total_amount, delivery_fee, paid, payment_method, created_at')
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
      setOrders(orderData as Order[]);
    }
    
    if (!logError && logData) {
      setLogs(logData as OrderEditLog[]);
    }
    
    setIsLoading(false);
  };

  if (isLoading) {
    return <div className="p-4">Loading today's summary...</div>;
  }

  // Calculate metrics
  const totalOrders = orders.length;
  
  const totalRevenue = orders.reduce((sum, order) => {
    // Only count as revenue if it is paid, or you can count all non-cancelled.
    // Given the prompt, we usually sum total_amount.
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

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold border-b pb-2">
        TODAY'S SUMMARY ({new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()})
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Overview</h2>
          <div className="space-y-3 text-lg">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Orders:</span>
              <span className="font-bold">{totalOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Revenue:</span>
              <span className="font-bold text-green-600">RM {totalRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Delivery Fees:</span>
              <span className="font-bold">RM {totalDeliveryFees.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Order Types</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Dine-In</span>
              <span className="font-bold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{breakdown.dine_in} orders</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Takeaway</span>
              <span className="font-bold bg-orange-100 text-orange-800 px-3 py-1 rounded-full">{breakdown.takeaway} orders</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Delivery</span>
              <span className="font-bold bg-purple-100 text-purple-800 px-3 py-1 rounded-full">{breakdown.delivery} orders</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 md:col-span-2">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Payment Methods (Paid Orders Only)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-2">💵 Cash</h3>
              <p className="text-2xl font-bold text-green-600 mb-1">RM {paymentMethods.cash.amount.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{paymentMethods.cash.count} orders</p>
            </div>
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-2">💳 Card</h3>
              <p className="text-2xl font-bold text-blue-600 mb-1">RM {paymentMethods.card.amount.toFixed(2)}</p>
              <p className="text-sm text-gray-500">{paymentMethods.card.count} orders</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 pt-4 border-t">
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 font-bold shadow">
          Print Report
        </button>
      </div>
    </div>
  );
}
