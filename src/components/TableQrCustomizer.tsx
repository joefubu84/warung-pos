import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  QrCode, 
  Printer, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Eye, 
  Check, 
  Loader2, 
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import { 
  TableQrConfig, 
  DEFAULT_TABLE_QR_CONFIG, 
  fetchTableQrConfigFromSupabase, 
  syncTableQrConfigToSupabase, 
  resetTableQrConfigToDefault 
} from '@/lib/table-qr-config';

interface TableQrCustomizerProps {
  storeId?: string;
  onOpenPrintModal?: () => void;
}

const PRESET_NOTICES = [
  {
    title: 'Medan Selera Kongsi (Asal)',
    desc: 'Mesra peniaga lain, mengesahkan pelanggan bebas menikmati makanan dari mana-mana gerai',
    text: "Meja Kongsi: Anda dialu-alukan menikmati makanan daripada mana-mana gerai pilihan anda. Pesanan menu Warung J&J akan terus dihantar ke meja ini oleh kru kami!"
  },
  {
    title: 'Medan Selera Ringkas',
    desc: 'Ayat lebih padat dan terus ke maksud',
    text: "Meja Kongsi: Nikmati makanan pilihan anda daripada mana-mana gerai. Pesanan Warung J&J akan dihantar terus ke meja ini."
  },
  {
    title: 'Warung Santai / Mesra',
    desc: 'Sesuai jika meja khusus atau suasana santai keluarga',
    text: "Selamat Menjamu Selera! Anda dialu-alukan duduk di sini. Pesanan menu panas & minuman Warung J&J akan terus dihantar ke meja anda."
  }
];

