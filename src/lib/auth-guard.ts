import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import type { AuthState } from '@/lib/auth-state';
import { getTodayCashStatus } from '@/lib/cash-guard';

async function getUserProfile(session: any) {
  if (!session?.user) return { userProfile: null, error: null };

  // 1. Try lookup by user ID
  let { data: userProfile, error } = await supabase
    .from('users')
    .select('id, role, store_id, email')
    .eq('id', session.user.id)
    .maybeSingle();

  // 2. If not found by ID, try matching by email
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

  // 3. Check metadata role from Supabase auth
  const metaRole = session.user.user_metadata?.role || session.user.app_metadata?.role;
  if (!userProfile && metaRole) {
    userProfile = {
      id: session.user.id,
      role: metaRole,
      store_id: null as unknown as string,
      email: session.user.email
    };
    error = null;
  }

  // 4. Fallback for authenticated email/password users (who login via /auth)
  const isEmailAuth = session.user.app_metadata?.provider === 'email' || !session.user.app_metadata?.provider;
  if (!userProfile && isEmailAuth && session.user.email) {
    userProfile = {
      id: session.user.id,
      role: 'admin',
      store_id: null as unknown as string,
      email: session.user.email
    };
    error = null;
  }

  // 5. Admin fallback for store owner / admin accounts
  if (!userProfile && session.user.email) {
    const emailLower = session.user.email.toLowerCase();
    if (emailLower.includes('admin') || emailLower === 'joefubu84@gmail.com' || emailLower.endsWith('@warungjnj.online')) {
      userProfile = {
        id: session.user.id,
        role: 'admin',
        store_id: null as unknown as string,
        email: session.user.email
      };
      error = null;
    }
  }

  return { userProfile, error };
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

  const { userProfile, error } = await getUserProfile(session);

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
        reason: 'unauthorized'
      },
    });
  }

  return { session, role: userProfile.role, storeId: userProfile.store_id };
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
    return { ...authData, cashStatus: { status: 'OPEN', dailyCash: null, closedAt: null } as any };
  }
}
