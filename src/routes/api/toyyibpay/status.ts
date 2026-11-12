import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  checkRateLimit,
  getClientIdentifier,
  handleOptionsRequest,
  jsonError,
  jsonSuccess,
  sanitizeText,
} from '@/lib/api-security';

const StatusCheckSchema = z
  .object({
    billCode: z.string().trim().min(2).max(80).optional(),
    orderId: z.string().trim().min(2).max(80).optional(),
    isSandbox: z.boolean().optional(),
  })
  .refine((val) => Boolean(val.billCode || val.orderId), {
    message: 'Rujukan pesanan diperlukan.',
  });

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute('/api/toyyibpay/status')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => handleOptionsRequest(request, 'POST, OPTIONS'),
      POST: async ({ request }) => {
        const clientIp = getClientIdentifier(request);
        const rate = checkRateLimit(`toyyibpay_status:${clientIp}`, 30, 60_000);
        if (!rate.allowed) {
          return jsonError('Terlalu banyak permintaan semakan.', 429, request);
        }

        let rawBody: unknown;
        try {
          rawBody = await request.json();
        } catch {
          return jsonError('Format permintaan tidak sah.', 400, request);
        }

        const parsed = StatusCheckSchema.safeParse(rawBody);
        if (!parsed.success) {
          return jsonError('Maklumat rujukan bil pembayaran tidak sah.', 400, request);
        }

        try {
          const { getServerSupabase, getToyyibPayServerCredentials } = await import(
            '@/lib/supabase-server.server'
          );
          const sb = getServerSupabase();
          const creds = await getToyyibPayServerCredentials();

          const orderId = parsed.data.orderId ? sanitizeText(parsed.data.orderId, 80) : undefined;
          let billCode = parsed.data.billCode ? sanitizeText(parsed.data.billCode, 80) : undefined;

          let orderRecord:
            | {
                id: string;
                total_amount: number;
                paid: boolean | null;
                status: string;
                payment_reference: string | null;
              }
            | null = null;

          if (orderId && UUID_REGEX.test(orderId)) {
            const { data } = await sb
              .from('orders')
              .select('id, total_amount, paid, status, payment_reference')
              .eq('id', orderId)
              .maybeSingle();
            if (data) orderRecord = data;
          } else if (billCode) {
            const { data } = await sb
              .from('orders')
              .select('id, total_amount, paid, status, payment_reference')
              .eq('payment_reference', billCode)
              .maybeSingle();
            if (data) orderRecord = data;
          }

          if (!billCode && orderRecord?.payment_reference) {
            billCode = orderRecord.payment_reference;
          }

          if (orderRecord?.paid) {
            return jsonSuccess(
              {
                success: true,
                paid: true,
                orderId: orderRecord.id,
                billCode: billCode ?? orderRecord.payment_reference ?? null,
                status: orderRecord.status,
              },
              request
            );
          }

          if (!billCode) {
            return jsonError(
              'Rujukan transaksi FPX belum ditemui untuk pesanan ini.',
              400,
              request
            );
          }

          const isSandbox = creds.isSandbox || Boolean(parsed.data.isSandbox);
          const baseUrl = isSandbox ? 'https://dev.toyyibpay.com' : 'https://toyyibpay.com';

          const formData = new URLSearchParams();
          formData.append('billCode', billCode);

          const gatewayResponse = await fetch(`${baseUrl}/index.php/api/getBillTransactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString(),
          });

          const rawText = await gatewayResponse.text();
          let transactions: unknown = [];
          try {
            transactions = JSON.parse(rawText);
          } catch {
            return jsonSuccess(
              {
                success: true,
                paid: false,
                orderId: orderRecord?.id ?? orderId ?? null,
                billCode,
                message: 'Pengesahan pembayaran masih diproses oleh bank.',
              },
              request
            );
          }

          const txList = Array.isArray(transactions)
            ? (transactions as Array<Record<string, unknown>>)
            : [];
          const paidTx = txList.find((tx) => String(tx['billpaymentStatus'] ?? '') === '1');

          if (!paidTx) {
            return jsonSuccess(
              {
                success: true,
                paid: false,
                orderId: orderRecord?.id ?? orderId ?? null,
                billCode,
                message: 'Pembayaran belum selesai atau sedang disahkan.',
              },
              request
            );
          }

          const paidAmount = Number.parseFloat(String(paidTx['billpaymentAmount'] ?? '0'));
          if (
            orderRecord &&
            Number.isFinite(paidAmount) &&
            paidAmount > 0 &&
            Math.abs(paidAmount - Number(orderRecord.total_amount)) > 0.01
          ) {
            try {
              await (sb as any).from('security_events').insert({
                event_type: 'PAYMENT_AMOUNT_MISMATCH',
                details: `Order ${orderRecord.id}: FPX Paid RM ${paidAmount.toFixed(2)}, expected RM ${Number(orderRecord.total_amount).toFixed(2)}`,
              });
            } catch {
              // Non-fatal audit log write
            }
            return jsonError('Jumlah bayaran tidak sepadan dengan jumlah pesanan.', 400, request);
          }

          if (orderRecord) {
            const nextStatus =
              orderRecord.status === 'pending_payment' || orderRecord.status === 'pending'
                ? 'preparing'
                : orderRecord.status;

            await sb
              .from('orders')
              .update({
                paid: true,
                payment_status: 'paid',
                payment_method: 'toyyibpay_fpx',
                payment_reference: billCode,
                status: nextStatus as any,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orderRecord.id);
          }

          return jsonSuccess(
            {
              success: true,
              paid: true,
              orderId: orderRecord?.id ?? orderId ?? null,
              billCode,
              status: 'preparing',
            },
            request
          );
        } catch (err) {
          console.error('[ToyyibPay status] Error verifying transaction:', err);
          return jsonError(
            'Status pembayaran tidak dapat disemak buat masa ini.',
            500,
            request
          );
        }
      },
    },
  },
});
