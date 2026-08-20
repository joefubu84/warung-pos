import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface AuthState {
  authInitialized: boolean;
  session: Session | null;
  waitForInitialization: () => Promise<void>;
}

export function createAuthState(): AuthState {
  let markInitialized: (() => void) | undefined;
  const initialized = new Promise<void>((resolve) => {
    markInitialized = resolve;
  });

  const isServer = typeof window === "undefined";

  const auth: AuthState = {
    authInitialized: isServer,
    session: null,
    waitForInitialization: () => (isServer ? Promise.resolve() : initialized),
  };

  if (!isServer) {
    supabase.auth.onAuthStateChange((_event, session) => {
      auth.session = session;

      if (!auth.authInitialized) {
        auth.authInitialized = true;
        markInitialized?.();
        markInitialized = undefined;
      }
    });
  }

  return auth;
}