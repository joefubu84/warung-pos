import { describe, expect, it } from 'vitest';
import { extractRawErrorMessage, getFriendlyErrorMessage } from '@/lib/error-utils';

describe('error-utils', () => {
  it('masks PostgreSQL / Supabase technical errors into friendly Malay copy', () => {
    const cases = [
      new Error('invalid login credentials'),
      new Error('PGRST204: Could not find column foo in schema cache'),
      new Error('duplicate key value violates unique constraint "23505"'),
      new Error('new row violates row-level security policy for table "orders"'),
      new Error('TypeError: Failed to fetch'),
      new Error('JWT expired'),
    ];

    for (const err of cases) {
      const friendly = getFriendlyErrorMessage(err);
      expect(friendly).not.toMatch(/pgrst|postgres|sql|supabase|jwt|23505/i);
      expect(friendly.length).toBeGreaterThan(10);
    }
  });

  it('filters stack traces, JSON payloads, and overly long technical messages', () => {
    expect(getFriendlyErrorMessage('Error at src/routes/api/foo.ts:42:10', 'Ralat fallback')).toBe(
      'Ralat fallback'
    );
    expect(getFriendlyErrorMessage('{"code":"500","detail":"internal"}', 'Ralat fallback')).toBe(
      'Ralat fallback'
    );
    expect(getFriendlyErrorMessage('x'.repeat(250), 'Ralat fallback')).toBe('Ralat fallback');
  });

  it('returns concise user-readable messages untouched', () => {
    expect(getFriendlyErrorMessage('Pesanan anda tidak ditemui.')).toBe(
      'Pesanan anda tidak ditemui.'
    );
    expect(extractRawErrorMessage({ message: 'Masa tamat.' })).toBe('Masa tamat.');
    expect(extractRawErrorMessage(null)).toBe('');
  });
});
