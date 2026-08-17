import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import type { AuthState } from '@/lib/auth-state';
import { getTodayCashStatus } from '@/lib/cash-guard';

async function getUserProfile(session: any) {
  const { data: userProfile, error } = await supabase
    .from('users')
    .select('role, store_id')
    .eq('id', session.user.id)
    .single();
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
    throw new Error(`Access Denied: Requires one of [${allowedRoles.join(', ')}]`);
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
  return requireAuth(location, auth, ['admin', 'chef']);
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
