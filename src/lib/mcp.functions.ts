import { supabase } from '@/integrations/supabase/client';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'pending_payment' | 'pending_verification';

/**
 * Retrieves full details for a specific order.
 * @param orderId - The UUID of the order
 */
export async function getOrderDetails(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      tables (table_number),
      order_items (
        id,
        quantity,
        fulfillment_type,
        container_size,
        menu_items (name, price)
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    console.error(`MCP Error fetching order ${orderId}:`, error);
    throw new Error(`Failed to fetch order: ${error.message}`);
  }
  
  return data;
}

/**
 * Allows an agent to advance an order state with an audit trail.
 * @param orderId - The UUID of the order
 * @param nextStatus - The status to transition to
 * @param agentId - The identity string of the agent performing the action
 */
export async function updateOrderStatusAgent(orderId: string, nextStatus: OrderStatus, agentId: string) {
  // 1. Fetch current status to validate transition
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (fetchError || !currentOrder) {
    throw new Error(`Order not found or fetch failed: ${fetchError?.message}`);
  }

  // 2. Perform the update
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId);

  if (updateError) {
    throw new Error(`Failed to update order status: ${updateError.message}`);
  }

  // 3. Log the action (Audit Trail)
  console.info(`[AUDIT] Order ${orderId} status changed from ${currentOrder.status} to ${nextStatus} by AGENT: ${agentId}`);
  
  const { error: auditError } = await supabase
    .from('order_edit_logs')
    .insert({
      order_id: orderId,
      action: 'status_update',
      details: {
        previous_status: currentOrder.status,
        new_status: nextStatus,
        agent_id: agentId,
      },
      reason: `Agent ${agentId} advanced order to ${nextStatus} via MCP`
    });

  if (auditError) {
    console.warn(`Failed to write to order_edit_logs: ${auditError.message}`);
  }
  
  return {
    success: true,
    message: `Order ${orderId} updated to ${nextStatus}`,
    audit_log: `Agent ${agentId} updated order ${orderId} from ${currentOrder.status} to ${nextStatus} at ${new Date().toISOString()}`
  };
}

/**
 * Provides structured menu data for context/inventory checks.
 */
export async function getMenuContext() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('category', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch menu context: ${error.message}`);
  }
  
  return data;
}
