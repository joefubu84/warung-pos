import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { md5 } from '@/lib/md5';
import {
  createToyyibPayCheckout,
  getToyyibPayConfig,
  saveToyyibPayConfig,
  verifyToyyibPayPayment,
} from '@/lib/toyyibpay';

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

describe('md5 & toyyibpay client security', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('matches RFC 1321 and Node crypto MD5 digests for UTF-8 and webhook checksum inputs', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');

    const webhookInput = 'secret_key_test' + '1' + 'bill12345' + 'ord-999' + 'Cafe-Penampang';
    const expected = createHash('md5').update(webhookInput, 'utf8').digest('hex');
    expect(md5(webhookInput)).toBe(expected);

    const longUtf8Input =
      'Warung J&J Penampang Sabah — Pesanan Atas Talian #2026-11-12: Nasi Ayam Penyet Sambal Terasi Pedas + Teh Tarik Kaw (RM 18.50)';
    expect(md5(longUtf8Input)).toBe(
      createHash('md5').update(longUtf8Input, 'utf8').digest('hex')
    );
  });

  it('purges legacy client secret keys and never transmits userSecretKey from browser', async () => {
    const localStorageMock = createStorageMock();
    localStorageMock.setItem('toyyibpay_secret_key', 'should_be_deleted');
    localStorageMock.setItem('toyyibpay_config', JSON.stringify({ userSecretKey: 'legacy_secret' }));

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes('/api/toyyibpay/create-bill')) {
        const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
        expect(body['userSecretKey']).toBeUndefined();
        return new Response(
          JSON.stringify({
            success: true,
            paymentUrl: 'https://toyyibpay.com/abc123',
            billCode: 'abc123',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          paid: true,
          billCode: 'abc123',
          status: 'paid',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    vi.stubGlobal('window', { localStorage: localStorageMock });
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('fetch', fetchMock);

    saveToyyibPayConfig({
      categoryCode: 'cat999',
      isSandbox: false,
      chargeToCustomer: true,
    });
    const cfg = getToyyibPayConfig();
    expect(cfg).toEqual({
      categoryCode: 'cat999',
      isSandbox: false,
      chargeToCustomer: true,
    });
    expect(localStorageMock.getItem('toyyibpay_secret_key')).toBeNull();
    expect(localStorageMock.getItem('toyyibpay_config')).toBeNull();

    const bill = await createToyyibPayCheckout({
      orderId: '1094d737-8104-4a55-b678-0fe9097beba0',
      totalAmount: 25.5,
      customerName: 'Aminah',
      customerPhone: '0198887766',
    });
    expect(bill.success).toBe(true);
    expect(bill.billCode).toBe('abc123');

    const verified = await verifyToyyibPayPayment({ billCode: 'abc123' });
    expect(verified.paid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
