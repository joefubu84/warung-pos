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
const DEFAULT_STORE_ID = '1094d737-8104-4a55-b678-0fe9097beba0';

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

  let success = false;
  const storeId = customStoreId || DEFAULT_STORE_ID;

  // 1. Primary Sync: public.landing_page_config (Permissive RLS, 100% accessible to public & staff)
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
        table_qr: merged
      };
      const { error: lpcUpdateErr } = await (supabase
        .from('landing_page_config' as any)
        .update({ config: updatedConfig, updated_at: new Date().toISOString() }) as any)
        .eq('id', existingLpc.id);

      if (!lpcUpdateErr) {
        success = true;
      }
    } else {
      const { error: lpcInsertErr } = await (supabase
        .from('landing_page_config' as any)
        .insert({
          store_id: storeId,
          config: { table_qr: merged },
          updated_at: new Date().toISOString()
        }) as any);

      if (!lpcInsertErr) {
        success = true;
      }
    }
  } catch (lpcErr) {
    console.warn("Sync to landing_page_config error:", lpcErr);
  }

  // 2. Secondary Sync: stores.settings.table_qr (For authenticated admin roles)
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
          table_qr: merged
        }
      } as any)
      .eq('id', storeId);

    if (!storeUpdateErr) {
      success = true;
    }
  } catch (storeErr) {
    console.warn("Secondary sync to stores.settings error:", storeErr);
  }

  return success;
}

export async function fetchTableQrConfigFromSupabase(customStoreId?: string): Promise<TableQrConfig> {
  const storeId = customStoreId || DEFAULT_STORE_ID;

  // 1. Check landing_page_config first
  try {
    const { data: lpcData } = await (supabase
      .from('landing_page_config' as any)
      .select('config') as any)
      .eq('store_id', storeId)
      .limit(1)
      .maybeSingle();

    const lpcTableQr = (lpcData?.config as any)?.table_qr;
    if (lpcTableQr && typeof lpcTableQr === 'object') {
      const merged = { ...DEFAULT_TABLE_QR_CONFIG, ...lpcTableQr };
      saveTableQrConfigLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not fetch table QR config from landing_page_config:", err);
  }

  // 2. Fallback check stores.settings.table_qr
  try {
    const { data: storeData } = await supabase
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .limit(1)
      .maybeSingle();

    const remoteConfig = (storeData?.settings as any)?.table_qr;
    if (remoteConfig && typeof remoteConfig === 'object') {
      const merged = { ...DEFAULT_TABLE_QR_CONFIG, ...remoteConfig };
      saveTableQrConfigLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not fetch table QR config from stores, using local fallback:", err);
  }

  return getTableQrConfig();
}

export async function resetTableQrConfigToDefault(customStoreId?: string): Promise<TableQrConfig> {
  await syncTableQrConfigToSupabase(DEFAULT_TABLE_QR_CONFIG, customStoreId);
  return DEFAULT_TABLE_QR_CONFIG;
}