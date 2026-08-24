import { supabase } from '@/integrations/supabase/client';

export interface LoyaltyMember {
  id: string;
  phone: string;
  name: string;
  points: number;
  totalSpent: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  joinedAt: string;
  lastVisitAt: string;
}

export interface RewardCatalogItem {
  id: string;
  title: string;
  pointsRequired: number;
  rewardType: 'discount_rm' | 'free_item' | 'percentage_off';
  value: number;
  description: string;
  emoji: string;
}

export interface MembershipTransaction {
  id: string;
  phone: string;
  type: 'order_placed' | 'discount_used' | 'welcome_bonus';
  pointsChange: number;
  description: string;
  createdAt: string;
}

export const DEFAULT_REWARDS_CATALOG: RewardCatalogItem[] = [
  {
    id: 'reward-rm8',
    title: 'RM 8.00 Member Discount',
    pointsRequired: 60,
    rewardType: 'discount_rm',
    value: 8.00,
    description: 'Deduct 60 points to unlock instant RM 8.00 discount on your order.',
    emoji: '💎'
  },
  {
    id: 'reward-1',
    title: 'Free Teh Tarik / Sirap Bandung',
    pointsRequired: 30,
    rewardType: 'free_item',
    value: 3.50,
    description: 'Redeem 1 free iced/hot drink of your choice on your order.',
    emoji: '🥤'
  },
  {
    id: 'reward-2',
    title: 'RM 5.00 Off Total Bill',
    pointsRequired: 50,
    rewardType: 'discount_rm',
    value: 5.00,
    description: 'Get RM 5.00 instantly deducted from your current order total.',
    emoji: '💵'
  },
  {
    id: 'reward-3',
    title: 'Free Ayam Goreng Berempah Dish',
    pointsRequired: 80,
    rewardType: 'free_item',
    value: 7.50,
    description: 'Add a crispy fried chicken piece to any meal.',
    emoji: '🍗'
  },
  {
    id: 'reward-4',
    title: 'RM 15.00 VIP Feast Voucher',
    pointsRequired: 150,
    rewardType: 'discount_rm',
    value: 15.00,
    description: 'Enjoy RM 15.00 off on orders over RM 30.00.',
    emoji: '🌟'
  }
];

export const INITIAL_MEMBERS: LoyaltyMember[] = [];

const MEMBERS_STORAGE_KEY = 'warung_loyalty_members_v3';
const TRANSACTIONS_STORAGE_KEY = 'warung_membership_transactions_v2';

