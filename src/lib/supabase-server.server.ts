import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const CANONICAL_SUPABASE_URL = 'https://gtmzzblomcvgmwzjalja.supabase.co';
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_m0I3z41KlguoyAcf1VM53Q_cuJgYe_Q';
const DEPRECATED_PROJECT_REF = 'ilvbuhinmasmdsjcxfbn';
const DEPRECATED_KEY_PREFIX = 'W1moaaZz9eXPPPjQOf0e2g_YcIbl0e7';

export function getServerEnv(key: string): string | undefined {
  const g = globalThis as Record<string, unknown>;
  const cfEnv = g['__cf_env__'] as Record<string, unknown> | undefined;
  const runtimeEnv = g['__env__'] as Record<string, unknown> | undefined;

  const cfVal = cfEnv?.[key];
  if (typeof cfVal === 'string' && cfVal.trim()) return cfVal.trim();

  const runtimeVal = runtimeEnv?.[key];
  if (typeof runtimeVal === 'string' && runtimeVal.trim()) return runtimeVal.trim();

  if (typeof process !== 'undefined' && process.env) {
    const procVal = process.env[key];
    if (typeof procVal === 'string' && procVal.trim()) return procVal.trim();
  }
  return undefined;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createServerSupabaseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(apiKey) && headers.get('Authorization') === `Bearer ${apiKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', apiKey);
    return fetch(input, { ...init, headers });
  };
}

export function hasServiceRoleKey(): boolean {
  const key = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  return Boolean(key && !key.includes(DEPRECATED_KEY_PREFIX));
}

export function getServerSupabase() {
  const rawUrl = getServerEnv('SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const url = rawUrl && !rawUrl.includes(DEPRECATED_PROJECT_REF) ? rawUrl : CANONICAL_SUPABASE_URL;

  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  const pubKey =
    getServerEnv('SUPABASE_PUBLISHABLE_KEY') ||
    getServerEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    FALLBACK_PUBLISHABLE_KEY;

  const resolvedKey =
    serviceRoleKey && !serviceRoleKey.includes(DEPRECATED_KEY_PREFIX)
      ? serviceRoleKey
      : pubKey && !pubKey.includes(DEPRECATED_KEY_PREFIX)
        ? pubKey
        : FALLBACK_PUBLISHABLE_KEY;

  return createClient<Database>(url, resolvedKey, {
    global: {
      fetch: createServerSupabaseFetch(resolvedKey),
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface ToyyibPayServerCredentials {
  secretKey: string;
  categoryCode: string;
  isSandbox: boolean;
  hasEnvSecret: boolean;
  hasEnvCategory: boolean;
}

export async function getToyyibPayServerCredentials(
  storeId?: string
): Promise<ToyyibPayServerCredentials> {
  let secretKey = getServerEnv('TOYYIBPAY_SECRET_KEY') || '';
  let categoryCode = getServerEnv('TOYYIBPAY_CATEGORY_CODE') || '';
  const sandboxRaw = getServerEnv('TOYYIBPAY_SANDBOX');
  const isSandbox = sandboxRaw === 'true';

  const hasEnvSecret = Boolean(secretKey);
  const hasEnvCategory = Boolean(categoryCode);

  if ((!secretKey || !categoryCode) && hasServiceRoleKey()) {
    try {
      const sb = getServerSupabase();
      let query = sb
        .from('store_payment_config')
        .select('toyyibpay_secret, toyyibpay_category')
        .limit(1);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data } = await query.maybeSingle();
      if (data) {
        if (!secretKey && data.toyyibpay_secret) secretKey = data.toyyibpay_secret.trim();
        if (!categoryCode && data.toyyibpay_category) categoryCode = data.toyyibpay_category.trim();
      }
    } catch {
      // Fallback safely without failing caller
    }
  }

  return {
    secretKey: secretKey.trim(),
    categoryCode: categoryCode.trim(),
    isSandbox,
    hasEnvSecret,
    hasEnvCategory,
  };
}
