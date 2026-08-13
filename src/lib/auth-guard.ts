import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import type { AuthState } from '@/lib/auth-state';

export async function requireAdminAuth(
  location: { pathname: string },
  auth: AuthState,
) {
  await auth.waitForInitialization();
  const session = auth.session;

  if (!session) {
    throw redirect({
      to: '/auth',
      search: { redirect: location.pathname },
    });
  }

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('role, store_id')
    .eq('id', session.user.id)
    .single();

  if (error || !userProfile || userProfile.role !== 'admin') {
    throw new Error('Access Denied: Admin only');
  }

  return { session, role: userProfile.role, storeId: userProfile.store_id };
}

export async function requireStaffAuth(
  location: { pathname: string },
  auth: AuthState,
) {
  await auth.waitForInitialization();
  const session = auth.session;

  if (!session) {
    throw redirect({
      to: '/auth',
      search: { redirect: location.pathname },
    });
  }

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('role, store_id')
    .eq('id', session.user.id)
    .single();

  if (error || !userProfile || (userProfile.role !== 'staff' && userProfile.role !== 'admin')) {
    throw new Error('Access Denied: Staff only');
  }

  return { session, role: userProfile.role, storeId: userProfile.store_id };
}