export function TableQrCustomizer({ storeId, onOpenPrintModal }: TableQrCustomizerProps) {
  const [config, setConfig] = useState<TableQrConfig>(DEFAULT_TABLE_QR_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    setIsLoading(true);
    fetchTableQrConfigFromSupabase(storeId)
      .then((data) => {
        if (data) setConfig(data);
      })
      .catch((err) => {
        console.warn('Failed to load table QR config:', err);
      })
      .finally(() => setIsLoading(false));

    const handleUpdate = (e: any) => {
      if (e?.detail) setConfig(e.detail);
    };
    window.addEventListener('warung_table_qr_config_updated', handleUpdate);
    return () => window.removeEventListener('warung_table_qr_config_updated', handleUpdate);
  }, [storeId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await syncTableQrConfigToSupabase(config, storeId);
      if (success) {
        toast.success('Tetapan ayat pelekat kod QR meja berjaya disimpan!');
      } else {
        toast.error('Gagal menyimpan tetapan ke pangkalan data.');
      }
    } catch (err: any) {
      toast.error(`Ralat: ${err.message || 'Gagal menyimpan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Adakah anda pasti mahu memulihkan semua ayat pelekat QR ke ayat asal?')) return;
    setIsSaving(true);
    try {
      const reset = await resetTableQrConfigToDefault(storeId);
      setConfig(reset);
      toast.success('Ayat pelekat QR telah dipulihkan ke teks asal.');
    } catch (err: any) {
      toast.error(`Ralat: ${err.message || 'Gagal menetapkan semula'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (text: string) => {
    setConfig(prev => ({ ...prev, shared_table_notice: text }));
    toast.success('Contoh ayat meja kongsi dimuatkan!');
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        <span>Memuatkan tetapan pelekat QR meja...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-black mb-2">
            <QrCode className="w-3.5 h-3.5" />
            <span>Pelekat Meja Fizikal (Standee / Sticker)</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Tetapan Ayat &amp; Pelekat Kod QR Meja</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Ubah suai ayat jemputan mesra meja kongsi medan selera, tajuk seruan imbas, dan panduan pesanan pada pelekat QR meja (Meja A1 hingga A15) mengikut kesesuaian warung anda.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/tables"
            className="inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 border border-slate-200 cursor-pointer"
            title="Buka halaman pengurusan meja & cetak pelekat"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Cetak di Halaman Meja ↗</span>
          </a>

          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            className="border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold rounded-xl h-10 px-3 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Ayat Asal</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl h-10 px-4.5 shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                <span>Simpan Ayat 💾</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT: FORM INPUTS + LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        
        {/* LEFT COLUMN: FORM CONTROLS (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. NOTA MEJA KONGSI MEDAN SELERA (THE MAIN REQUESTED TEXT) */}
          <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-4.5 space-y-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label htmlFor="shared_table_notice" className="text-sm font-black text-amber-950 flex items-center gap-1.5">
                  <span>🤝 Nota Meja Kongsi Medan Selera (Courtesy Notice)</span>
                </Label>
                <p className="text-[11px] text-amber-800/90 mt-0.5 leading-normal">
                  Ayat penting agar peniaga gerai bersebelahan tidak tersinggung atau marah apabila pelekat QR dilekatkan di meja kongsi medan selera.
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded-md shrink-0">
                Wajib Mesra
              </span>
            </div>

            <Textarea
              id="shared_table_notice"
              rows={3}
              value={config.shared_table_notice}
              onChange={(e) => setConfig(prev => ({ ...prev, shared_table_notice: e.target.value }))}
              placeholder="Masukkan ayat meja kongsi..."
              className="bg-white border-amber-300/80 text-amber-950 font-medium text-xs leading-relaxed rounded-xl focus:border-orange-500 shadow-2xs resize-none"
            />

            {/* QUICK PRESETS */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block">
                Pilih Contoh Ayat Pantas:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_NOTICES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(preset.text)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 transition-all cursor-pointer shadow-2xs"
                    title={preset.desc}
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. TAJUK & SUB-TAJUK SERUAN PESANAN (CALL TO ACTION) */}
          <div className="space-y-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>📲 Seruan Tindakan Pelanggan (Call To Action)</span>
            </h3>

            <div className="space-y-1.5">
              <Label htmlFor="cta_title" className="text-xs font-bold text-slate-700">
                Tajuk Seruan Utama (Bahasa Melayu)
              </Label>
              <Input
                id="cta_title"
                value={config.cta_title}
                onChange={(e) => setConfig(prev => ({ ...prev, cta_title: e.target.value }))}
                placeholder="cth: 📲 IMBAS UNTUK LIHAT MENU & PESAN"
                className="bg-white border-slate-200 text-xs font-bold rounded-xl font-mono text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cta_subtitle" className="text-xs font-bold text-slate-700">
                Sub-Tajuk Seruan (Bahasa Inggeris / Dwibahasa)
              </Label>
              <Input
                id="cta_subtitle"
                value={config.cta_subtitle}
                onChange={(e) => setConfig(prev => ({ ...prev, cta_subtitle: e.target.value }))}
                placeholder="cth: Scan me to view & order at Warung J&J"
                className="bg-white border-slate-200 text-xs font-medium rounded-xl text-slate-900"
              />
            </div>
          </div>

          {/* 3. KETERANGAN GERAI (STALL SUBTITLE) */}
          <div className="space-y-1.5">
            <Label htmlFor="stall_subtitle" className="text-xs font-bold text-slate-700">
              Keterangan Ringkas Bawah Nama Gerai
            </Label>
            <Input
              id="stall_subtitle"
              value={config.stall_subtitle}
              onChange={(e) => setConfig(prev => ({ ...prev, stall_subtitle: e.target.value }))}
              placeholder="cth: Masakan Panas & Minuman"
              className="bg-slate-50 border-slate-200 text-xs font-bold rounded-xl text-orange-600"
            />
          </div>

          {/* 4. PANDUAN 3 LANGKAH PESANAN */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">
              Panduan 3 Langkah Pesanan (Bahagian Tengah Bawah)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Langkah 1:</span>
                <Input
                  value={config.step_1}
                  onChange={(e) => setConfig(prev => ({ ...prev, step_1: e.target.value }))}
                  className="bg-slate-50 border-slate-200 text-xs rounded-xl"
                  placeholder="1. Buka Kamera"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Langkah 2:</span>
                <Input
                  value={config.step_2}
                  onChange={(e) => setConfig(prev => ({ ...prev, step_2: e.target.value }))}
                  className="bg-slate-50 border-slate-200 text-xs rounded-xl"
                  placeholder="2. Imbas QR"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Langkah 3:</span>
                <Input
                  value={config.step_3}
                  onChange={(e) => setConfig(prev => ({ ...prev, step_3: e.target.value }))}
                  className="bg-slate-50 border-slate-200 text-xs rounded-xl"
                  placeholder="3. Pilih & Pesan"
                />
              </div>
            </div>
          </div>

          {/* 5. NOTA GUNTING / PANDUAN BAWAH */}
          <div className="space-y-1.5">
            <Label htmlFor="footer_note" className="text-xs font-bold text-slate-700">
              Teks Panduan Bawah (Sebelah Pautan URL Meja)
            </Label>
            <Input
              id="footer_note"
              value={config.footer_note}
              onChange={(e) => setConfig(prev => ({ ...prev, footer_note: e.target.value }))}
              placeholder="cth: ✂️ Gunting ikut garisan"
              className="bg-slate-50 border-slate-200 text-xs rounded-xl text-slate-500"
            />
          </div>

          {/* SAVE BUTTON AT BOTTOM OF FORM */}
          <div className="pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-2xl h-12 shadow-lg shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Menyimpan Tetapan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  <span>Simpan Ayat Pelekat Meja 💾</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE INTERACTIVE PREVIEW CARD (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Pratonton Cetakan Masa Nyata
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Live Preview
            </span>
          </div>

          {/* MOCKUP CARD (EXACT REPLICA OF THE PRINTED STICKER) */}
          <div className="w-full max-w-[320px] bg-white border-2 border-dashed border-slate-400 rounded-3xl p-4 flex flex-col justify-between items-center text-center shadow-lg relative overflow-hidden">
            
            {/* TOP BRAND ACCENT HEADER */}
            <div className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 text-white py-1 px-3 rounded-2xl flex items-center justify-between shadow-2xs mb-2">
              <div className="flex items-center gap-1.5 text-left">
                <span className="text-xs">🍲</span>
                <span className="text-[10px] font-black uppercase tracking-wider">Warung J&amp;J</span>
              </div>
              <span className="text-[9px] font-bold bg-white/20 px-2 py-0.2 rounded-full uppercase tracking-widest font-mono">
                QR Order
              </span>
            </div>

            {/* STALL LOGO & TABLE NUMBER BANNER */}
            <div className="w-full flex items-center justify-between px-1 mb-1">
              <div className="flex items-center gap-2 text-left">
                <img
                  src="/logo.png"
                  alt="Warung J&J"
                  className="w-10 h-10 rounded-full object-cover border-2 border-orange-500 shadow-2xs shrink-0"
                />
                <div>
                  <h4 className="text-xs font-black text-slate-900 leading-tight">
                    Warung J&amp;J
                  </h4>
                  <span className="text-[9px] font-extrabold text-orange-600 block">
                    {config.stall_subtitle || 'Masakan Panas & Minuman'}
                  </span>
                </div>
              </div>

              <div className="bg-orange-50 border-2 border-orange-400 rounded-2xl px-3 py-1 shadow-2xs text-center">
                <span className="text-[8px] font-black text-orange-700 block uppercase tracking-wider leading-none">
                  NOMBOR
                </span>
                <span className="text-base font-black text-slate-900 font-mono leading-none">
                  MEJA A1
                </span>
              </div>
            </div>

            {/* HIGH RESOLUTION QR CODE */}
            <div className="p-2.5 bg-white border-2 border-slate-900 rounded-2xl shadow-xs my-1">
              <QRCodeSVG
                value="https://warungjnj.online/t/preview-sample"
                size={125}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* FRIENDLY CALL TO ACTION */}
            <div className="w-full space-y-1 my-1">
              <div className="bg-slate-900 text-white py-1 px-2 rounded-xl">
                <p className="text-[10.5px] font-black tracking-tight leading-tight">
                  {config.cta_title || '📲 IMBAS UNTUK LIHAT MENU & PESAN'}
                </p>
                <p className="text-[8.5px] text-orange-300 font-semibold leading-none mt-0.5">
                  {config.cta_subtitle || 'Scan me to view & order at Warung J&J'}
                </p>
              </div>

              {/* COURTEOUS SHARED TABLE NOTICE (RESPECT NEIGHBOR STALLS) */}
              <div className="p-2 bg-amber-50/90 border border-amber-200 rounded-xl text-left">
                <div className="flex items-start gap-1.5">
                  <span className="text-xs leading-none shrink-0 mt-0.5">🤝</span>
                  <p className="text-[8.5px] text-amber-950 font-medium leading-snug break-words">
                    {config.shared_table_notice || 'Meja Kongsi...'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3 STEPS INSTRUCTIONS */}
            <div className="w-full grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 text-[7.5px] text-slate-600 font-bold">
              <div className="bg-slate-50 py-1 px-1 rounded-lg truncate">{config.step_1 || '1. Buka Kamera'}</div>
              <div className="bg-slate-50 py-1 px-1 rounded-lg truncate">{config.step_2 || '2. Imbas QR'}</div>
              <div className="bg-slate-50 py-1 px-1 rounded-lg truncate">{config.step_3 || '3. Pilih & Pesan'}</div>
            </div>

            {/* FOOTER CUTTING GUIDE NOTE */}
            <div className="w-full pt-1.5 flex justify-between items-center text-[7.5px] text-slate-400 font-mono">
              <span className="truncate max-w-[140px]">https://warungjnj.online/t/...</span>
              <span>{config.footer_note || '✂️ Gunting ikut garisan'}</span>
            </div>
          </div>

          {/* HELPER TEXT BELOW PREVIEW */}
          <div className="mt-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 text-center leading-relaxed">
            <p>💡 Perubahan teks ini akan diguna pakai secara automatik pada cetakan semua <strong>15 Meja (A1 hingga A15)</strong> di halaman Pengurusan Meja.</p>
          </div>
        </div>

      </div>
    </div>
  );
}