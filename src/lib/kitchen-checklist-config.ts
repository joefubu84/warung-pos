// Kitchen Checklist & Component Configuration
export interface KitchenComponent {
  key: string;
  icon: string;
  label: string;
}

export interface MenuItemChecklistConfig {
  menuItemId: string;
  menuItemName: string;
  components: KitchenComponent[];
}

export const DEFAULT_GLOBAL_COMPONENTS: KitchenComponent[] = [
  { key: 'rice', icon: '🍚', label: 'Nasi / Mee' },
  { key: 'protein', icon: '🍗', label: 'Lauk Utama' },
  { key: 'sambal', icon: '🌶️', label: 'Sambal J&J' },
  { key: 'soup', icon: '🥣', label: 'Kuah / Sup' },
  { key: 'ulam', icon: '🥒', label: 'Ulam / Sayur' }
];

export const PRESET_ICONS = ['🍚', '🍗', '🐟', '🥩', '🌶️', '🥣', '🥒', '🥤', '🧊', '🍟', '🥫', '🥢', '🥚', '🧀', '🍞', '🍢', '🥜', '🧅', '🍔', '🥟'];

const KITCHEN_CHECKLIST_KEY = 'warung_kitchen_checklist_config_v1';
const MENU_CHECKLIST_MAP_KEY = 'warung_menu_item_checklist_map_v1';

export function getGlobalChecklistComponents(): KitchenComponent[] {
  if (typeof localStorage === 'undefined') return DEFAULT_GLOBAL_COMPONENTS;
  try {
    const stored = localStorage.getItem(KITCHEN_CHECKLIST_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Failed to parse stored global checklist:", e);
  }
  return DEFAULT_GLOBAL_COMPONENTS;
}

export function saveGlobalChecklistComponents(components: KitchenComponent[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KITCHEN_CHECKLIST_KEY, JSON.stringify(components));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('warung_kitchen_checklist_updated'));
    }
  } catch (e) {
    console.error("Failed to save global checklist config:", e);
  }
}

export function getMenuItemChecklistMap(): Record<string, KitchenComponent[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const stored = localStorage.getItem(MENU_CHECKLIST_MAP_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to parse menu checklist map:", e);
  }
  return {};
}

export function saveMenuItemChecklist(menuItemId: string, components: KitchenComponent[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    const map = getMenuItemChecklistMap();
    if (!components || components.length === 0) {
      delete map[menuItemId];
    } else {
      map[menuItemId] = components;
    }
    localStorage.setItem(MENU_CHECKLIST_MAP_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('warung_kitchen_checklist_updated'));
    }
  } catch (e) {
    console.error("Failed to save menu checklist config:", e);
  }
}

export function resolveDishComponents(menuItemId: string | undefined, itemName: string, notes?: string | null): KitchenComponent[] {
  // 1. Check if specific menu item has custom checklist defined
  if (menuItemId) {
    const menuMap = getMenuItemChecklistMap();
    if (menuMap[menuItemId] && menuMap[menuItemId].length > 0) {
      const list = [...menuMap[menuItemId]];
      if (notes) list.push({ key: 'notes', icon: '⚠️', label: `Nota: ${notes}` });
      return list;
    }
  }

  const nameLower = (itemName || '').toLowerCase();
  
  // 2. Drinks
  if (nameLower.includes('teh') || nameLower.includes('kopi') || nameLower.includes('milo') || nameLower.includes('sirap') || nameLower.includes('jus') || nameLower.includes('air') || nameLower.includes('tea') || nameLower.includes('nescafe') || nameLower.includes('horlicks') || nameLower.includes('lemon')) {
    const list: KitchenComponent[] = [
      { key: 'drink', icon: '🥤', label: 'Air / Minuman' },
      { key: 'straw', icon: '🧊', label: 'Ais & Straw' }
    ];
    if (notes) list.push({ key: 'notes', icon: '⚠️', label: `Nota: ${notes}` });
    return list;
  }
  
  // 3. Snacks / Sides
  if (nameLower.includes('popcorn') || nameLower.includes('fries') || nameLower.includes('kentang') || nameLower.includes('nugget') || nameLower.includes('pisang') || nameLower.includes('keropok') || nameLower.includes('burger') || nameLower.includes('sosej')) {
    const list: KitchenComponent[] = [
      { key: 'main', icon: '🍟', label: 'Makanan Panas' },
      { key: 'sauce', icon: '🥫', label: 'Sos / Mayonis' }
    ];
    if (notes) list.push({ key: 'notes', icon: '⚠️', label: `Nota: ${notes}` });
    return list;
  }
  
  // 4. Soups & Bakso
  if (nameLower.includes('sup') || nameLower.includes('soup') || nameLower.includes('soto') || nameLower.includes('bakso')) {
    const list: KitchenComponent[] = [
      { key: 'soup_bowl', icon: '🥣', label: 'Mangkuk Sup' },
      { key: 'protein', icon: '🥩', label: 'Daging / Lauk' },
      { key: 'sambal', icon: '🌶️', label: 'Sambal Kicap' },
      { key: 'nasi_mee', icon: '🍚', label: 'Nasi / Mee' }
    ];
    if (notes) list.push({ key: 'notes', icon: '⚠️', label: `Nota: ${notes}` });
    return list;
  }

  // 5. Default Global Checklist
  const globalList = [...getGlobalChecklistComponents()];
  if (notes) globalList.push({ key: 'notes', icon: '⚠️', label: `Nota: ${notes}` });
  return globalList;
}
