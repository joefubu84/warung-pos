import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Circle, ArrowRight, Store, UtensilsCrossed, QrCode, CreditCard, Printer, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  path: string;
  isComplete: boolean;
  icon: any;
}

export function RestaurantSetupCard() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState<any>(null);
  const [menuCount, setMenuCount] = useState(0);
  const [tableCount, setTableCount] = useState(0);
  const [hasPaymentConfig, setHasPaymentConfig] = useState(false);
  const [hasPrinterConfig, setHasPrinterConfig] = useState(false);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      setLoading(true);
      const [
        { data: stores },
        { count: menuItemsCount },
        { count: tablesCount },
        { data: paymentConfig },
        { data: printerConfig }
      ] = await Promise.all([
        supabase.from('stores').select('id, name, logo_url, phone_number').limit(1).maybeSingle(),
        supabase.from('menu_items').select('*', { count: 'exact', head: true }),
        supabase.from('tables').select('*', { count: 'exact', head: true }),
        supabase.from('store_payment_config').select('store_id, toyyibpay_secret').limit(1).maybeSingle(),
        supabase.from('printer_settings').select('store_id, printer_name').limit(1).maybeSingle()
      ]);

      setStoreData(stores);
      setMenuCount(menuItemsCount || 0);
      setTableCount(tablesCount || 0);
      setHasPaymentConfig(!!paymentConfig?.toyyibpay_secret);
      setHasPrinterConfig(!!printerConfig?.printer_name);
    } catch (err) {
      console.error('Error fetching setup checklist status:', err);
    } finally {
      setLoading(false);
    }
  };

  const steps: SetupStep[] = [
    {
      id: 'store_profile',
      title: 'Profil Restoran & Logo Kedai',
      description: storeData?.name && storeData?.logo_url ? ('Nama: ' + storeData.name + ' (Logo Sedia Ada)') : 'Tetapkan nama cawangan, logo rasmi & telefon kedai.',
      path: '/settings',
      isComplete: Boolean(storeData?.name && storeData?.logo_url),
      icon: Store,
    },
    {
      id: 'menu_items',
      title: 'Daftar Menu Hidangan & Kategori',
      description: menuCount > 0 ? (menuCount + ' hidangan telah didaftarkan dalam menu') : 'Tambah hidangan pertama, gambar, ramuan & harga jualan.',
      path: '/menu',
      isComplete: menuCount > 0,
      icon: UtensilsCrossed,
    },
    {
      id: 'tables_qr',
      title: 'Daftar Meja Makan & QR Token',
      description: tableCount > 0 ? (tableCount + ' meja makan berdaftar dengan kod QR') : 'Sediakan susun atur meja dan jana kod QR pelanggan.',
      path: '/tables',
      isComplete: tableCount > 0,
      icon: QrCode,
    },
    {
      id: 'payment_gateway',
      title: 'Gerbang Pembayaran ToyyibPay / DuitNow',
      description: hasPaymentConfig ? 'ToyyibPay Secret & Kategori diaktifkan' : 'Sambungkan akaun ToyyibPay untuk bayaran online tanpa sentuh.',
      path: '/settings',
      isComplete: hasPaymentConfig,
      icon: CreditCard,
    },
    {
      id: 'thermal_printer',
      title: 'Pencetak Resit & Tiket Dapur',
      description: hasPrinterConfig ? 'Thermal printer telah dikonfigurasi' : 'Tetapkan auto-cetak resit pelanggan dan pesanan ke dapur.',
      path: '/settings',
      isComplete: hasPrinterConfig,
      icon: Printer,
    }
  ];

  const completedCount = steps.filter(s => s.isComplete).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  if (loading) {
    return (
      <div className="bg-white/80 border border-slate-200 p-5 rounded-2xl animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
        <div className="h-2 bg-slate-800 rounded w-full" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
      {/* HEADER BAR */}
      <div className="p-5 border-b border-slate-200/80 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-tight">
                Panduan Persediaan Warung J&J
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {completedCount}/{steps.length} Selesai ({progressPercent}%)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Selesaikan langkah persediaan di bawah untuk melancarkan operasi penuh restoran.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          title={isExpanded ? 'Kecilkan' : 'Buka'}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* PROGRESS BAR */}
      <div className="w-full bg-white h-2">
        <div
          className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2 transition-all duration-500"
          style={{ width: progressPercent + '%' }}
        />
      </div>

      {/* EXPANDABLE STEPS LIST */}
      {isExpanded && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.id}
                to={step.path}
                className={'flex items-start justify-between p-3.5 rounded-xl border transition-all group ' + (
                  step.isComplete
                    ? 'bg-white/60 border-slate-200/80 hover:border-emerald-500/40'
                    : 'bg-amber-950/10 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-950/20'
                )}
              >
                <div className="flex items-start gap-3 min-w-0 pr-2">
                  <div className="mt-0.5 shrink-0">
                    {step.isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className={'w-3.5 h-3.5 ' + (step.isComplete ? 'text-slate-400' : 'text-amber-400')} />
                      <span className={'text-xs font-bold truncate ' + (step.isComplete ? 'text-slate-700' : 'text-white')}>
                        {step.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-center">
                  <span className={'text-[11px] font-bold flex items-center gap-1 transition-transform group-hover:translate-x-0.5 ' + (
                    step.isComplete ? 'text-slate-500' : 'text-amber-400'
                  )}>
                    {step.isComplete ? 'Lihat' : 'Setup'} <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
