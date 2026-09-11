import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Receipt, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Eye, 
  Loader2, 
  Store, 
  MessageSquare, 
  ArrowRight 
} from 'lucide-react';
import { 
  ReceiptCustomConfig, 
  DEFAULT_RECEIPT_CONFIG, 
  fetchReceiptConfigFromSupabase, 
  syncReceiptConfigToSupabase, 
  resetReceiptConfigToDefault 
} from '@/lib/receipt-config';

interface ReceiptCustomizerProps {
  storeId?: string;
  storeData?: {
    name?: string;
    phone_number?: string;
    logo_url?: string;
  };
}

const PRESET_FOOTERS = [
  {
    title: 'Mesra Tradisional (Asal)',
    line1: 'Terima Kasih Atas Pesanan Anda!',
    line2: 'Sila Datang Lagi.',
    note: ''
  },
  {
    title: 'Media Sosial & Promosi',
    line1: 'Terima Kasih Atas Sokongan Anda! 🌟',
    line2: 'Kongsi & Tag Kami di IG/TikTok: @warungjnj',
    note: 'Tunjukkan resit ini untuk 5% diskaun kunjungan seterusnya!'
  },
  {
    title: 'Ringkas & Pantas',
    line1: 'JUMPA LAGI!',
    line2: 'Kepuasan Anda Keutamaan Warung J&J',
    note: ''
  },
  {
    title: 'Pesanan Hotline & Katering',
    line1: 'Terima Kasih Menjamu Selera Bersama Kami!',
    line2: 'Untuk Tempahan Katering: 017-222 1784',
    note: 'Buka Setiap Hari Kecuali Isnin'
  }
];

