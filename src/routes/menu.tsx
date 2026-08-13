import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { requireStaffAuth } from '@/lib/auth-guard';

export const Route = createFileRoute('/menu')({
  ssr: false,
  beforeLoad: async ({ context, location }) => {
    return await requireStaffAuth(location, context.auth);
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
}

function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting item: ' + error.message);
    } else {
      await fetchMenuItems();
    }
  };

  const startEditing = (item: MenuItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCategory(item.category);
    setEditPrice(item.price.toString());
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: editName,
        category: editCategory,
        price: parseFloat(editPrice),
      })
      .eq('id', id);

    if (error) {
      alert('Error updating item: ' + error.message);
    } else {
      setEditingId(null);
      await fetchMenuItems();
    }
  };

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setItems(data as MenuItem[]);
    }
    setIsLoading(false);
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

      const { error: insertError } = await supabase
        .from('menu_items')
        .insert({
          name,
          category,
          price: parseFloat(price),
          is_available: isAvailable,
          store_id: userProfile.store_id,
          image_url: imageUrl || null
        });

      if (insertError) throw insertError;

      // Reset form and refresh list
      setName('');
      setCategory('');
      setPrice('');
      setIsAvailable(true);
      setImageUrl('');
      await fetchMenuItems();
    } catch (err: any) {
      setError(err.message || 'Failed to add menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Menu Management</h1>
      
      <div className="mb-8 border p-4">
        <h2 className="text-lg font-bold mb-2">Add New Item</h2>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block">Name:</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="border p-1" 
              required 
            />
          </div>
          <div>
            <label className="block">Category:</label>
            <input 
              type="text" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              className="border p-1" 
              required 
            />
          </div>
          <div>
            <label className="block">Price (RM):</label>
            <input 
              type="number" 
              step="0.01" 
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              className="border p-1" 
              required 
            />
          </div>
          <div>
            <label className="block">Image URL (optional):</label>
            <input 
              type="text" 
              value={imageUrl} 
              onChange={(e) => setImageUrl(e.target.value)} 
              className="border p-1 w-full max-w-xs" 
            />
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={isAvailable} 
                onChange={(e) => setIsAvailable(e.target.checked)} 
              />
              Available
            </label>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-blue-500 text-white px-4 py-1 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Item'}
          </button>
        </form>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      <h2 className="text-lg font-bold mb-2">Current Items</h2>
      {items.length === 0 ? (
        <p>No menu items yet</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4">
              {item.image_url ? (
                <img 
                  src={item.image_url} 
                  alt={item.name} 
                  className="w-[60px] h-[60px] object-cover bg-gray-100" 
                />
              ) : (
                <div className="w-[60px] h-[60px] bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                  No Image
                </div>
              )}
              <div className="flex-grow">
                {editingId === item.id ? (
                  <div className="space-y-1">
                    <input 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="border p-1 text-sm mr-2" 
                    />
                    <input 
                      value={editCategory} 
                      onChange={(e) => setEditCategory(e.target.value)} 
                      className="border p-1 text-sm mr-2" 
                    />
                    <input 
                      type="number" 
                      step="0.01"
                      value={editPrice} 
                      onChange={(e) => setEditPrice(e.target.value)} 
                      className="border p-1 text-sm w-20 mr-2" 
                    />
                    <button onClick={() => handleUpdate(item.id)} className="bg-green-500 text-white px-2 py-1 text-xs mr-1">Save</button>
                    <button onClick={() => setEditingId(null)} className="bg-gray-500 text-white px-2 py-1 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p>
                      {item.name} | {item.category} | RM{item.price.toFixed(2)} | {item.is_available ? 'Available' : 'Unavailable'}
                    </p>
                    <button 
                      onClick={() => startEditing(item)}
                      className="bg-gray-200 px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="bg-red-500 text-white px-2 py-1 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
