import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'cashier' | 'chef' | 'staff';

export interface StaffUser {
  id: string;
  name: string;
  role: AppRole;
  email: string;
  phone?: string;
  pin: string; // 4-6 digit quick PIN for instant counter/kitchen POS switching
  allowed_pages?: string[]; // Specific customized routes, or fallback to role defaults
  active: boolean;
  created_at: string;
}

export interface RolePagePermissions {
  admin: string[];
  cashier: string[];
  chef: string[];
  staff: string[];
}

export interface StaffAccessConfig {
  staff_users: StaffUser[];
  role_permissions: RolePagePermissions;
}

export interface SystemPageInfo {
  path: string;
  name: string;
  category: 'counter' | 'kitchen' | 'management' | 'general';
  emoji: string;
  description: string;
  defaultRoles: AppRole[];
}

export const SYSTEM_PAGES: SystemPageInfo[] = [
  {
    path: '/counter',
    name: 'Kaunter Jualan POS',
    category: 'counter',
    emoji: '🛒',
    description: 'Ambil pesanan Dine-in & Takeaway, kira bil dan terima bayaran tunai / DuitNow QR',
    defaultRoles: ['admin', 'cashier', 'staff']
  },
  {
    path: '/inventory',
    name: 'Urus Stok & Habis (86)',
    category: 'general',
    emoji: '📦',
    description: 'Pantau baki hidangan, tandakan lauk Habis (86 / Sold Out) dan kemas kini stok',
    defaultRoles: ['admin', 'cashier', 'chef', 'staff']
  },
  {
    path: '/orders',
    name: 'Senarai Pesanan (Orders)',
    category: 'general',
    emoji: '📋',
    description: 'Pantau status tiket pesanan pelanggan, cetak resit bayaran dan semak transaksi',
    defaultRoles: ['admin', 'cashier', 'chef', 'staff']
  },
  {
    path: '/kitchen',
    name: 'Paparan Dapur (Kitchen KDS)',
    category: 'kitchen',
    emoji: '🍳',
    description: 'Skrin tukang masak untuk terima tiket masa nyata dan bunyi loceng amaran dapur',
    defaultRoles: ['admin', 'chef']
  },
  {
    path: '/tables',
    name: 'Susun Atur Meja & QR (Tables)',
    category: 'counter',
    emoji: '📱',
    description: 'Urus 15 meja dan cetak stiker kod QR pesanan digital pelanggan',
    defaultRoles: ['admin', 'cashier']
  },
  {
    path: '/cash',
    name: 'Pengurusan Wang Tunai (Cash)',
    category: 'counter',
    emoji: '💰',
    description: 'Buka kaunter duit apungan pagi, rekod petty cash laci dan tutup syif malam',
    defaultRoles: ['admin', 'cashier']
  },
  {
    path: '/menu',
    name: 'Katalog Menu Hidangan',
    category: 'management',
    emoji: '🍱',
    description: 'Katalog senarai makanan, gambar, harga hidangan dan kategori lauk',
    defaultRoles: ['admin', 'cashier']
  },
  {
    path: '/loyalty',
    name: 'Ganjaran Pelanggan (Loyalty)',
    category: 'management',
    emoji: '💎',
    description: 'Program mata ganjaran kesetiaan pelanggan dan diskaun khas',
    defaultRoles: ['admin']
  },
  {
    path: '/dashboard',
    name: 'Laporan & Analisis Jualan',
    category: 'management',
    emoji: '📊',
    description: 'Ringkasan jualan harian, kutipan wang tunai vs QR dan statistik warung',
    defaultRoles: ['admin']
  },
  {
    path: '/settings',
    name: 'Pusat Tetapan (Settings)',
    category: 'management',
    emoji: '⚙️',
    description: 'Konfigurasi pencetak, bunyi dapur, homepage dan pengurusan staf (eksklusif Admin)',
    defaultRoles: ['admin']
  }
];

export const DEFAULT_ROLE_PERMISSIONS: RolePagePermissions = {
  admin: [
    '/counter',
    '/inventory',
    '/orders',
    '/kitchen',
    '/tables',
    '/cash',
    '/menu',
    '/loyalty',
    '/dashboard',
    '/settings'
  ],
  cashier: [
    '/counter',
    '/inventory',
    '/orders',
    '/tables',
    '/cash',
    '/menu'
  ],
  chef: [
    '/kitchen',
    '/orders',
    '/inventory'
  ],
  staff: [
    '/counter',
    '/orders',
    '/inventory',
    '/kitchen'
  ]
};

