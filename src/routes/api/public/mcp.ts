import { createAPIFileRoute } from '@tanstack/react-start/api';

export const Route = createAPIFileRoute('/api/public/mcp')({
  GET: async ({ request }) => {
    return new Response(
      JSON.stringify({
        system: 'Warung J&J',
        version: '1.0.0',
        protocol: 'Model Context Protocol',
        capabilities: {
          orders: {
            lookup: {
              description: 'Retrieve full order details including items and table context.',
              endpoint: 'internal: mcp.functions.ts -> getOrderDetails(orderId)'
            },
            update_status: {
              description: 'Advance order state (e.g. pending -> preparing) with strict audit logging.',
              endpoint: 'internal: mcp.functions.ts -> updateOrderStatusAgent(orderId, nextStatus, agentId)'
            }
          },
          menu: {
            discovery: {
              description: 'Fetch the structured menu catalog and categories for contextual understanding.',
              endpoint: 'internal: mcp.functions.ts -> getMenuContext()'
            }
          }
        },
        security: {
          audit_logging: 'Enabled on state-mutating actions',
          authentication: 'Agent invocation requires trusted internal environment execution.'
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      }
    );
  },
});
