/**
 * Server-side HTTP security utilities:
 * - Explicit CORS origin allowlist (never Access-Control-Allow-Origin: *)
 * - Sliding-window per-client rate limiting
 * - Input sanitization & defensive response builders
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://warungjnj.online',
  'https://www.warungjnj.online',
  'https://warung-pos.josephsudarso05.workers.dev',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
] as const;

function readEnvValue(key: string): string | undefined {
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

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  const singleEnv = readEnvValue('ALLOWED_ORIGIN');
  if (singleEnv) {
    for (const part of singleEnv.split(',')) {
      const clean = part.trim().replace(/\/+$/, '');
      if (clean && clean !== '*') origins.add(clean);
    }
  }
  const multiEnv = readEnvValue('ALLOWED_ORIGINS');
  if (multiEnv) {
    for (const part of multiEnv.split(',')) {
      const clean = part.trim().replace(/\/+$/, '');
      if (clean && clean !== '*') origins.add(clean);
    }
  }
  return Array.from(origins);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.trim().replace(/\/+$/, '');
  return getAllowedOrigins().includes(normalized);
}

export function getCorsHeaders(
  request: Request,
  methods = 'GET, POST, OPTIONS'
): Record<string, string> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store',
  };

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin.trim().replace(/\/+$/, '');
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function handleOptionsRequest(
  request: Request,
  methods = 'GET, POST, OPTIONS'
): Response {
  const origin = request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'Permintaan asal tidak dibenarkan.' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request, methods),
      },
    });
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request, methods),
  });
}

export function resolveTrustedReturnOrigin(request: Request): string {
  const originHeader = request.headers.get('origin');
  if (originHeader && isAllowedOrigin(originHeader)) {
    return originHeader.trim().replace(/\/+$/, '');
  }

  try {
    const reqUrl = new URL(request.url);
    const reqOrigin = reqUrl.origin.replace(/\/+$/, '');
    if (isAllowedOrigin(reqOrigin)) {
      return reqOrigin;
    }
  } catch {
    // Ignore malformed URL and fall back to production domain
  }

  return 'https://warungjnj.online';
}

export function getClientIdentifier(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim()) return cfIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded && forwarded.trim()) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  return 'unknown-client';
}

interface RateBucket {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateBucket>();

export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 60_000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  const fresh = existing ? existing.timestamps.filter((t) => now - t < windowMs) : [];

  if (fresh.length >= maxRequests) {
    const oldest = fresh[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateLimitStore.set(key, { timestamps: fresh });
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  fresh.push(now);
  rateLimitStore.set(key, { timestamps: fresh });

  // Prevent unbounded growth across long-lived isolate instances
  if (rateLimitStore.size > 5000) {
    for (const [k, bucket] of rateLimitStore.entries()) {
      const stillValid = bucket.timestamps.filter((t) => now - t < windowMs);
      if (stillValid.length === 0) {
        rateLimitStore.delete(k);
      } else {
        bucket.timestamps = stillValid;
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - fresh.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

export function sanitizeText(value: string, maxLen = 200): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^0-9+]/g, '').slice(0, 15);
}

export function jsonSuccess(
  payload: Record<string, unknown>,
  request: Request,
  status = 200
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    },
  });
}

export function jsonError(
  message: string,
  status: number,
  request: Request,
  extra?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      ...(extra ?? {}),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(request),
      },
    }
  );
}
