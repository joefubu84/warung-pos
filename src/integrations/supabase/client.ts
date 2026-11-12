import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}


const FALLBACK_SUPABASE_URL = 'https://gtmzzblomcvgmwzjalja.supabase.co';
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_m0I3z41KlguoyAcf1VM53Q_cuJgYe_Q';

function resolveEnvValue(value: string | undefined, deprecatedToken: string): string | undefined {
  if (!value || value.includes(deprecatedToken)) return undefined;
  return value;
}

function createSupabaseClient() {
  const envUrl =
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined) ||
    (typeof process !== 'undefined' ? process.env?.['SUPABASE_URL'] || process.env?.['VITE_SUPABASE_URL'] : undefined);

  const envKey =
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined) ||
    (typeof process !== 'undefined'
      ? process.env?.['SUPABASE_PUBLISHABLE_KEY'] || process.env?.['VITE_SUPABASE_PUBLISHABLE_KEY']
      : undefined);

  const SUPABASE_URL = resolveEnvValue(envUrl, 'ilvbuhinmasmdsjcxfbn') || FALLBACK_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    resolveEnvValue(envKey, 'W1moaaZz9eXPPPjQOf0e2g_YcIbl0e7') || FALLBACK_SUPABASE_PUBLISHABLE_KEY;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

