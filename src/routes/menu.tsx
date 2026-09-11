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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Edit2, Trash2, Plus, Image as ImageIcon, Loader2, UtensilsCrossed, Sparkles, RefreshCw, Search, Camera, UploadCloud, X, AlertTriangle } from 'lucide-react';
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
  
  // Modal Popup states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [deleteTargetItem, setDeleteTargetItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      // Safe store ID determination
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

  const handleOpenAddNew = () => {
    cancelEdit();
    setIsFormModalOpen(true);
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
    setError(null);

    setIsFormModalOpen(true);
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
    setIsFormModalOpen(false);
  };

  const handleOpenDeleteModal = (item: MenuItem) => {
    setDeleteTargetItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetItem) return;
    const itemToDelete = deleteTargetItem;
    const id = itemToDelete.id;
    const itemName = itemToDelete.name || 'Menu item';

    setIsDeleting(true);
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
        setDeleteTargetItem(null);
        return;
      }

      toast.success(`Hidangan "${itemName}" telah berjaya dipadam.`);
      await fetchMenuItems();
      setDeleteTargetItem(null);
    } catch (err: any) {
      toast.error('Gagal memadam menu: ' + (err.message || 'Sila cuba lagi'));
    } finally {
      setIsDeleting(false);
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

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleOpenAddNew}
                className="bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold text-xs px-4 py-2 rounded-2xl shadow-sm transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Menu Baharu</span>
              </Button>

              <div className="flex items-center gap-2 font-mono text-xs text-orange-700 bg-orange-50 border border-orange-200 px-4 py-2 rounded-full font-bold shadow-xs">
                <UtensilsCrossed className="w-4 h-4 text-orange-600" /> {items.length} Menu Dishes Tracked
              </div>
            </div>
          </div>
        </div>

        {/* MENU DISHES GRID & FILTERS (FULL WIDTH) */}
        <div className="space-y-4">
          
          {/* SEARCH & FILTER BAR */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari hidangan atau kategori..."
                className="bg-slate-50 border-slate-200 text-slate-900 text-xs pl-9 rounded-xl w-full"
              />
            </div>

            {/* Filter tags / Active tab pills */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <button
                type="button"
                onClick={() => setMenuFilter('all')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all active:scale-[0.98] shrink-0 ${
                  menuFilter === 'all'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setMenuFilter('active')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all active:scale-[0.98] shrink-0 ${
                  menuFilter === 'active'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                ON Menu ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setMenuFilter('archived')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold font-mono transition-all active:scale-[0.98] shrink-0 ${
                  menuFilter === 'archived'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                OFF Menu ({archivedCount})
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-500 space-y-3 p-6 shadow-xs">
              <UtensilsCrossed className="w-12 h-12 mx-auto text-slate-300" />
              <h3 className="text-lg font-bold text-slate-900">Tiada Hidangan Dijumpai</h3>
              <p className="text-xs font-mono text-slate-500">
                {searchQuery ? `Tiada padanan untuk "${searchQuery}".` : 'Sila tekan "+ Tambah Menu Baharu" untuk mula menambah hidangan.'}
              </p>
              <Button
                type="button"
                onClick={handleOpenAddNew}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs rounded-xl px-4 py-2 mt-2"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Tambah Hidangan Sekarang
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isLowStock = (item.stock_count ?? null) !== null && (item.low_stock_threshold ?? null) !== null && (item.stock_count ?? 0) <= (item.low_stock_threshold ?? 0);
                const isOutOfStock = item.stock_count === 0 || !item.is_available;

                return (
                  <Card key={item.id} className={`bg-white border border-slate-200/90 text-slate-900 rounded-3xl overflow-hidden hover:border-orange-300 transition-all duration-300 shadow-xs group flex flex-col justify-between ${isOutOfStock ? 'opacity-65 grayscale-[0.3]' : ''}`}>
                    <div>
                      {/* UNCROPPED IMAGE CONTAINER */}
                      <div className="h-44 bg-slate-50 relative border-b border-slate-100 flex items-center justify-center p-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain drop-shadow-xs group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-[10px] font-mono">No Image</span>
                          </div>
                        )}
                        {/* Status Badges */}
                        <div className="absolute top-2 right-2">
                          <Badge 
                            variant={item.is_available ? "default" : "destructive"} 
                            className={item.is_available ? "bg-orange-600 text-white font-semibold font-mono text-[10px]" : "bg-rose-600 text-white font-semibold font-mono text-[10px]"}
                          >
                            {item.is_available ? 'ON MENU' : 'OFF MENU'}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm md:text-base tracking-tight truncate" title={item.name}>{item.name}</h3>
                            <p className="text-xs text-slate-500 font-mono truncate">{item.category}</p>
                          </div>
                          <p className="font-black text-orange-600 text-sm md:text-base font-mono shrink-0">RM {item.price.toFixed(2)}</p>
                        </div>

                        {/* INVENTORY BADGES */}
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          {item.stock_count !== null ? (
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isOutOfStock ? "bg-rose-50 text-rose-700 border-rose-200" : (isLowStock ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")
                            }`}>
                              {isOutOfStock ? "❌ Sold Out (0)" : (isLowStock ? `⚠️ Low Stock (${item.stock_count})` : `📦 Stock: ${item.stock_count}`)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                              ∞ Unlimited Stock
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </div>

                    <div className="px-4 pb-4">
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 font-mono">
                        <div className="flex items-center gap-2 text-xs">
                          <Switch 
                            checked={item.is_available} 
                            onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                          />
                          <span className={item.is_available ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                            {item.is_available ? 'Active' : 'Hidden'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => startEditing(item)} 
                            className="h-8 w-8 text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all active:scale-95"
                            title="Edit dish"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleOpenDeleteModal(item)} 
                            className="h-8 w-8 text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all active:scale-95"
                            title="Delete dish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* POPUP MODAL DIALOG: TAMBAH / EDIT MENU ITEM                 */}
        {/* ============================================================ */}
        <Dialog open={isFormModalOpen} onOpenChange={(open) => {
          if (!open) {
            cancelEdit();
          } else {
            setIsFormModalOpen(true);
          }
        }}>
          <DialogContent className="max-w-xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-2xl z-50">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/70 shrink-0">
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                {editingId ? (
                  <>
                    <span className="p-2 bg-amber-100 text-amber-700 rounded-xl"><Edit2 className="w-5 h-5"/></span>
                    <span>Edit Maklumat Hidangan</span>
                  </>
                ) : (
                  <>
                    <span className="p-2 bg-orange-100 text-orange-700 rounded-xl"><Plus className="w-5 h-5"/></span>
                    <span>Tambah Menu Baharu</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-mono mt-1">
                {editingId ? "Kemaskini harga, foto, custom tag atau stok inventori hidangan ini." : "Lengkapkan maklumat hidangan di bawah untuk dipaparkan pada menu digital."}
              </DialogDescription>
            </div>

            {/* Modal Scrollable Form Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-4 font-mono text-xs overscroll-contain">
              <form id="menu-dish-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* Photo Upload with Camera & Gallery */}
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-orange-600" />
                      <span>Gambar Hidangan (Dish Photo)</span>
                    </Label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-[10px] text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline font-bold"
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

                      {/* Action Buttons with WCAG AA Compliant High Contrast */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={uploadingPhoto}
                          onClick={() => cameraInputRef.current?.click()}
                          className="h-9 px-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-medium text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-colors duration-150 shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500 border border-transparent"
                        >
                          <Camera className="w-4 h-4 text-white shrink-0" />
                          <span>Kamera</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={uploadingPhoto}
                          onClick={() => galleryInputRef.current?.click()}
                          className="h-9 px-3 bg-white hover:bg-amber-50/80 active:scale-[0.98] border border-amber-300 hover:border-amber-400 text-amber-950 font-medium text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-colors duration-150 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          <UploadCloud className="w-4 h-4 text-amber-800 shrink-0" />
                          <span>Galeri / Fail</span>
                        </Button>
                      </div>

                      {uploadingPhoto ? (
                        <p className="text-xs text-amber-600 font-bold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin"/> Memproses gambar...
                        </p>
                      ) : (
                        <input
                          type="text"
                          placeholder="Atau tampal URL gambar di sini..."
                          value={imageUrl}
                          onChange={e => setImageUrl(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[10px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-orange-500"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Nama Hidangan (Dish Name)</Label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    placeholder="Contoh: Nasi Goreng Kampung Meletup" 
                    className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-xl"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Kategori (Category)</Label>
                    <Input 
                      value={category} 
                      onChange={e => setCategory(e.target.value)} 
                      required 
                      placeholder="Contoh: Makanan / Minuman" 
                      className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Harga Jualan (RM)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={price} 
                      onChange={e => setPrice(e.target.value)} 
                      required 
                      placeholder="12.50" 
                      className="bg-slate-50 border-slate-200 text-slate-900 text-xs font-bold text-orange-600 rounded-xl"
                    />
                  </div>
                </div>

                {/* DISH BADGES CONFIGURATION */}
                <div className="p-3.5 bg-slate-50/80 rounded-2xl space-y-3 border border-slate-200 font-mono">
                  <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Customer Menu Badges
                  </Label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-700 font-medium">🔥 Popular / Best Seller Badge</span>
                      <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-700 font-medium">⭐ Chef Special Badge</span>
                      <Switch checked={isChefSpecial} onCheckedChange={setIsChefSpecial} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1">
                    <Label className="text-[10px] text-slate-500 uppercase font-bold">Custom Badge Tag (Optional)</Label>
                    <Input 
                      value={customTag} 
                      onChange={e => setCustomTag(e.target.value)} 
                      placeholder="Contoh: 🌶️ Pedas Berapi atau 🥤 Percuma Air" 
                      className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* INVENTORY / STOCK CONTROL */}
                <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Stock Inventory Control</span>
                    <span className="text-[10px] text-slate-500 font-mono">Kosongkan untuk kuantiti tanpa had (unlimited)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">Baki Stok</Label>
                      <Input 
                        type="number" 
                        value={stockCount} 
                        onChange={e => setStockCount(e.target.value)} 
                        placeholder="Tanpa had" 
                        className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-slate-500 uppercase font-bold">Amaran Baki Rendah</Label>
                      <Input 
                        type="number" 
                        value={lowStockThreshold} 
                        onChange={e => setLowStockThreshold(e.target.value)} 
                        placeholder="5" 
                        className="bg-slate-50 border-slate-200 text-slate-900 text-xs rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <Label className="text-xs font-bold text-slate-900 block">Buka untuk pesanan pelanggan (Available)</Label>
                    <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                    {error}
                  </div>
                )}
              </form>
            </div>

            {/* Modal Footer / Action Buttons */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={cancelEdit} 
                className="border border-slate-300 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 font-medium rounded-xl px-4 py-2 transition-all text-xs"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                form="menu-dish-form"
                disabled={isSubmitting || uploadingPhoto} 
                className="bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold rounded-xl px-5 py-2 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500 text-xs flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  editingId ? 'Simpan Perubahan 💾' : '+ Tambah Hidangan 🍽️'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ============================================================ */}
        {/* POPUP MODAL DIALOG: PENGESAHAN PADAM HIDANGAN                */}
        {/* ============================================================ */}
        <Dialog open={Boolean(deleteTargetItem)} onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTargetItem(null);
          }
        }}>
          <DialogContent className="max-w-md w-full p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl z-50">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Padam Hidangan Menu?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono mt-1.5 leading-relaxed">
                  Adakah anda pasti mahu memadam hidangan berikut daripada pangkalan data dan menu digital?
                </DialogDescription>
              </div>

              {deleteTargetItem && (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 text-left">
                  {deleteTargetItem.image_url ? (
                    <img 
                      src={deleteTargetItem.image_url} 
                      alt={deleteTargetItem.name} 
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                      <UtensilsCrossed className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{deleteTargetItem.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{deleteTargetItem.category}</p>
                    <p className="text-xs font-black text-orange-600 font-mono mt-0.5">RM {deleteTargetItem.price.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 w-full pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => setDeleteTargetItem(null)}
                  className="w-full border-slate-200 bg-white hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 h-10"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold h-10 shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memadam...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ya, Padam 🗑️</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
      <Card className="bg-white border-slate-200 text-slate-900 shadow-xs rounded-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold flex items-center justify-between text-orange-600">
            <span>✨ Custom Customer Add-ons</span>
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-mono text-[10px]">
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
            <Button 
              type="submit" 
              className="bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-semibold shrink-0 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              <Plus className="w-4 h-4 mr-1 text-white" /> Add
            </Button>
          </form>

          {/* ADD-ONS LIST */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            {addons.map((addon) => (
              <div key={addon.id} className="p-3 flex items-center justify-between hover:bg-slate-100/60 transition-colors">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={addon.available}
                    onCheckedChange={() => handleToggleAddonAvailability(addon.id)}
                  />
                  <div>
                    <span className={`font-bold block ${addon.available ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
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
                  className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. PROMO BANNERS MANAGER */}
      <Card className="bg-white border-slate-200 text-slate-900 shadow-xs rounded-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold flex items-center justify-between text-amber-700">
            <span>📢 Rotating Promo Banners</span>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 font-mono text-[10px]">
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
            <Button 
              type="submit" 
              className="bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold shrink-0 transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <Plus className="w-4 h-4 mr-1 text-white" /> Add Banner
            </Button>
          </form>

          {/* PROMOS LIST */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
            {promos.map((promo, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-100/60 transition-colors">
                <span className="text-slate-800 font-bold text-xs truncate max-w-[280px]">
                  {promo}
                </span>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleRemovePromo(idx)}
                  className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 shrink-0 active:scale-95 transition-all"
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
