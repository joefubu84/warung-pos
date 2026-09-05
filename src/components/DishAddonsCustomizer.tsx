import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  CustomAddon, 
  getAddonsConfig, 
  saveAddonsConfig,
  syncAddonsToDatabase
} from '@/lib/addons-config';
import { 
  Plus, 
  Trash2, 
  RotateCcw, 
  Utensils, 
  RefreshCw, 
  Sparkles, 
  Pencil, 
  Image as ImageIcon, 
  Camera,
  Loader2, 
  Check 
} from 'lucide-react';

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
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingNewPhoto, setUploadingNewPhoto] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit Modal State
  const [editingAddon, setEditingAddon] = useState<CustomAddon | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editAvailable, setEditAvailable] = useState(true);
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const current = getAddonsConfig();
    setAddons(current);
    // Auto-sync existing addons to database menu_items
    syncAddonsToDatabase(current);

    const handleUpdate = () => setAddons(getAddonsConfig());
    window.addEventListener('warung_addons_updated', handleUpdate);
    return () => window.removeEventListener('warung_addons_updated', handleUpdate);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncAddonsToDatabase(addons);
      toast.success(`🎉 Berjaya menyegerakkan ${addons.length} add-on ke menu utama! Pelanggan kini boleh membeli terus dari menu.`);
    } catch (e: any) {
      toast.error('Gagal menyegerakkan: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Upload Photo for New Addon
  const handleUploadNewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingNewPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `addon_${Math.random().toString(36).substring(2, 12)}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('menu-items')
        .upload(fileName, file);

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage
        .from('menu-items')
        .getPublicUrl(fileName);

      setNewImageUrl(data.publicUrl);
      toast.success("Foto add-on berjaya dimuat naik!");
    } catch (err: any) {
      toast.error('Gagal memuat naik gambar: ' + err.message);
    } finally {
      setUploadingNewPhoto(false);
    }
  };

  // Upload Photo for Editing Addon
  const handleUploadEditPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEditPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `addon_${Math.random().toString(36).substring(2, 12)}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('menu-items')
        .upload(fileName, file);

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage
        .from('menu-items')
        .getPublicUrl(fileName);

      setEditImageUrl(data.publicUrl);
      toast.success("Foto add-on dikemaskini!");
    } catch (err: any) {
      toast.error('Gagal memuat naik gambar: ' + err.message);
    } finally {
      setUploadingEditPhoto(false);
    }
  };

  // Create Addon
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
      available: true,
      imageUrl: newImageUrl || null
    };

    const updated = [...addons, newAddon];
    setAddons(updated);
    saveAddonsConfig(updated);
    setNewName('');
    setNewPrice('1.50');
    setNewImageUrl('');
    toast.success(`Add-on "${newAddon.name}" (+RM ${newAddon.price.toFixed(2)}) berjaya ditambah & diselaraskan!`);
  };

  // Open Edit Modal
  const handleOpenEdit = (addon: CustomAddon) => {
    setEditingAddon(addon);
    setEditName(addon.name);
    setEditPrice(addon.price.toFixed(2));
    setEditImageUrl(addon.imageUrl || '');
    setEditAvailable(addon.available);
    setIsEditModalOpen(true);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddon) return;
    if (!editName.trim()) {
      toast.error('Sila masukkan nama add-on');
      return;
    }
    const priceNum = parseFloat(editPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Sila masukkan harga yang sah');
      return;
    }

    const updated = addons.map(a => {
      if (a.id === editingAddon.id) {
        return {
          ...a,
          name: editName.trim(),
          price: Number(priceNum.toFixed(2)),
          imageUrl: editImageUrl || null,
          available: editAvailable
        };
      }
      return a;
    });

    setAddons(updated);
    saveAddonsConfig(updated);
    setIsEditModalOpen(false);
    toast.success(`Add-on "${editName}" berjaya dikemaskini!`);
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
    const target = addons.find(a => a.id === id);
    const targetName = target?.name || 'Add-on';

    if (confirm(`Adakah anda pasti mahu memadam add-on "${targetName}"?`)) {
      const updated = addons.filter(a => a.id !== id);
      setAddons(updated);
      saveAddonsConfig(updated);
      toast.info(`Add-on "${targetName}" telah dipadam.`);
    }
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
    <>
      <Card className="bg-white border-slate-200/90 text-slate-900 rounded-3xl shadow-xs overflow-hidden font-sans">
        <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
                <Utensils className="w-5 h-5 text-orange-600" />
                <span>Pengurusan Tambahan Pilihan (*Dish Add-ons*)</span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Urus, edit gambar, harga dan nama add-ons. Semua item diselaraskan secara automatik ke menu pelanggan (QR & Delivery).
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isSyncing}
                onClick={handleManualSync}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-orange-500/20 rounded-xl h-8 px-3"
              >
                {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isSyncing ? 'Sedang Selaras...' : 'Selaraskan ke Menu Utama'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs flex items-center gap-1.5 rounded-xl h-8 px-3"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Asal</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* ADD NEW ADD-ON FORM */}
          <form onSubmit={handleAddAddon} className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 shadow-2xs">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Tambah Add-on / Sampingan Baharu
            </span>

            {/* PHOTO PREVIEW & UPLOAD (DIRECT CAMERA OR GALLERY) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                {newImageUrl ? (
                  <img src={newImageUrl} alt="Addon Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-7 h-7 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* DIRECT CAMERA SNAP BUTTON */}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs">
                    {uploadingNewPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>{uploadingNewPhoto ? 'Memproses...' : '📸 Ambil Gambar Terus (Kamera)'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleUploadNewPhoto} 
                      disabled={uploadingNewPhoto} 
                      className="hidden" 
                    />
                  </label>

                  {/* GALLERY / FILE PICKER BUTTON */}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Pilih dari Galeri / Fail</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleUploadNewPhoto} 
                      disabled={uploadingNewPhoto} 
                      className="hidden" 
                    />
                  </label>

                  {newImageUrl && (
                    <button 
                      type="button" 
                      onClick={() => setNewImageUrl('')} 
                      className="text-xs text-rose-600 hover:underline px-2 py-1 font-bold"
                    >
                      Buang foto
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 font-sans">
                  💡 Ambil gambar guna kamera telefon secara terus atau pilih gambar makanan yang sedia ada dari galeri.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Nama Add-on</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Telur Dadar Crispy / Ekstra Sambal"
                  className="bg-white border-slate-200 text-slate-900 text-xs h-9 rounded-xl shadow-2xs"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Harga Tambahan (RM)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">RM</span>
                  <Input
                    type="number"
                    step="0.10"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="bg-white border-slate-200 text-slate-900 text-xs h-9 pl-9 font-bold rounded-xl shadow-2xs"
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex items-end">
                <Button
                  type="submit"
                  disabled={uploadingNewPhoto}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-9 text-xs flex items-center justify-center gap-1 rounded-xl shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah
                </Button>
              </div>
            </div>

            {/* PRESET CHIPS */}
            <div className="pt-1">
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
                    className="text-[10px] bg-white hover:bg-orange-50 text-slate-700 border border-slate-200 hover:border-orange-300 px-2 py-1 rounded-lg transition-all shadow-2xs"
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Senarai Tambahan Pilihan Semasa ({addons.length} Add-on)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Auto-simpan & selaras serta-merta</span>
            </div>

            {addons.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
                Tiada add-on didaftarkan. Sila tambah menggunakan borang di atas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      addon.available
                        ? 'bg-white border-slate-200/90 hover:border-orange-200 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* THUMBNAIL PHOTO OR ICON */}
                      <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {addon.imageUrl ? (
                          <img src={addon.imageUrl} alt={addon.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${
                            addon.available ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-slate-100'
                          }`}>
                            <Utensils className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{addon.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-black text-orange-600 font-mono">
                            +RM {addon.price.toFixed(2)}
                          </span>
                          <span className={`text-[9px] px-2 py-0.2 rounded-full font-bold uppercase ${
                            addon.available ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {addon.available ? 'Aktif' : 'Nyahaktif'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* EDIT BUTTON (PENCIL) */}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleOpenEdit(addon)}
                        className="h-8 w-8 text-amber-700 hover:bg-amber-50 border-amber-200 rounded-xl"
                        title="Edit nama, harga & gambar add-on"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      {/* AVAILABILITY SWITCH */}
                      <Switch
                        checked={addon.available}
                        onCheckedChange={(val) => handleToggleAvailability(addon.id, val)}
                      />

                      {/* REMOVE BUTTON */}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveAddon(addon.id)}
                        className="h-8 w-8 text-rose-700 hover:bg-rose-50 border-rose-200 rounded-xl"
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

      {/* EDIT ADDON DIALOG MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-white border-slate-200/90 text-slate-900 max-w-md font-sans rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-slate-900">
              <Pencil className="w-4 h-4 text-orange-500" />
              <span>Edit Add-on / Sampingan</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
            {/* PHOTO UPLOAD IN MODAL (DIRECT CAMERA OR GALLERY) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                {editImageUrl ? (
                  <img src={editImageUrl} alt="Addon Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-7 h-7 text-slate-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* DIRECT CAMERA SNAP BUTTON */}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs">
                    {uploadingEditPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    <span>{uploadingEditPhoto ? 'Memproses...' : '📸 Kamera Terus'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleUploadEditPhoto} 
                      disabled={uploadingEditPhoto} 
                      className="hidden" 
                    />
                  </label>

                  {/* GALLERY / FILE PICKER BUTTON */}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Galeri / Fail</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleUploadEditPhoto} 
                      disabled={uploadingEditPhoto} 
                      className="hidden" 
                    />
                  </label>

                  {editImageUrl && (
                    <button 
                      type="button" 
                      onClick={() => setEditImageUrl('')} 
                      className="text-xs text-rose-600 hover:underline px-2 py-1 font-bold"
                    >
                      Buang foto
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 font-sans">
                  💡 Ambil foto makanan terus menggunakan kamera peranti atau muat naik dari storan fail.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Nama Add-on</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 text-xs rounded-xl shadow-2xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Harga Tambahan (RM)</label>
              <Input
                type="number"
                step="0.10"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="bg-white border-slate-200 text-orange-600 text-xs font-mono font-bold rounded-xl shadow-2xs"
                required
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Status Boleh Ditempah</span>
                <span className="text-[10px] text-slate-500">Papar di menu QR & Delivery</span>
              </div>
              <Switch checked={editAvailable} onCheckedChange={setEditAvailable} />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={uploadingEditPhoto}
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm shadow-orange-500/20"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Simpan Perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
