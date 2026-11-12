import { createFileRoute } from '@tanstack/react-router';
import {
  checkRateLimit,
  getClientIdentifier,
  handleOptionsRequest,
  jsonError,
  jsonSuccess,
  sanitizeText,
} from '@/lib/api-security';
import { md5 } from '@/lib/md5';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function parseWebhookPayload(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const out: Record<string, string> = {};
    form.forEach((value, key) => {
      out[key] = typeof value === 'string' ? value : value.name;
    });
    return out;
  }

  const rawBody = await request.text();
  if (contentType.includes('application/json')) {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined && v !== null) out[k] = String(v);
    }
    return out;
  }

  const params = new URLSearchParams(rawBody);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export const Route = createFileRoute('/api/toyyibpay-webhook')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => handleOptionsRequest(request, 'POST, OPTIONS'),
      POST: async ({ request }) => {
        const clientIp = getClientIdentifier(request);
        const rate = checkRateLimit(`toyyibpay_webhook:${clientIp}`, 60, 60_000);
        if (!rate.allowed) {
          return jsonError('Kadar permintaan melebihi had.', 429, request);
        }

        try {
          const { getServerSupabase, getToyyibPayServerCredentials } = await import(
            '@/lib/supabase-server.server'
          );
          const sb = getServerSupabase();
          const creds = await getToyyibPayServerCredentials();

          if (!creds.secretKey) {
            return jsonError('Konfigurasi gerbang pembayaran pelayan tidak tersedia.', 503, request);
          }

          const payload = await parseWebhookPayload(request);
          const statusId = sanitizeText(payload['status_id'] ?? '', 8);
          const billCode = sanitizeText(payload['billcode'] ?? '', 80);
          const orderId = sanitizeText(payload['order_id'] ?? payload['refno'] ?? '', 80);
          const amountStr = sanitizeText(payload['amount'] ?? '0', 30);
          const receivedChecksum = sanitizeText(payload['checksum'] ?? '', 64).toLowerCase();

          if (!statusId || !billCode || !receivedChecksum) {
            return jsonError('Data notifikasi pembayaran tidak lengkap.', 400, request);
          }

          // ToyyibPay signature formula: MD5(userSecretKey + status_id + billcode + order_id)
          const rawSignature = `${creds.secretKey}${statusId}${billCode}${orderId}`;
          const expectedChecksum = md5(rawSignature).toLowerCase();

          if (receivedChecksum !== expectedChecksum) {
            try {
              await (sb as any).from('security_events').insert({
                event_type: 'FAKE_WEBHOOK_SIGNATURE',
                details: `Invalid payment checksum received for bill ${billCode} (order: ${orderId || 'unknown'})`,
              });
            } catch {
              // Non-fatal logging failure
            }
            return jsonError('Pengesahan tandatangan pembayaran gagal.', 401, request);
          }

          let orderQuery = sb
            .from('orders')
            .select('id, total_amount, paid, status, payment_reference')
            .limit(1);

          if (orderId && UUID_REGEX.test(orderId)) {
            orderQuery = orderQuery.eq('id', orderId);
          } else {
            orderQuery = orderQuery.eq('payment_reference', billCode);
          }

          const { data: order, error: fetchErr } = await orderQuery.maybeSingle();
          if (fetchErr || !order) {
            return jsonError('Rekod pesanan tidak ditemui.', 404, request);
          }

          if (
            order.paid ||
            order.status === 'preparing' ||
            order.status === 'ready' ||
            order.status === 'completed'
          ) {
            return jsonSuccess({ success: true, status: 'already_processed' }, request);
          }

          if (statusId !== '1') {
            await sb
              .from('orders')
              .update({
                payment_status: 'failed',
                status: 'cancelled',
                updated_at: new Date().toISOString(),
              })
              .eq('id', order.id)
              .eq('paid', false);

            return jsonSuccess({ success: true, status: 'payment_failed_recorded' }, request);
          }

          const parsedCents = Number.parseFloat(amountStr);
          if (Number.isFinite(parsedCents) && parsedCents > 0) {
            const paidAmount = parsedCents / 100;
            if (Math.abs(paidAmount - Number(order.total_amount)) > 0.01) {
              try {
                await (sb as any).from('security_events').insert({
                  event_type: 'PAYMENT_AMOUNT_MISMATCH',
                  details: `Order ${order.id}: Paid RM ${paidAmount.toFixed(2)}, expected RM ${Number(order.total_amount).toFixed(2)}`,
                });
              } catch {
                // Non-fatal logging failure
              }
              return jsonError('Jumlah bayaran tidak sepadan.', 400, request);
            }
          }

          await sb
            .from('orders')
            .update({
              paid: true,
              payment_status: 'paid',
              payment_method: 'toyyibpay_fpx',
              payment_reference: billCode,
              status: 'preparing',
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id);

          return jsonSuccess({ success: true, orderId: order.id }, request);
        } catch (err) {
          console.error('[ToyyibPay webhook] Error processing callback:', err);
          return jsonError('Notifikasi pembayaran gagal diproses.', 500, request);
        }
      },
    },
  },
});