export function getLoyaltyMembers(): LoyaltyMember[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MEMBERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed: LoyaltyMember[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function saveLoyaltyMembers(members: LoyaltyMember[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(members));
    window.dispatchEvent(new Event('warung_loyalty_updated'));
    // Persist to Supabase in background
    syncMembersToSupabase(members);
  } catch (err) {
    console.error('Failed to save loyalty members:', err);
  }
}

/**
 * Persists members to Supabase DB asynchronously
 */
export async function syncMembersToSupabase(members: LoyaltyMember[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const defaultStoreId = 'store-jnj-main';

    for (const m of members) {
      const cleanPhone = m.phone.replace(/\D/g, '');
      const formatted = cleanPhone.startsWith('0') ? '60' + cleanPhone.slice(1) : cleanPhone;

      // 1. Upsert into Supabase `users` table
      const { data: userRow } = await supabase
        .from('users')
        .upsert({
          id: m.id,
          name: m.name,
          phone: formatted,
          role: 'member',
          store_id: defaultStoreId
        } as any, { onConflict: 'id' })
        .select()
        .maybeSingle();

      const userId = userRow?.id || m.id;

      // 2. Upsert into Supabase `members` table
      await supabase
        .from('members')
        .upsert({
          id: `mem-row-${m.id}`,
          user_id: userId,
          store_id: defaultStoreId,
          loyalty_points: m.points,
          kyc_status: 'verified'
        } as any, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('Supabase loyalty persistence notice:', err);
  }
}

export const DEMO_MEMBER_IDS = ['mem-user', 'mem-1', 'mem-2', 'mem-3', 'mem-row-mem-user', 'mem-row-mem-1', 'mem-row-mem-2', 'mem-row-mem-3'];
export const DEMO_MEMBER_NAMES = ['Boss J&J', 'Ahmad Faiz', 'Siti Nurhaliza', 'Tan Wei Ming'];

export function clearAllLoyaltyMembers(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify([]));
    localStorage.removeItem('warung_loyalty_members_v2');
    localStorage.removeItem('warung_loyalty_members_v1');
    window.dispatchEvent(new Event('warung_loyalty_updated'));

    // Purge demo members from Supabase
    supabase.from('members').delete().in('id', ['mem-row-mem-user', 'mem-row-mem-1', 'mem-row-mem-2', 'mem-row-mem-3']).then(() => {}).catch(() => {});
    supabase.from('users').delete().in('id', ['mem-user', 'mem-1', 'mem-2', 'mem-3']).then(() => {}).catch(() => {});
  } catch (err) {
    console.error('Failed to clear loyalty members:', err);
  }
}

/**
 * Fetches members live from Supabase DB
 */
export async function fetchMembersFromSupabase(): Promise<LoyaltyMember[]> {
  try {
    // Purge demo members in background
    try {
      supabase.from('members').delete().in('id', ['mem-row-mem-user', 'mem-row-mem-1', 'mem-row-mem-2', 'mem-row-mem-3']).then(() => {}).catch(() => {});
      supabase.from('users').delete().in('id', ['mem-user', 'mem-1', 'mem-2', 'mem-3']).then(() => {}).catch(() => {});
    } catch {}

    const { data: memberRows, error } = await supabase
      .from('members')
      .select('*, users!inner(*)');

    if (error || !memberRows || memberRows.length === 0) {
      return getLoyaltyMembers();
    }

    const loaded: LoyaltyMember[] = memberRows
      .filter((r: any) => {
        const id = r.user_id || r.id;
        const name = r.users?.name || '';
        return !DEMO_MEMBER_IDS.includes(id) && !DEMO_MEMBER_NAMES.includes(name);
      })
      .map((r: any) => ({
        id: r.user_id || r.id,
        phone: r.users?.phone || '601125251817',
        name: r.users?.name || 'Valued Member',
        points: r.loyalty_points || 0,
        totalSpent: r.loyalty_points ? r.loyalty_points * 1.5 : 0,
        tier: calculateTier(r.loyalty_points || 0),
        joinedAt: r.created_at?.split('T')[0] || new Date().toISOString().split('T')[0] || '2026-08-15',
        lastVisitAt: new Date().toISOString().split('T')[0] || '2026-08-15'
      }));

    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(loaded));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('warung_loyalty_updated'));
    }
    return loaded;
  } catch (err) {
    return getLoyaltyMembers();
  }
}

export function findMemberByPhone(phone: string): LoyaltyMember | undefined {
  if (!phone) return undefined;
  const clean = phone.replace(/\D/g, '');
  if (!clean) return undefined;
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const localNum = clean.startsWith('60') ? '0' + clean.slice(2) : clean;
  const members = getLoyaltyMembers();
  return members.find(m => {
    const mClean = m.phone.replace(/\D/g, '');
    return m.phone === formatted || m.phone === clean || m.phone === localNum || mClean === clean || mClean === formatted;
  });
}

export function getMemberByPhone(phone: string): LoyaltyMember | undefined {
  return findMemberByPhone(phone);
}

/**
 * Direct Supabase Member Registration / Identification
 * Inserts new member to Supabase users & members tables with 50 welcome points,
 * or loads existing member if phone already exists.
 */
