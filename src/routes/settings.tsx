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
import { MessageSquare, ShieldCheck, QrCode, Phone, AlertTriangle, RefreshCw, Globe, Key, ExternalLink, Lock } from 'lucide-react';
import { markManualRefundComplete } from '@/lib/riders';
import { getToyyibPayConfig, saveToyyibPayConfig, ToyyibPayConfig } from '@/lib/toyyibpay';

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 pb-24 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* SETTINGS HEADER CARD */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">System & Store Settings</h1>
          <p className="text-xs text-slate-400 font-mono mt-1">Configure store branding, kitchen printer triggers, alert audio & audit logs</p>
        </div>

        {/* STORE INFO & LICENSE CARD (LOCKED TO BACKEND ONLY) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 relative overflow-hidden">
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

          <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl space-y-3 text-xs leading-relaxed text-slate-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-bold">Perlindungan Pelesenan Proprietary:</strong>
                Maklumat kedai, nama restoran, dan lokasi dikunci secara kekal pada antaramuka ini untuk mengelakkan sebarang pengubahsuaian tidak sah. Sebarang pengemaskinian rasmi hanya boleh dilakukan melalui pangkalan data backend.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nama Restoran / Premis</span>
              <p className="text-base font-black text-white">{storeForm.name || 'Warung J&J (Penampang)'}</p>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">Status: Aktif & Berlesen</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Alamat / Lokasi Operasi</span>
              <p className="text-sm font-semibold text-slate-200">{storeForm.address || 'Jalan Penampang, 89500 Penampang, Sabah'}</p>
              <span className="text-[10px] text-slate-400 font-mono">Koordinat: 5.918° N, 116.082° E</span>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">No. Telefon Utama</span>
              <p className="text-sm font-mono font-bold text-white">{storeForm.phone_number || '017-222 1784'}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Kategori Pelesenan</span>
              <p className="text-sm font-bold text-emerald-400">POS Single-Tenant Proprietary License</p>
              <span className="text-[10px] text-slate-400 font-mono">ID: {storeId || '1094d737-8104-4a55-b678-0fe9097beba0'}</span>
            </div>
          </div>
        </div>

        {/* HOMEPAGE CUSTOMIZATION CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h2 className="text-xl font-black text-white tracking-tight border-b border-slate-800 pb-3">Homepage Customization</h2>
          <div className="space-y-6">
            
            {/* HERO SECTION */}
            <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <h3 className="font-bold text-slate-200">Main Hero Section</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="heroTitle" className="text-slate-400 text-xs">Hero Title</Label>
                  <Input
                    id="heroTitle"
                    value={homepageForm.hero_title}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, hero_title: e.target.value }))}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroImage" className="text-slate-400 text-xs">Hero Image (Menu Item)</Label>
                  <select
                    id="heroImage"
                    value={homepageForm.hero_item_id}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, hero_item_id: e.target.value }))}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">-- Use Default (1st Featured Item) --</option>
                    {menuItems?.filter(i => i.image_url).map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* TOP BENTO SECTION */}
            <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <h3 className="font-bold text-slate-200">Top Bento Grid</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bento1Title" className="text-slate-400 text-xs">Title</Label>
                  <Input
                    id="bento1Title"
                    value={homepageForm.bento_1_title}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, bento_1_title: e.target.value }))}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bento1Image" className="text-slate-400 text-xs">Image (Menu Item)</Label>
                  <select
                    id="bento1Image"
                    value={homepageForm.bento_1_item_id}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, bento_1_item_id: e.target.value }))}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">-- Use Default (2nd Featured Item) --</option>
                    {menuItems?.filter(i => i.image_url).map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* BOTTOM BENTO SECTION */}
            <div className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
              <h3 className="font-bold text-slate-200">Bottom Bento Grid</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bento2Title" className="text-slate-400 text-xs">Title</Label>
                  <Input
                    id="bento2Title"
                    value={homepageForm.bento_2_title}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, bento_2_title: e.target.value }))}
                    className="bg-slate-950 border-slate-800 text-white rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bento2Image" className="text-slate-400 text-xs">Image (Menu Item)</Label>
                  <select
                    id="bento2Image"
                    value={homepageForm.bento_2_item_id}
                    onChange={(e) => setHomepageForm(prev => ({ ...prev, bento_2_item_id: e.target.value }))}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="">-- Use Default (3rd Featured Item) --</option>
                    {menuItems?.filter(i => i.image_url).map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl py-3 shadow-md active:scale-95 transition-all" 
              onClick={() => updateHomepageMutation.mutate(homepageForm)}
              disabled={updateHomepageMutation.isPending}
            >
              {updateHomepageMutation.isPending ? 'Saving Homepage...' : 'Save Homepage Settings'}
            </Button>
          </div>
        </div>


        {/* KITCHEN DISPLAY & PRINTER SETTINGS CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-xl font-black text-white tracking-tight border-b border-slate-800 pb-3">Kitchen Display & Printer Settings</h2>
          
          <div className="space-y-2">
            <Label htmlFor="printer_name" className="text-slate-300 font-bold">Thermal Printer Name</Label>
            <Input
              id="printer_name"
              placeholder='e.g. "POS-5810dd Counter"'
              value={printerForm.printer_name}
              onChange={(e) => setPrinterForm(prev => ({ ...prev, printer_name: e.target.value }))}
              className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 rounded-xl font-mono text-sm"
            />
          </div>
          
          <div className="space-y-3">
            <Label className="text-slate-300 font-bold">Auto-Print Triggers</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'payment_confirmed', label: 'On Payment Confirmed' },
                { id: 'ready', label: 'On Order Ready' },
                { id: 'completed', label: 'On Order Completed' },
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
            <h3 className="font-bold text-base text-white flex items-center gap-2">🔊 Kitchen Alert Sounds</h3>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Select Alert Sound</Label>
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
                Test Current Sound
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Upload Custom Sound (MP3/WAV/WebM max 5MB)</Label>
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
              <Label className="text-slate-300">Or Record Voice Message</Label>
              <div>
                {!isRecording ? (
                  <Button type="button" variant="outline" onClick={handleStartRecording} className="bg-rose-950/40 text-rose-400 border-rose-800 hover:bg-rose-900">
                    🔴 Record Voice
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" onClick={handleStopRecording} className="animate-pulse bg-rose-600 text-white font-bold">
                    ⏹ Stop Recording
                  </Button>
                )}
              </div>
            </div>
            {printerForm.sound_file_url && printerForm.sound_choice === 'custom' && (
              <p className="text-xs text-emerald-400 font-bold">✓ Custom sound ready</p>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="font-bold text-base text-white">🎨 Badge Colors</h3>
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
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl py-3 shadow-md active:scale-95 transition-all" 
            onClick={() => updatePrinterMutation.mutate(printerForm)}
            disabled={updatePrinterMutation.isPending}
          >
            {updatePrinterMutation.isPending ? 'Saving Printer Settings...' : 'Save Printer & Kitchen Settings'}
          </Button>
        </div>

        {/* DUITNOW MERCHANT QR & HYBRID PAYMENT CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                💳 DuitNow Merchant QR & Hybrid Payment Strategy
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Alliance Bank DuitNow QR for Dine-In & POS Counter | ToyyibPay FPX Webhook for Online Delivery
              </p>
            </div>
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs px-3 py-1 rounded-full font-bold">
              Alliance Bank
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="relative inline-block bg-white p-4 rounded-3xl border-4 border-[#a6192e] shadow-2xl text-center">
              {/* DuitNow Header */}
              <div className="bg-[#a6192e] text-white text-xs font-black py-1.5 px-4 rounded-t-xl tracking-wider uppercase flex items-center justify-between mb-3">
                <span className="flex items-center gap-1.5 font-sans">💳 DuitNow QR</span>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full">Alliance Bank</span>
              </div>

              {/* QR Code Container with Centered Warung J&J Logo */}
              <div className="relative inline-block">
                <img src="/duitnow-qr.png" alt="Alliance Bank DuitNow QR" className="w-52 h-auto mx-auto rounded-lg" />
                
                {/* Centered Warung J&J Logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white p-1 rounded-xl shadow-md border-2 border-[#a6192e]">
                    <img src="/warung-logo.png" alt="Warung J&J Logo" className="w-9 h-9 object-contain rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Merchant Details Footer */}
              <div className="mt-3 pt-2 border-t border-gray-100 font-mono text-center">
                <p className="text-xs font-black text-[#a6192e] uppercase tracking-wide">J&J CAFE & CATERING</p>
                <p className="text-[10px] text-gray-500 font-bold">Alliance Bank Malaysia Berhad</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  🍽️ Dine-In & Counter: Static DuitNow QR (0% Fees)
                </h4>
                <p className="text-xs text-slate-300">
                  Customers scan this Alliance Bank QR at the register or table. Staff visually verifies payment on the Alliance Bank app and confirms in POS.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                  🛵 Online Delivery: ToyyibPay / FPX Signature Webhook
                </h4>
                <p className="text-xs text-slate-300">
                  Online prepaid delivery automatically routes through ToyyibPay signature-verified webhooks. Kitchen only starts when payment is 100% server-confirmed!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TOYYIBPAY FPX GATEWAY CONFIGURATION CARD */}
        <ToyyibPaySettingsCard />

        {/* MANUAL STAFF REFUND QUEUE CARD */}
        <RefundQueueCard />

        {/* AUDIT LOG CARD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-black text-white tracking-tight">Audit & Security</h2>
          <p className="text-xs text-slate-400 font-mono">
            View detailed logs of all order edits, status overrides, and register operations to monitor staff activity.
          </p>
          <Link to="/settings/audit-log" className="block">
            <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold rounded-xl py-3">
              View Staff Audit Log
            </Button>
          </Link>
        </div>

        {/* TOP NAVIGATION HEADER CUSTOMIZER */}
        <NavbarCustomizerCard />
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
