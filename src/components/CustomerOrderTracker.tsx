import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Sparkles, 
  Bell, 
  Share2, 
  ShoppingBag,
  Utensils,
  X,
  Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomerOrderTrackerProps {
  orderId: string;
  onClose?: () => void;
}

export function CustomerOrderTracker({ orderId, onClose }: CustomerOrderTrackerProps) {
  const [order, setOrder] = useState<any | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('pending');
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(900); // 15 mins default

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, tables(table_number), order_items(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (!error && data) {
        setOrder(data);
        setStatus(data.status || 'pending');
        setTableNumber(data.tables?.table_number || null);
        setOrderItems(data.order_items || []);
      }
    } catch (err) {
      console.error("Error fetching order tracker details:", err);
    }
  };

  // Play audio chime when order is ready
  const playReadyChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (e) {
      console.warn("Audio chime play warning:", e);
    }
  };

  useEffect(() => {
    fetchOrderDetails();

    // Setup Supabase Realtime channel subscription for order status updates
    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          console.log(`⚡ Realtime customer order status update: ${newStatus}`);
          setStatus(newStatus);
          
          if (newStatus === 'ready') {
            playReadyChime();
            toast.success("🎉 Your order is READY! Our staff will serve your food to your table shortly!", { duration: 8000 });
          } else if (newStatus === 'preparing') {
            toast.info("👨‍🍳 Kitchen is now preparing your delicious food!");
          } else if (newStatus === 'completed') {
            toast.success("Order completed! Thank you for dining with Warung J&J!");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    if (status === 'completed' || status === 'ready') return;
    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;

  // Step mapping
  const STEPS = [
    { id: 'pending', label: 'Order Received', icon: ShoppingBag },
    { id: 'preparing', label: 'In Kitchen', icon: ChefHat },
    { id: 'ready', label: 'Ready to Serve', icon: Sparkles },
    { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  ];

  const getStepIndex = (st: string) => {
    if (st === 'completed') return 3;
    if (st === 'ready') return 2;
    if (st === 'preparing') return 1;
    return 0; // pending
  };

  const currentStepIdx = getStepIndex(status);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-6 text-white font-sans shadow-2xl relative overflow-hidden">
      {/* HEADER & CLOSE */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
            <ChefHat className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white">Live Order Progress</h3>
              <span className="text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 px-2.5 py-0.5 rounded-full border border-slate-700">
                #{orderId.slice(0, 8)}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {tableNumber ? `Dine-in Table ${tableNumber}` : 'Takeaway Order'}
            </p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-xl border border-slate-800">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* COUNTDOWN / READY BANNER */}
      {status === 'ready' ? (
        <div className="bg-emerald-500/20 border-2 border-emerald-500 p-4 rounded-2xl text-center space-y-1 animate-pulse">
          <div className="text-xl font-black text-emerald-300 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400" /> YOUR ORDER IS READY! 🎉
          </div>
          <p className="text-xs text-emerald-200">
            {tableNumber ? `Our friendly staff will serve your food to Table #${tableNumber} shortly! 🍽️` : 'Please pick up your takeaway order at the counter! 🛍️'}
          </p>
        </div>
      ) : status === 'completed' ? (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center space-y-1">
          <div className="text-base font-bold text-slate-300 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Order Completed & Served
          </div>
          <p className="text-xs text-slate-500">Thank you for dining with Warung J&J!</p>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Estimated Ready In</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {minutes}:{seconds < 10 ? `0${seconds}` : seconds} <span className="text-xs font-normal">mins</span>
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            {status === 'preparing' ? '👨‍🍳 Cooking Now' : '⏳ Queued'}
          </span>
        </div>
      )}

      {/* ANIMATED STEPPER PROGRESS BAR */}
      <div className="space-y-3 pt-2">
        <div className="flex justify-between items-center relative font-mono text-xs">
          {STEPS.map((step, idx) => {
            const IconComp = step.icon;
            const isDone = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;

            return (
              <div key={step.id} className="flex flex-col items-center gap-2 z-10 w-1/4 text-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  isCurrent 
                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold scale-110 shadow-lg shadow-amber-500/30 animate-pulse'
                    : isDone
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-600'
                }`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold ${isCurrent ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ORDER ITEMS SUMMARY */}
      {orderItems.length > 0 && (
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs">
          <div className="text-slate-400 uppercase text-[10px] font-bold tracking-wider flex justify-between">
            <span>Order Summary</span>
            <span>{orderItems.length} items</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {orderItems.map((item, idx) => (
              <div key={idx} className="py-2 flex justify-between items-center text-slate-200">
                <div>
                  <span className="font-bold text-white">{item.quantity}x {item.item_name || 'Dish'}</span>
                  {item.notes && <p className="text-[10px] text-amber-400/80">{item.notes}</p>}
                </div>
                <span className="font-bold text-emerald-400">RM {Number(item.price || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WHATSAPP RECEIPT ACTION BUTTON */}
      <div className="pt-1 font-mono">
        <Button
          onClick={() => {
            const customerPhone = localStorage.getItem('warung_customer_phone') || '60172221784';
            const itemsText = orderItems.map(i => `${i.quantity}x ${i.item_name || 'Dish'} (RM ${Number(i.price || 0).toFixed(2)})`).join('\n');
            const receiptText = `🧾 *WARUNG J&J DIGITAL RECEIPT*\nTable: Table ${tableNumber || 'A1'}\nOrder ID: #${orderId.slice(0, 8).toUpperCase()}\n-------------------------------\n${itemsText}\nTotal Paid: RM ${Number(order?.total_amount || 0).toFixed(2)}\nStatus: ${status.toUpperCase()}\n-------------------------------\nThank you for dining with Warung J&J! 🌟`;
            
            const clean = customerPhone.replace(/\D/g, '');
            const waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(receiptText)}`;
            window.open(waUrl, '_blank');
            toast.success("💬 Opening WhatsApp to forward digital receipt!");
          }}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-xs font-mono"
        >
          <Share2 className="w-4 h-4 text-white" /> Forward Digital Receipt via WhatsApp
        </Button>
      </div>
    </div>
  );
}
