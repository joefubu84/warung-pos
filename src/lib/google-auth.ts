import { supabase } from '@/integrations/supabase/client';
import { 
  findMemberByPhone, 
  addMemberPoints, 
  getLoyaltyMembers, 
  saveLoyaltyMembers, 
  calculateTier,
  logMembershipTransaction,
  LoyaltyMember 
} from './loyalty-config';

export interface GoogleAuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | undefined;
}

const GOOGLE_USER_STORAGE_KEY = 'warung_google_authenticated_user_v1';

export function getStoredGoogleUser(): GoogleAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GOOGLE_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function saveStoredGoogleUser(user: GoogleAuthUser): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GOOGLE_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (err) {}
}

export function clearStoredGoogleUser(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GOOGLE_USER_STORAGE_KEY);
  } catch (err) {}
}

/**
 * Handle Supabase Google OAuth Provider Login
 * Triggers native OAuth flow or OAuth pop-up/redirect
 */
export async function signInWithGoogleOAuth(): Promise<{ success: boolean; message: string }> {
  try {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: currentUrl ? { redirectTo: currentUrl } : {}
    });

    if (error) {
      console.warn('Supabase OAuth trigger warning:', error);
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Redirecting to Google Sign-In...' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Google OAuth failed to trigger.' };
  }
}

/**
 * Helper to register or retrieve member account using Google user info.
 * Links to existing loyalty phone if matched or creates new member with 50 welcome points!
 */
export function getOrCreateMemberFromGoogle(googleUser: {
  email: string;
  name: string;
  id?: string | undefined;
  phoneLink?: string | undefined;
}): LoyaltyMember {
  const members = getLoyaltyMembers();
  
  // 1. Check if linked via phone or email
  let existing: LoyaltyMember | undefined;

  if (googleUser.phoneLink) {
    const cleanPhone = googleUser.phoneLink.replace(/\D/g, '');
    const formatted = cleanPhone.startsWith('0') ? '60' + cleanPhone.slice(1) : cleanPhone;
    existing = members.find(m => m.phone === formatted || m.phone === cleanPhone);
  }

  // Check email-based ID link
  if (!existing) {
    existing = members.find(m => m.id === `mem-google-${googleUser.email.toLowerCase()}` || m.name === googleUser.name);
  }

  const todayStr = new Date().toISOString().split('T')[0] || '2026-08-15';
  let memberToReturn: LoyaltyMember;

  if (!existing) {
    // Auto-create new Google member & credit 50 welcome points!
    const syntheticPhone = googleUser.phoneLink ? googleUser.phoneLink.replace(/\D/g, '') : `601${Math.floor(10000000 + Math.random()*90000000)}`;
    
    memberToReturn = {
      id: `mem-google-${googleUser.email.toLowerCase()}`,
      phone: syntheticPhone,
      name: googleUser.name || googleUser.email.split('@')[0] || 'Google User',
      points: 50, // 50 FREE Welcome Points
      totalSpent: 0,
      tier: calculateTier(50),
      joinedAt: todayStr,
      lastVisitAt: todayStr
    };

    members.push(memberToReturn);
    saveLoyaltyMembers(members);
    logMembershipTransaction(memberToReturn.phone, 'welcome_bonus', 50, 'Google OAuth Welcome 50 Bonus Points');
  } else {
    // Update visit timestamp & name
    if (googleUser.name && !existing.name.includes('Boss')) {
      existing.name = googleUser.name;
    }
    existing.lastVisitAt = todayStr;
    saveLoyaltyMembers(members);
    memberToReturn = existing;
  }

  return memberToReturn;
}
