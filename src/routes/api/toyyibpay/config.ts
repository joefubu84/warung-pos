import { createFileRoute } from '@tanstack/react-router';
import {
  checkRateLimit,
  getClientIdentifier,
  handleOptionsRequest,
  jsonError,
  jsonSuccess,
} from '@/lib/api-security';

export const Route = createFileRoute('/api/toyyibpay/config')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => handleOptionsRequest(request, 'GET, OPTIONS'),
      GET: async ({ request }) => {
        const clientIp = getClientIdentifier(request);
        const rate = checkRateLimit(`toyyibpay_config:${clientIp}`, 60, 60_000);
        if (!rate.allowed) {
          return jsonError('Terlalu banyak permintaan. Sila cuba sebentar lagi.', 429, request);
        }

        try {
          const { getToyyibPayServerCredentials, getServerSupabase } = await import(
            '@/lib/supabase-server.server'
          );
          const creds = await getToyyibPayServerCredentials();

          let storePrefs: Record<string, unknown> | undefined;
          if (!creds.categoryCode) {
            try {
              const sb = getServerSupabase();
              const { data } = await sb
                .from('stores')
                .select('settings')
                .limit(1)
                .maybeSingle();
              const settings = data?.settings as Record<string, unknown> | null;
              if (settings && typeof settings['toyyibpay'] === 'object' && settings['toyyibpay']) {
                storePrefs = settings['toyyibpay'] as Record<string, unknown>;
              }
            } catch {
              // Ignore non-critical settings read error
            }
          }

          const prefCategory =
            typeof storePrefs?.['categoryCode'] === 'string'
              ? storePrefs['categoryCode'].trim()
              : '';
          const categoryConfigured = Boolean(creds.categoryCode || prefCategory);

          return jsonSuccess(
            {
              success: true,
              configured: Boolean(creds.secretKey),
              categoryConfigured,
              sandbox: creds.isSandbox || storePrefs?.['isSandbox'] === true,
            },
            request
          );
        } catch {
          return jsonError(
            'Status konfigurasi pembayaran tidak dapat disemak buat masa ini.',
            500,
            request
          );
        }
      },
    },
  },
});
