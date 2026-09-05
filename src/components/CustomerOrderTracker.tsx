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
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 space-y-5 text-slate-900 font-sans shadow-xl relative overflow-hidden">
      {/* HEADER & CLOSE */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 border border-orange-200 text-orange-600 rounded-2xl shadow-sm">
            <ChefHat className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Status Pesanan Meja</h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                #{orderId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {tableNumber ? `Meja Makan #${tableNumber}` : 'Pesanan Bungkus / Takeaway'}
            </p>
          </div>
        </div>

        {onClose && (
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            title="Tutup Penjejak"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* COUNTDOWN / READY BANNER */}
      {status === 'ready' ? (
        <div className="bg-emerald-50 border-2 border-emerald-500 p-4 rounded-2xl text-center space-y-1 animate-pulse">
          <div className="text-xl font-black text-emerald-800 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" /> HIDANGAN ANDA SUDAH SIAP! 🎉
          </div>
          <p className="text-xs text-emerald-700 font-medium">
            {tableNumber ? `Staf mesra kami akan menghantar hidangan panas ke Meja #${tableNumber} sebentar lagi! 🍽️` : 'Sila ambil bungkusan pesanan anda di kaunter! 🛍️'}
          </p>
        </div>
      ) : status === 'completed' ? (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center space-y-1">
          <div className="text-base font-bold text-slate-800 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Pesanan Selesai & Dihantar
          </div>
          <p className="text-xs text-slate-500">Terima kasih kerana menjamu selera di Warung J&J!</p>
        </div>
      ) : (
        <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 animate-spin" />
            <div>
              <span className="text-[11px] text-amber-800/80 uppercase font-black tracking-wider block">Anggaran Masa Siap</span>
              <span className="text-xl font-black text-amber-900">
                {minutes}:{seconds < 10 ? `0${seconds}` : seconds} <span className="text-xs font-semibold">minit</span>
              </span>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm">
            {status === 'preparing' ? '👨‍🍳 Sedang Dimasak' : '⏳ Dalam Giliran Dapur'}
          </span>
        </div>
      )}

      {/* ANIMATED STEPPER PROGRESS BAR */}
      <div className="space-y-2 pt-1">
        <div className="flex justify-between items-center relative text-xs">
          {STEPS.map((step, idx) => {
            const IconComp = step.icon;
            const isDone = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;

            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5 z-10 w-1/4 text-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  isCurrent 
                    ? 'bg-orange-500 border-orange-500 text-white font-bold scale-110 shadow-lg shadow-orange-500/30 animate-pulse'
                    : isDone
                    ? 'bg-emerald-500 border-emerald-500 text-white font-bold'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <IconComp className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-black ${isCurrent ? 'text-orange-600' : isDone ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ORDER ITEMS SUMMARY */}
      {orderItems.length > 0 && (
        <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 space-y-2 text-xs">
          <div className="text-slate-500 uppercase text-[10px] font-black tracking-wider flex justify-between">
            <span>Ringkasan Hidangan</span>
            <span>{orderItems.length} hidangan</span>
          </div>
          <div className="divide-y divide-slate-200/80">
            {orderItems.map((item, idx) => (
              <div key={idx} className="py-2 flex justify-between items-center text-slate-800">
                <div>
                  <span className="font-bold text-slate-900">{item.quantity}x {item.item_name || 'Hidangan'}</span>
                  {item.notes && <p className="text-[10px] text-amber-700 font-medium">{item.notes}</p>}
                </div>
                <span className="font-extrabold text-orange-600">RM {Number(item.price || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WHATSAPP RECEIPT ACTION BUTTON */}
      <div className="pt-1">
        <Button
          onClick={() => {
            const customerPhone = localStorage.getItem('warung_customer_phone') || '60172221784';
            const itemsText = orderItems.map(i => `${i.quantity}x ${i.item_name || 'Hidangan'} (RM ${Number(i.price || 0).toFixed(2)})`).join('\n');
            const receiptText = `🧾 *RESIT DIGITAL WARUNG J&J*\nMeja: Meja ${tableNumber || 'A1'}\nNo Pesanan: #${orderId.slice(0, 8).toUpperCase()}\n-------------------------------\n${itemsText}\nJumlah Bayaran: RM ${Number(order?.total_amount || 0).toFixed(2)}\nStatus: ${status.toUpperCase()}\n-------------------------------\nTerima kasih kerana menjamu selera bersama Warung J&J! 🌟`;
            
            const clean = customerPhone.replace(/\D/g, '');
            const waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(receiptText)}`;
            window.open(waUrl, '_blank');
            toast.success("💬 Membuka WhatsApp untuk menghantar resit digital!");
          }}
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 text-xs active:scale-[0.98] transition-all cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-white" /> Hantar Resit Digital ke WhatsApp
        </Button>
      </div>
    </div>
  );
}
