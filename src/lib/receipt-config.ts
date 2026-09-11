import { supabase } from '@/integrations/supabase/client';

export interface ReceiptCustomConfig {
  store_name: string;
  store_sub_header: string; // e.g. Penampang, Sabah
  phone_number: string;     // e.g. 60172221784
  show_logo: boolean;
  order_id_prefix: string;  // e.g. ORDER #
  cashier_label: string;    // e.g. Juruwang:
  footer_line_1: string;    // e.g. Terima Kasih Atas Pesanan Anda!
  footer_line_2: string;    // e.g. Sila Datang Lagi.
  custom_footer_note?: string; // Optional promo/social message e.g. Follow IG & TikTok: @warungjnj
  show_notes: boolean;      // Show dish notes e.g. kurang manis
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptCustomConfig = {
  store_name: 'WARUNG J&J',
  store_sub_header: 'Penampang, Sabah',
  phone_number: '60172221784',
  show_logo: true,
  order_id_prefix: 'ORDER #',
  cashier_label: 'Juruwang:',
  footer_line_1: 'Terima Kasih Atas Pesanan Anda!',
  footer_line_2: 'Sila Datang Lagi.',
  custom_footer_note: '',
  show_notes: true,
};

const STORAGE_KEY = 'warung_receipt_config_v1';
const DEFAULT_STORE_ID = '1094d737-8104-4a55-b678-0fe9097beba0';

/**
 * Reads the latest receipt configuration synchronously from localStorage (instant cache)
 */
export function getReceiptCustomConfig(): ReceiptCustomConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_RECEIPT_CONFIG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_RECEIPT_CONFIG,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Failed to parse cached receipt config:', e);
  }
  return DEFAULT_RECEIPT_CONFIG;
}

/**
 * Saves receipt configuration to localStorage and notifies listeners
 */
export function saveReceiptConfigLocally(config: ReceiptCustomConfig) {
  if (typeof localStorage === 'undefined') return;
  const merged = { ...DEFAULT_RECEIPT_CONFIG, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('warung_receipt_config_updated', { detail: merged }));
}

/**
 * Fetches receipt configuration from Supabase (landing_page_config or stores)
 */
export async function fetchReceiptConfigFromSupabase(customStoreId?: string): Promise<ReceiptCustomConfig> {
  const storeId = customStoreId || DEFAULT_STORE_ID;

  // 1. Primary: landing_page_config (Permissive RLS)
  try {
    const { data: lpcData } = await (supabase
      .from('landing_page_config' as any)
      .select('config') as any)
      .eq('store_id', storeId)
      .limit(1)
      .maybeSingle();

    const lpcReceipt = (lpcData?.config as any)?.receipt_config;
    if (lpcReceipt && typeof lpcReceipt === 'object') {
      const merged = { ...DEFAULT_RECEIPT_CONFIG, ...lpcReceipt };
      saveReceiptConfigLocally(merged);
      return merged;
    }
  } catch (err) {
    console.warn('Could not fetch receipt config from landing_page_config:', err);
  }

  // 2. Fallback: stores.settings.receipt_config
  try {
    const { data: storeData } = await supabase
      .from('stores')
      .select('settings, name, phone_number')
      .eq('id', storeId)
      .limit(1)
      .maybeSingle();

    const remoteConfig = (storeData?.settings as any)?.receipt_config;
    if (remoteConfig && typeof remoteConfig === 'object') {
      const merged = { ...DEFAULT_RECEIPT_CONFIG, ...remoteConfig };
      saveReceiptConfigLocally(merged);
      return merged;
    }
    // If no config set yet, prefill from store profile
    if (storeData?.name || storeData?.phone_number) {
      const prefilled: ReceiptCustomConfig = {
        ...DEFAULT_RECEIPT_CONFIG,
        store_name: storeData.name ? storeData.name.toUpperCase() : DEFAULT_RECEIPT_CONFIG.store_name,
        phone_number: storeData.phone_number || DEFAULT_RECEIPT_CONFIG.phone_number,
      };
      saveReceiptConfigLocally(prefilled);
      return prefilled;
    }
  } catch (err) {
    console.warn('Could not fetch receipt config from stores:', err);
  }

  return getReceiptCustomConfig();
}

/**
 * Synchronizes receipt configuration to Supabase & localStorage
 */
export async function syncReceiptConfigToSupabase(
  config: ReceiptCustomConfig,
  customStoreId?: string
): Promise<boolean> {
  const merged = { ...DEFAULT_RECEIPT_CONFIG, ...config };
  saveReceiptConfigLocally(merged);

  let success = false;
  const storeId = customStoreId || DEFAULT_STORE_ID;

  // 1. Sync to landing_page_config
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
        receipt_config: merged,
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
          config: { receipt_config: merged },
          updated_at: new Date().toISOString(),
        }) as any);

      if (!lpcInsertErr) success = true;
    }
  } catch (lpcErr) {
    console.warn('Sync receipt to landing_page_config error:', lpcErr);
  }

  // 2. Sync to stores.settings
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
          receipt_config: merged,
        },
      } as any)
      .eq('id', storeId);

    if (!storeUpdateErr) success = true;
  } catch (storeErr) {
    console.warn('Secondary sync to stores.settings error:', storeErr);
  }

  return success;
}

/**
 * Resets receipt configuration to defaults
 */
export async function resetReceiptConfigToDefault(customStoreId?: string): Promise<ReceiptCustomConfig> {
  await syncReceiptConfigToSupabase(DEFAULT_RECEIPT_CONFIG, customStoreId);
  return DEFAULT_RECEIPT_CONFIG;
}
