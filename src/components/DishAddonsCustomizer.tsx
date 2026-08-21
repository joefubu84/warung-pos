import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  CustomAddon, 
  getAddonsConfig, 
  saveAddonsConfig 
} from '@/lib/addons-config';
import { Plus, Trash2, RotateCcw, Utensils } from 'lucide-react';

const PRESET_ADDONS = [
  { name: 'Telur Mata (Fried Egg)', price: 1.50 },
  { name: 'Extra Sambal Belacan', price: 1.00 },
  { name: 'Extra Nasi Putih', price: 1.50 },
  { name: 'Kepingan Keju (Cheese)', price: 2.00 },
  { name: 'Mangkuk Sup Ekstra', price: 1.00 },
  { name: 'Keropok Keping', price: 1.00 },
  { name: 'Ayam Goreng Seketul', price: 4.50 },
  { name: 'Sambal Kicap Cili Padi', price: 0.80 },
];

export function DishAddonsCustomizer() {
  const [addons, setAddons] = useState<CustomAddon[]>([]);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('1.50');

  useEffect(() => {
    setAddons(getAddonsConfig());

    const handleUpdate = () => setAddons(getAddonsConfig());
    window.addEventListener('warung_addons_updated', handleUpdate);
    return () => window.removeEventListener('warung_addons_updated', handleUpdate);
  }, []);

  const handleAddAddon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Sila masukkan nama add-on');
      return;
    }
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Sila masukkan harga yang sah');
      return;
    }

    const newAddon: CustomAddon = {
      id: `addon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newName.trim(),
      price: Number(priceNum.toFixed(2)),
      available: true
    };

    const updated = [...addons, newAddon];
    setAddons(updated);
    saveAddonsConfig(updated);
    setNewName('');
    setNewPrice('1.50');
    toast.success(`Add-on "${newAddon.name}" (+RM ${newAddon.price.toFixed(2)}) berjaya ditambah!`);
  };

  const handleToggleAvailability = (id: string, available: boolean) => {
    const updated = addons.map(a => a.id === id ? { ...a, available } : a);
    setAddons(updated);
    saveAddonsConfig(updated);
    toast.success('Status add-on dikemaskini.');
  };

  const handleUpdatePrice = (id: string, newPriceStr: string) => {
    const priceNum = parseFloat(newPriceStr);
    if (isNaN(priceNum) || priceNum < 0) return;
    const updated = addons.map(a => a.id === id ? { ...a, price: Number(priceNum.toFixed(2)) } : a);
    setAddons(updated);
    saveAddonsConfig(updated);
  };

  const handleRemoveAddon = (id: string) => {
    const updated = addons.filter(a => a.id !== id);
    setAddons(updated);
    saveAddonsConfig(updated);
    toast.info('Add-on dipadamkan.');
  };

  const handleResetDefaults = () => {
    if (confirm('Kembalikan senarai Tambahan Pilihan (Add-ons) kepada tetapan asal warung?')) {
      const defaultAddons: CustomAddon[] = [
        { id: 'egg', name: 'Telur Mata (Fried Egg)', price: 1.50, available: true },
        { id: 'sambal', name: 'Extra Sambal Special', price: 1.00, available: true },
        { id: 'rice', name: 'Extra Nasi (Extra Rice)', price: 1.50, available: true },
        { id: 'cheese', name: 'Melted Cheese Slice', price: 2.00, available: true },
        { id: 'soup', name: 'Extra Soup Bowl', price: 1.00, available: true },
      ];
      setAddons(defaultAddons);
      saveAddonsConfig(defaultAddons);
      toast.success('Senarai add-ons dikembalikan kepada tetapan asal.');
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 text-white rounded-2xl shadow-xl overflow-hidden font-mono">
      <CardHeader className="border-b border-slate-800 pb-4 bg-slate-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-black flex items-center gap-2 text-white">
              <Utensils className="w-5 h-5 text-emerald-400" />
              <span>Pengurusan Tambahan Pilihan (*Dish Add-ons*)</span>
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Urus dan tetapkan senarai add-ons (contoh: Telur Mata, Nasi Tambah, Sambal Ekstra) yang muncul di pop-up pesanan QR meja & troli pelanggan.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white text-xs self-start sm:self-auto flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Asal</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* ADD NEW ADD-ON FORM */}
        <form onSubmit={handleAddAddon} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 shadow-inner">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Tambah Add-on Baharu
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7">
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nama Add-on</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Contoh: Telur Dadar Crispy / Ekstra Sambal"
                className="bg-slate-900 border-slate-800 text-white text-xs h-9"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Harga Tambahan (RM)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-slate-500 font-bold">RM</span>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white text-xs h-9 pl-9 font-bold"
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </Button>
            </div>
          </div>

          {/* PRESET CHIPS */}
          <div className="pt-2">
            <span className="text-[10px] text-slate-500 block mb-1.5 font-bold">💡 Cadangan Pantas (Klik untuk isi cepat):</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ADDONS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setNewName(preset.name);
                    setNewPrice(preset.price.toFixed(2));
                  }}
                  className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded-lg transition-all"
                >
                  + {preset.name} (RM {preset.price.toFixed(2)})
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* EXISTING ADD-ONS LIST */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Senarai Tambahan Pilihan Semasa ({addons.length} Add-on)
            </span>
            <span className="text-[10px] text-slate-500">Auto-simpan serta-merta</span>
          </div>

          {addons.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 text-slate-500 text-xs">
              Tiada add-on didaftarkan. Sila tambah menggunakan borang di atas.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  className={p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={p-2 rounded-lg border }>
                      <Utensils className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{addon.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-black text-emerald-400">
                          +RM {addon.price.toFixed(2)}
                        </span>
                        <span className={	ext-[9px] px-1.5 py-0.2 rounded font-bold uppercase }>
                          {addon.available ? 'Aktif' : 'Nyahaktif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* EDIT PRICE INPUT */}
                    <div className="w-20">
                      <Input
                        type="number"
                        step="0.10"
                        min="0"
                        defaultValue={addon.price.toFixed(2)}
                        onBlur={(e) => handleUpdatePrice(addon.id, e.target.value)}
                        className="h-7 text-xs bg-slate-900 border-slate-800 text-emerald-400 font-bold px-2 text-right"
                        title="Klik untuk ubah harga"
                      />
                    </div>

                    {/* AVAILABILITY SWITCH */}
                    <Switch
                      checked={addon.available}
                      onCheckedChange={(val) => handleToggleAvailability(addon.id, val)}
                    />

                    {/* REMOVE BUTTON */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAddon(addon.id)}
                      className="h-7 w-7 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30"
                      title="Padam add-on ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