export const DEFAULT_STAFF_USERS: StaffUser[] = [
  {
    id: '0f81ea5a-e622-4343-a188-62f90dc1ef14',
    name: 'Admin Warung J&J',
    role: 'admin',
    email: 'ogyic84@gmail.com',
    phone: '0172221784',
    pin: '8888',
    allowed_pages: DEFAULT_ROLE_PERMISSIONS.admin,
    active: true,
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'staff-cashier-001',
    name: 'Siti (Staf Kaunter)',
    role: 'cashier',
    email: 'kaunter@warungjnj.com',
    phone: '012-345 6789',
    pin: '1234',
    allowed_pages: DEFAULT_ROLE_PERMISSIONS.cashier,
    active: true,
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: 'staff-chef-001',
    name: 'Chef Mat (Staf Dapur)',
    role: 'chef',
    email: 'dapur@warungjnj.com',
    phone: '013-987 6543',
    pin: '5678',
    allowed_pages: DEFAULT_ROLE_PERMISSIONS.chef,
    active: true,
    created_at: '2026-01-01T00:00:00Z'
  }
];

export const DEFAULT_STAFF_ACCESS_CONFIG: StaffAccessConfig = {
  staff_users: DEFAULT_STAFF_USERS,
  role_permissions: DEFAULT_ROLE_PERMISSIONS
};

const STORAGE_KEY = 'warung_staff_access_config_v1';
const ACTIVE_STAFF_STORAGE_KEY = 'warung_active_staff_user';
const DEFAULT_STORE_ID = '1094d737-8104-4a55-b678-0fe9097beba0';

export function getStaffAccessConfig(): StaffAccessConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_STAFF_ACCESS_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        staff_users: Array.isArray(parsed.staff_users) && parsed.staff_users.length > 0 
          ? parsed.staff_users 
          : DEFAULT_STAFF_USERS,
        role_permissions: {
          ...DEFAULT_ROLE_PERMISSIONS,
          ...(parsed.role_permissions || {})
        }
      };
    }
  } catch (e) {
    console.warn("Failed to parse stored staff access config:", e);
  }
  return DEFAULT_STAFF_ACCESS_CONFIG;
}

export function saveStaffAccessConfigLocally(config: StaffAccessConfig) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('warung_staff_permissions_updated', { detail: config }));
  } catch (e) {
    console.error("Failed to save staff access config locally:", e);
  }
}

export function getActiveStaffUser(): StaffUser | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(ACTIVE_STAFF_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to parse active staff user:", e);
  }
  return null;
}

export function setActiveStaffUser(user: StaffUser | null) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(ACTIVE_STAFF_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(ACTIVE_STAFF_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('warung_active_staff_updated', { detail: user }));
  } catch (e) {
    console.error("Failed to set active staff user:", e);
  }
}

export async function syncStaffAccessConfigToSupabase(
  config: StaffAccessConfig, 
  customStoreId?: string
): Promise<boolean> {
  saveStaffAccessConfigLocally(config);

  const storeId = customStoreId || DEFAULT_STORE_ID;
  let success = false;

  // 1. Primary Sync: public.landing_page_config (Zero RLS restrictions, guaranteed accessible)
  try {
    const { data: existingLpc } = await (supabase
      .from('landing_page_config' as any)
      .select('id, config') as any)
      .eq('store_id', storeId)
      .limit(1)
      .maybeSingle();

    if (existingLpc) {
      const updatedConfig = {
        ...((existingLpc.config as any) || {}),
        staff_access: config
      };
      const { error: lpcUpdateErr } = await (supabase
        .from('landing_page_config' as any)
        .update({ config: updatedConfig, updated_at: new Date().toISOString() }) as any)
        .eq('id', existingLpc.id);

      if (!lpcUpdateErr) success = true;
    } else {
      const { error: lpcInsertErr } = await (supabase
        .from('landing_page_config' as any)
        .insert({
          store_id: storeId,
          config: { staff_access: config },
          updated_at: new Date().toISOString()
        }) as any);

      if (!lpcInsertErr) success = true;
    }
  } catch (err) {
    console.warn("Sync staff access to landing_page_config warning:", err);
  }

  // 2. Secondary Sync: stores.settings.staff_access (For authenticated admin roles)
  try {
    const { data: storeData } = await supabase
      .from('stores')
      .select('id, settings')
      .eq('id', storeId)
      .limit(1)
      .maybeSingle();

    const currentSettings = (storeData?.settings as any) || {};
    const { error: storeUpdateErr } = await supabase
      .from('stores')
      .update({
        settings: {
          ...currentSettings,
          staff_access: config
        }
      } as any)
      .eq('id', storeId);

    if (!storeUpdateErr) success = true;
  } catch (err) {
    console.warn("Sync staff access to stores.settings warning:", err);
  }

  return success;
}

