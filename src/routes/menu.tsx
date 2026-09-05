import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { requireAdminAuth } from '@/lib/auth-guard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Plus, Image as ImageIcon, Loader2, UtensilsCrossed, Sparkles, Check, RefreshCw, Search, Camera, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { 
  getAddonsConfig, 
  saveAddonsConfig, 
  getPromoConfig, 
  savePromoConfig, 
  getDishBadgesMap,
  saveDishBadge,
  CustomAddon 
} from '@/lib/addons-config';

export const Route = createFileRoute('/menu')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireAdminAuth(location, context.auth);
  },
  component: MenuPage,
});

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  is_available: boolean;
  store_id: string;
  image_url?: string | null;
  stock_count?: number | null;
  low_stock_threshold?: number | null;
}

function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [menuFilter, setMenuFilter] = useState<'all' | 'active' | 'archived'>('all');
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [stockCount, setStockCount] = useState<string>('');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('5');

  // Badge Customization state
  const [isPopular, setIsPopular] = useState(true);
  const [isHalal, setIsHalal] = useState(true);
  const [isChefSpecial, setIsChefSpecial] = useState(false);
  const [customTag, setCustomTag] = useState('');

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setItems(data as MenuItem[]);
    }
    setIsLoading(false);
  };

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File, maxWidth = 800, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(readerEvent.target?.result as string);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
          } catch (e) {
            resolve(readerEvent.target?.result as string);
          }
        };
        img.onerror = () => resolve(readerEvent.target?.result as string);
        img.src = readerEvent.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const processSelectedFile = async (file: File) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      // 1. Client-side compression to responsive data URL
      const compressedDataUrl = await compressImage(file);

      // 2. Attempt storage upload if available
      let publicUrl = '';
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `dish_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        // Try logos bucket (which has public read/write in migrations)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, file, { upsert: true });

        if (!uploadError && uploadData) {
          const { data: pubData } = supabase.storage.from('logos').getPublicUrl(fileName);
          publicUrl = pubData.publicUrl;
        }
      } catch (storageErr) {
        console.warn('Storage upload fallback:', storageErr);
      }

      // Use public URL if successfully uploaded to bucket, otherwise use compressed Data URL
      const finalUrl = publicUrl || compressedDataUrl;
      setImageUrl(finalUrl);
      toast.success("Gambar hidangan berjaya dimasukkan! 📸");
    } catch (err: any) {
      toast.error('Gagal memproses gambar: ' + (err.message || 'Sila cuba lagi.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Safe store ID determination (works even if user logged in via emergency bypass)
      let currentStoreId = '1094d737-8104-4a55-b678-0fe9097beba0';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userProfile } = await supabase
            .from('users')
            .select('store_id')
            .eq('id', user.id)
            .maybeSingle();
          if (userProfile?.store_id) {
            currentStoreId = userProfile.store_id;
          }
        }
      } catch (e) {}

      if (!currentStoreId) {
        const { data: storeData } = await supabase.from('stores').select('id').limit(1).maybeSingle();
        currentStoreId = storeData?.id || '1094d737-8104-4a55-b678-0fe9097beba0';
      }

      const payload = {
        name,
        category,
        price: parseFloat(price),
        is_available: isAvailable,
        store_id: currentStoreId,
        image_url: imageUrl || null,
        stock_count: stockCount ? parseInt(stockCount) : null,
        low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold) : 5
      };

      let targetId = editingId;
      if (editingId) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
        toast.success(`Updated "${name}"!`);
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from('menu_items')
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        targetId = insertedData.id;
        toast.success(`Added new dish "${name}"!`);
      }

      if (targetId) {
        saveDishBadge(targetId, {
          isPopular,
          isHalal,
          isChefSpecial,
          customTag: customTag.trim()
        });
      }

      // Reset form and refresh
      cancelEdit();
      await fetchMenuItems();
    } catch (err: any) {
      setError(err.message || 'Failed to save menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (item: MenuItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setPrice(item.price.toString());
    setIsAvailable(item.is_available);
    setImageUrl(item.image_url || '');
    setStockCount(item.stock_count?.toString() || '');
    setLowStockThreshold(item.low_stock_threshold?.toString() || '5');

    const badgesMap = getDishBadgesMap();
    const existingBadge = badgesMap[item.id] || { isPopular: true, isHalal: true, isChefSpecial: false, customTag: '' };
    setIsPopular(existingBadge.isPopular ?? true);
    setIsHalal(existingBadge.isHalal ?? true);
    setIsChefSpecial(existingBadge.isChefSpecial ?? false);
    setCustomTag(existingBadge.customTag || '');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setCategory('');
    setPrice('');
    setIsAvailable(true);
    setImageUrl('');
    setStockCount('');
    setLowStockThreshold('5');
    setIsPopular(true);
    setIsHalal(true);
    setIsChefSpecial(false);
    setCustomTag('');
    setError(null);
  };

  const handleDelete = async (id: string) => {
    const itemToDelete = items.find(item => item.id === id);
    const itemName = itemToDelete?.name || 'Menu item';

    if (!window.confirm(`Adakah anda pasti mahu memadam hidangan "${itemName}"?`)) return;
    
    try {
      // 1. Bersihkan rujukan child records dalam order_items jika ada
      try {
        await supabase
          .from('order_items')
          .delete()
          .eq('menu_item_id', id);
      } catch (childErr) {
        console.warn('Child order_items clean note:', childErr);
      }

      // 2. Padam menu_items terus dari pangkalan data
      const { error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (deleteError) {
        // 3. Fallback: Jika pemadaman disekat oleh RLS/Kekangan lain, nyahaktifkan status (OFF Menu)
        const { error: archiveError } = await supabase
          .from('menu_items')
          .update({ 
            is_available: false,
            ...(itemToDelete?.store_id ? { store_id: itemToDelete.store_id } : {})
          })
          .eq('id', id);

        if (archiveError) throw deleteError;

        toast.success(`"${itemName}" telah dinyahaktifkan (OFF Menu & Disembunyikan).`);
        await fetchMenuItems();
        return;
      }

      toast.success(`Hidangan "${itemName}" telah berjaya dipadam.`);
      await fetchMenuItems();
    } catch (err: any) {
      toast.error('Gagal memadam menu: ' + (err.message || 'Sila cuba lagi'));
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !currentStatus })
      .eq('id', id);
      
    if (error) {
      alert('Error updating status: ' + error.message);
    } else {
      setItems(items.map(item => item.id === id ? { ...item, is_available: !currentStatus } : item));
      toast.success(currentStatus ? "Dish set to OFF Menu" : "Dish set to ON Menu");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-sm text-slate-500">Loading Menu & Inventory Database...</p>
        </div>
      </div>
    );
  }

  const activeCount = items.filter(i => i.is_available).length;
  const archivedCount = items.filter(i => !i.is_available).length;

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (menuFilter === 'active') {
      return item.is_available;
    } else if (menuFilter === 'archived') {
      return !item.is_available;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER BAR (FAUNA KITCHEN LIGHT THEME) */}
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Warung J&J Logo" className="w-12 h-12 rounded-full object-cover border-2 border-orange-200 shadow-xs" />
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span>Menu & Inventory Management</span>
                  <span className="text-xs font-mono font-bold bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full border border-orange-200">
                    MENU
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Live dish catalogue, pricing, custom badges & inventory tracking
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-orange-700 bg-orange-50 border border-orange-200 px-4 py-2 rounded-full font-bold shadow-xs">
              <UtensilsCrossed className="w-4 h-4 text-orange-600" /> {items.length} Menu Dishes Tracked
            </div>
          </div>
        </div>

        {/* MAIN 2-COLUMN LAYOUT: FORM (LEFT) & DISHES GRID (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* EDITOR FORM SIDEBAR */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 bg-white border border-slate-200/90 text-slate-900 rounded-3xl shadow-xs">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                  {editingId ? <><Edit2 className="w-5 h-5 text-amber-400"/> Edit Dish</> : <><Plus className="w-5 h-5 text-orange-600"/> Add New Menu Item</>}
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs font-mono">
                  {editingId ? "Update dish price, image, or inventory stock." : "Add a new item to your digital menu."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
                  
                  {/* Photo Upload with Camera & Gallery */}
                  <div className="space-y-2.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-orange-600" />
                        <span>Gambar Hidangan (Dish Photo)</span>
                      </Label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline"
                        >
                          <X className="w-3 h-3" /> Buang Gambar
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-slate-50 shrink-0 flex items-center justify-center p-1 shadow-md">
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 flex flex-col items-center justify-center text-slate-500 shrink-0 gap-1">
                          <ImageIcon className="w-6 h-6 text-slate-600" />
                          <span className="text-[9px] text-slate-500">Tiada Foto</span>
                        </div>
                      )}

                      <div className="flex-1 space-y-2">
                        {/* Hidden Inputs */}
                        <input
                          ref={cameraInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                        <input
                          ref={galleryInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={uploadingPhoto}
                            onClick={() => cameraInputRef.current?.click()}
                            className="h-9 bg-orange-600 hover:bg-orange-500 text-slate-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Kamera</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={uploadingPhoto}
                            onClick={() => galleryInputRef.current?.click()}
                            className="h-9 border-slate-300 bg-slate-800 hover:bg-slate-700 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Galeri / Fail</span>
                          </Button>
                        </div>

                        {uploadingPhoto ? (
                          <p className="text-xs text-amber-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin"/> Memproses gambar...
                          </p>
                        ) : (
                          <input
                            type="text"
                            placeholder="Atau tampal URL gambar di sini..."
                            value={imageUrl}
                            onChange={e => setImageUrl(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] text-slate-700 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Dish Name</Label>
                    <Input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required 
                      placeholder="e.g. Nasi Ayam Butter Special" 
                      className="bg-slate-50 border-slate-200 text-slate-900 text-xs"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Category</Label>
                      <Input 
                        value={category} 
                        onChange={e => setCategory(e.target.value)} 
                        required 
                        placeholder="e.g. Chicken" 
                        className="bg-slate-50 border-slate-200 text-slate-900 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Price (RM)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={price} 
                        onChange={e => setPrice(e.target.value)} 
                        required 
                        placeholder="12.50" 
                        className="bg-slate-50 border-slate-200 text-slate-900 text-xs font-bold text-orange-600"
                      />
                    </div>
                  </div>

                  {/* DISH BADGES CONFIGURATION */}
                  <div className="p-3.5 bg-slate-50/80 rounded-xl space-y-3 border border-slate-200 font-mono">
                    <Label className="text-xs font-bold text-amber-400 uppercase tracking-wider block border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Customer Menu Badges
                    </Label>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-700">🔥 Popular / Best Seller Badge</span>
                        <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-700">⭐ Chef Special Badge</span>
                        <Switch checked={isChefSpecial} onCheckedChange={setIsChefSpecial} />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-1">
                      <Label className="text-[10px] text-slate-500 uppercase">Custom Badge Tag (Optional)</Label>
                      <Input 
                        value={customTag} 
                        onChange={e => setCustomTag(e.target.value)} 
                        placeholder="e.g. 🌶️ Super Spicy or 🥤 Free Drink" 
                        className="bg-slate-50 border-slate-200 text-slate-900 text-xs"
                      />
                    </div>
                  </div>

                  {/* INVENTORY / STOCK CONTROL */}
                  <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Stock Inventory Control</span>
                      <span className="text-[10px] text-slate-500 font-mono">Leave empty for unlimited</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase">Stock Count</Label>
                        <Input 
                          type="number" 
                          value={stockCount} 
                          onChange={e => setStockCount(e.target.value)} 
                          placeholder="Unlimited" 
                          className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase">Low Alert At</Label>
                        <Input 
                          type="number" 
                          value={lowStockThreshold} 
                          onChange={e => setLowStockThreshold(e.target.value)} 
                          placeholder="5" 
                          className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Label className="text-xs font-bold text-slate-900 block">Available for Ordering</Label>
                      <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                    </div>
                  </div>

                  {error && <p className="text-rose-400 text-xs font-bold">{error}</p>}
                  
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={isSubmitting || uploadingPhoto} className="flex-1 bg-orange-600 hover:bg-orange-500 text-slate-900 font-bold rounded-xl py-2">
                      {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : '+ Add Dish to Menu')}
                    </Button>
                    {editingId && (
                      <Button type="button" variant="outline" onClick={cancelEdit} className="border-slate-200 text-slate-700 rounded-xl">
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* MENU DISHES GRID */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* SEARCH & FILTER BAR */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari hidangan atau kategori..."
                  className="bg-slate-50 border-slate-200 text-slate-900 text-xs pl-9 rounded-xl w-full"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setMenuFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 ${
                    menuFilter === 'all'
                      ? 'bg-orange-600 text-slate-900 shadow-md'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  Semua ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMenuFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 ${
                    menuFilter === 'active'
                      ? 'bg-orange-600 text-slate-900 shadow-md'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  ON Menu ({activeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setMenuFilter('archived')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all shrink-0 ${
                    menuFilter === 'archived'
                      ? 'bg-amber-600 text-slate-900 shadow-md'
                      : 'bg-slate-50 text-slate-500 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  OFF Menu ({archivedCount})
                </button>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-2">
                <UtensilsCrossed className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Tiada Hidangan Dijumpai</h3>
                <p className="text-xs font-mono text-slate-500">
                  {searchQuery ? `Tiada padanan untuk "${searchQuery}".` : 'Sila tambah hidangan baharu atau tukar penapis.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => {
                  const isLowStock = (item.stock_count ?? null) !== null && (item.low_stock_threshold ?? null) !== null && (item.stock_count ?? 0) <= (item.low_stock_threshold ?? 0);
                  const isOutOfStock = item.stock_count === 0 || !item.is_available;

                  return (
                    <Card key={item.id} className={`bg-slate-50 border-slate-200 text-slate-900 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 shadow-xl group ${isOutOfStock ? 'opacity-60 grayscale-[0.4]' : ''}`}>
                      {/* UNCROPPED IMAGE CONTAINER */}
                      <div className="h-44 bg-slate-50 relative border-b border-slate-100 flex items-center justify-center p-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-1">
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-[10px] font-mono">No Image</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant={item.is_available ? "default" : "destructive"} className={item.is_available ? "bg-orange-600 text-slate-900 font-mono text-[10px]" : "bg-rose-600 text-slate-900 font-mono text-[10px]"}>
                            {item.is_available ? 'ON MENU' : 'OFF MENU'}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-slate-900 text-base tracking-tight line-clamp-1">{item.name}</h3>
                            <p className="text-xs text-slate-500 font-mono">{item.category}</p>
                          </div>
                          <p className="font-black text-orange-600 text-base font-mono">RM {item.price.toFixed(2)}</p>
                        </div>

                        {/* INVENTORY BADGES */}
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          {item.stock_count !== null ? (
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isOutOfStock ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : (isLowStock ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-emerald-500/10 text-orange-600 border-emerald-500/20")
                            }`}>
                              {isOutOfStock ? "❌ Sold Out (0)" : (isLowStock ? `⚠️ Low Stock (${item.stock_count})` : `📦 Stock: ${item.stock_count}`)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
                              ∞ Unlimited Stock
                            </span>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 font-mono">
                          <div className="flex items-center gap-2 text-xs">
                            <Switch 
                              checked={item.is_available} 
                              onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                            />
                            <span className={item.is_available ? 'text-slate-700' : 'text-slate-500'}>
                              {item.is_available ? 'Active' : 'Hidden'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button size="icon" variant="ghost" onClick={() => startEditing(item)} className="h-8 w-8 text-amber-400 hover:bg-amber-950/40 border border-amber-500/20">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-rose-400 hover:bg-rose-950/40 border border-rose-500/20">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* CUSTOM ADD-ONS & PROMO BANNERS MANAGER */}
        <div className="mt-8 border-t border-slate-200 pt-8">
          <AddonsAndPromosManagerCard />
        </div>

      </div>
    </div>
  );
}

