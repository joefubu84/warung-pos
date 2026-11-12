import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import type { AuthState } from '@/lib/auth-state';
import { getStaffPinSession } from '@/lib/auth-state';
import { getTodayCashStatus } from '@/lib/cash-guard';
import {
  getActiveStaffUser,
  getStaffAccessConfig,
  isPageAllowedForUser,
  getPrimaryPageForRole,
  type StaffUser,
} from '@/lib/staff-access-config';

const DEFAULT_STORE_ID = '1094d737-8104-4a55-b678-0fe9097beba0';
const VERIFIED_OWNER_EMAILS = new Set(['ogyic84@gmail.com', 'joefubu84@gmail.com']);

async function getUserProfile(session: any) {
  if (!session?.user) return { userProfile: null, error: null };

  // Never honor deprecated insecure bypass tokens
  if (session.access_token === 'emergency_warung_staff_token') {
    return { userProfile: null, error: null };
  }

  // 1. Scoped PIN quick-login session (must pass getStaffPinSession expiry & integrity check)
  if (session.staff_pin_verified === true) {
    const validPinSession = getStaffPinSession() as any;
    if (!validPinSession || validPinSession.access_token !== session.access_token) {
      return { userProfile: null, error: null };
    }

    const staffConfig = getStaffAccessConfig();
    const activeStaff = getActiveStaffUser();
    const targetStaffId = validPinSession.staff_id || session.user.id;
    const directoryStaff = staffConfig.staff_users.find((s) => s.id === targetStaffId);
    const resolvedStaff = directoryStaff || (activeStaff?.id === targetStaffId ? activeStaff : null);

    if (!resolvedStaff || !resolvedStaff.active) {
      return { userProfile: null, error: null };
    }

    return {
      userProfile: {
        id: resolvedStaff.id,
        role: resolvedStaff.role,
        store_id: DEFAULT_STORE_ID,
        email: resolvedStaff.email,
        name: resolvedStaff.name,
      },
      staffRecord: resolvedStaff as StaffUser,
      error: null,
    };
  }

  // 2. Real Supabase Auth session: verified store owner allowlist
  const emailLower = (session.user.email || '').toLowerCase();
  if (emailLower && VERIFIED_OWNER_EMAILS.has(emailLower)) {
    return {
      userProfile: {
        id: session.user.id,
        role: 'admin',
        store_id: DEFAULT_STORE_ID,
        email: session.user.email,
      },
      staffRecord: null,
      error: null,
    };
  }

  // 3. Lookup by user ID in public.users
  let { data: userProfile, error } = await supabase
    .from('users')
    .select('id, role, store_id, email')
    .eq('id', session.user.id)
    .maybeSingle();

  // 4. Fallback lookup by email in public.users
  if (!userProfile && session.user.email) {
    const { data: byEmail } = await supabase
      .from('users')
      .select('id, role, store_id, email')
      .eq('email', session.user.email)
      .maybeSingle();

    if (byEmail) {
      userProfile = byEmail;
      error = null;
    }
  }

  // 5. Match configured active staff directory by verified email (using configured role only)
  if (!userProfile && emailLower) {
    const staffDirectoryMatch = getStaffAccessConfig().staff_users.find(
      (s) => s.active && s.email?.toLowerCase() === emailLower
    );
    if (staffDirectoryMatch) {
      userProfile = {
        id: session.user.id,
        role: staffDirectoryMatch.role as any,
        store_id: DEFAULT_STORE_ID,
        email: session.user.email,
      };
      error = null;
    }
  }

  // 6. Check server-controlled app_metadata role or safe customer/rider user_metadata role
  if (!userProfile) {
    const appMetaRole = session.user.app_metadata?.role;
    const userMetaRole = session.user.user_metadata?.role;
    if (appMetaRole) {
      userProfile = {
        id: session.user.id,
        role: appMetaRole,
        store_id: DEFAULT_STORE_ID,
        email: session.user.email,
      };
      error = null;
    } else if (userMetaRole === 'rider' || userMetaRole === 'customer') {
      userProfile = {
        id: session.user.id,
        role: userMetaRole,
        store_id: DEFAULT_STORE_ID,
        email: session.user.email,
      };
      error = null;
    }
  }

  if (userProfile && !userProfile.store_id) {
    userProfile.store_id = DEFAULT_STORE_ID;
  }

  const activeStaff = getActiveStaffUser();
  const matchedActiveStaff =
    activeStaff &&
    activeStaff.active &&
    (activeStaff.id === session.user.id ||
      (emailLower && activeStaff.email?.toLowerCase() === emailLower))
      ? activeStaff
      : null;

  return { userProfile, staffRecord: matchedActiveStaff, error };
}

export async function requireAuth(location: { pathname: string }, auth: AuthState, allowedRoles: string[]) {
  await auth.waitForInitialization();
  const session = auth.session;

  if (!session) {
    throw redirect({
      to: '/auth',
      search: { redirect: location.pathname },
    });
  }

  const { userProfile, staffRecord, error } = await getUserProfile(session);

  if (error || !userProfile || !allowedRoles.includes(userProfile.role)) {
    if (userProfile?.role === 'rider') {
      throw redirect({
        to: '/rider',
      });
    }

    if (userProfile?.role === 'customer') {
      throw redirect({
        to: '/delivery',
      });
    }

    throw redirect({
      to: '/auth',
      search: {
        redirect: location.pathname,
        reason: 'unauthorized',
      },
    });
  }

  // Check granular page permission configured by Admin
  if (userProfile.role !== 'admin') {
    if (!isPageAllowedForUser(location.pathname, userProfile.role, staffRecord)) {
      const fallbackTarget = getPrimaryPageForRole(userProfile.role, staffRecord);
      if (fallbackTarget !== location.pathname) {
        throw redirect({
          to: fallbackTarget as any,
          search: { reason: 'page_restricted' } as any,
        });
      }
    }
  }

  return { session, role: userProfile.role, storeId: userProfile.store_id || DEFAULT_STORE_ID };
}

export async function requireAdminAuth(location: { pathname: string }, auth: AuthState) {
  return requireAuth(location, auth, ['admin']);
}

export async function requireCashierAuth(location: { pathname: string }, auth: AuthState) {
  return requireAuth(location, auth, ['admin', 'cashier']);
}

export async function requireChefAuth(location: { pathname: string }, auth: AuthState) {
  return requireAuth(location, auth, ['admin', 'chef', 'staff', 'cashier']);
}

export async function requireStaffAuth(location: { pathname: string }, auth: AuthState) {
  return requireAuth(location, auth, ['admin', 'cashier', 'chef', 'staff']);
}

export async function requireOrderingAuth(location: { pathname: string }, auth: AuthState) {
  const authData = await requireStaffAuth(location, auth);
  
  try {
    const cashStatus = await getTodayCashStatus(authData.storeId);
    if (cashStatus.status === 'NOT_OPENED') {
      throw redirect({
        to: '/cash-management',
        search: { reason: 'not_opened' },
      });
    }
    return { ...authData, cashStatus };
  } catch (err) {
    if ((err as any)?.to) {
      throw err;
    }
    console.error('Error in requireOrderingAuth:', err);
    return { ...authData, cashStatus: { status: 'NOT_OPENED', dailyCash: null, closedAt: null } as any };
  }
}