export async function registerOrIdentifyMemberSupabase(name: string, phone: string): Promise<{
  isNew: boolean;
  member: LoyaltyMember;
  message: string;
}> {
  const clean = phone.replace(/\D/g, '');
  if (!clean || (clean.length < 9 || clean.length > 12)) {
    throw new Error('Please enter a valid phone number (e.g. +60123456789 or 0123456789).');
  }

  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const members = getLoyaltyMembers();
  const existing = members.find(m => m.phone === formatted || m.phone === clean);

  if (existing) {
    if (name && !existing.name.includes('Boss')) {
      existing.name = name;
      saveLoyaltyMembers(members);
    }
    return {
      isNew: false,
      member: existing,
      message: `Welcome back ${existing.name}! (${existing.tier} VIP • ${existing.points} Active Points)`
    };
  }

  const todayStr = new Date().toISOString().split('T')[0] || '2026-08-15';
  const newMember: LoyaltyMember = {
    id: `mem-${Date.now()}`,
    phone: formatted,
    name: name.trim() || `Member +${formatted.slice(-4)}`,
    points: 50, // 50 FREE Welcome Points
    totalSpent: 0,
    tier: calculateTier(50),
    joinedAt: todayStr,
    lastVisitAt: todayStr
  };

  members.push(newMember);
  saveLoyaltyMembers(members);
  logMembershipTransaction(formatted, 'welcome_bonus', 50, 'Direct Member Registration 50 Welcome Points');

  // Async Direct Supabase Insert into users & members tables
  try {
    const defaultStoreId = 'store-jnj-main';
    const { data: userRow } = await supabase
      .from('users')
      .upsert({
        id: newMember.id,
        name: newMember.name,
        phone: formatted,
        role: 'member',
        store_id: defaultStoreId
      } as any, { onConflict: 'id' })
      .select()
      .maybeSingle();

    await supabase
      .from('members')
      .upsert({
        id: `mem-row-${newMember.id}`,
        user_id: userRow?.id || newMember.id,
        store_id: defaultStoreId,
        loyalty_points: 50,
        kyc_status: 'verified'
      } as any, { onConflict: 'id' });
  } catch (err) {
    console.warn('Supabase direct insert background warning:', err);
  }

  return {
    isNew: true,
    member: newMember,
    message: `🎉 Welcome ${newMember.name}! 50 FREE Welcome Points Credited!`
  };
}

export function calculateTier(points: number): 'Bronze' | 'Silver' | 'Gold' | 'Platinum' {
  if (points >= 1000) return 'Platinum';
  if (points >= 500) return 'Gold';
  if (points >= 100) return 'Silver';
  return 'Bronze';
}

const REWARDS_CATALOG_STORAGE_KEY = 'warung_rewards_catalog_v2';

export function getRewardsCatalog(): RewardCatalogItem[] {
  if (typeof window === 'undefined') return DEFAULT_REWARDS_CATALOG;
  try {
    const raw = localStorage.getItem(REWARDS_CATALOG_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(REWARDS_CATALOG_STORAGE_KEY, JSON.stringify(DEFAULT_REWARDS_CATALOG));
      return DEFAULT_REWARDS_CATALOG;
    }
    const parsed: RewardCatalogItem[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_REWARDS_CATALOG;
  } catch (err) {
    return DEFAULT_REWARDS_CATALOG;
  }
}

export function saveRewardsCatalog(items: RewardCatalogItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REWARDS_CATALOG_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('warung_rewards_catalog_updated'));
  } catch (err) {
    console.error('Failed to save rewards catalog:', err);
  }
}

export function addRewardItem(item: Omit<RewardCatalogItem, 'id'>): RewardCatalogItem {
  const newItem: RewardCatalogItem = {
    ...item,
    id: `reward-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  };
  const list = getRewardsCatalog();
  const updated = [newItem, ...list];
  saveRewardsCatalog(updated);
  return newItem;
}

export function updateRewardItem(item: RewardCatalogItem): void {
  const list = getRewardsCatalog();
  const updated = list.map(r => r.id === item.id ? item : r);
  saveRewardsCatalog(updated);
}

export function deleteRewardItem(id: string): void {
  const list = getRewardsCatalog();
  const updated = list.filter(r => r.id !== id);
  saveRewardsCatalog(updated);
}

export function clearAllRewards(): void {
  saveRewardsCatalog([]);
}

export function logMembershipTransaction(phone: string, type: MembershipTransaction['type'], pointsChange: number, description: string): MembershipTransaction {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;

  const transaction: MembershipTransaction = {
    id: `tx-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    phone: formatted,
    type,
    pointsChange,
    description,
    createdAt: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      const list: MembershipTransaction[] = raw ? JSON.parse(raw) : [];
      list.unshift(transaction);
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event('warung_loyalty_updated'));
    } catch (err) {
      console.error('Failed to log membership transaction:', err);
    }
  }

  return transaction;
}