export function ReceiptCustomizer({ storeId, storeData }: ReceiptCustomizerProps) {
  const [config, setConfig] = useState<ReceiptCustomConfig>(DEFAULT_RECEIPT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    setIsLoading(true);
    fetchReceiptConfigFromSupabase(storeId)
      .then((data) => {
        if (data) {
          setConfig(data);
        } else if (storeData?.name) {
          setConfig(prev => ({
            ...prev,
            store_name: storeData.name?.toUpperCase() || prev.store_name,
            phone_number: storeData.phone_number || prev.phone_number
          }));
        }
      })
      .catch((err) => console.warn('Failed to load receipt config:', err))
      .finally(() => setIsLoading(false));

    const handleUpdate = (e: any) => {
      if (e?.detail) setConfig(e.detail);
    };
    window.addEventListener('warung_receipt_config_updated', handleUpdate);
    return () => window.removeEventListener('warung_receipt_config_updated', handleUpdate);
  }, [storeId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await syncReceiptConfigToSupabase(config, storeId);
      if (success) {
        toast.success('Tetapan ayat resit berjaya disimpan & dikemaskini ke cloud! 📄✨');
      } else {
        toast.error('Gagal menyimpan tetapan resit ke pangkalan data.');
      }
    } catch (err: any) {
      toast.error('Ralat: ' + (err.message || 'Gagal menyimpan'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Adakah anda pasti mahu memulihkan semua tetapan ayat resit ke teks asal?')) return;
    setIsSaving(true);
    try {
      const reset = await resetReceiptConfigToDefault(storeId);
      setConfig(reset);
      toast.success('Ayat resit telah dipulihkan ke teks lalai asal.');
    } catch (err: any) {
      toast.error('Gagal memulihkan: ' + (err.message || 'Ralat'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_FOOTERS[0]) => {
    setConfig(prev => ({
      ...prev,
      footer_line_1: preset.line1,
      footer_line_2: preset.line2,
      custom_footer_note: preset.note
    }));
    toast.info('Preset "' + preset.title + '" diterapkan! Sila klik Simpan.');
  };

  return (
    <Card className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-700 border border-amber-500/20 shrink-0">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Tetapan Format & Ayat Resit Cetakan</span>
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                  Thermal 58mm / 80mm
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-mono mt-0.5">
                Ubah teks tajuk, nombor telefon, label juruwang, dan ayat ucapan terima kasih pada resit pelanggan.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 font-mono text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={'px-3 py-1.5 rounded-lg font-bold transition-all ' + (activeTab === 'edit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
              >
                ✏️ Edit Ayat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={'px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ' + (activeTab === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900')}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Pratonton Resit</span>
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 font-mono text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            <span>Memuatkan konfigurasi resit...</span>
          </div>
        ) : activeTab === 'edit' ? (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 font-mono uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Pilih Contoh Ayat Pantas (Presets)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono">
                {PRESET_FOOTERS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/40 transition-all text-xs group cursor-pointer"
                  >
                    <div className="font-bold text-slate-900 group-hover:text-amber-700 flex items-center justify-between">
                      <span>{preset.title}</span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 italic">
                      "{preset.line1}"
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <Store className="w-4 h-4 text-amber-600" />
                <span>1. Bahagian Kepala Resit (Header)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">Nama Premis Pada Resit</Label>
                  <Input
                    value={config.store_name}
                    onChange={e => setConfig(prev => ({ ...prev, store_name: e.target.value }))}
                    placeholder="WARUNG J&J"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs font-bold"
                  />
                  <p className="text-[10px] text-slate-400 font-mono">Dipaparkan besar di bahagian atas resit.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">Lokasi / Sub-Header</Label>
                  <Input
                    value={config.store_sub_header}
                    onChange={e => setConfig(prev => ({ ...prev, store_sub_header: e.target.value }))}
                    placeholder="Penampang, Sabah"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400 font-mono">Cawangan atau lokasi premis.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">No. Telefon Hotline / WhatsApp</Label>
                  <Input
                    value={config.phone_number}
                    onChange={e => setConfig(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="60172221784"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">Prefix Nombor Pesanan</Label>
                  <Input
                    value={config.order_id_prefix}
                    onChange={e => setConfig(prev => ({ ...prev, order_id_prefix: e.target.value }))}
                    placeholder="ORDER #"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Paparkan Logo Warung</p>
                    <p className="text-[10px] text-slate-500 font-mono">Cetak logo bulat Warung J&J di bahagian atas</p>
                  </div>
                  <Switch
                    checked={config.show_logo}
                    onCheckedChange={checked => setConfig(prev => ({ ...prev, show_logo: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Paparkan Nota Khas Masakan</p>
                    <p className="text-[10px] text-slate-500 font-mono">Cth: "kurang manis", "pedas berapi"</p>
                  </div>
                  <Switch
                    checked={config.show_notes}
                    onCheckedChange={checked => setConfig(prev => ({ ...prev, show_notes: checked }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <MessageSquare className="w-4 h-4 text-amber-600" />
                <span>2. Bahagian Bawah Resit (Ayat Ucapan & Nota Kaki)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">Ayat Utama (Baris 1 - Tebal / Bold)</Label>
                  <Input
                    value={config.footer_line_1}
                    onChange={e => setConfig(prev => ({ ...prev, footer_line_1: e.target.value }))}
                    placeholder="Terima Kasih Atas Pesanan Anda!"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">Ayat Kedua (Baris 2)</Label>
                  <Input
                    value={config.footer_line_2}
                    onChange={e => setConfig(prev => ({ ...prev, footer_line_2: e.target.value }))}
                    placeholder="Sila Datang Lagi."
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 font-mono">
                    Nota Tambahan / Promosi / Media Sosial (Pilihan)
                  </Label>
                  <Input
                    value={config.custom_footer_note || ''}
                    onChange={e => setConfig(prev => ({ ...prev, custom_footer_note: e.target.value }))}
                    placeholder="Contoh: Follow Instagram & TikTok kami: @warungjnj"
                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl font-mono text-xs"
                  />
                  <p className="text-[10px] text-slate-400 font-mono">
                    Akan dipaparkan di bawah ayat ucapan terima kasih pada resit.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSaving}
                className="w-full sm:w-auto border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-mono text-xs rounded-xl flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Pulihkan ke Asal</span>
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Tetapan Resit 💾</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 bg-slate-100/70 rounded-2xl border border-slate-200 p-4">
            <div className="w-[280px] bg-white text-black p-5 font-mono text-[11px] leading-tight border border-slate-300 shadow-xl rounded-sm">
              <div className="text-center space-y-1">
                {config.show_logo && (
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="w-16 h-16 mx-auto rounded-full object-cover border border-slate-300 filter grayscale"
                  />
                )}
                <div className="font-black text-sm tracking-wide mt-1">
                  {config.store_name || 'WARUNG J&J'}
                </div>
                {config.store_sub_header && (
                  <div className="text-[10px]">{config.store_sub_header}</div>
                )}
                {config.phone_number && (
                  <div className="text-[10px]">Tel: {config.phone_number}</div>
                )}
              </div>

              <div className="my-3 p-1.5 border border-black text-center">
                <div className="font-black text-xs">{(config.order_id_prefix || 'ORDER #') + 'E2A52BA7'}</div>
                <div className="font-bold text-[10px] mt-0.5">DINE-IN [ MEJA A1 ]</div>
              </div>

              <div className="text-[10px] space-y-0.5 pb-2 border-b-2 border-black">
                <div className="flex justify-between">
                  <span>Masa: 03:50 pm</span>
                  <span>11/09/2026</span>
                </div>
                <div className="flex justify-between">
                  <span>{(config.cashier_label || 'Juruwang:') + ' Staff'}</span>
                  <span>(1 Item)</span>
                </div>
              </div>

              <div className="py-2 space-y-1.5 border-b border-dashed border-black">
                <div className="flex justify-between font-bold">
                  <span>[1x] Chicken Popcorn</span>
                  <span>RM 10.00</span>
                </div>
                {config.show_notes && (
                  <div className="text-[9px] italic text-slate-700 pl-2">
                    * Nota: DINE IN (Makan Sini) | "tambah nasi"
                  </div>
                )}
              </div>

              <div className="py-2 text-[10px] space-y-1 border-b-2 border-black">
                <div className="flex justify-between">
                  <span>Jumlah Kuantiti</span>
                  <span>1 item</span>
                </div>
                <div className="border-t border-dashed border-black my-1"></div>
                <div className="flex justify-between font-black text-xs">
                  <span>JUMLAH BESAR</span>
                  <span>RM 10.00</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Status Bayaran</span>
                  <span>SUDAH BAYAR (CASH)</span>
                </div>
              </div>

              <div className="text-center pt-3 space-y-1">
                <div className="font-bold text-xs">{config.footer_line_1}</div>
                {config.footer_line_2 && (
                  <div className="text-[10px]">{config.footer_line_2}</div>
                )}
                {config.custom_footer_note && (
                  <div className="text-[9px] font-bold mt-2 pt-1 border-t border-dotted border-slate-400">
                    {config.custom_footer_note}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs rounded-xl px-4 py-2"
              >
                ✏️ Kembali Ke Edit Ayat
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
