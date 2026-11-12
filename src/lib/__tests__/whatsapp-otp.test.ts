import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/whatsapp-gateway', () => ({
  getWhatsAppGatewayConfig: () => ({ mode: 'A', fonnteToken: '' }),
  dispatchWhatsAppOTP: vi.fn(async () => ({ success: true })),
}));

import {
  requestWhatsAppOtp,
  sanitizePhone,
  verifyWhatsAppOtp,
} from '@/lib/whatsapp-otp';

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('whatsapp-otp security controls', () => {
  beforeEach(() => {
    const localStorageMock = createStorageMock();
    vi.stubGlobal('window', { localStorage: localStorageMock });
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('normalizes Malaysian phone numbers consistently to 601XXXXXXXX format', () => {
    expect(sanitizePhone('017-222 1784')).toBe('60172221784');
    expect(sanitizePhone('+60 11-2525 1817')).toBe('601125251817');
    expect(sanitizePhone('123456789')).toBe('60123456789');
  });

  it('enforces 3-attempt OTP brute-force lockouts and hourly request limits', () => {
    const req1 = requestWhatsAppOtp('0198887766');
    expect(req1.success).toBe(true);
    expect(req1.otpCode).toMatch(/^\d{6}$/);

    const wrongCode = req1.otpCode === '000000' ? '111111' : '000000';
    expect(verifyWhatsAppOtp('0198887766', wrongCode).success).toBe(false);
    expect(verifyWhatsAppOtp('0198887766', wrongCode).success).toBe(false);
    const lockRes = verifyWhatsAppOtp('0198887766', wrongCode);
    expect(lockRes.success).toBe(false);
    expect(lockRes.message.toLowerCase()).toContain('locked');

    const blockedRequest = requestWhatsAppOtp('0198887766');
    expect(blockedRequest.success).toBe(false);
    expect(blockedRequest.message.toLowerCase()).toContain('locked');
  });

  it('enforces max 5 OTP dispatches per hour per phone number', () => {
    for (let i = 0; i < 5; i++) {
      const r = requestWhatsAppOtp('0123456789');
      expect(r.success).toBe(true);
    }
    const sixth = requestWhatsAppOtp('0123456789');
    expect(sixth.success).toBe(false);
    expect(sixth.message.toLowerCase()).toContain('rate limit');
  });

  it('verifies a valid 6-digit OTP and awards points cleanly', () => {
    const issued = requestWhatsAppOtp('0139876543');
    expect(issued.success).toBe(true);
    const verified = verifyWhatsAppOtp('0139876543', issued.otpCode ?? '');
    expect(verified.success).toBe(true);
    expect(verified.pointsAwarded).toBe(50);
  });
});