export function getMembershipTransactions(phone: string): MembershipTransaction[] {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    const list: MembershipTransaction[] = JSON.parse(raw);
    return list.filter(t => t.phone === formatted || t.phone === clean);
  } catch (err) {
    return [];
  }
}

export function addMemberPoints(phone: string, pointsToAdd: number, description: string = 'Points Earned'): LoyaltyMember {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const members = getLoyaltyMembers();
  let existing = members.find(m => m.phone === formatted || m.phone === clean);

  const todayStr = new Date().toISOString().split('T')[0] || '2026-08-15';
  let memberToReturn: LoyaltyMember;

  if (!existing) {
    memberToReturn = {
      id: `mem-${Date.now()}`,
      phone: formatted,
      name: `Member +${formatted.slice(-4)}`,
      points: pointsToAdd,
      totalSpent: 0,
      tier: calculateTier(pointsToAdd),
      joinedAt: todayStr,
      lastVisitAt: todayStr
    };
    members.push(memberToReturn);
  } else {
    existing.points += pointsToAdd;
    existing.tier = calculateTier(existing.points);
    existing.lastVisitAt = todayStr;
    memberToReturn = existing;
  }

  saveLoyaltyMembers(members);
  logMembershipTransaction(formatted, 'order_placed', pointsToAdd, description);
  return memberToReturn;
}

export function deductMemberPoints(phone: string, pointsToDeduct: number, description: string = 'RM 8 Discount Applied'): boolean {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const members = getLoyaltyMembers();
  const member = members.find(m => m.phone === formatted || m.phone === clean);

  if (!member || member.points < pointsToDeduct) return false;

  member.points -= pointsToDeduct;
  member.tier = calculateTier(member.points);
  saveLoyaltyMembers(members);
  logMembershipTransaction(formatted, 'discount_used', -pointsToDeduct, description);
  return true;
}

export function registerOrUpdateMember(phone: string, name: string, pointsToAdd: number = 0, spentAmount: number = 0): LoyaltyMember {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const members = getLoyaltyMembers();
  let existing = members.find(m => m.phone === formatted || m.phone === clean);

  const todayStr = new Date().toISOString().split('T')[0] || '2026-08-15';
  let memberToReturn: LoyaltyMember;

  if (!existing) {
    memberToReturn = {
      id: `mem-${Date.now()}`,
      phone: formatted,
      name: name || `Member +${formatted.slice(-4)}`,
      points: pointsToAdd,
      totalSpent: spentAmount,
      tier: calculateTier(pointsToAdd),
      joinedAt: todayStr,
      lastVisitAt: todayStr
    };
    members.push(memberToReturn);
  } else {
    if (name) existing.name = name;
    existing.points += pointsToAdd;
    existing.totalSpent += spentAmount;
    existing.tier = calculateTier(existing.points);
    existing.lastVisitAt = todayStr;
    memberToReturn = existing;
  }

  saveLoyaltyMembers(members);
  return memberToReturn;
}

export function redeemRewardForMember(phone: string, rewardParam: string | RewardCatalogItem): { success: boolean; message: string } {
  const clean = phone.replace(/\D/g, '');
  const formatted = clean.startsWith('0') ? '60' + clean.slice(1) : clean;
  const members = getLoyaltyMembers();
  const member = members.find(m => m.phone === formatted || m.phone === clean);
  const rewardId = typeof rewardParam === 'string' ? rewardParam : rewardParam.id;
  const reward = DEFAULT_REWARDS_CATALOG.find(r => r.id === rewardId);

  if (!member) return { success: false, message: 'Member not found.' };
  if (!reward) return { success: false, message: 'Reward item not found.' };
  if (member.points < reward.pointsRequired) {
    return { success: false, message: `Insufficient points. You need ${reward.pointsRequired} points to redeem this reward.` };
  }

  member.points -= reward.pointsRequired;
  member.tier = calculateTier(member.points);
  saveLoyaltyMembers(members);
  logMembershipTransaction(formatted, 'discount_used', -reward.pointsRequired, `Redeemed ${reward.title}`);
  return { success: true, message: `🎉 Successfully redeemed ${reward.title}!` };
}
