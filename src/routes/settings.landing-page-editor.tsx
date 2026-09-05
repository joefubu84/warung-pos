
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

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
    headline: 'Welcome to Warung J&J',
    subheadline: 'Authentic Malaysian Flavors, Delivered to Your Doorstep!',
    badge_text: 'Open for Delivery',
    is_delivery_enabled: true,
    delivery_status_note: 'Currently delivering to selected areas.',
    hero_image_url: '/warung-hero.jpg', // Placeholder image
  },
  highlights_section: [
    {
      id: '1',
      title: 'Sambal Gesek',
      description: 'Our signature spicy chili paste, a must-try!',
      image_url: '/sambal-gesek.jpg',
    },
    {
      id: '2',
      title: 'Fresh Ingredients',
      description: 'We use only the freshest local produce and halal meats.',
      image_url: '/fresh-ingredients.jpg',
    },
  ],
  popular_dishes: [], // Will be populated from menu items
  business_info: {
    operating_hours: 'Mon - Sun: 10:00 AM - 10:00 PM',
    address: '123 Warung Street, Flavor Town, Malaysia',
    phone_number: '+60123456789',
    google_maps_link: 'https://maps.google.com/?q=Warung+J&J',
  },
};

export function Route() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<LandingPageConfig>(defaultLandingPageConfig);
  const [menuItems, setMenuItems] = useState<{ id: string; name: string }[]>([]);

  // Fetch landing page config
  const { data, isLoading, error } = useQuery<LandingPageConfig, Error>({
    queryKey: ['landingPageConfig'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_page_config').select('*').single();
      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }
      return data || defaultLandingPageConfig;
    },
  });

  // Fetch menu items for popular dishes dropdown
  useEffect(() => {
    const fetchMenuItems = async () => {
      const { data, error } = await supabase.from('menu_items').select('id, name');
      if (error) {
        console.error('Error fetching menu items:', error);
      } else {
        setMenuItems(data || []);
      }
    };
    fetchMenuItems();
  }, []);

  useEffect(() => {
    if (data) {
      setConfig(data);
    }
  }, [data]);

  // Mutation to save/update landing page config
  const saveConfigMutation = useMutation<LandingPageConfig, Error, LandingPageConfig>({
    mutationFn: async (newConfig: LandingPageConfig) => {
      if (newConfig.id) {
        const { data, error } = await supabase
          .from('landing_page_config')
          .update(newConfig)
          .eq('id', newConfig.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('landing_page_config')
          .insert(newConfig)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landingPageConfig'] });
      toast.success('Landing page configuration saved successfully.');
    },
    onError: (err) => {
      toast.error(`Failed to save configuration: ${err.message}`);
    },
  });

  const handleChange = (section: keyof LandingPageConfig, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...((prev[section] || {}) as object), // Ensure target is an object for spreading
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

  if (isLoading) return <div className="p-4">Loading configuration...</div>;
  if (error) return <div className="p-4 text-red-500">Error loading configuration: {error.message}</div>;

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold">Pengurusan Homepage</h1>
      <p className="text-gray-600">Edit content for your public landing page.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hero Section */}
        <Card>
          <CardHeader>
            <CardTitle>Hero Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={config.hero_section.headline}
                onChange={(e) => handleChange('hero_section', 'headline', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="subheadline">Subheadline</Label>
              <Textarea
                id="subheadline"
                value={config.hero_section.subheadline}
                onChange={(e) => handleChange('hero_section', 'subheadline', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="badge_text">Badge Text (e.g., "Open for Delivery")</Label>
              <Input
                id="badge_text"
                value={config.hero_section.badge_text}
                onChange={(e) => handleChange('hero_section', 'badge_text', e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_delivery_enabled"
                checked={config.hero_section.is_delivery_enabled}
                onCheckedChange={(checked) => handleChange('hero_section', 'is_delivery_enabled', checked)}
              />
              <Label htmlFor="is_delivery_enabled">Status Delivery ({config.hero_section.is_delivery_enabled ? 'Buka' : 'Tutup Sementara'})</Label>
            </div>
            {config.hero_section.is_delivery_enabled === false && (
              <div>
                <Label htmlFor="delivery_status_note">Delivery Status Note (e.g., "Back in 30 mins")</Label>
                <Input
                  id="delivery_status_note"
                  value={config.hero_section.delivery_status_note}
                  onChange={(e) => handleChange('hero_section', 'delivery_status_note', e.target.value)}
                />
              </div>
            )}
            <div>
              <Label htmlFor="hero_image_url">Hero Image URL</Label>
              <Input
                id="hero_image_url"
                value={config.hero_section.hero_image_url}
                onChange={(e) => handleChange('hero_section', 'hero_image_url', e.target.value)}
                placeholder="https://example.com/hero.jpg"
              />
              {config.hero_section.hero_image_url && (
                <img src={config.hero_section.hero_image_url} alt="Hero Preview" className="mt-2 h-32 w-auto object-cover rounded-md" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Highlights Section */}
        <Card>
          <CardHeader>
            <CardTitle>Highlights Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.highlights_section.map((highlight, index) => (
              <div key={highlight.id} className="border p-4 rounded-md space-y-2 relative">
                <h3 className="font-semibold">Highlight {index + 1}</h3>
                <div>
                  <Label htmlFor={`highlight-title-${index}`}>Title</Label>
                  <Input
                    id={`highlight-title-${index}`}
                    value={highlight.title}
                    onChange={(e) => handleHighlightChange(index, 'title', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`highlight-description-${index}`}>Description</Label>
                  <Textarea
                    id={`highlight-description-${index}`}
                    value={highlight.description}
                    onChange={(e) => handleHighlightChange(index, 'description', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`highlight-image-${index}`}>Image URL</Label>
                  <Input
                    id={`highlight-image-${index}`}
                    value={highlight.image_url}
                    onChange={(e) => handleHighlightChange(index, 'image_url', e.target.value)}
                    placeholder="https://example.com/highlight.jpg"
                  />
                   {highlight.image_url && (
                    <img src={highlight.image_url} alt="Highlight Preview" className="mt-2 h-24 w-auto object-cover rounded-md" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => removeHighlight(highlight.id)}
                  className="absolute top-2 right-2"
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button type="button" onClick={addHighlight} variant="outline">
              Add Highlight
            </Button>
          </CardContent>
        </Card>

        {/* Popular Dishes */}
        <Card>
          <CardHeader>
            <CardTitle>Hidangan Paling Digemari (Popular Dishes)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="popular_dishes">Select Popular Dishes (hold Ctrl/Cmd to select multiple)</Label>
              <select
                id="popular_dishes"
                multiple
                value={config.popular_dishes}
                onChange={handlePopularDishesChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Business Info */}
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="operating_hours">Operating Hours</Label>
              <Input
                id="operating_hours"
                value={config.business_info.operating_hours}
                onChange={(e) => handleChange('business_info', 'operating_hours', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={config.business_info.address}
                onChange={(e) => handleChange('business_info', 'address', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                value={config.business_info.phone_number}
                onChange={(e) => handleChange('business_info', 'phone_number', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="google_maps_link">Google Maps Link</Label>
              <Input
                id="google_maps_link"
                value={config.business_info.google_maps_link}
                onChange={(e) => handleChange('business_info', 'google_maps_link', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl" disabled={saveConfigMutation.isPending}>
          {saveConfigMutation.isPending ? 'Saving...' : 'Simpan & Terbitkan'}
        </Button>
      </form>
    </div>
  );
}
