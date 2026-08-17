import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { requireAdminAuth } from '@/lib/auth-guard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Plus, Image as ImageIcon, Loader2, UtensilsCrossed, Sparkles, Check, RefreshCw } from 'lucide-react';
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('menu-items')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('menu-items')
        .getPublicUrl(fileName);

      setImageUrl(data.publicUrl);
      toast.success("Dish photo uploaded successfully!");
    } catch (err: any) {
      alert('Error uploading image: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('store_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.store_id) throw new Error('Store not found for user');

      const payload = {
        name,
        category,
        price: parseFloat(price),
        is_available: isAvailable,
        store_id: userProfile.store_id,
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
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting item: ' + error.message);
    } else {
      toast.info("Dish deleted.");
      await fetchMenuItems();
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-400">Loading Menu & Inventory Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Warung J&J Logo" className="w-12 h-12 rounded-full object-cover border border-amber-400 shadow-md" />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Menu & Inventory Management</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-xl font-bold">
            <UtensilsCrossed className="w-4 h-4" /> {items.length} Menu Dishes Tracked
          </div>
        </div>

        {/* MAIN 2-COLUMN LAYOUT: FORM (LEFT) & DISHES GRID (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* EDITOR FORM SIDEBAR */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 bg-slate-900 border-slate-800 text-white rounded-2xl shadow-xl">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  {editingId ? <><Edit2 className="w-5 h-5 text-amber-400"/> Edit Dish</> : <><Plus className="w-5 h-5 text-emerald-400"/> Add New Dish</>}
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs font-mono">
                  {editingId ? "Update dish price, image, or inventory stock." : "Add a new dish to your digital menu."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
                  
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Dish Photo</Label>
                    <div className="flex items-center gap-3">
                      {imageUrl ? (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shrink-0 flex items-center justify-center p-1">
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border border-dashed border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600 shrink-0">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={handlePhotoUpload} 
                          disabled={uploadingPhoto}
                          className="bg-slate-950 border-slate-800 text-white text-xs cursor-pointer file:cursor-pointer"
                        />
                        {uploadingPhoto && <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading photo...</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Dish Name</Label>
                    <Input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required 
                      placeholder="e.g. Nasi Ayam Butter Special" 
                      className="bg-slate-950 border-slate-800 text-white text-xs"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Category</Label>
                      <Input 
                        value={category} 
                        onChange={e => setCategory(e.target.value)} 
                        required 
                        placeholder="e.g. Chicken" 
                        className="bg-slate-950 border-slate-800 text-white text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">Price (RM)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={price} 
                        onChange={e => setPrice(e.target.value)} 
                        required 
                        placeholder="12.50" 
                        className="bg-slate-950 border-slate-800 text-white text-xs font-bold text-emerald-400"
                      />
                    </div>
                  </div>

                  {/* DISH BADGES CONFIGURATION */}
                  <div className="p-3.5 bg-slate-950 rounded-xl space-y-3 border border-slate-800 font-mono">
                    <Label className="text-xs font-bold text-amber-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Customer Menu Badges
                    </Label>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">🔥 Popular / Best Seller Badge</span>
                        <Switch checked={isPopular} onCheckedChange={setIsPopular} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">⭐ Chef Special Badge</span>
                        <Switch checked={isChefSpecial} onCheckedChange={setIsChefSpecial} />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <Label className="text-[10px] text-slate-400 uppercase">Custom Badge Tag (Optional)</Label>
                      <Input 
                        value={customTag} 
                        onChange={e => setCustomTag(e.target.value)} 
                        placeholder="e.g. 🌶️ Super Spicy or 🥤 Free Drink" 
                        className="bg-slate-900 border-slate-800 text-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-950 rounded-xl space-y-3 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-white block">Available for Ordering</Label>
                        <p className="text-[10px] text-slate-400">Show on digital QR menu?</p>
                      </div>
                      <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400 uppercase">Stock Level</Label>
                        <Input 
                          type="number" 
                          value={stockCount} 
                          onChange={e => setStockCount(e.target.value)} 
                          placeholder="Unlimited" 
                          className="bg-slate-900 border-slate-800 text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-400 uppercase">Low Alert At</Label>
                        <Input 
                          type="number" 
                          value={lowStockThreshold} 
                          onChange={e => setLowStockThreshold(e.target.value)} 
                          placeholder="5" 
                          className="bg-slate-900 border-slate-800 text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {error && <p className="text-rose-400 text-xs font-bold">{error}</p>}
                  
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" disabled={isSubmitting || uploadingPhoto} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl">
                      {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : '+ Add Dish to Menu')}
                    </Button>
                    {editingId && (
                      <Button type="button" variant="outline" onClick={cancelEdit} className="border-slate-800 text-slate-300">
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* MENU DISHES GRID */}
          <div className="lg:col-span-2">
            {items.length === 0 ? (
              <div className="text-center py-20 bg-slate-900 rounded-2xl border border-dashed border-slate-800 text-slate-500">
                <UtensilsCrossed className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <h3 className="text-lg font-bold text-white">Menu is Empty</h3>
                <p className="text-xs font-mono text-slate-400">Add your first dish using the form on the left.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((item) => {
                  const isLowStock = (item.stock_count ?? null) !== null && (item.low_stock_threshold ?? null) !== null && (item.stock_count ?? 0) <= (item.low_stock_threshold ?? 0);
                  const isOutOfStock = item.stock_count === 0 || !item.is_available;

                  return (
                    <Card key={item.id} className={`bg-slate-900 border-slate-800 text-white rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 shadow-xl group ${isOutOfStock ? 'opacity-60 grayscale-[0.4]' : ''}`}>
                      {/* UNCROPPED IMAGE CONTAINER */}
                      <div className="h-44 bg-slate-950 relative border-b border-slate-800 flex items-center justify-center p-2">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-1">
                            <ImageIcon className="w-8 h-8" />
                            <span className="text-[10px] font-mono">No Image</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge variant={item.is_available ? "default" : "destructive"} className={item.is_available ? "bg-emerald-600 text-white font-mono text-[10px]" : "bg-rose-600 text-white font-mono text-[10px]"}>
                            {item.is_available ? 'ON MENU' : 'OFF MENU'}
                          </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-white text-base tracking-tight line-clamp-1">{item.name}</h3>
                            <p className="text-xs text-slate-400 font-mono">{item.category}</p>
                          </div>
                          <p className="font-black text-emerald-400 text-base font-mono">RM {item.price.toFixed(2)}</p>
                        </div>

                        {/* INVENTORY BADGES */}
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          {item.stock_count !== null ? (
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isOutOfStock ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : (isLowStock ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")
                            }`}>
                              {isOutOfStock ? "❌ Sold Out (0)" : (isLowStock ? `⚠️ Low Stock (${item.stock_count})` : `📦 Stock: ${item.stock_count}`)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full">
                              ∞ Unlimited Stock
                            </span>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 font-mono">
                          <div className="flex items-center gap-2 text-xs">
                            <Switch 
                              checked={item.is_available} 
                              onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                            />
                            <span className={item.is_available ? 'text-slate-300' : 'text-slate-500'}>
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
        <div className="mt-8 border-t border-slate-800 pt-8">
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
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl rounded-2xl">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-lg font-bold flex items-center justify-between text-emerald-400">
            <span>✨ Custom Customer Add-ons</span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
              {addons.length} Active
            </Badge>
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs font-mono">
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
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
            <Input
              type="number"
              step="0.10"
              value={newAddonPrice}
              onChange={(e) => setNewAddonPrice(e.target.value)}
              placeholder="RM 1.50"
              className="bg-slate-950 border-slate-800 text-white text-xs w-24 shrink-0 font-bold text-emerald-400"
            />
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </form>

          {/* ADD-ONS LIST */}
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            {addons.map((addon) => (
              <div key={addon.id} className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={addon.available}
                    onCheckedChange={() => handleToggleAddonAvailability(addon.id)}
                  />
                  <div>
                    <span className={`font-bold block ${addon.available ? 'text-white' : 'text-slate-500 line-through'}`}>
                      {addon.name}
                    </span>
                    <span className="text-emerald-400 font-bold text-[11px]">
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
      <Card className="bg-slate-900 border-slate-800 text-white shadow-xl rounded-2xl">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-lg font-bold flex items-center justify-between text-amber-400">
            <span>📢 Rotating Promo Banners</span>
            <Badge variant="outline" className="border-amber-500/30 text-amber-300 font-mono text-[10px]">
              {promos.length} Announcements
            </Badge>
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs font-mono">
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
              className="bg-slate-950 border-slate-800 text-white text-xs"
            />
            <Button type="submit" className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold shrink-0">
              <Plus className="w-4 h-4 mr-1" /> Add Banner
            </Button>
          </form>

          {/* PROMOS LIST */}
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            {promos.map((promo, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                <span className="text-slate-200 font-bold text-xs truncate max-w-[280px]">
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
