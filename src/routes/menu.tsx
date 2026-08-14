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
import { Edit2, Trash2, Plus, Image as ImageIcon, Loader2, UtensilsCrossed } from 'lucide-react';

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

      if (editingId) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('menu_items')
          .insert(payload);
        if (insertError) throw insertError;
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
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) alert('Error deleting item: ' + error.message);
    else await fetchMenuItems();
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: !currentStatus })
      .eq('id', id);
      
    if (error) alert('Error updating status: ' + error.message);
    else {
      setItems(items.map(item => item.id === id ? { ...item, is_available: !currentStatus } : item));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20 pt-24 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Menu & Inventory</h1>
            <p className="text-muted-foreground mt-1">Manage your dishes and track stock levels.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Editor Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-28 border-border/50 shadow-lg bg-card/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  {editingId ? <><Edit2 className="w-5 h-5"/> Edit Item</> : <><Plus className="w-5 h-5"/> Add New Item</>}
                </CardTitle>
                <CardDescription>
                  {editingId ? "Update dish details and stock." : "Add a new dish to your menu."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <Label>Dish Photo</Label>
                    <div className="flex items-center gap-4">
                      {imageUrl ? (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border">
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/50 text-muted-foreground">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          onChange={handlePhotoUpload} 
                          disabled={uploadingPhoto}
                          className="cursor-pointer file:cursor-pointer"
                        />
                        {uploadingPhoto && <p className="text-xs text-primary mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading...</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dish Name</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Nasi Goreng Ayam" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input value={category} onChange={e => setCategory(e.target.value)} required placeholder="e.g. Mains" />
                    </div>
                    <div className="space-y-2">
                      <Label>Price (RM)</Label>
                      <Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required placeholder="8.50" />
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl space-y-4 border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Available for Ordering</Label>
                        <p className="text-xs text-muted-foreground">Is this item currently available?</p>
                      </div>
                      <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label>Stock Level</Label>
                        <Input 
                          type="number" 
                          value={stockCount} 
                          onChange={e => setStockCount(e.target.value)} 
                          placeholder="Leave empty for unlimited" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Low Alert At</Label>
                        <Input 
                          type="number" 
                          value={lowStockThreshold} 
                          onChange={e => setLowStockThreshold(e.target.value)} 
                          placeholder="5" 
                        />
                      </div>
                    </div>
                  </div>

                  {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                  
                  <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={isSubmitting || uploadingPhoto} className="flex-1">
                      {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Item')}
                    </Button>
                    {editingId && (
                      <Button type="button" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Menu Items Grid */}
          <div className="lg:col-span-2">
            {items.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-2xl border border-dashed">
                <UtensilsCrossed className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-bold">Menu is empty</h3>
                <p className="text-muted-foreground">Add your first dish using the form.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((item) => {
                  const isLowStock = item.stock_count !== null && item.low_stock_threshold !== null && item.stock_count <= item.low_stock_threshold;
                  const isOutOfStock = item.stock_count === 0 || !item.is_available;

                  return (
                    <Card key={item.id} className={`overflow-hidden transition-all duration-300 ${isOutOfStock ? 'opacity-70 grayscale-[0.5]' : 'hover:shadow-md hover:border-primary/30'}`}>
                      <div className="h-40 bg-muted relative">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="w-8 h-8 opacity-20" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex flex-col gap-2">
                           <Badge variant={item.is_available ? "default" : "destructive"} className="shadow-sm">
                             {item.is_available ? 'Available' : 'Disabled'}
                           </Badge>
                        </div>
                      </div>
                      
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                            <p className="text-sm text-muted-foreground">{item.category}</p>
                          </div>
                          <p className="font-black text-primary">RM{item.price.toFixed(2)}</p>
                        </div>

                        {/* Inventory Badges */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.stock_count !== null ? (
                            <Badge variant={isOutOfStock ? "destructive" : (isLowStock ? "warning" : "secondary")} className="flex gap-1">
                              {isOutOfStock ? "Sold Out (0)" : (isLowStock ? `⚠️ Low Stock (${item.stock_count})` : `📦 Stock: ${item.stock_count}`)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">∞ Unlimited</Badge>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Switch 
                              checked={item.is_available} 
                              onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                            />
                            <span className={item.is_available ? 'text-foreground' : 'text-muted-foreground'}>
                              {item.is_available ? 'On Menu' : 'Off Menu'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <Button size="icon" variant="secondary" onClick={() => startEditing(item)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="destructive" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="w-4 h-4" />
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
      </div>
    </div>
  );
}

