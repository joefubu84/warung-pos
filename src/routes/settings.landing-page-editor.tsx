
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Globe, Sparkles, UtensilsCrossed, MapPin, Plus, Trash2, Save } from 'lucide-react';

interface HeroSection {
  headline: string;
  subheadline: string;
  badge_text: string;
  is_delivery_enabled: boolean;
  delivery_status_note: string;
  hero_image_url: string;
}

interface Highlight {
  id: string;
  title: string;
  description: string;
  image_url: string;
}

interface BusinessInfo {
  operating_hours: string;
  address: string;
  phone_number: string;
  google_maps_link: string;
}

interface LandingPageConfig {
  id?: string;
  hero_section: HeroSection;
  highlights_section: Highlight[];
  popular_dishes: string[]; // Array of dish IDs
  business_info: BusinessInfo;
}

const defaultLandingPageConfig: LandingPageConfig = {
  hero_section: {
    headline: 'Selamat Datang ke Warung J&J',
    subheadline: 'Sajian Tradisional Penuh Kehangatan, Dihantar Terus ke Meja Anda!',
    badge_text: 'Buka Sekarang',
    is_delivery_enabled: true,
    delivery_status_note: 'Penghantaran aktif ke sekitar kawasan terpilih.',
    hero_image_url: '/logo.png',
  },
  highlights_section: [
    {
      id: '1',
      title: 'Sambal Gesek Kaw-Kaw',
      description: 'Pedas menyengat, membangkitkan selera asli warung!',
      image_url: '/logo.png',
    },
    {
      id: '2',
      title: 'Ramuan Segar & Halal',
      description: 'Hanya ayam & bahan segar dipilih setiap hari khas untuk anda.',
      image_url: '/logo.png',
    },
  ],
  popular_dishes: [],
  business_info: {
    operating_hours: 'Isnin - Ahad: 10:00 AM - 10:00 PM',
    address: 'Warung J&J, Penampang, Sabah',
    phone_number: '+60123456789',
    google_maps_link: 'https://maps.google.com/?q=Warung+J&J',
  },
};