function AddonsAndPromosManagerCard() {
  const [addons, setAddons] = useState<CustomAddon[]>(getAddonsConfig());
  const [promos, setPromos] = useState<string[]>(getPromoConfig());
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [newPromoText, setNewPromoText] = useState('');

  const handleAddAddon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddonName.trim() || !newAddonPrice) return;

    const newAddon: CustomAddon = {
      id: `addon_${Date.now()}`,
      name: newAddonName.trim(),
      price: parseFloat(newAddonPrice),
      available: true
    };

    const updated = [...addons, newAddon];
    setAddons(updated);
    saveAddonsConfig(updated);
    setNewAddonName('');
    setNewAddonPrice('');
    toast.success(`Added custom add-on "${newAddon.name}"!`);
  };

  const handleRemoveAddon = (id: string) => {
    const updated = addons.filter(a => a.id !== id);
    setAddons(updated);
    saveAddonsConfig(updated);
    toast.info("Add-on removed.");
  };

  const handleToggleAddonAvailability = (id: string) => {
    const updated = addons.map(a => a.id === id ? { ...a, available: !a.available } : a);
    setAddons(updated);
    saveAddonsConfig(updated);
  };

  const handleAddPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoText.trim()) return;

    const updated = [...promos, newPromoText.trim()];
    setPromos(updated);
    savePromoConfig(updated);
    setNewPromoText('');
    toast.success("New promo banner announcement added!");
  };

  const handleRemovePromo = (idx: number) => {
    const updated = promos.filter((_, i) => i !== idx);
    setPromos(updated);
    savePromoConfig(updated);
    toast.info("Promo banner removed.");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
      {/* 1. CUSTOM DISH ADD-ONS MANAGER */}
      <Card className="bg-slate-50 border-slate-200 text-slate-900 shadow-xl rounded-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold flex items-center justify-between text-orange-600">
            <span>✨ Custom Customer Add-ons</span>
            <Badge variant="outline" className="border-emerald-500/30 text-orange-600 font-mono text-[10px]">
              {addons.length} Active
            </Badge>
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs font-mono">
            Staff can add or edit dish customization add-on choices and pricing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 font-mono text-xs">
          {/* ADD NEW ADD-ON FORM */}
          <form onSubmit={handleAddAddon} className="flex gap-2">
            <Input
              value={newAddonName}
              onChange={(e) => setNewAddonName(e.target.value)}
              placeholder="e.g. Extra Sambal Belacan"
              className="bg-slate-50 border-slate-200 text-slate-900 text-xs"
            />
            <Input
              type="number"
              step="0.10"
              value={newAddonPrice}
              onChange={(e) => setNewAddonPrice(e.target.value)}
              placeholder="RM 1.50"
              className="bg-slate-50 border-slate-200 text-slate-900 text-xs w-24 shrink-0 font-bold text-orange-600"
            />
            <Button type="submit" className="bg-orange-600 hover:bg-orange-500 text-slate-900 font-bold shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </form>

          {/* ADD-ONS LIST */}
          <div className="divide-y divide-slate-800 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            {addons.map((addon) => (
              <div key={addon.id} className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={addon.available}
                    onCheckedChange={() => handleToggleAddonAvailability(addon.id)}
                  />
                  <div>
                    <span className={`font-bold block ${addon.available ? 'text-slate-900' : 'text-slate-500 line-through'}`}>
                      {addon.name}
                    </span>
                    <span className="text-orange-600 font-bold text-[11px]">
                      +RM {Number(addon.price).toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemoveAddon(addon.id)}
                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. PROMO BANNERS MANAGER */}
      <Card className="bg-slate-50 border-slate-200 text-slate-900 shadow-xl rounded-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold flex items-center justify-between text-amber-400">
            <span>📢 Rotating Promo Banners</span>
            <Badge variant="outline" className="border-amber-500/30 text-amber-300 font-mono text-[10px]">
              {promos.length} Announcements
            </Badge>
          </CardTitle>
          <CardDescription className="text-slate-500 text-xs font-mono">
            Top promo text banners displayed on customer QR ordering menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 font-mono text-xs">
          {/* ADD NEW PROMO FORM */}
          <form onSubmit={handleAddPromo} className="flex gap-2">
            <Input
              value={newPromoText}
              onChange={(e) => setNewPromoText(e.target.value)}
              placeholder="e.g. ⚡ Happy Hour: 20% OFF Beverages!"
              className="bg-slate-50 border-slate-200 text-slate-900 text-xs"
            />
            <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add Banner
            </Button>
          </form>

          {/* PROMOS LIST */}
          <div className="divide-y divide-slate-800 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            {promos.map((promo, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                <span className="text-slate-800 font-bold text-xs truncate max-w-[280px]">
                  {promo}
                </span>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemovePromo(idx)}
                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
