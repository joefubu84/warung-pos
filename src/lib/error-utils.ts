/**
 * Centralized error translator & logger for client and server layers.
 * Ensures technical stack traces, SQL/schema details, and raw internal error codes
 * never leak directly onto user-facing screens.
 */

const TECHNICAL_PATTERNS: Array<{ pattern: RegExp; friendlyMessage: string }> = [
  {
    pattern: /invalid login credentials|invalid_credentials/i,
    friendlyMessage: 'Emel atau kata laluan tidak tepat. Sila semak dan cuba lagi.',
  },
  {
    pattern: /email not confirmed/i,
    friendlyMessage: 'Emel akaun belum disahkan. Sila semak peti masuk emel anda.',
  },
  {
    pattern: /user already registered|already been registered/i,
    friendlyMessage: 'Akaun dengan maklumat ini telah didaftarkan. Sila log masuk.',
  },
  {
    pattern: /jwt|token.*expired|session.*missing|auth session/i,
    friendlyMessage: 'Sesi log masuk anda telah tamat. Sila log masuk semula.',
  },
  {
    pattern: /failed to fetch|networkerror|network request failed|fetcherror|err_network/i,
    friendlyMessage: 'Sambungan internet terganggu buat sementara waktu. Sila cuba sebentar lagi.',
  },
  {
    pattern: /timeout|timed out|abort/i,
    friendlyMessage: 'Permintaan mengambil masa terlalu lama. Sila cuba lagi.',
  },
  {
    pattern: /duplicate key|unique constraint|23505/i,
    friendlyMessage: 'Rekod dengan maklumat yang sama telah wujud dalam sistem.',
  },
  {
    pattern: /foreign key|23503|violates.*constraint/i,
    friendlyMessage: 'Rekod ini masih mempunyai pautan aktif dengan data lain.',
  },
  {
    pattern: /row-level security|permission denied|42501|insufficient_privilege|unauthorized/i,
    friendlyMessage: 'Anda tidak mempunyai kebenaran untuk melaksanakan tindakan ini.',
  },
  {
    pattern: /pgrst|postgres|sql|supabase|relation .* does not exist|column .* does not exist|syntax error|unexpected token|undefined is not/i,
    friendlyMessage: 'Ralat sistem sementara berlaku. Sila cuba sebentar lagi.',
  },
];

export function extractRawErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'object' && 'message' in error && typeof (error as any).message === 'string') {
    return (error as any).message;
  }
  return '';
}

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = 'Operasi tidak dapat dilengkapkan. Sila cuba sebentar lagi.'
): string {
  const raw = extractRawErrorMessage(error).trim();
  if (!raw) return fallback;

  for (const { pattern, friendlyMessage } of TECHNICAL_PATTERNS) {
    if (pattern.test(raw)) {
      return friendlyMessage;
    }
  }

  // Filter out overly technical one-liners containing stack fragments or JSON dumps
  if (raw.includes('at ') && raw.includes('.ts')) return fallback;
  if (raw.startsWith('{') || raw.startsWith('[')) return fallback;
  if (raw.length > 220) return fallback;

  return raw;
}

export function reportClientError(context: string, error: unknown): string {
  console.error(`[${context}]`, error);
  return getFriendlyErrorMessage(error);
}
