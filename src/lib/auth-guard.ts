import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import type { AuthState } from '@/lib/auth-state';

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

