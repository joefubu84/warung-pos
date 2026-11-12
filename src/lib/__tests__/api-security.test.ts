import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  getAllowedOrigins,
  getClientIdentifier,
  getCorsHeaders,
  handleOptionsRequest,
  isAllowedOrigin,
  resetRateLimitStore,
  resolveTrustedReturnOrigin,
  sanitizePhoneInput,
  sanitizeText,
} from '@/lib/api-security';

describe('api-security', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  afterEach(() => {
    delete process.env['ALLOWED_ORIGIN'];
    delete process.env['ALLOWED_ORIGINS'];
  });

  it('never issues wildcard Access-Control-Allow-Origin and reflects only allowlisted origins', () => {
    const trustedReq = new Request('https://warungjnj.online/api/toyyibpay/config', {
      headers: { Origin: 'https://warungjnj.online' },
    });
    const trustedHeaders = getCorsHeaders(trustedReq);
    expect(trustedHeaders['Access-Control-Allow-Origin']).toBe('https://warungjnj.online');
    expect(trustedHeaders['Access-Control-Allow-Origin']).not.toBe('*');

    const evilReq = new Request('https://warungjnj.online/api/toyyibpay/config', {
      headers: { Origin: 'https://evil-phishing.example' },
    });
    const evilHeaders = getCorsHeaders(evilReq);
    expect(evilHeaders['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('ignores wildcard values in ALLOWED_ORIGIN env overrides', () => {
    process.env['ALLOWED_ORIGIN'] = '*, https://staging.warungjnj.online/';
    const origins = getAllowedOrigins();
    expect(origins).not.toContain('*');
    expect(origins).toContain('https://staging.warungjnj.online');
    expect(isAllowedOrigin('https://staging.warungjnj.online')).toBe(true);
  });

  it('blocks disallowed preflight OPTIONS requests with 403 and allows trusted ones with 204', () => {
    const blocked = handleOptionsRequest(
      new Request('https://warungjnj.online/api/toyyibpay/config', {
        method: 'OPTIONS',
        headers: { Origin: 'https://untrusted.example' },
      })
    );
    expect(blocked.status).toBe(403);

    const allowed = handleOptionsRequest(
      new Request('https://warungjnj.online/api/toyyibpay/config', {
        method: 'OPTIONS',
        headers: { Origin: 'https://warung-pos.josephsudarso05.workers.dev' },
      })
    );
    expect(allowed.status).toBe(204);
  });

  it('resolves trusted return origins safely and falls back to warungjnj.online', () => {
    const spoofingReq = new Request('https://evil.example/api/toyyibpay/create-bill', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(resolveTrustedReturnOrigin(spoofingReq)).toBe('https://warungjnj.online');

    const validReq = new Request('https://warungjnj.online/api/toyyibpay/create-bill', {
      headers: { Origin: 'https://warungjnj.online' },
    });
    expect(resolveTrustedReturnOrigin(validReq)).toBe('https://warungjnj.online');
  });

  it('extracts client IP safely and enforces sliding-window rate limiting', () => {
    const req = new Request('https://warungjnj.online/api/test', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    });
    expect(getClientIdentifier(req)).toBe('203.0.113.10');

    expect(checkRateLimit('test:ip', 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit('test:ip', 2, 60_000).allowed).toBe(true);
    const blocked = checkRateLimit('test:ip', 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('sanitizes text against script/HTML injection and cleans phone inputs', () => {
    expect(sanitizeText('  <script>alert(1)</script><b>Ali</b>   Sabah  ')).toBe('Ali Sabah');
    expect(sanitizePhoneInput('+60 17-222 1784 ext 99')).toBe('+6017222178499');
  });
});
