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

export interface ModifierBadge {
  id: string;
  icon: string;
  label: string;
  colorClass: string;
}

export const COMMON_MODIFIERS = [
  { id: 'no_chili', icon: '🚫🌶️', label: 'Tak Nak Lada / Kurang Pedas', tag: 'tak nak lada' },
  { id: 'extra_spicy', icon: '🔥🌶️', label: 'Ekstra Pedas / Pedas Gila', tag: 'ekstra pedas' },
  { id: 'no_vege', icon: '🥒🚫', label: 'Tak Nak Sayur / Tanpa Timun', tag: 'tak nak timun' },
  { id: 'kangkung', icon: '🥬', label: 'Sayur Kangkung Sahaja', tag: 'kangkung sahaja' },
  { id: 'sauce_aside', icon: '🥣', label: 'Sambal / Kuah Asing', tag: 'sambal asing' },
  { id: 'extra_rice', icon: '🍚', label: 'Tambah Nasi', tag: 'tambah nasi' },
  { id: 'less_sweet', icon: '🧊', label: 'Kurang Manis / Kurang Ais', tag: 'kurang manis' }
];

export function detectModifierBadges(notes?: string | null): ModifierBadge[] {
  if (!notes) return [];
  const n = notes.toLowerCase();
  const badges: ModifierBadge[] = [];

  // No chili / tak nak lada / kurang pedas
  if (n.includes('tak nak lada') || n.includes('tak pedas') || n.includes('kurang pedas') || n.includes('no chili') || n.includes('no spicy') || n.includes('tanpa lada')) {
    badges.push({ id: 'no_chili', icon: '🚫🌶️', label: 'TANPA LADA / TAK PEDAS', colorClass: 'bg-amber-400 text-slate-950 font-black border-2 border-amber-300 shadow-md' });
  }

  // Extra spicy / nak pedas / pedas gila
  if (n.includes('nak pedas') || n.includes('ekstra pedas') || n.includes('extra pedas') || n.includes('pedas gila') || n.includes('tambah lada') || n.includes('pedas')) {
    if (!badges.some(b => b.id === 'no_chili')) {
      badges.push({ id: 'extra_spicy', icon: '🔥🌶️', label: 'EKSTRA PEDAS!', colorClass: 'bg-rose-600 text-white font-black border-2 border-white shadow-lg animate-pulse' });
    }
  }

  // No vege / tak nak timun / sayur
  if (n.includes('tak nak sayur') || n.includes('tanpa timun') || n.includes('tak nak timun') || n.includes('no sayur') || n.includes('no vege') || n.includes('tak mahu sayur')) {
    badges.push({ id: 'no_vege', icon: '🥒🚫', label: 'TANPA TIMUN / SAYUR', colorClass: 'bg-sky-400 text-slate-950 font-black border-2 border-sky-300 shadow-md' });
  }

  // Kangkung sahaja / sayur khusus
  if (n.includes('kangkung') || n.includes('sayur kangkung') || n.includes('kangkung sahaja')) {
    badges.push({ id: 'kangkung', icon: '🥬', label: 'KANGKUNG SAHAJA', colorClass: 'bg-emerald-500 text-slate-950 font-black border-2 border-emerald-300 shadow-md' });
  }

  // Sambal / kuah asing
  if (n.includes('sambal asing') || n.includes('kuah asing') || n.includes('asing') || n.includes('kuah banjir') || n.includes('banjir')) {
    badges.push({ id: 'sauce_aside', icon: '🥣', label: n.includes('banjir') ? 'KUAH BANJIR' : 'SAMBAL/KUAH ASING', colorClass: 'bg-purple-600 text-white font-black border-2 border-purple-300 shadow-md' });
  }

  // Tambah nasi
  if (n.includes('tambah nasi') || n.includes('extra nasi') || n.includes('nasi lebih')) {
    badges.push({ id: 'extra_rice', icon: '🍚', label: 'TAMBAH NASI', colorClass: 'bg-orange-500 text-white font-black border-2 border-orange-300 shadow-md' });
  }

  // Kurang manis / ais
  if (n.includes('kurang manis') || n.includes('kurang ais') || n.includes('tak nak manis') || n.includes('tanpa ais')) {
    badges.push({ id: 'less_sweet', icon: '🧊', label: 'KURANG MANIS / AIS', colorClass: 'bg-cyan-500 text-slate-950 font-black border-2 border-cyan-300 shadow-md' });
  }

  return badges;
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
