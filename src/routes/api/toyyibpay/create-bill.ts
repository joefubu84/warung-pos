import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  checkRateLimit,
  getClientIdentifier,
  handleOptionsRequest,
  jsonError,
  jsonSuccess,
  resolveTrustedReturnOrigin,
  sanitizePhoneInput,
  sanitizeText,
} from '@/lib/api-security';

const CreateBillSchema = z.object({
  orderId: z.string().trim().min(1).max(80),
  totalAmount: z.number().finite().positive().max(50000),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(6).max(20),
  customerEmail: z.string().trim().email().max(120).optional(),
  categoryCode: z.string().trim().max(40).optional(),
  isSandbox: z.boolean().optional(),
  chargeToCustomer: z.boolean().optional(),
});

function mapToyyibPayGatewayError(rawText: string, isSandbox: boolean): string {
  const clean = rawText.replace(/[\[\]"']/g, '').trim();

  if (clean.includes('KEY-DID-NOT-EXIST') || clean.includes('KEY-NOT-EXIST')) {
    return isSandbox
      ? 'Konfigurasi gerbang pembayaran ujian tidak sah. Sila semak tetapan mod persekitaran.'
      : 'Kunci gerbang pembayaran tidak sah. Sila hubungi pentadbir kedai.';
  }

  if (clean.includes('KEY-DID-NOT-MATCH') || clean.includes('KEY-NOT-MATCH')) {
    return 'Kod kategori pembayaran tidak sepadan dengan akaun pedagang.';
  }

  if (clean.includes('CATEGORY-NOT-EXIST') || clean.includes('CATEGORY-DOES-NOT-EXIST')) {
    return 'Kod kategori pembayaran tidak ditemui. Sila semak dalam Tetapan Kedai.';
  }

  if (clean.includes('INACTIVE') || clean.includes('PENDING') || clean.includes('UNDER-REVIEW')) {
    return 'Akaun gerbang pembayaran masih dalam semakan oleh penyedia perkhidmatan.';
  }

  return 'Pembayaran dalam talian tidak dapat dimulakan buat sementara waktu.';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute('/api/toyyibpay/create-bill')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => handleOptionsRequest(request, 'POST, OPTIONS'),
      POST: async ({ request }) => {
        const clientIp = getClientIdentifier(request);
        const rate = checkRateLimit(`toyyibpay_create:${clientIp}`, 15, 60_000);
        if (!rate.allowed) {
          return jsonError(
            'Terlalu banyak percubaan pembayaran. Sila tunggu seketika.',
            429,
            request,
            { retryAfterSeconds: rate.retryAfterSeconds }
          );
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonError('Format permintaan tidak sah.', 400, request);
        }

        const parsed = CreateBillSchema.safeParse(rawBody);
        if (!parsed.success) {
          return jsonError('Maklumat pesanan untuk pembayaran tidak lengkap.', 400, request);
        }

        try {
          const { getServerSupabase, getToyyibPayServerCredentials } = await import(
            '@/lib/supabase-server.server'
          );
          const sb = getServerSupabase();
          const creds = await getToyyibPayServerCredentials();

          if (!creds.secretKey) {
            return jsonError(
              'Gerbang pembayaran FPX automatik belum diaktifkan. Sila gunakan DuitNow QR buat masa ini.',
              503,
              request
            );
          }

          let storePrefs: Record<string, unknown> | undefined;
          try {
            const { data: storeRow } = await sb
              .from('stores')
              .select('settings')
              .limit(1)
              .maybeSingle();
            const settings = storeRow?.settings as Record<string, unknown> | null;
            if (settings && typeof settings['toyyibpay'] === 'object' && settings['toyyibpay']) {
              storePrefs = settings['toyyibpay'] as Record<string, unknown>;
            }
          } catch {
            // Continue with server/request preferences
          }

          const prefCategory =
            typeof storePrefs?.['categoryCode'] === 'string'
              ? storePrefs['categoryCode'].trim()
              : '';
          const categoryCode =
            creds.categoryCode ||
            sanitizeText(parsed.data.categoryCode || prefCategory, 40);

          if (!categoryCode) {
            return jsonError(
              'Kod kategori pembayaran belum ditetapkan dalam Tetapan Kedai.',
              400,
              request
            );
          }

          const isSandbox =
            creds.isSandbox ||
            Boolean(parsed.data.isSandbox ?? storePrefs?.['isSandbox'] === true);
          const chargeToCustomer =
            parsed.data.chargeToCustomer ??
            (storePrefs?.['chargeToCustomer'] !== false);

          const orderId = sanitizeText(parsed.data.orderId, 80);
          let authoritativeAmount = parsed.data.totalAmount;

          if (UUID_REGEX.test(orderId)) {
            const { data: existingOrder } = await sb
              .from('orders')
              .select('id, total_amount, paid')
              .eq('id', orderId)
              .maybeSingle();

            if (existingOrder) {
              if (existingOrder.paid) {
                return jsonError('Pesanan ini telah pun dijelaskan sebelum ini.', 409, request);
              }
              if (Number(existingOrder.total_amount) > 0) {
                authoritativeAmount = Number(existingOrder.total_amount);
              }
            }
          }

          const amountInCents = Math.max(100, Math.round(authoritativeAmount * 100));
          const cleanOrderRef = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'ORDER';
          const billName = `Warung_JNJ_${cleanOrderRef}`.slice(0, 30);
          const billDescription = `Pesanan Warung JNJ #${cleanOrderRef}`.slice(0, 100);
          const customerName = sanitizeText(parsed.data.customerName, 80) || 'Pelanggan';
          const customerPhone = sanitizePhoneInput(parsed.data.customerPhone) || '0123456789';
          const customerEmail = parsed.data.customerEmail || 'pelanggan@warungjnj.online';

          const origin = resolveTrustedReturnOrigin(request);
          const returnUrl = `${origin}/delivery?payment_status=return&order_id=${encodeURIComponent(orderId)}`;
          const callbackUrl = `${origin}/api/toyyibpay-webhook`;

          const baseUrl = isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';

          const formData = new URLSearchParams();
          formData.append('userSecretKey', creds.secretKey);
          formData.append('categoryCode', categoryCode);
          formData.append('billName', billName);
          formData.append('billDescription', billDescription);
          formData.append('billPriceSetting', '1');
          formData.append('billPayorInfo', '1');
          formData.append('billAmount', amountInCents.toString());
          formData.append('billReturnUrl', returnUrl);
          formData.append('billCallbackUrl', callbackUrl);
          formData.append('billExternalReferenceNo', orderId);
          formData.append('billTo', customerName);
          formData.append('billEmail', customerEmail);
          formData.append('billPhone', customerPhone);
          formData.append('billPaymentChannel', '0');
          formData.append('billChargeToCustomer', chargeToCustomer ? '0' : '1');
          formData.append('enableDuitNowQR', '1');
          formData.append('chargeDuitNowQR', '0');

          const gatewayResponse = await fetch(`${baseUrl}/index.php/api/createBill`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
          });

          const rawText = await gatewayResponse.text();
          let gatewayData: unknown = null;
          try {
            gatewayData = JSON.parse(rawText);
          } catch {
            const friendlyMsg = mapToyyibPayGatewayError(rawText, isSandbox);
            return jsonError(friendlyMsg, 502, request);
          }

          if (
            Array.isArray(gatewayData) &&
            gatewayData.length > 0 &&
            typeof gatewayData[0] === 'object' &&
            gatewayData[0] !== null &&
            typeof (gatewayData[0] as Record<string, unknown>)['BillCode'] === 'string'
          ) {
            const billCode = sanitizeText(
              String((gatewayData[0] as Record<string, unknown>)['BillCode']),
              60
            );
            const paymentUrl = `${baseUrl}/${billCode}`;

            if (UUID_REGEX.test(orderId)) {
              await sb
                .from('orders')
                .update({
                  payment_reference: billCode,
                  payment_method: 'toyyibpay_fpx',
                })
                .eq('id', orderId);
            }

            return jsonSuccess(
              {
                success: true,
                paymentUrl,
                billCode,
                isDemo: false,
              },
              request
            );
          }

          const firstItem = Array.isArray(gatewayData)
            ? (gatewayData[0] as Record<string, unknown> | undefined)
            : undefined;
          const rawMsg =
            typeof firstItem?.['msg'] === 'string' ? firstItem['msg'] : rawText;
          return jsonError(mapToyyibPayGatewayError(rawMsg, isSandbox), 502, request);
        } catch (err) {
          console.error('[ToyyibPay create-bill] Unexpected failure:', err);
          return jsonError(
            'Sesi pembayaran FPX tidak dapat dimulakan buat masa ini.',
            500,
            request
          );
        }
      },
    },
  },
});