export async function fetchStaffAccessConfigFromSupabase(customStoreId?: string): Promise<StaffAccessConfig> {
  const storeId = customStoreId || DEFAULT_STORE_ID;

  // 1. Check landing_page_config first
  try {
    const { data: lpcData } = await (supabase
      .from('landing_page_config' as any)
      .select('config') as any)
      .eq('store_id', storeId)
      .limit(1)
      .maybeSingle();

    const lpcStaffAccess = (lpcData?.config as any)?.staff_access;
    if (lpcStaffAccess && typeof lpcStaffAccess === 'object') {
      const merged: StaffAccessConfig = {
        staff_users: Array.isArray(lpcStaffAccess.staff_users) && lpcStaffAccess.staff_users.length > 0
          ? lpcStaffAccess.staff_users
          : DEFAULT_STAFF_USERS,
        role_permissions: {
          ...DEFAULT_ROLE_PERMISSIONS,
          ...(lpcStaffAccess.role_permissions || {})
        }
      };
      saveStaffAccessConfigLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not fetch staff access from landing_page_config:", err);
  }

  // 2. Fallback check stores.settings.staff_access
  try {
    const { data: storeData } = await supabase
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .limit(1)
      .maybeSingle();

    const remoteStaffAccess = (storeData?.settings as any)?.staff_access;
    if (remoteStaffAccess && typeof remoteStaffAccess === 'object') {
      const merged: StaffAccessConfig = {
        staff_users: Array.isArray(remoteStaffAccess.staff_users) && remoteStaffAccess.staff_users.length > 0
          ? remoteStaffAccess.staff_users
          : DEFAULT_STAFF_USERS,
        role_permissions: {
          ...DEFAULT_ROLE_PERMISSIONS,
          ...(remoteStaffAccess.role_permissions || {})
        }
      };
      saveStaffAccessConfigLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not fetch staff access from stores.settings:", err);
  }

  return getStaffAccessConfig();
}

/**
 * Determines whether a given pathname is allowed for the active user / role.
 */
export function isPageAllowedForUser(
  pathname: string, 
  role?: string, 
  staffUser?: StaffUser | null
): boolean {
  // Admin ALWAYS has 100% full access to all pages
  if (role === 'admin' || staffUser?.role === 'admin') {
    return true;
  }

  // Normalize path (strip trailing slashes or subpaths)
  const baseRoute = '/' + pathname.split('/')[1];

  // If specific staff user has custom allowed_pages, check that first
  if (staffUser?.allowed_pages && staffUser.allowed_pages.length > 0) {
    return staffUser.allowed_pages.includes(baseRoute);
  }

  // Otherwise check role-based global permissions
  const config = getStaffAccessConfig();
  const effectiveRole = (staffUser?.role || role || 'staff') as AppRole;
  const allowedList = config.role_permissions[effectiveRole] || DEFAULT_ROLE_PERMISSIONS[effectiveRole] || [];

  return allowedList.includes(baseRoute);
}

/**
 * Returns the primary landing page for a given staff user or role.
 */
export function getPrimaryPageForRole(role?: string, staffUser?: StaffUser | null): string {
  const effectiveRole = staffUser?.role || role;
  if (effectiveRole === 'chef') return '/kitchen';
  if (effectiveRole === 'cashier') return '/counter';
  if (effectiveRole === 'rider') return '/rider';
  return '/counter';
}
