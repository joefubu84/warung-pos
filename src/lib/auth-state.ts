import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthState {
  authInitialized: boolean;
  session: Session | null;
  waitForInitialization: () => Promise<void>;
}

export const EMERGENCY_ADMIN_SESSION: any = {
  access_token: 'emergency_warung_staff_token',
  token_type: 'bearer',
  expires_in: 315360000,
  refresh_token: 'emergency_warung_staff_refresh',
  user: {
    id: '0f81ea5a-e622-4343-a188-62f90dc1ef14',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'teststaffa@test.com',
    user_metadata: {
      name: 'Staff A (Admin)',
      role: 'admin'
    },
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      role: 'admin'
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  }
};

export function createAuthState(): AuthState {
  let markInitialized: (() => void) | undefined;
  const initialized = new Promise<void>((resolve) => {
    markInitialized = resolve;
  });

  const isServer = typeof window === "undefined";

  const getEmergencySession = (): Session | null => {
    if (isServer) return null;
    try {
      const stored = localStorage.getItem('warung_emergency_staff_session');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return null;
  };

  const initialEmergency = getEmergencySession();

  const auth: AuthState = {
    authInitialized: isServer,
    session: initialEmergency,
    waitForInitialization: () => (isServer ? Promise.resolve() : initialized),
  };

  if (!isServer) {
    supabase.auth.onAuthStateChange((_event, session) => {
      auth.session = session || getEmergencySession();

      if (!auth.authInitialized) {
        auth.authInitialized = true;
        markInitialized?.();
        markInitialized = undefined;
      }
    });

    // Fallback timer in case onAuthStateChange is delayed
    setTimeout(() => {
      if (!auth.authInitialized) {
        if (!auth.session) {
          auth.session = getEmergencySession();
        }
        auth.authInitialized = true;
        markInitialized?.();
        markInitialized = undefined;
      }
    }, 200);
  }

  return auth;
}