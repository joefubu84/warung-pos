import { supabase } from '@/integrations/supabase/client';
import { 
  Bell, 
  Receipt, 
  Utensils, 
  Droplet, 
  Package, 
  Sparkles, 
  Flame, 
  RefreshCw, 
  Clock, 
  HelpCircle, 
  Coffee, 
  Hand,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import React from 'react';

export interface CallWaiterReason {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  order: number;
}

export const DEFAULT_CALL_WAITER_REASONS: CallWaiterReason[] = [
  { 
    id: 'waiter', 
    title: 'Panggil Pelayan', 
    description: 'Perlukan bantuan pesanan atau pertanyaan', 
    icon: 'bell', 
    enabled: true, 
    order: 0 
  },
  { 
    id: 'bill', 
    title: 'Minta Bil Fizikal', 
    description: 'Sedia untuk bayar secara tunai / kad di meja', 
    icon: 'receipt', 
    enabled: true, 
    order: 1 
  },
  { 
    id: 'cutlery', 
    title: 'Tambah Sudu / Garpu / Mangkuk', 
    description: 'Peralatan makan tambahan', 
    icon: 'utensils', 
    enabled: true, 
    order: 2 
  },
  { 
    id: 'water', 
    title: 'Tambah Air Kosong', 
    description: 'Air suam / ais untuk meja', 
    icon: 'droplet', 
    enabled: true, 
    order: 3 
  }
];

export const PRESET_CALL_WAITER_REASONS = [
  { 
    title: 'Bungkus Makanan (Tapau)', 
    description: 'Minta bekas / plastik untuk bawa pulang baki makanan', 
    icon: 'package' 
  },
  { 
    title: 'Bersihkan Meja / Tumpahan', 
    description: 'Meja kotor, basah atau makanan tumpah', 
    icon: 'sparkles' 
  },
  { 
    title: 'Minta Sambal / Sos Tambahan', 
    description: 'Ekstra sambal belacan, cili padi atau kicap', 
    icon: 'flame' 
  },
  { 
    title: 'Tukar Meja Makan', 
    description: 'Mohon berpindah ke meja lain', 
    icon: 'refresh-cw' 
  },
  { 
    title: 'Semak Status Makanan', 
    description: 'Pesanan belum sampai atau lewat', 
    icon: 'clock' 
  },
  { 
    title: 'Tambah Tisu / Basuh Tangan', 
    description: 'Perlukan tisu kering / tisu basah tambahan', 
    icon: 'hand' 
  },
];

export const AVAILABLE_ICONS = [
  { id: 'bell', label: 'Loceng', icon: Bell },
  { id: 'receipt', label: 'Resit / Bil', icon: Receipt },
  { id: 'utensils', label: 'Sudu & Garpu', icon: Utensils },
  { id: 'droplet', label: 'Air Minuman', icon: Droplet },
  { id: 'package', label: 'Kotak Bungkus', icon: Package },
  { id: 'sparkles', label: 'Bersih / Kilat', icon: Sparkles },
  { id: 'flame', label: 'Pedas / Sambal', icon: Flame },
  { id: 'refresh-cw', label: 'Tukar Meja', icon: RefreshCw },
  { id: 'clock', label: 'Jam / Status', icon: Clock },
  { id: 'hand', label: 'Tisu / Tangan', icon: Hand },
  { id: 'coffee', label: 'Kopi / Minuman', icon: Coffee },
  { id: 'help-circle', label: 'Bantuan Am', icon: HelpCircle }
];

export function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> {
  switch (iconName?.toLowerCase()) {
    case 'receipt':
      return Receipt;
    case 'utensils':
      return Utensils;
    case 'droplet':
      return Droplet;
    case 'package':
      return Package;
    case 'sparkles':
      return Sparkles;
    case 'flame':
      return Flame;
    case 'refresh-cw':
      return RefreshCw;
    case 'clock':
      return Clock;
    case 'hand':
      return Hand;
    case 'coffee':
      return Coffee;
    case 'help-circle':
      return HelpCircle;
    case 'bell':
    default:
      return Bell;
  }
}

const STORAGE_KEY = 'warung_call_waiter_reasons_v1';

export function getCallWaiterReasons(): CallWaiterReason[] {
  if (typeof localStorage === 'undefined') return DEFAULT_CALL_WAITER_REASONS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
    }
  } catch (e) {
    console.warn("Failed to parse stored call waiter reasons:", e);
  }
  return DEFAULT_CALL_WAITER_REASONS;
}

export function saveCallWaiterReasonsLocally(reasons: CallWaiterReason[]) {
  if (typeof localStorage === 'undefined') return;
  const sorted = [...reasons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  window.dispatchEvent(new CustomEvent('warung_call_waiter_reasons_updated', { detail: sorted }));
}

export async function syncCallWaiterReasonsToSupabase(reasons: CallWaiterReason[]) {
  const sorted = [...reasons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  saveCallWaiterReasonsLocally(sorted);

  try {
    const { data: storeData } = await supabase.from('stores').select('id, settings').limit(1).maybeSingle();
    const storeId = storeData?.id;
    if (!storeId) return false;

    const currentSettings = (storeData.settings as any) || {};
    const { error } = await supabase.from('stores').update({
      settings: {
        ...currentSettings,
        call_waiter_reasons: sorted
      }
    } as any).eq('id', storeId);

    if (error) {
      console.error("Error saving call waiter reasons to Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Failed to sync call waiter reasons to database:", err);
    return false;
  }
}

export async function fetchCallWaiterReasonsFromSupabase(): Promise<CallWaiterReason[]> {
  try {
    const { data: storeData } = await supabase.from('stores').select('settings').limit(1).maybeSingle();
    const remoteReasons = (storeData?.settings as any)?.call_waiter_reasons;
    if (Array.isArray(remoteReasons) && remoteReasons.length > 0) {
      saveCallWaiterReasonsLocally(remoteReasons);
      return remoteReasons;
    }
  } catch (err) {
    console.warn("Could not fetch call waiter reasons from Supabase, using local fallback:", err);
  }
  return getCallWaiterReasons();
}

export async function resetCallWaiterReasonsToDefault() {
  await syncCallWaiterReasonsToSupabase(DEFAULT_CALL_WAITER_REASONS);
  return DEFAULT_CALL_WAITER_REASONS;
}
