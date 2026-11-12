import { createFileRoute } from '@tanstack/react-router';
import {
  checkRateLimit,
  getClientIdentifier,
  getCorsHeaders,
  handleOptionsRequest,
  jsonError,
} from '@/lib/api-security';

export const Route = createFileRoute('/api/public/mcp')({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => handleOptionsRequest(request, 'GET, OPTIONS'),
      GET: async ({ request }) => {
        const clientIp = getClientIdentifier(request);
        const rate = checkRateLimit(`mcp:${clientIp}`, 60, 60_000);
        if (!rate.allowed) {
          return jsonError(
            'Terlalu banyak permintaan. Sila cuba sebentar lagi.',
            429,
            request,
            { retryAfterSeconds: rate.retryAfterSeconds }
          );
        }

        return new Response(
          JSON.stringify({
            system: 'Warung J&J',
            version: '1.0.0',
            protocol: 'Model Context Protocol',
            capabilities: {
              orders: {
                lookup: {
                  description: 'Retrieve full order details including items and table context.',
                  endpoint: 'internal: mcp.functions.ts -> getOrderDetails(orderId)',
                },
                update_status: {
                  description: 'Advance order state (e.g. pending -> preparing) with strict audit logging.',
                  endpoint: 'internal: mcp.functions.ts -> updateOrderStatusAgent(orderId, nextStatus, agentId)',
                },
              },
              menu: {
                discovery: {
                  description: 'Fetch the structured menu catalog and categories for contextual understanding.',
                  endpoint: 'internal: mcp.functions.ts -> getMenuContext()',
                },
              },
            },
            security: {
              audit_logging: 'Enabled on state-mutating actions',
              authentication: 'Agent invocation requires trusted internal environment execution.',
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...getCorsHeaders(request, 'GET, OPTIONS'),
            },
          }
        );
      },
    },
  },
});
