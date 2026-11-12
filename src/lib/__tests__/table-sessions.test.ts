import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  },
}));

import {
  calculateHaversineDistance,
  checkOrderRateLimit,
} from '@/lib/table-sessions';

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

describe('table-sessions security & geolocation helpers', () => {
  beforeEach(() => {
    const localStorageMock = createStorageMock();
    vi.stubGlobal('window', { localStorage: localStorageMock });
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('computes accurate Haversine distances in meters', () => {
    expect(calculateHaversineDistance(5.9284, 116.1146, 5.9284, 116.1146)).toBe(0);
    // ~1.11 km northward delta (~0.01 deg latitude)
    const dist = calculateHaversineDistance(5.9284, 116.1146, 5.9384, 116.1146);
    expect(dist).toBeGreaterThan(1050);
    expect(dist).toBeLessThan(1200);
  });

  it('blocks excessive per-device orders beyond 5 orders per minute', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkOrderRateLimit('dev-test-1').allowed).toBe(true);
    }
    const sixth = checkOrderRateLimit('dev-test-1');
    expect(sixth.allowed).toBe(false);
    expect(sixth.remainingSeconds).toBeGreaterThan(0);
  });
});