export function Route() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<LandingPageConfig>(defaultLandingPageConfig);
  const [menuItems, setMenuItems] = useState<{ id: string; name: string }[]>([]);

  // Fetch landing page config with graceful fallback to stores.settings
  const { data, isLoading } = useQuery<LandingPageConfig, Error>({
    queryKey: ['landingPageConfig'],
    queryFn: async () => {
      // 1. Try querying landing_page_config table if present in schema
      try {
        const { data: tableData, error: tableError } = await supabase
          .from('landing_page_config')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!tableError && tableData) {
          return {
            ...defaultLandingPageConfig,
            ...tableData,
            hero_section: { ...defaultLandingPageConfig.hero_section, ...(tableData.hero_section || {}) },
            business_info: { ...defaultLandingPageConfig.business_info, ...(tableData.business_info || {}) },
            highlights_section: tableData.highlights_section || defaultLandingPageConfig.highlights_section,
            popular_dishes: tableData.popular_dishes || defaultLandingPageConfig.popular_dishes,
          } as LandingPageConfig;
        }
      } catch (err) {
        // Table not in schema cache, safely continue to fallback
      }

      // 2. Seamless fallback: Load from stores.settings.landing_page_config
      try {
        const { data: storeData } = await supabase
          .from('stores')
          .select('id, settings')
          .limit(1)
          .maybeSingle();

        const storedConfig = (storeData?.settings as any)?.landing_page_config;
        if (storedConfig) {
          return {
            ...defaultLandingPageConfig,
            ...storedConfig,
            hero_section: { ...defaultLandingPageConfig.hero_section, ...(storedConfig.hero_section || {}) },
            business_info: { ...defaultLandingPageConfig.business_info, ...(storedConfig.business_info || {}) },
            highlights_section: storedConfig.highlights_section || defaultLandingPageConfig.highlights_section,
            popular_dishes: storedConfig.popular_dishes || defaultLandingPageConfig.popular_dishes,
          } as LandingPageConfig;
        }
      } catch (storeErr) {
        console.warn('Fallback to defaultLandingPageConfig:', storeErr);
      }

      return defaultLandingPageConfig;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch menu items for popular dishes dropdown
  useEffect(() => {
    const fetchMenuItems = async () => {
      const { data, error } = await supabase.from('menu_items').select('id, name').order('name');
      if (!error && data) {
        setMenuItems(data);
      }
    };
    fetchMenuItems();
  }, []);

  useEffect(() => {
    if (data) {
      setConfig(data);
    }
  }, [data]);

  // Mutation to save/update landing page config safely
  const saveConfigMutation = useMutation<LandingPageConfig, Error, LandingPageConfig>({
    mutationFn: async (newConfig: LandingPageConfig) => {
      // 1. Always persist to stores.settings.landing_page_config (active Supabase schema compatible)
      const { data: storeData, error: storeFetchErr } = await supabase
        .from('stores')
        .select('id, settings')
        .limit(1)
        .maybeSingle();

      if (storeFetchErr) throw storeFetchErr;

      if (storeData?.id) {
        const currentSettings = (storeData.settings as any) || {};
        const { error: storeUpdateErr } = await supabase
          .from('stores')
          .update({
            settings: {
              ...currentSettings,
              landing_page_config: newConfig,
            }
          })
          .eq('id', storeData.id);

        if (storeUpdateErr) throw storeUpdateErr;
      }

      // 2. Also try writing to landing_page_config table if table exists
      try {
        if (newConfig.id) {
          await supabase
            .from('landing_page_config')
            .update(newConfig)
            .eq('id', newConfig.id);
        } else {
          await supabase
            .from('landing_page_config')
            .insert(newConfig);
        }
      } catch (e) {
        // Table not present in schema cache, safely ignored since stores.settings is already saved
      }

      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landingPageConfig'] });
      queryClient.invalidateQueries({ queryKey: ['store'] });
      toast.success('🎉 Konfigurasi homepage Warung J&J berjaya disimpan!');
    },
    onError: (err) => {
      toast.error(`Gagal menyimpan konfigurasi: ${err.message}`);
    },
  });

  const handleChange = (section: keyof LandingPageConfig, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...((prev[section] || {}) as object),
        [field]: value,
      },
    }));
  };

  const handleHighlightChange = (index: number, field: keyof Highlight, value: string) => {
    const newHighlights = [...config.highlights_section];
    newHighlights[index] = { ...newHighlights[index], [field]: value };
    setConfig((prev) => ({ ...prev, highlights_section: newHighlights }));
  };

  const addHighlight = () => {
    setConfig((prev) => ({
      ...prev,
      highlights_section: [
        ...prev.highlights_section,
        { id: Math.random().toString(), title: '', description: '', image_url: '' },
      ],
    }));
  };

  const removeHighlight = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      highlights_section: prev.highlights_section.filter((h) => h.id !== id),
    }));
  };

  const handlePopularDishesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map((option) => option.value);
    setConfig((prev) => ({ ...prev, popular_dishes: selectedOptions }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveConfigMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center shadow-xs">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600">Memuatkan konfigurasi homepage...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Globe className="w-6 h-6 text-purple-600" />
            <span>Pengurusan Homepage Laman Web</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Urus tajuk hero, sorotan istimewa, status delivery, dan info premis di halaman utama warungjnj.online
          </p>
        </div>
        
        <Button 
          type="button" 
          onClick={handleSubmit} 
          disabled={saveConfigMutation.isPending}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black px-6 py-2.5 rounded-2xl shadow-sm active:scale-95 transition-all text-sm flex items-center gap-2 cursor-pointer ring-1 ring-orange-400"
        >
          <Save className="w-4 h-4" />
          <span>{saveConfigMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* HERO SECTION */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Hero Banner Utama</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="headline" className="text-xs font-bold text-slate-700">Tajuk Utama (Headline)</Label>
              <Input
                id="headline"
                value={config.hero_section.headline}
                onChange={(e) => handleChange('hero_section', 'headline', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-semibold"
                placeholder="cth: Selamat Datang ke Warung J&J"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="subheadline" className="text-xs font-bold text-slate-700">Penerangan / Subheadline</Label>
              <Textarea
                id="subheadline"
                value={config.hero_section.subheadline}
                onChange={(e) => handleChange('hero_section', 'subheadline', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-normal min-h-[70px]"
                placeholder="cth: Sajian Tradisional Penuh Kehangatan, Dihantar Terus ke Meja Anda!"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="badge_text" className="text-xs font-bold text-slate-700">Teks Lencana (Badge Text)</Label>
              <Input
                id="badge_text"
                value={config.hero_section.badge_text}
                onChange={(e) => handleChange('hero_section', 'badge_text', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-medium"
                placeholder="cth: Buka Sekarang / Delivery Aktif"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hero_image_url" className="text-xs font-bold text-slate-700">URL Gambar Hero</Label>
              <Input
                id="hero_image_url"
                value={config.hero_section.hero_image_url}
                onChange={(e) => handleChange('hero_section', 'hero_image_url', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-mono"
                placeholder="/logo.png atau URL imej"
              />
            </div>

            <div className="md:col-span-2 p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm font-bold text-slate-900">Status Pesanan Delivery</span>
                <p className="text-xs text-slate-500">Kawalan buka atau tutup sementara pesanan penghantaran rider di landing page</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="is_delivery_enabled"
                  checked={config.hero_section.is_delivery_enabled}
                  onCheckedChange={(checked) => handleChange('hero_section', 'is_delivery_enabled', checked)}
                />
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  config.hero_section.is_delivery_enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {config.hero_section.is_delivery_enabled ? '🟢 Buka' : '🔴 Tutup Sementara'}
                </span>
              </div>
            </div>

            {!config.hero_section.is_delivery_enabled && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="delivery_status_note" className="text-xs font-bold text-rose-800">Nota Sebab Ditutup</Label>
                <Input
                  id="delivery_status_note"
                  value={config.hero_section.delivery_status_note}
                  onChange={(e) => handleChange('hero_section', 'delivery_status_note', e.target.value)}
                  className="bg-rose-50/40 border-rose-200 focus:bg-white rounded-xl text-sm font-medium"
                  placeholder="cth: Dibuka semula jam 5:00 petang / Hujan lebat"
                />
              </div>
            )}
          </div>
        </div>

        {/* HIGHLIGHTS SECTION */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Sorotan Istimewa (Highlights)</h3>
            </div>
            <Button
              type="button"
              onClick={addHighlight}
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Sorotan</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {config.highlights_section.map((highlight, index) => (
              <div key={highlight.id || index} className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 relative group">
                <div className="flex items-center justify-between pr-8">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Sorotan #{index + 1}
                  </span>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-600">Tajuk Sorotan</Label>
                  <Input
                    value={highlight.title}
                    onChange={(e) => handleHighlightChange(index, 'title', e.target.value)}
                    className="bg-white border-slate-200 rounded-xl text-xs font-bold"
                    placeholder="cth: Sambal Gesek Kaw-Kaw"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-600">Penerangan Ringkas</Label>
                  <Textarea
                    value={highlight.description}
                    onChange={(e) => handleHighlightChange(index, 'description', e.target.value)}
                    className="bg-white border-slate-200 rounded-xl text-xs min-h-[50px]"
                    placeholder="cth: Pedas Menyengat, Bikin Ketagihan!"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-bold text-slate-600">URL Gambar</Label>
                  <Input
                    value={highlight.image_url}
                    onChange={(e) => handleHighlightChange(index, 'image_url', e.target.value)}
                    className="bg-white border-slate-200 rounded-xl text-xs font-mono"
                    placeholder="/logo.png atau URL imej"
                  />
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeHighlight(highlight.id)}
                  className="absolute top-3 right-3 p-1.5 h-8 w-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-200"
                  title="Padam Sorotan Ini"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* POPULAR DISHES MULTI-SELECT */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <UtensilsCrossed className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Hidangan Paling Digemari (Popular Dishes)</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="popular_dishes" className="text-xs font-bold text-slate-700">
              Pilih Hidangan untuk Dipaparkan (Tahan kekunci Ctrl/Cmd untuk pilih lebih daripada satu)
            </Label>
            <select
              id="popular_dishes"
              multiple
              value={config.popular_dishes}
              onChange={handlePopularDishesChange}
              className="w-full min-h-[140px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {menuItems.map((item) => (
                <option key={item.id} value={item.id} className="p-1 rounded hover:bg-orange-50">
                  {item.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 font-mono">
              {config.popular_dishes.length} hidangan dipilih untuk paparan popular.
            </p>
          </div>
        </div>

        {/* BUSINESS INFO */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Maklumat Premis & Waktu Operasi</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="operating_hours" className="text-xs font-bold text-slate-700">Waktu Operasi Kedai</Label>
              <Input
                id="operating_hours"
                value={config.business_info.operating_hours}
                onChange={(e) => handleChange('business_info', 'operating_hours', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-medium"
                placeholder="cth: Isnin - Ahad: 10:00 AM - 10:00 PM"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone_number" className="text-xs font-bold text-slate-700">Nombor Telefon Kedai</Label>
              <Input
                id="phone_number"
                value={config.business_info.phone_number}
                onChange={(e) => handleChange('business_info', 'phone_number', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-medium"
                placeholder="cth: +6012-3456789"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="address" className="text-xs font-bold text-slate-700">Alamat Lengkap Premis</Label>
              <Textarea
                id="address"
                value={config.business_info.address}
                onChange={(e) => handleChange('business_info', 'address', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-medium min-h-[60px]"
                placeholder="cth: Warung J&J, Jalan Penampang, Sabah"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="google_maps_link" className="text-xs font-bold text-slate-700">Pautan Lokasi Google Maps</Label>
              <Input
                id="google_maps_link"
                value={config.business_info.google_maps_link}
                onChange={(e) => handleChange('business_info', 'google_maps_link', e.target.value)}
                className="bg-slate-50 border-slate-200 focus:bg-white rounded-xl text-sm font-mono"
                placeholder="https://maps.google.com/?q=..."
              />
            </div>
          </div>
        </div>

        {/* BOTTOM SUBMIT BUTTON */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={saveConfigMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black px-8 py-3 rounded-2xl shadow-sm active:scale-95 transition-all text-base flex items-center gap-2 cursor-pointer ring-1 ring-orange-400"
          >
            <Save className="w-5 h-5" />
            <span>{saveConfigMutation.isPending ? 'Menyimpan...' : 'Simpan & Terbitkan Perubahan'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

