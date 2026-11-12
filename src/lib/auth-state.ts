import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, StaffUser } from '@/lib/staff-access-config';

export interface AuthState {
  authInitialized: boolean;
  session: Session | null;
  waitForInitialization: () => Promise<void>;
}

export interface StaffPinSession {
  access_token: string;
  token_type: 'bearer';
  expires_at: number;
  staff_pin_verified: true;
  staff_id: string;
  user: {
    id: string;
    aud: 'authenticated';
    role: 'authenticated';
    email: string;
    user_metadata: {
      name: string;
      role: AppRole;
    };
    app_metadata: {
      provider: 'pin';
      providers: ['pin'];
      role: AppRole;
    };
  };
}

const STAFF_PIN_SESSION_KEY = 'warung_staff_pin_session';
const LEGACY_EMERGENCY_SESSION_KEY = 'warung_emergency_staff_session';
const PIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createStaffPinSession(staff: StaffUser): StaffPinSession {
  const token =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `pin_${crypto.randomUUID()}`
      : `pin_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;

  const pinSession: StaffPinSession = {
    access_token: token,
    token_type: 'bearer',
    expires_at: Date.now() + PIN_SESSION_TTL_MS,
    staff_pin_verified: true,
    staff_id: staff.id,
    user: {
      id: staff.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: staff.email || `${staff.id}@staff.local`,
      user_metadata: {
        name: staff.name,
        role: staff.role,
      },
      app_metadata: {
        provider: 'pin',
        providers: ['pin'],
        role: staff.role,
      },
    },
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LEGACY_EMERGENCY_SESSION_KEY);
      localStorage.setItem(STAFF_PIN_SESSION_KEY, JSON.stringify(pinSession));
    } catch {
      // Ignore storage quota errors
    }
  }

  return pinSession;
}

export function getStaffPinSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    // Always purge deprecated insecure emergency bypass tokens
    if (localStorage.getItem(LEGACY_EMERGENCY_SESSION_KEY)) {
      localStorage.removeItem(LEGACY_EMERGENCY_SESSION_KEY);
    }

    const stored = localStorage.getItem(STAFF_PIN_SESSION_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<StaffPinSession>;
    if (
      parsed.staff_pin_verified !== true ||
      typeof parsed.access_token !== 'string' ||
      parsed.access_token === 'emergency_warung_staff_token' ||
      typeof parsed.expires_at !== 'number' ||
      parsed.expires_at <= Date.now() ||
      !parsed.user?.id ||
      !parsed.user?.user_metadata?.role
    ) {
      localStorage.removeItem(STAFF_PIN_SESSION_KEY);
      return null;
    }

    return parsed as unknown as Session;
  } catch {
    return null;
  }
}

export function clearStaffPinSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STAFF_PIN_SESSION_KEY);
    localStorage.removeItem(LEGACY_EMERGENCY_SESSION_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function createAuthState(): AuthState {
  let markInitialized: (() => void) | undefined;
  const initialized = new Promise<void>((resolve) => {
    markInitialized = resolve;
  });

  const isServer = typeof window === 'undefined';
  const initialPinSession = getStaffPinSession();

  const auth: AuthState = {
    authInitialized: isServer,
    session: initialPinSession,
    waitForInitialization: () => (isServer ? Promise.resolve() : initialized),
  };

  if (!isServer) {
    supabase.auth.onAuthStateChange((_event, session) => {
      auth.session = session || getStaffPinSession();

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
          auth.session = getStaffPinSession();
        }
        auth.authInitialized = true;
        markInitialized?.();
        markInitialized = undefined;
      }
    }, 200);
  }

  return auth;
}