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
export async function signInWithGoogleOAuth(): Promise<{ success: boolean; message: string; isNotConfigured?: boolean }> {
  try {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: currentUrl ? { redirectTo: currentUrl } : {}
    });

    if (error) {
      console.warn('Supabase OAuth trigger warning:', error);
      if (error.message.includes('missing OAuth secret') || error.message.includes('validation_failed') || error.message.includes('Unsupported provider')) {
        return { 
          success: false, 
          isNotConfigured: true,
          message: 'Google OAuth belum dikonfigurasi Client ID & Secret dalam Supabase Dashboard. Anda boleh daftar terus menggunakan No. Telefon & Nama.' 
        };
      }
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Menghubungkan ke akaun Google...' };
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
  
  // 1. Check if linked via phone or email or ID
  let existing: LoyaltyMember | undefined;

  if (googleUser.phoneLink) {
    const cleanPhone = googleUser.phoneLink.replace(/\D/g, '');
    const formatted = cleanPhone.startsWith('0') ? '60' + cleanPhone.slice(1) : cleanPhone;
    existing = members.find(m => m.phone === formatted || m.phone === cleanPhone || (cleanPhone.length >= 8 && m.phone.endsWith(cleanPhone.slice(-8))));
  }

  // Check email-based ID link
  if (!existing && googleUser.email) {
    const emailKey = googleUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    existing = members.find(m => 
      m.id === `mem-google-${emailKey}` || 
      m.id === `mem-google-${googleUser.email.toLowerCase()}` ||
      (m.name && googleUser.name && m.name.toLowerCase() === googleUser.name.toLowerCase())
    );
  }

  const todayStr = new Date().toISOString().split('T')[0] || '2026-08-25';
  let memberToReturn: LoyaltyMember;

  if (!existing) {
    // Auto-create new Google member & credit 50 welcome points!
    const cleanPhone = googleUser.phoneLink ? googleUser.phoneLink.replace(/\D/g, '') : '';
    const formattedPhone = cleanPhone 
      ? (cleanPhone.startsWith('0') ? '60' + cleanPhone.slice(1) : cleanPhone)
      : `601${Math.floor(10000000 + Math.random()*90000000)}`;

    const emailKey = (googleUser.email || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    memberToReturn = {
      id: `mem-google-${emailKey}`,
      phone: formattedPhone,
      name: googleUser.name || googleUser.email?.split('@')[0] || 'Pelanggan Google',
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
    // Update visit timestamp, name & update linked phone if provided
    if (googleUser.name && !existing.name.includes('Boss')) {
      existing.name = googleUser.name;
    }
    if (googleUser.phoneLink) {
      const cleanPhone = googleUser.phoneLink.replace(/\D/g, '');
      const formatted = cleanPhone.startsWith('0') ? '60' + cleanPhone.slice(1) : cleanPhone;
      existing.phone = formatted;
    }
    existing.lastVisitAt = todayStr;
    saveLoyaltyMembers(members);
    memberToReturn = existing;
  }

  return memberToReturn;
}
