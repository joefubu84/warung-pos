import { createFileRoute, Link } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { requireAdminAuth } from '@/lib/auth-guard';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { GripVertical, SlidersHorizontal } from 'lucide-react';
import { NavCustomizerModal } from '@/components/NavCustomizerModal';
import { 
  getNavOrderConfig, 
  saveNavOrderConfig, 
  resetNavOrderConfig, 
  NavItemConfig 
} from '@/lib/addons-config';
import { 
  MessageSquare, 
  ShieldCheck, 
  QrCode, 
  Phone, 
  AlertTriangle, 
  RefreshCw, 
  Globe, 
  Key, 
  ExternalLink, 
  Lock, 
  Store,
  Camera,
  FileText,
  Calendar,
  MapPin,
  Eye,
  CheckCircle2,
  UserCheck,
  ShieldAlert,
  PlusCircle,
  Upload,
  User,
  Bike,
  CreditCard,
  Landmark,
  Copy,
  Check,
  Layers,
  Printer,
  Utensils,
  Palette,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { markManualRefundComplete } from '@/lib/riders';
import { getToyyibPayConfig, saveToyyibPayConfig, type ToyyibPayConfig } from '@/lib/toyyibpay';
import { KitchenChecklistCustomizer } from '@/components/KitchenChecklistCustomizer';
import { DishAddonsCustomizer } from '@/components/DishAddonsCustomizer';

export const Route = createFileRoute('/settings')({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    return await requireAdminAuth(location, context.auth);
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { storeId } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: printerSettings, isLoading: printerLoading } = useQuery({
    queryKey: ['printer-settings', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems, isLoading: menuLoading } = useQuery({
    queryKey: ['menu_items', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, image_url')
        .eq('store_id', storeId)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const updateStoreMutation = useMutation({
    mutationFn: async (values: { name: string; address: string; logo_url: string; phone_number: string; phone_number_2: string }) => {
      const { data, error } = await supabase
        .from('stores')
        .update({
          name: values.name,
          address: values.address,
          logo_url: values.logo_url,
          phone_number: values.phone_number,
          phone_number_2: values.phone_number_2,
        })
        .eq('id', storeId)
        .select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Store was not updated — you may not have permission to edit this store.');
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store', storeId] });
      toast.success('Restaurant information & branding updated');
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePrinterMutation = useMutation({
    mutationFn: async (values: { 
      printer_name: string; 
      print_on_status: string[];
      sound_choice: string;
      sound_file_url: string | null;
      badge_colors: Record<string, string>;
    }) => {
      if (printerSettings) {
        const { error } = await supabase
          .from('printer_settings')
          .update({
            printer_name: values.printer_name,
            print_on_status: values.print_on_status,
            auto_print: values.print_on_status.length > 0,
            sound_choice: values.sound_choice,
            sound_file_url: values.sound_file_url,
            badge_colors: values.badge_colors
          })
          .eq('store_id', storeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('printer_settings')
          .insert({
            store_id: storeId,
            printer_name: values.printer_name,
            print_on_status: values.print_on_status,
            auto_print: values.print_on_status.length > 0,
            sound_choice: values.sound_choice,
            sound_file_url: values.sound_file_url,
            badge_colors: values.badge_colors
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printer-settings', storeId] });
      toast.success('Printer and Kitchen settings updated');
    },
    onError: (error) => toast.error(error.message),
  });

  const updateHomepageMutation = useMutation({
    mutationFn: async (homepageSettings: any) => {
      const currentSettings = (store as any)?.settings || {};
      const { data, error } = await supabase
        .from('stores')
        .update({
          settings: {
            ...currentSettings,
            homepage: homepageSettings
          }
        })
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store', storeId] });
      toast.success('Homepage settings updated');
    },
    onError: (error) => toast.error(error.message),
  });

  type SettingsSection = 
    | 'riders' 
    | 'payments' 
    | 'kitchen' 
    | 'checklist' 
    | 'addons' 
    | 'store' 
    | 'appearance' 
    | 'refunds' 
    | 'security';

  const [activeSection, setActiveSection] = useState<SettingsSection>('riders');

  const [storeForm, setStoreForm] = useState({ name: '', address: '', logo_url: '', phone_number: '', phone_number_2: '' });

  const [printerForm, setPrinterForm] = useState({ 
    printer_name: '', 
    print_on_status: [] as string[],
    sound_choice: 'kitchen_bell',
    sound_file_url: null as string | null,
    badge_colors: {
      dineIn: '#3B82F6',
      takeaway: '#F97316',
      delivery: '#8B5CF6',
      specialRequests: '#EC4899'
    } as Record<string, string>
  });

  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const [homepageForm, setHomepageForm] = useState({
    hero_item_id: '',
    hero_title: 'Taste the Soul of Malaysia',
    bento_1_item_id: '',
    bento_1_title: 'The Perfect Atmosphere',
    bento_2_item_id: '',
    bento_2_title: 'Uncompromised Spices',
  });

  useEffect(() => {
    if (store) {
      setStoreForm({
        name: store.name || '',
        address: (store as any).address || '',
        logo_url: store.logo_url || '/logo.png',
        phone_number: store.phone_number || '',
        phone_number_2: (store as any).phone_number_2 || '',
      });
      
      const hp = (store as any).settings?.homepage || {};
      setHomepageForm({
        hero_item_id: hp.hero_item_id || '',
        hero_title: hp.hero_title || 'Taste the Soul of Malaysia',
        bento_1_item_id: hp.bento_1_item_id || '',
        bento_1_title: hp.bento_1_title || 'The Perfect Atmosphere',
        bento_2_item_id: hp.bento_2_item_id || '',
        bento_2_title: hp.bento_2_title || 'Uncompromised Spices',
      });
    }
  }, [store]);

  useEffect(() => {
    if (printerSettings) {
      setPrinterForm({
        printer_name: printerSettings.printer_name || '',
        print_on_status: printerSettings.print_on_status || [],
        sound_choice: printerSettings.sound_choice || 'kitchen_bell',
        sound_file_url: printerSettings.sound_file_url || null,
        badge_colors: (printerSettings.badge_colors as Record<string, string>) || {
          dineIn: '#3B82F6',
          takeaway: '#F97316',
          delivery: '#8B5CF6',
          specialRequests: '#EC4899'
        }
      });
    }
  }, [printerSettings]);

  if (storeLoading || printerLoading || menuLoading) return <div className="p-8 text-center">Loading settings...</div>;

  const handleToggleStatus = (status: string) => {
    setPrinterForm(prev => ({
      ...prev,
      print_on_status: prev.print_on_status.includes(status)
        ? prev.print_on_status.filter(s => s !== status)
        : [...prev.print_on_status, status]
    }));
  };

  const handleTestSound = async () => {
    const { playKitchenSound } = await import('@/lib/sounds');
    playKitchenSound(printerForm.sound_choice, printerForm.sound_file_url);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await handleSoundUpload(file);
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      toast.error('Microphone access denied or unavailable');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleSoundUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    
    try {
      const filePath = `${storeId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sounds')
        .upload(filePath, file, { upsert: true });
        
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('sounds')
        .getPublicUrl(filePath);
        
      setPrinterForm(prev => ({ 
        ...prev, 
        sound_choice: 'custom',
        sound_file_url: publicUrl 
      }));
      toast.success('Sound uploaded successfully');
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    }
  };

  const SIDEBAR_ITEMS: {
    id: SettingsSection;
    label: string;
    subtitle: string;
    icon: any;
    color: string;
    badge?: string;
  }[] = [
    {
      id: 'riders',
      label: 'Rider & KYC (Gaji)',
      subtitle: 'Daftar, Lesen, Bank & Gaji',
      icon: Bike,
      color: 'text-amber-400',
      badge: 'KYC Sah'
    },
    {
      id: 'payments',
      label: 'Kaedah Pembayaran',
      subtitle: 'DuitNow QR & ToyyibPay FPX',
      icon: CreditCard,
      color: 'text-emerald-400',
    },
    {
      id: 'kitchen',
      label: 'Pencetak & Dapur',
      subtitle: 'Thermal Printer, Bunyi & Alert',
      icon: Printer,
      color: 'text-sky-400',
    },
    {
      id: 'checklist',
      label: 'Semakan Bungkus QC',
      subtitle: 'Checklist Pembungkusan Makanan',
      icon: CheckCircle2,
      color: 'text-indigo-400',
    },
    {
      id: 'addons',
      label: 'Pilihan Tambahan Menu',
      subtitle: 'Add-Ons, Sambal & Topping',
      icon: Layers,
      color: 'text-pink-400',
    },
    {
      id: 'store',
      label: 'Maklumat Premis',
      subtitle: 'Warung J&J Penampang Sabah',
      icon: Store,
      color: 'text-amber-300',
    },
    {
      id: 'appearance',
      label: 'Tampilan & Menu Bar',
      subtitle: 'Hero Bento & Susunan Nav',
      icon: Palette,
      color: 'text-teal-400',
    },
    {
      id: 'refunds',
      label: 'Bayaran Balik (Refund)',
      subtitle: 'Antrian Pindahan Manual DuitNow',
      icon: RefreshCw,
      color: 'text-orange-400',
    },
    {
      id: 'security',
      label: 'Keselamatan & Audit',
      subtitle: 'Log Kakitangan & Integriti POS',
      icon: ShieldCheck,
      color: 'text-rose-400',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 lg:p-8 pb-28 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP SYSTEM HEADER */}
        <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <Store className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                Pusat Tetapan & Konfigurasi Warung
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Pengurusan bersistem: Rakan Penghantar, Kaedah Bayaran, Dapur, QC, dan Integriti POS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono px-3.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Warung J&J Penampang (Online)
            </span>
          </div>
        </div>

        {/* MAIN SIDEBAR + CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR NAVIGATION */}
          <aside className="lg:col-span-4 xl:col-span-3 lg:sticky lg:top-4 z-20 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-2xl space-y-1">
              <div className="px-3 py-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-2 flex items-center justify-between">
                <span>Menu Tetapan</span>
                <span className="text-[10px] text-slate-500 font-mono">{SIDEBAR_ITEMS.length} Modul</span>
              </div>
              
              {/* MOBILE HORIZONTAL SCROLL / DESKTOP VERTICAL STACK */}
              <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
                {SIDEBAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      type="button"
                      className={`w-full text-left flex items-center justify-between p-2.5 sm:p-3 rounded-2xl transition-all shrink-0 lg:shrink ${
                        isActive
                          ? 'bg-slate-800 text-white shadow-lg border border-slate-700 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                          isActive 
                            ? 'bg-slate-950 border border-slate-700 shadow-inner' 
                            : 'bg-slate-950/70 border border-slate-800/60'
                        }`}>
                          <Icon className={`w-4 h-4 ${isActive ? item.color : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold truncate flex items-center gap-1.5">
                            <span>{item.label}</span>
                            {item.badge && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-mono font-semibold">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5 hidden sm:block">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 hidden lg:block transition-transform ${
                        isActive ? 'text-white translate-x-0.5' : 'text-slate-600 opacity-60'
                      }`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* RIGHT DEDICATED CONTENT PANELS */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-6 min-w-0">
            
            {/* 1. RIDER & KYC MANAGEMENT */}
            {activeSection === 'riders' && (
              <div className="transition-all duration-300 animate-in fade-in">
                <AdminRiderManagementCard />
              </div>
            )}

            {/* 2. PAYMENT METHODS (DUITNOW QR & TOYYIBPAY FPX) */}
            {activeSection === 'payments' && (
              <div className="space-y-6 transition-all duration-300 animate-in fade-in">
                {/* DUITNOW MERCHANT QR & HYBRID PAYMENT CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        💳 DuitNow Merchant QR & Strategi Pembayaran
                      </h2>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Alliance Bank DuitNow QR (Dine-In & Kaunter POS) | ToyyibPay FPX Webhook (Penghantaran Delivery)
                      </p>
                    </div>
                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs px-3 py-1 rounded-full font-bold">
                      Alliance Bank
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="relative inline-block bg-white p-4 rounded-3xl border-4 border-[#a6192e] shadow-2xl text-center">
                      <div className="bg-[#a6192e] text-white text-xs font-black py-1.5 px-4 rounded-t-xl tracking-wider uppercase flex items-center justify-between mb-3">
                        <span className="flex items-center gap-1.5 font-sans">💳 DuitNow QR</span>
                        <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full">Alliance Bank</span>
                      </div>

                      <div className="relative inline-block">
                        <img src="/duitnow-qr.png" alt="Alliance Bank DuitNow QR" className="w-52 h-auto mx-auto rounded-lg" />
                        
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white p-1 rounded-xl shadow-md border-2 border-[#a6192e]">
                            <img src="/warung-logo.png" alt="Warung J&J Logo" className="w-9 h-9 object-contain rounded-lg" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-100 font-mono text-center">
                        <p className="text-xs font-black text-[#a6192e] uppercase tracking-wide">J&J CAFE & CATERING</p>
                        <p className="text-[10px] text-gray-500 font-bold">Alliance Bank Malaysia Berhad</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
                        <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                          🍽️ Dine-In & Kaunter: DuitNow QR Statik (0% Caj)
                        </h4>
                        <p className="text-xs text-slate-300">
                          Pelanggan imbas DuitNow QR Alliance Bank di kaunter atau meja. Kakitangan mengesahkan bayaran masuk pada aplikasi perbankan sebelum sahkan di POS.
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
                        <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                          🛵 Online Delivery: ToyyibPay / FPX Gateway
                        </h4>
                        <p className="text-xs text-slate-300">
                          Pesanan penghantaran diproses secara automatik dengan pengesahan tandatangan webhook pelayan ToyyibPay.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TOYYIBPAY FPX GATEWAY CONFIGURATION CARD */}
                <ToyyibPaySettingsCard />
              </div>
            )}

            {/* 3. KITCHEN & THERMAL PRINTER SETTINGS */}
            {activeSection === 'kitchen' && (
              <div className="space-y-6 transition-all duration-300 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
                  <h2 className="text-xl font-black text-white tracking-tight border-b border-slate-800 pb-3 flex items-center gap-2">
                    <Printer className="w-5 h-5 text-sky-400" />
                    <span>Tetapan Pencetak Thermal & Penggera Dapur</span>
                  </h2>
                  
                  <div className="space-y-2">
                    <Label htmlFor="printer_name" className="text-slate-300 font-bold">Nama Thermal Printer</Label>
                    <Input
                      id="printer_name"
                      placeholder='cth: "POS-5810dd Counter"'
                      value={printerForm.printer_name}
                      onChange={(e) => setPrinterForm(prev => ({ ...prev, printer_name: e.target.value }))}
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 rounded-xl font-mono text-sm"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-slate-300 font-bold">Cetus Cetakan Automatik</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'payment_confirmed', label: 'Bila Bayaran Disahkan' },
                        { id: 'ready', label: 'Bila Pesanan Siap' },
                        { id: 'completed', label: 'Bila Pesanan Selesai' },
                      ].map((trigger) => (
                        <div key={trigger.id} className="flex items-center space-x-2 bg-slate-950 border border-slate-800 p-3 rounded-xl">
                          <Checkbox
                            id={trigger.id}
                            checked={printerForm.print_on_status.includes(trigger.id)}
                            onCheckedChange={() => handleToggleStatus(trigger.id)}
                            className="border-slate-700 data-[state=checked]:bg-emerald-600"
                          />
                          <Label htmlFor={trigger.id} className="font-bold text-xs text-slate-200 cursor-pointer">{trigger.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">🔊 Bunyi Penggera Dapur (Audio Alerts)</h3>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Pilih Bunyi Penggera</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {['kitchen_bell', 'beep_alert', 'ding_dong', 'whistle', 'buzzer', 'custom'].map(choice => (
                          <div key={choice} className="flex items-center space-x-2 bg-slate-950 border border-slate-800 p-2.5 rounded-xl">
                            <input 
                              type="radio" 
                              id={`sound-${choice}`} 
                              name="sound_choice" 
                              value={choice}
                              checked={printerForm.sound_choice === choice}
                              onChange={(e) => setPrinterForm(prev => ({ ...prev, sound_choice: e.target.value }))}
                              className="cursor-pointer accent-emerald-500"
                            />
                            <Label htmlFor={`sound-${choice}`} className="cursor-pointer capitalize text-xs font-bold text-slate-200">
                              {choice.replace('_', ' ')}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleTestSound} className="bg-slate-950 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800">
                        Uji Bunyi Semasa 🔔
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Muat Naik Bunyi Tersuai (MP3/WAV/WebM maks 5MB)</Label>
                      <Input
                        type="file"
                        accept="audio/*"
                        className="bg-slate-950 border-slate-800 text-slate-300 rounded-xl"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSoundUpload(file);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Atau Rakam Mesej Suara</Label>
                      <div>
                        {!isRecording ? (
                          <Button type="button" variant="outline" onClick={handleStartRecording} className="bg-rose-950/40 text-rose-400 border-rose-800 hover:bg-rose-900">
                            🔴 Rakam Suara
                          </Button>
                        ) : (
                          <Button type="button" variant="destructive" onClick={handleStopRecording} className="animate-pulse bg-rose-600 text-white font-bold">
                            ⏹ Henti Rakaman
                          </Button>
                        )}
                      </div>
                    </div>
                    {printerForm.sound_file_url && printerForm.sound_choice === 'custom' && (
                      <p className="text-xs text-emerald-400 font-bold">✓ Bunyi tersuai siap digunakan</p>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h3 className="font-bold text-base text-white">🎨 Warna Lencana Jenis Pesanan</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {['dineIn', 'takeaway', 'delivery', 'specialRequests'].map(key => (
                        <div key={key} className="space-y-1">
                          <Label className="capitalize text-xs font-bold text-slate-300">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={printerForm.badge_colors[key]}
                              onChange={(e) => setPrinterForm(prev => ({
                                ...prev,
                                badge_colors: { ...prev.badge_colors, [key]: e.target.value }
                              }))}
                              className="h-10 w-12 p-1 rounded-lg border border-slate-800 bg-slate-950 cursor-pointer"
                            />
                            <Input
                              value={printerForm.badge_colors[key]}
                              onChange={(e) => setPrinterForm(prev => ({
                                ...prev,
                                badge_colors: { ...prev.badge_colors, [key]: e.target.value }
                              }))}
                              className="flex-1 font-mono text-sm bg-slate-950 border-slate-800 text-white rounded-xl"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl py-3 shadow-md active:scale-95 transition-all" 
                    onClick={() => updatePrinterMutation.mutate(printerForm)}
                    disabled={updatePrinterMutation.isPending}
                  >
                    {updatePrinterMutation.isPending ? 'Menyimpan...' : 'Simpan Tetapan Pencetak & Dapur 💾'}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. KITCHEN PACKING QC CHECKLIST */}
            {activeSection === 'checklist' && (
              <div className="transition-all duration-300 animate-in fade-in">
                <KitchenChecklistCustomizer menuItems={menuItems || []} />
              </div>
            )}

            {/* 5. DISH ADD-ONS CUSTOMIZER */}
            {activeSection === 'addons' && (
              <div className="transition-all duration-300 animate-in fade-in">
                <DishAddonsCustomizer />
              </div>
            )}

            {/* 6. STORE INFO & PROPRIETARY LICENSE */}
            {activeSection === 'store' && (
              <div className="space-y-6 transition-all duration-300 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                        🔒 Maklumat Premis & Pelesenan Sistem
                      </h2>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Sistem Eksklusif Warung J&J Penampang, Sabah</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">
                      <Lock className="w-3.5 h-3.5" /> Terkunci (Backend Sahaja)
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-3 text-xs leading-relaxed text-slate-300">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block font-bold">Perlindungan Pelesenan Proprietary:</strong>
                        Maklumat kedai, nama restoran, dan lokasi dikunci secara kekal pada antaramuka ini untuk mengelakkan sebarang pengubahsuaian tidak sah.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/60 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nama Restoran / Premis</span>
                      <p className="text-base font-black text-white">{storeForm.name || 'Warung J&J (Penampang)'}</p>
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">Status: Aktif & Berlesen</span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/60 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Alamat / Lokasi Operasi</span>
                      <p className="text-sm font-semibold text-slate-200">{storeForm.address || 'Jalan Penampang, 89500 Penampang, Sabah'}</p>
                      <span className="text-[10px] text-slate-400 font-mono">Koordinat: 5.918° N, 116.082° E</span>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/60 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">No. Telefon Utama</span>
                      <p className="text-sm font-mono font-bold text-white">{storeForm.phone_number || '017-222 1784'}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/60 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Pelesenan</span>
                      <p className="text-sm font-bold text-emerald-400">POS Single-Tenant Proprietary License</p>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {storeId || '1094d737-8104-4a55-b678-0fe9097beba0'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. HOMEPAGE & NAVBAR APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-6 transition-all duration-300 animate-in fade-in">
                {/* HOMEPAGE CUSTOMIZATION CARD */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                  <h2 className="text-xl font-black text-white tracking-tight border-b border-slate-800 pb-3">
                    Tampilan Laman Utama (Homepage)
                  </h2>
                  <div className="space-y-6">
                    <div className="space-y-4 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                      <h3 className="font-bold text-slate-200">Seksyen Hero Utama</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="heroTitle" className="text-slate-400 text-xs">Tajuk Hero</Label>
                          <Input
                            id="heroTitle"
                            value={homepageForm.hero_title}
                            onChange={(e) => setHomepageForm(prev => ({ ...prev, hero_title: e.target.value }))}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="heroImage" className="text-slate-400 text-xs">Gambar Hero (Pilihan Menu)</Label>
                          <select
                            id="heroImage"
                            value={homepageForm.hero_item_id}
                            onChange={(e) => setHomepageForm(prev => ({ ...prev, hero_item_id: e.target.value }))}
                            className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                          >
                            <option value="">-- Gunakan Default (Item Pilihan #1) --</option>
                            {menuItems?.filter(i => i.image_url).map(item => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl py-3 shadow-md active:scale-95 transition-all" 
                      onClick={() => updateHomepageMutation.mutate(homepageForm)}
                      disabled={updateHomepageMutation.isPending}
                    >
                      {updateHomepageMutation.isPending ? 'Menyimpan...' : 'Simpan Tampilan Homepage 💾'}
                    </Button>
                  </div>
                </div>

                {/* TOP NAVIGATION HEADER CUSTOMIZER */}
                <NavbarCustomizerCard />
              </div>
            )}

            {/* 8. MANUAL REFUND QUEUE */}
            {activeSection === 'refunds' && (
              <div className="transition-all duration-300 animate-in fade-in">
                <RefundQueueCard />
              </div>
            )}

            {/* 9. SECURITY & AUDIT LOGS */}
            {activeSection === 'security' && (
              <div className="space-y-6 transition-all duration-300 animate-in fade-in">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-rose-400" />
                      <span>Audit & Keselamatan Operasi POS</span>
                    </h2>
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs">
                      RLS-Protected
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 font-mono leading-relaxed">
                    Pantau rekod pengubahan pesanan, pembukaan laci tunai, pembatalan resit, dan aktiviti juruwang untuk kawalan integriti premis.
                  </p>
                  <Link to="/settings/audit-log" className="block pt-2">
                    <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold rounded-2xl py-3.5 gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Buka Log Audit Staf & Keselamatan POS</span>
                    </Button>
                  </Link>
                </div>
              </div>
            )}

          </main>
        </div>

      </div>
    </div>
  );
}

function NavbarCustomizerCard() {
  const [navItems, setNavItems] = useState<NavItemConfig[]>(getNavOrderConfig());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => setNavItems(getNavOrderConfig());
    window.addEventListener('warung_nav_order_updated', handleUpdate);
    return () => window.removeEventListener('warung_nav_order_updated', handleUpdate);
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...navItems];
    const movedItem = updated[draggedIdx];
    if (!movedItem) return;

    updated.splice(draggedIdx, 1);
    updated.splice(dropIdx, 0, movedItem);

    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success(`Reordered "${movedItem.label}" to position ${dropIdx + 1}!`);

    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= navItems.length) return;
    const currentItem = navItems[index];
    const targetItem = navItems[targetIdx];
    if (!currentItem || !targetItem) return;

    const updated = [...navItems];
    updated[index] = targetItem;
    updated[targetIdx] = currentItem;

    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success(`Moved ${currentItem.label} ${direction === 'up' ? 'left' : 'right'}!`);
  };

  const handleToggleVisibility = (id: string) => {
    const updated = navItems.map(item => item.id === id ? { ...item, visible: !item.visible } : item);
    setNavItems(updated);
    saveNavOrderConfig(updated);
    toast.success("Header tab visibility updated.");
  };

  const handleReset = () => {
    resetNavOrderConfig();
    setNavItems(getNavOrderConfig());
    setDraggedIdx(null);
    setDragOverIdx(null);
    toast.info("Navigation header reset to default order.");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🎛️ Drag & Drop Navigation Header Customizer</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Grab any tab (via ⠿ handle or item pill) and drag to rearrange tab positions (e.g. move Menu next to Orders)!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button 
            className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black font-mono text-xs gap-1.5 shadow-md"
            onClick={() => setIsModalOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4" /> Open Reorder Popup
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
            className="border-slate-800 text-slate-300 hover:text-white font-mono text-xs shrink-0"
          >
            🔄 Reset Default
          </Button>
        </div>
      </div>

      {/* DRAGGABLE LIVE HEADER PREVIEW BAR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Live Header Preview (Drag items directly here):</span>
          <span className="text-[10px] text-slate-500">🖱️ Drag & Drop supported</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-slate-800 font-black text-emerald-400 text-sm select-none">
            <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-full" />
            <span>Warung J&J</span>
          </div>

          <div className="flex items-center gap-1.5">
            {navItems.map((item, idx) => {
              if (!item.visible) return null;
              const isBeingDragged = draggedIdx === idx;
              const isTargetSlot = dragOverIdx === idx;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                  className={`bg-slate-900 border px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-grab active:cursor-grabbing select-none transition-all duration-200 ${
                    isBeingDragged 
                      ? 'opacity-40 border-amber-400 scale-95' 
                      : (isTargetSlot ? 'border-2 border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-500/50' : 'border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800')
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* REORDER & VISIBILITY CONTROLS LIST WITH DRAG HANDLES */}
      <div className="space-y-2 font-mono">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Full Nav Items List (Drag rows or click arrows):</span>
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 text-xs">
          {navItems.map((item, idx) => {
            const isBeingDragged = draggedIdx === idx;
            const isTargetSlot = dragOverIdx === idx;

            return (
              <div 
                key={item.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                className={`p-3 flex items-center justify-between transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                  isBeingDragged 
                    ? 'opacity-40 bg-amber-500/10 border-amber-400' 
                    : (isTargetSlot ? 'bg-emerald-950/60 border-y-2 border-emerald-400' : 'hover:bg-slate-900/70')
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="w-4 h-4 text-slate-500 hover:text-white shrink-0 cursor-grab" />
                  <Switch
                    checked={item.visible}
                    onCheckedChange={() => handleToggleVisibility(item.id)}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-base">{item.emoji}</span>
                    <span className={`font-bold text-sm ${item.visible ? 'text-white' : 'text-slate-500 line-through'}`}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">({item.path})</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === 0}
                    onClick={(e) => { e.stopPropagation(); handleMove(idx, 'up'); }}
                    className="h-8 w-8 p-0 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-800"
                    title="Move Left"
                  >
                    ⬅️
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={idx === navItems.length - 1}
                    onClick={(e) => { e.stopPropagation(); handleMove(idx, 'down'); }}
                    className="h-8 w-8 p-0 text-slate-300 hover:text-white disabled:opacity-30 border border-slate-800"
                    title="Move Right"
                  >
                    ➡️
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <NavCustomizerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function RefundQueueCard() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: pendingRefunds, isLoading } = useQuery({
    queryKey: ['pending-refunds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, status, paid, customer_phone, created_at, type')
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
  });

  const handleConfirmRefund = async (orderId: string) => {
    setProcessingId(orderId);
    try {
      const res = await markManualRefundComplete(orderId, 'Staff Cashier', 'Manual DuitNow QR Transfer');
      if (res.success) {
        toast.success(`Order #${orderId.slice(0, 8)} marked as refunded via DuitNow QR!`);
        queryClient.invalidateQueries({ queryKey: ['pending-refunds'] });
      } else {
        toast.error(res.message || 'Refund failed');
      }
    } catch (err: any) {
      toast.error(`Refund Failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            🔴 Staff Refund Queue (Manual DuitNow QR Transfer)
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Process manual refunds via Alliance Bank DuitNow QR to customer phone numbers. Enforces idempotency & rider-race guards.
          </p>
        </div>
        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 font-mono text-xs">
          {pendingRefunds?.length || 0} Pending
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-slate-500 font-mono text-xs">Loading refund queue...</div>
      ) : pendingRefunds?.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center text-xs text-emerald-400 font-mono">
          ✓ No pending refunds in queue. All orders clear!
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRefunds?.map(order => (
            <div key={order.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">Order #{order.id.slice(0, 8)}</span>
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                    {order.type}
                  </Badge>
                </div>
                <p className="text-slate-400">Customer Phone: <span className="text-emerald-400 font-bold">{order.customer_phone || 'N/A'}</span></p>
                <p className="text-slate-500 text-[10px]">Created: {new Date(order.created_at).toLocaleTimeString()}</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="font-black text-rose-400 text-lg">RM {order.total_amount.toFixed(2)}</span>
                <Button
                  size="sm"
                  onClick={() => handleConfirmRefund(order.id)}
                  disabled={processingId === order.id}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md active:scale-95"
                >
                  {processingId === order.id ? 'Processing...' : '✅ Mark DuitNow Refunded'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToyyibPaySettingsCard() {
  const [config, setConfig] = useState<ToyyibPayConfig>({
    userSecretKey: '',
    categoryCode: '',
    isSandbox: false,
    chargeToCustomer: true,
  });

  useEffect(() => {
    setConfig(getToyyibPayConfig());
  }, []);

  const handleSave = () => {
    saveToyyibPayConfig(config);
    toast.success('Tetapan ToyyibPay FPX berjaya disimpan! 🎉');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            ToyyibPay FPX Gateway Settings
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Sistem pembayaran automatik FPX Online Banking Malaysia (Maybank, CIMB, Bank Islam, etc.)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.userSecretKey && config.categoryCode ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-2.5 py-0.5 font-bold">
              ● API Siap Dikonfigurasi
            </Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs px-2.5 py-0.5 font-bold">
              ⏳ Menunggu Kelulusan / Kunci API
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* User Secret Key */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" /> ToyyibPay User Secret Key
          </Label>
          <Input 
            type="password"
            placeholder="e.g. w5x7srq7-rx5r-3t89-2ou2-k7361x2jewhn"
            value={config.userSecretKey}
            onChange={(e) => setConfig(prev => ({ ...prev, userSecretKey: e.target.value }))}
            className="bg-slate-950 border-slate-800 text-slate-100 font-mono text-xs h-10 rounded-xl"
          />
          <p className="text-[11px] text-slate-500">
            Dapatkan User Secret Key daripada portal rasmi ToyyibPay selepas pendaftaran diluluskan.
          </p>
        </div>

        {/* Category Code */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-sky-400" /> ToyyibPay Category Code
          </Label>
          <Input 
            placeholder="e.g. gcbhict9"
            value={config.categoryCode}
            onChange={(e) => setConfig(prev => ({ ...prev, categoryCode: e.target.value }))}
            className="bg-slate-950 border-slate-800 text-slate-100 font-mono text-xs h-10 rounded-xl"
          />
          <p className="text-[11px] text-slate-500">
            Kod kategori bil yang dicipta di bawah menu Category dalam akaun ToyyibPay anda.
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="space-y-0.5">
            <Label className="text-xs font-bold text-slate-200 block">Caj FPX kepada Pelanggan</Label>
            <span className="text-[10px] text-slate-400 block">Caj RM1.00 FPX ditanggung oleh pembeli</span>
          </div>
          <Switch 
            checked={config.chargeToCustomer} 
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, chargeToCustomer: checked }))} 
          />
        </div>

        <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="space-y-0.5">
            <Label className="text-xs font-bold text-slate-200 block">Mod Sandbox (Testing)</Label>
            <span className="text-[10px] text-slate-400 block">Gunakan akaun dev.toyyibpay.com untuk ujian</span>
          </div>
          <Switch 
            checked={config.isSandbox} 
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isSandbox: checked }))} 
          />
        </div>
      </div>

      {/* Save Button & Link */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <a 
          href="https://toyyibpay.com" 
          target="_blank" 
          rel="noreferrer" 
          className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 underline"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Buka Portal ToyyibPay Malaysia
        </a>

        <Button 
          onClick={handleSave}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 h-10 rounded-xl shadow-lg shadow-emerald-600/20"
        >
          Simpan Tetapan ToyyibPay 💾
        </Button>
      </div>
    </div>
  );
}

interface RiderKYCRecord {
  id: string;
  userId?: string;
  fullName: string;
  icNumber: string;
  phone: string;
  email: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  vehiclePlate: string;
  vehicleModel: string;
  licenseNumber: string;
  licenseExpiry: string;
  roadtaxExpiry: string;
  homeAddress: string;
  emergencyContact: string;
  photoRider?: string;
  photoIc?: string;
  photoLicense?: string;
  photoBankStatement?: string;
  registeredAt: string;
  isVerified: boolean;
}

const MALAYSIAN_BANKS = [
  'Maybank (Malayan Banking)',
  'CIMB Bank',
  'Alliance Bank Malaysia',
  'Public Bank',
  'RHB Bank',
  'Bank Islam Malaysia',
  'Hong Leong Bank',
  'Bank Simpanan Nasional (BSN)',
  'AmBank',
  'Bank Rakyat',
  'Affin Bank',
  'Bank Muamalat',
  'Agrobank',
  'HSBC Bank Malaysia',
  'Standard Chartered Malaysia',
  'OCBC Bank Malaysia',
  'UOB Malaysia',
  'Touch n Go eWallet (DuitNow)',
  'Lain-lain Bank / Akaun'
];

function AdminRiderManagementCard() {
  const queryClient = useQueryClient();
  
  // KYC Form State
  const [fullName, setFullName] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Bank Account State
  const [bankName, setBankName] = useState('Maybank (Malayan Banking)');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  
  // Vehicle & License State
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [roadtaxExpiry, setRoadtaxExpiry] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  
  // Photos & Documents State
  const [photoRider, setPhotoRider] = useState<string>('');
  const [photoIc, setPhotoIc] = useState<string>('');
  const [photoLicense, setPhotoLicense] = useState<string>('');
  const [photoBankStatement, setPhotoBankStatement] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRider, setSelectedRider] = useState<RiderKYCRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copiedBankId, setCopiedBankId] = useState<string | null>(null);

  // Helper to handle camera/file uploads into Base64
  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Saiz gambar terlalu besar. Sila pilih gambar di bawah 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setter(reader.result as string);
      toast.success('Dokumen berjaya dimuat naik! 📸');
    };
    reader.readAsDataURL(file);
  };

  const handleCopyAccount = (accNo: string, riderId: string) => {
    navigator.clipboard.writeText(accNo);
    setCopiedBankId(riderId);
    toast.success(`No. Akaun ${accNo} berjaya disalin! Sedia untuk pindahan gaji. 📋`);
    setTimeout(() => setCopiedBankId(null), 2500);
  };

  // Fetch Store settings for verified riders
  const { data: storeData, refetch: refetchStore } = useQuery({
    queryKey: ['store-kyc-riders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, settings')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch registered users with role rider
  const { data: dbRiders, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-riders-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'rider')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch live riders table (is_approved, status, current_lat, current_lng)
  const { data: ridersTableData, refetch: refetchRidersTable } = useQuery({
    queryKey: ['admin-riders-table'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riders')
        .select('*');
      if (error) return [];
      return data || [];
    },
  });

  const kycRecords: RiderKYCRecord[] = (storeData?.settings as any)?.verified_riders || [];

  // 1-Click Approval Toggle for Rider Fleet
  const toggleRiderApproval = async (userId: string, currentApproved: boolean) => {
    try {
      const nextApproved = !currentApproved;

      // 1. Update or Insert in 'riders' table (if user exists in auth)
      try {
        const { data: existingRows } = await supabase
          .from('riders')
          .select('id, user_id')
          .or(`user_id.eq.${userId},id.eq.${userId}`);

        if (existingRows && existingRows.length > 0) {
          for (const row of existingRows) {
            await supabase
              .from('riders')
              .update({
                is_approved: nextApproved,
                status: 'offline',
                updated_at: new Date().toISOString()
              } as any)
              .eq('id', row.id);
          }
        } else {
          await supabase
            .from('riders')
            .insert({
              user_id: userId,
              store_id: storeData?.id || '',
              is_approved: nextApproved,
              status: 'offline',
              updated_at: new Date().toISOString()
            } as any);
        }
      } catch (riderTableErr) {
        console.warn('Riders table sync note:', riderTableErr);
      }

      // 2. Synchronize with storeData.settings.verified_riders
      if (storeData?.id) {
        const existingSettings = (storeData.settings as any) || {};
        const currentKyc: RiderKYCRecord[] = existingSettings.verified_riders || [];
        const updatedKyc = currentKyc.map(r => {
          if (r.userId === userId || r.id === userId) {
            return { ...r, isVerified: nextApproved };
          }
          return r;
        });

        await supabase
          .from('stores')
          .update({
            settings: {
              ...existingSettings,
              verified_riders: updatedKyc,
            } as any,
          })
          .eq('id', storeData.id);
      }

      toast.success(nextApproved ? '✅ Rider berjaya diluluskan (APPROVED)!' : '⏸️ Kelulusan rider dinyahaktif (REVOKED).');
      refetchRidersTable();
      refetchUsers();
      refetchStore();
    } catch (err: any) {
      toast.error('Gagal mengemas kini kelulusan rider: ' + err.message);
    }
  };

  // Force Re-dispatch order if rider is stuck
  const forceRedispatchOrder = async (orderId: string) => {
    const confirmAction = window.confirm("Adakah anda pasti mahu membatalkan tugasan rider ini dan buka semula pesanan untuk dispatch?");
    if (!confirmAction) return;

    try {
      await supabase
        .from('orders')
        .update({ delivery_service: null, status: 'ready', updated_at: new Date().toISOString() } as any)
        .eq('id', orderId);

      toast.success("✅ Pesanan berjaya dibuka semula untuk dispatch!");
      refetchRidersTable();
    } catch (err: any) {
      toast.error("Ralat membuka semula pesanan: " + err.message);
    }
  };

  const handleRegisterRiderKYC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !icNumber.trim() || !phone.trim() || !email.trim() || !password.trim() || !vehiclePlate.trim() || !licenseExpiry.trim() || !homeAddress.trim() || !bankAccountNumber.trim()) {
      toast.error('Sila lengkapkan semua butiran wajib (Nama, IC, Telefon, Bank & No Akaun, No Plat, Tarikh Lesen, Alamat Rumah).');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create auth user in Supabase
      const { data: authRes, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            phone_number: phone,
            role: 'rider',
          },
        },
      });

      if (authErr) throw authErr;

      const userId = authRes?.user?.id || crypto.randomUUID();

      // 2. Upsert into users table
      await supabase.from('users').upsert({
        id: userId,
        name: fullName,
        phone: phone,
        role: 'rider' as any,
        store_id: storeData?.id || '',
      });

      // 3. Create full KYC record with bank info
      const newRecord: RiderKYCRecord = {
        id: crypto.randomUUID(),
        userId,
        fullName,
        icNumber,
        phone,
        email,
        bankName: bankName || 'Maybank',
        bankAccountNumber: bankAccountNumber.replace(/\s+/g, ''),
        bankAccountHolder: bankAccountHolder || fullName,
        vehiclePlate: vehiclePlate.toUpperCase(),
        vehicleModel: vehicleModel || 'Motosikal',
        licenseNumber: licenseNumber || icNumber,
        licenseExpiry,
        roadtaxExpiry: roadtaxExpiry || licenseExpiry,
        homeAddress,
        emergencyContact,
        photoRider,
        photoIc,
        photoLicense,
        photoBankStatement,
        registeredAt: new Date().toISOString(),
        isVerified: true,
      };

      const updatedRecords = [newRecord, ...kycRecords.filter(r => r.email !== email)];

      // 4. Save to store settings
      if (storeData?.id) {
        const existingSettings = (storeData.settings as any) || {};
        await supabase
          .from('stores')
          .update({
            settings: {
              ...existingSettings,
              verified_riders: updatedRecords,
            } as any,
          })
          .eq('id', storeData.id);
      }

      toast.success(`🎉 Rakan Penghantar ${fullName} berjaya didaftarkan dengan akaun bank & disahkan!`);
      
      // Reset form
      setFullName('');
      setIcNumber('');
      setPhone('');
      setEmail('');
      setPassword('');
      setBankName('Maybank (Malayan Banking)');
      setBankAccountNumber('');
      setBankAccountHolder('');
      setVehiclePlate('');
      setVehicleModel('');
      setLicenseNumber('');
      setLicenseExpiry('');
      setRoadtaxExpiry('');
      setHomeAddress('');
      setEmergencyContact('');
      setPhotoRider('');
      setPhotoIc('');
      setPhotoLicense('');
      setPhotoBankStatement('');
      setShowForm(false);
      
      refetchStore();
      refetchUsers();
    } catch (err: any) {
      toast.error(`Ralat pendaftaran rider: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if license is valid
  const checkLicenseStatus = (expiryDate: string) => {
    if (!expiryDate) return { valid: false, text: 'Tiada Tarikh', color: 'text-amber-400' };
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { valid: false, text: '🔴 Lesen Tamat Tempoh', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    } else if (diffDays <= 30) {
      return { valid: true, text: `⚠️ Luput dlm ${diffDays} hari`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    } else {
      return { valid: true, text: '🟢 Lesen Sah', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <span>🛵</span>
            <span>Pengurusan & Pendaftaran Rakan Penghantar (KYC & Gaji Rider)</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Pendaftaran bersemuka oleh Admin. Lengkap dengan MyKad, lesen sah, kenderaan, akaun bank gaji, & dokumen foto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md gap-1.5"
          >
            {showForm ? 'Tutup Borang' : '➕ Daftar Rider Baru (KYC & Gaji)'}
          </Button>
        </div>
      </div>

      {/* FULL KYC ONBOARDING FORM */}
      {showForm && (
        <form onSubmit={handleRegisterRiderKYC} className="bg-slate-950 border-2 border-amber-500/40 p-5 rounded-2xl space-y-5 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <UserCheck className="w-5 h-5 text-amber-500" />
              <span>Borang Pengesahan Identiti, Kenderaan & Akaun Bank Gaji Rider</span>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
              Wajib Hadir di Kaunter Warung
            </Badge>
          </div>

          {/* SECTION 1: BUTIRAN PERIBADI & MYKAD */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              <span>1. Butiran Peribadi & Kad Pengenalan</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Nama Penuh Seperti Dalam MyKad *</Label>
                <Input
                  placeholder="cth: Mohd Azlan Bin Ramli"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">No. Kad Pengenalan (MyKad) *</Label>
                <Input
                  placeholder="cth: 920514-12-5678"
                  value={icNumber}
                  onChange={(e) => setIcNumber(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">No. Telefon WhatsApp *</Label>
                <Input
                  placeholder="cth: 019-888 7766"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-slate-300 font-bold">Alamat Kediaman Lengkap *</Label>
                <Input
                  placeholder="cth: No. 12, Lorong 3, Taman Penampang, 89500 Penampang, Sabah"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">No. Telefon Waris / Kecemasan</Label>
                <Input
                  placeholder="cth: 012-345 6789 (Isteri)"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: AKAUN BANK UNTUK PEMBAYARAN GAJI & UPAH */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-emerald-400" />
              <span>2. Maklumat Akaun Bank Rider (Untuk Bayaran Gaji & Komisen)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Nama Bank *</Label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-white h-10 rounded-xl px-3 text-xs focus:outline-none focus:border-amber-500"
                  required
                >
                  {MALAYSIAN_BANKS.map((b) => (
                    <option key={b} value={b} className="bg-slate-900 text-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">No. Akaun Bank Rider *</Label>
                <Input
                  placeholder="cth: 162012345678"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl font-bold tracking-wider"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Nama Pemegang Akaun (Seperti di Bank)</Label>
                <Input
                  placeholder="Sama seperti nama MyKad jika kosong"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: KENDERAAN & LESEN MEMANDU */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Bike className="w-4 h-4 text-sky-400" />
              <span>3. Maklumat Kenderaan & Lesen Memandu</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">No. Plat Motosikal / Kenderaan *</Label>
                <Input
                  placeholder="cth: SAB 1234 A"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Model / Jenis Kenderaan</Label>
                <Input
                  placeholder="cth: Yamaha Y15ZR / Honda RSX"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Tarikh Sah Lesen Memandu *</Label>
                <Input
                  type="date"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Tarikh Luput Cukai Jalan (Roadtax)</Label>
                <Input
                  type="date"
                  value={roadtaxExpiry}
                  onChange={(e) => setRoadtaxExpiry(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: LOG MASUK SISTEM */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>4. Akaun Log Masuk Rider</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Emel Log Masuk Rider *</Label>
                <Input
                  type="email"
                  placeholder="azlan.rider@warungjnj.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-slate-300 font-bold">Kata Laluan Sementara *</Label>
                <Input
                  type="text"
                  placeholder="cth: warung123456"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white h-10 rounded-xl"
                  required
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: TANGKAP GAMBAR DOKUMEN, FOTO RIDER & PENYATA BANK */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>5. Tangkap Gambar Wajah & Dokumen Pengesahan (Kamera / Muat Naik)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Foto Wajah Rider */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-center">
                <Label className="text-slate-300 font-bold block text-left">📸 Foto Wajah Rider</Label>
                {photoRider ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-500/50">
                    <img src={photoRider} alt="Foto Rider" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoRider('')}
                      className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded"
                    >
                      Padam
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-amber-500 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all">
                    <Camera className="w-5 h-5 text-amber-400 mb-1" />
                    <span className="text-[11px] text-slate-300 font-bold">Ambil Foto Wajah</span>
                    <span className="text-[9px] text-slate-500">Kamera atau Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={(e) => handleFileCapture(e, setPhotoRider)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Foto Kad Pengenalan */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-center">
                <Label className="text-slate-300 font-bold block text-left">📄 Salinan MyKad</Label>
                {photoIc ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-500/50">
                    <img src={photoIc} alt="Salinan IC" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoIc('')}
                      className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded"
                    >
                      Padam
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-sky-500 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all">
                    <FileText className="w-5 h-5 text-sky-400 mb-1" />
                    <span className="text-[11px] text-slate-300 font-bold">Tangkap Gambar IC</span>
                    <span className="text-[9px] text-slate-500">Kamera atau Fail</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileCapture(e, setPhotoIc)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Foto Lesen Memandu */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-center">
                <Label className="text-slate-300 font-bold block text-left">🪪 Salinan Lesen</Label>
                {photoLicense ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-500/50">
                    <img src={photoLicense} alt="Salinan Lesen" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoLicense('')}
                      className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded"
                    >
                      Padam
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all">
                    <Upload className="w-5 h-5 text-emerald-400 mb-1" />
                    <span className="text-[11px] text-slate-300 font-bold">Tangkap Gambar Lesen</span>
                    <span className="text-[9px] text-slate-500">Kamera atau Fail</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileCapture(e, setPhotoLicense)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Foto Penyata / Kad Bank */}
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2 text-center">
                <Label className="text-slate-300 font-bold block text-left">💳 Salinan Penyata / Kad Bank</Label>
                {photoBankStatement ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-emerald-500/50">
                    <img src={photoBankStatement} alt="Salinan Penyata Bank" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoBankStatement('')}
                      className="absolute top-1 right-1 bg-rose-600 text-white text-[10px] px-1.5 py-0.5 rounded"
                    >
                      Padam
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-amber-500 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all">
                    <CreditCard className="w-5 h-5 text-amber-400 mb-1" />
                    <span className="text-[11px] text-slate-300 font-bold">Penyata / Kad Bank</span>
                    <span className="text-[9px] text-slate-500">Kamera atau Fail</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileCapture(e, setPhotoBankStatement)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              🛡️ Semua butiran peribadi & akaun bank disimpan secara selamat dalam pangkalan data berpusat Warung J&J.
            </span>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-11 px-8 rounded-xl shadow-lg shadow-emerald-600/30"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '✅ Sahkan & Daftarkan Rakan Penghantar'}
            </Button>
          </div>
        </form>
      )}

      {/* VERIFIED RIDERS LIST */}
      <div className="space-y-3 font-mono">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold text-slate-300 uppercase tracking-wider">
            Senarai Rakan Penghantar Sah Warung J&J ({kycRecords.length || dbRiders?.length || 0})
          </span>
          <button
            type="button"
            onClick={() => { refetchStore(); refetchUsers(); }}
            className="text-amber-400 hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Kemaskini Rekod
          </button>
        </div>

        {kycRecords.length === 0 && (!dbRiders || dbRiders.length === 0) ? (
          <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-500 text-xs space-y-2">
            <Bike className="w-8 h-8 mx-auto text-slate-600" />
            <p className="font-bold text-slate-400">Belum ada rakan penghantar didaftarkan.</p>
            <p className="text-[11px]">Gunakan butang "➕ Daftar Rider Baru (KYC & Gaji)" di atas untuk memulakan proses pendaftaran.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {kycRecords.map((rider) => {
              const licenseStatus = checkLicenseStatus(rider.licenseExpiry);
              const riderRow = ridersTableData?.find((r: any) => r.user_id === rider.userId || r.id === rider.id);
              const isApproved = riderRow ? Boolean(riderRow.is_approved) : Boolean(rider.isVerified);
              const statusVal = riderRow?.status || 'offline';

              return (
                <div
                  key={rider.id}
                  className={`bg-slate-950 border ${isApproved ? 'border-slate-800' : 'border-amber-500/50'} hover:border-amber-500/40 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-lg transition-all`}
                >
                  <div className="flex items-start gap-3">
                    {/* AVATAR / PHOTO */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                      {rider.photoRider ? (
                        <img src={rider.photoRider} alt={rider.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-slate-500" />
                      )}
                    </div>

                    {/* RIDER INFO */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-white text-sm truncate">{rider.fullName}</h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* LIVE STATUS BADGE */}
                          {statusVal === 'available' && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                              🟢 ONLINE
                            </span>
                          )}
                          {statusVal === 'busy' && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              🟡 BUSY
                            </span>
                          )}
                          {statusVal === 'offline' && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              ⚪ OFFLINE
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isApproved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                            {isApproved ? 'APPROVED' : 'PENDING'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Bike className="w-3.5 h-3.5 text-amber-500" />
                          {rider.vehiclePlate}
                        </span>
                        {rider.bankName && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono truncate">
                            🏦 {rider.bankName.split(' ')[0]} • {rider.bankAccountNumber?.slice(-4) || '****'}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 truncate">
                        📍 {rider.homeAddress}
                      </p>
                    </div>
                  </div>

                  {/* ACTION BUTTONS & 1-CLICK APPROVAL */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1.5">
                      {/* 1-CLICK APPROVE / REVOKE TOGGLE */}
                      <button
                        type="button"
                        onClick={() => toggleRiderApproval(rider.userId || rider.id, isApproved)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 ${
                          isApproved 
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        }`}
                      >
                        {isApproved ? '⏸️ Nyahaktif' : '✅ Luluskan (Approve)'}
                      </button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSelectedRider(rider); setIsDetailOpen(true); }}
                        className="bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 text-xs h-7 px-2 rounded-xl gap-1"
                      >
                        <Eye className="w-3 h-3 text-sky-400" />
                        <span>Dossier</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {rider.bankAccountNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopyAccount(rider.bankAccountNumber!, rider.id)}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 rounded-xl transition-all flex items-center gap-1 text-[10px] font-bold"
                          title="Salin No. Akaun Bank untuk Gaji"
                        >
                          {copiedBankId === rider.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedBankId === rider.id ? 'Disalin' : 'Bank'}</span>
                        </button>
                      )}

                      <a
                        href={`https://wa.me/${rider.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all flex items-center gap-1 font-bold text-xs"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WA</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: DETAIL RIDER KYC & BANK INSPECTION */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-slate-900 border border-slate-800 text-white max-w-xl max-h-[90vh] overflow-y-auto font-mono">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
              <span>Dossier Pengesahan & Akaun Bank Rakan Penghantar</span>
            </DialogTitle>
          </DialogHeader>

          {selectedRider && (
            <div className="space-y-4 text-xs pt-2">
              {/* HEADER WITH PHOTO */}
              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0">
                  {selectedRider.photoRider ? (
                    <img src={selectedRider.photoRider} alt={selectedRider.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-500 m-auto mt-4" />
                  )}
                </div>

                <div>
                  <h3 className="text-base font-black text-white">{selectedRider.fullName}</h3>
                  <p className="text-xs text-amber-400 font-bold">No. IC: {selectedRider.icNumber}</p>
                  <p className="text-[11px] text-slate-400">No. Telefon: {selectedRider.phone}</p>
                </div>
              </div>

              {/* SECTION: BANK ACCOUNT & PAYOUT HIGHLIGHT */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <Landmark className="w-4 h-4" />
                    <span>Maklumat Akaun Bank Untuk Bayaran Gaji</span>
                  </div>
                  {selectedRider.bankAccountNumber && (
                    <Button
                      size="sm"
                      onClick={() => handleCopyAccount(selectedRider.bankAccountNumber!, selectedRider.id)}
                      className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin No. Akaun</span>
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Nama Bank:</span>
                    <span className="font-bold text-white">{selectedRider.bankName || 'Maybank'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">No. Akaun:</span>
                    <span className="font-bold text-emerald-300 font-mono tracking-wider">{selectedRider.bankAccountNumber || 'Tiada'}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">Pemegang Akaun:</span>
                    <span className="font-bold text-slate-200 truncate block">{selectedRider.bankAccountHolder || selectedRider.fullName}</span>
                  </div>
                </div>
              </div>

              {/* DETAILS GRID */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 block">No. Plat Kenderaan:</span>
                  <span className="font-bold text-white">{selectedRider.vehiclePlate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Model Kenderaan:</span>
                  <span className="font-bold text-white">{selectedRider.vehicleModel || 'Motosikal'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Tarikh Sah Lesen:</span>
                  <span className="font-bold text-emerald-400">{selectedRider.licenseExpiry}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Tarikh Luput Roadtax:</span>
                  <span className="font-bold text-sky-400">{selectedRider.roadtaxExpiry || 'N/A'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-500 block">Alamat Kediaman:</span>
                  <span className="text-slate-200">{selectedRider.homeAddress}</span>
                </div>
                {selectedRider.emergencyContact && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-500 block">Hubungan Kecemasan:</span>
                    <span className="text-rose-400 font-bold">{selectedRider.emergencyContact}</span>
                  </div>
                )}
              </div>

              {/* DOCUMENT IMAGES PREVIEWS */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-300 text-xs">Dokumen Bukti Disahkan:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedRider.photoIc && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">Salinan MyKad</span>
                      <div className="aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                        <img src={selectedRider.photoIc} alt="IC" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}

                  {selectedRider.photoLicense && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">Salinan Lesen & Roadtax</span>
                      <div className="aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                        <img src={selectedRider.photoLicense} alt="Lesen" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}

                  {selectedRider.photoBankStatement && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 block">Penyata / Kad Bank</span>
                      <div className="aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                        <img src={selectedRider.photoBankStatement} alt="Penyata Bank" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  onClick={() => setIsDetailOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl"
                >
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

