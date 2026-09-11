import { supabase } from '@/integrations/supabase/client';

export interface TableQrConfig {
  shared_table_notice: string;
  cta_title: string;
  cta_subtitle: string;
  stall_subtitle: string;
  step_1: string;
  step_2: string;
  step_3: string;
  footer_note: string;
}

export const DEFAULT_TABLE_QR_CONFIG: TableQrConfig = {
  shared_table_notice: "Meja Kongsi: Anda dialu-alukan menikmati makanan daripada mana-mana gerai pilihan anda. Pesanan menu Warung J&J akan terus dihantar ke meja ini oleh kru kami!",
  cta_title: "📲 IMBAS UNTUK LIHAT MENU & PESAN",
  cta_subtitle: "Scan me to view & order at Warung J&J",
  stall_subtitle: "Masakan Panas & Minuman",
  step_1: "1. Buka Kamera",
  step_2: "2. Imbas QR",
  step_3: "3. Pilih & Pesan",
  footer_note: "✂️ Gunting ikut garisan"
};

const STORAGE_KEY = 'warung_table_qr_config_v1';

export function getTableQrConfig(): TableQrConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_TABLE_QR_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_TABLE_QR_CONFIG,
        ...parsed
      };
    }
  } catch (e) {
    console.warn("Failed to parse stored table QR config:", e);
  }
  return DEFAULT_TABLE_QR_CONFIG;
}

export function saveTableQrConfigLocally(config: TableQrConfig) {
  if (typeof localStorage === 'undefined') return;
  const merged = { ...DEFAULT_TABLE_QR_CONFIG, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('warung_table_qr_config_updated', { detail: merged }));
}

export async function syncTableQrConfigToSupabase(config: TableQrConfig, customStoreId?: string): Promise<boolean> {
  const merged = { ...DEFAULT_TABLE_QR_CONFIG, ...config };
  saveTableQrConfigLocally(merged);

  try {
    let storeId = customStoreId;
    let currentSettings: any = {};

    if (!storeId) {
      const { data: storeData } = await supabase.from('stores').select('id, settings').limit(1).maybeSingle();
      storeId = storeData?.id || '1094d737-8104-4a55-b678-0fe9097beba0';
      currentSettings = (storeData?.settings as any) || {};
    } else {
      const { data: storeData } = await supabase.from('stores').select('settings').eq('id', storeId).maybeSingle();
      currentSettings = (storeData?.settings as any) || {};
    }

    const { error } = await supabase.from('stores').update({
      settings: {
        ...currentSettings,
        table_qr: merged
      }
    } as any).eq('id', storeId);

    if (error) {
      console.error("Error saving table QR config to Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to sync table QR config to database:", err);
    return false;
  }
}

export async function fetchTableQrConfigFromSupabase(customStoreId?: string): Promise<TableQrConfig> {
  try {
    let query = supabase.from('stores').select('settings');
    if (customStoreId) {
      query = query.eq('id', customStoreId);
    }
    const { data: storeData } = await query.limit(1).maybeSingle();
    const remoteConfig = (storeData?.settings as any)?.table_qr;
    if (remoteConfig && typeof remoteConfig === 'object') {
      const merged = { ...DEFAULT_TABLE_QR_CONFIG, ...remoteConfig };
      saveTableQrConfigLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not fetch table QR config from Supabase, using local fallback:", err);
  }
  return getTableQrConfig();
}

export async function resetTableQrConfigToDefault(customStoreId?: string): Promise<TableQrConfig> {
  await syncTableQrConfigToSupabase(DEFAULT_TABLE_QR_CONFIG, customStoreId);
  return DEFAULT_TABLE_QR_CONFIG;
}