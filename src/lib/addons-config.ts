import { supabase } from '@/integrations/supabase/client';

export interface CustomAddon {
  id: string;
  name: string;
  price: number;
  available: boolean;
  imageUrl?: string | null;
}

export interface PromoConfig {
  banners: string[];
}

const DEFAULT_ADDONS: CustomAddon[] = [
  { id: 'egg', name: 'Telur Mata (Fried Egg)', price: 1.50, available: true },
  { id: 'sambal', name: 'Extra Sambal Special', price: 1.00, available: true },
  { id: 'rice', name: 'Extra Nasi (Extra Rice)', price: 1.50, available: true },
  { id: 'cheese', name: 'Melted Cheese Slice', price: 2.00, available: true },
  { id: 'soup', name: 'Extra Soup Bowl', price: 1.00, available: true },
];

const DEFAULT_PROMOS: string[] = [
  "⚡ Happy Hour Special: 20% OFF All Beverages!",
  "🎁 Order > RM 30 & get FREE Teh O Ais!",
  "🌟 Today's Special: Nasi Ayam Warung + Drink for RM 14.90",
];

const ADDONS_STORAGE_KEY = 'warung_addons_config_v1';
const PROMO_STORAGE_KEY = 'warung_promos_config_v1';

export function getAddonsConfig(): CustomAddon[] {
  if (typeof localStorage === 'undefined') return DEFAULT_ADDONS;
  try {
    const stored = localStorage.getItem(ADDONS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to parse stored addons config:", e);
  }
  return DEFAULT_ADDONS;
}

export async function syncAddonsToDatabase(addons: CustomAddon[]) {
  try {
    const { data: storeData } = await supabase.from('stores').select('id, settings').limit(1).maybeSingle();
    const storeId = storeData?.id;
    if (!storeId) return;

    // 1. Save in store settings
    const currentSettings = (storeData.settings as any) || {};
    await supabase.from('stores').update({
      settings: {
        ...currentSettings,
        addons
      }
    } as any).eq('id', storeId);

    // 2. Sync to menu_items table under category 'Add-ons / Sampingan'
    const { data: existingMenuItems } = await supabase
      .from('menu_items')
      .select('id, name, price, is_available, image_url')
      .eq('category', 'Add-ons / Sampingan');

    const existingMap = new Map((existingMenuItems || []).map(m => [m.name.trim().toLowerCase(), m]));
    const activeAddonNames = new Set(addons.map(a => a.name.trim().toLowerCase()));

    for (const addon of addons) {
      const match = existingMap.get(addon.name.trim().toLowerCase());
      if (match) {
        if (
          match.price !== addon.price || 
          match.is_available !== addon.available ||
          (addon.imageUrl && match.image_url !== addon.imageUrl)
        ) {
          await supabase.from('menu_items').update({
            price: addon.price,
            is_available: addon.available,
            ...(addon.imageUrl ? { image_url: addon.imageUrl } : {})
          } as any).eq('id', match.id);
        }
      } else {
        await supabase.from('menu_items').insert({
          name: addon.name.trim(),
          category: 'Add-ons / Sampingan',
          price: addon.price,
          is_available: addon.available,
          image_url: addon.imageUrl || null,
          store_id: storeId
        } as any);
      }
    }

    // Deactivate removed addons from menu_items
    for (const oldItem of (existingMenuItems || [])) {
      if (!activeAddonNames.has(oldItem.name.trim().toLowerCase()) && oldItem.is_available) {
        await supabase.from('menu_items').update({ is_available: false } as any).eq('id', oldItem.id);
      }
    }
  } catch (e) {
    console.warn('Sync addons to database note:', e);
  }
}

export function saveAddonsConfig(addons: CustomAddon[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(addons));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('warung_addons_updated'));
    // Asynchronously push to database & sync with menu_items
    syncAddonsToDatabase(addons);
  } catch (e) {
    console.error("Failed to save addons config:", e);
  }
}

export function getPromoConfig(): string[] {
  if (typeof localStorage === 'undefined') return DEFAULT_PROMOS;
  try {
    const stored = localStorage.getItem(PROMO_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to parse stored promo config:", e);
  }
  return DEFAULT_PROMOS;
}

export function savePromoConfig(banners: string[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(banners));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('warung_promos_updated'));
  } catch (e) {
    console.error("Failed to save promo config:", e);
  }
}

export interface DishBadgeConfig {
  isPopular: boolean;
  isHalal: boolean;
  isChefSpecial: boolean;
  customTag?: string;
}

const BADGES_STORAGE_KEY = 'warung_dish_badges_v1';

export function getDishBadgesMap(): Record<string, DishBadgeConfig> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const stored = localStorage.getItem(BADGES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to parse stored dish badges:", e);
  }
  return {};
}

export function saveDishBadge(dishId: string, badge: DishBadgeConfig) {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = getDishBadgesMap();
    map[dishId] = badge;
    localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('warung_dish_badges_updated'));
  } catch (e) {
    console.error("Failed to save dish badge:", e);
  }
}

export interface NavItemConfig {
  id: string;
  label: string;
  path: string;
  emoji: string;
  visible: boolean;
}

export const DEFAULT_NAV_ORDER: NavItemConfig[] = [
  { id: 'counter', label: 'Counter', path: '/counter', emoji: '🛒', visible: true },
  { id: 'menu', label: 'Menu', path: '/menu', emoji: '🍱', visible: true },
  { id: 'orders', label: 'Orders', path: '/orders', emoji: '📋', visible: true },
  { id: 'kitchen', label: 'Kitchen', path: '/kitchen', emoji: '🍳', visible: true },
  { id: 'loyalty', label: 'Loyalty', path: '/loyalty', emoji: '💎', visible: true },
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', emoji: '📊', visible: true },
  { id: 'cash', label: 'Cash', path: '/cash', emoji: '💰', visible: true },
  { id: 'tables', label: 'Tables', path: '/tables', emoji: '📱', visible: true },
  { id: 'settings', label: 'Settings', path: '/settings', emoji: '⚙️', visible: true },
];

const NAV_STORAGE_KEY = 'warung_nav_order_v1';

export function getNavOrderConfig(): NavItemConfig[] {
  if (typeof localStorage === 'undefined') return DEFAULT_NAV_ORDER;
  try {
    const stored = localStorage.getItem(NAV_STORAGE_KEY);
    if (stored) {
      const parsed: NavItemConfig[] = JSON.parse(stored);
      // Merge defaults if any new item was added
      const existingIds = new Set(parsed.map(i => i.id));
      const missingDefaults = DEFAULT_NAV_ORDER.filter(d => !existingIds.has(d.id));
      return [...parsed, ...missingDefaults];
    }
  } catch (e) {
    console.warn("Failed to parse stored nav order:", e);
  }
  return DEFAULT_NAV_ORDER;
}

export function saveNavOrderConfig(items: NavItemConfig[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(items));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('warung_nav_order_updated'));
  } catch (e) {
    console.error("Failed to save nav order:", e);
  }
}

export function resetNavOrderConfig() {
  saveNavOrderConfig(DEFAULT_NAV_ORDER);
}
