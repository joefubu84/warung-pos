-- supabase/migrations/20260816000000_enable_kitchen_orders_rpc_and_rls.sql
-- Enables Kitchen Display to query and receive Realtime orders without authentication blockers.

-- 1. RLS Policies: Allow anon to SELECT & UPDATE orders and order_items
DROP POLICY IF EXISTS "orders_anon_select" ON public.orders;
CREATE POLICY "orders_anon_select" ON public.orders
    FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "orders_anon_update" ON public.orders;
CREATE POLICY "orders_anon_update" ON public.orders
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_anon_select" ON public.order_items;
CREATE POLICY "order_items_anon_select" ON public.order_items
    FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "order_items_anon_all" ON public.order_items;
CREATE POLICY "order_items_anon_all" ON public.order_items
    FOR ALL TO anon
    USING (true)
    WITH CHECK (true);

-- 2. Ensure Realtime Publication includes orders & order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;

-- 3. Dedicated Atomic Kitchen RPC: get_kitchen_orders (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_kitchen_orders(p_store_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'store_id', o.store_id,
      'status', o.status,
      'type', o.type,
      'delivery_service', o.delivery_service,
      'customer_name', o.customer_name,
      'table_id', o.table_id,
      'paid', coalesce(o.paid, false),
      'payment_status', coalesce(o.payment_status, 'unpaid'),
      'payment_method', o.payment_method,
      'customer_phone', o.customer_phone,
      'delivery_address', o.delivery_address,
      'created_at', o.created_at,
      'ready_at', o.ready_at,
      'order_items', (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'quantity', oi.quantity,
            'fulfillment_type', oi.fulfillment_type,
            'notes', oi.notes,
            'menu_items', jsonb_build_object('name', coalesce(mi.name, 'Hidangan'))
          )
        ), '[]'::jsonb)
        FROM public.order_items oi
        LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = o.id
      )
    ) ORDER BY o.created_at ASC
  ), '[]'::jsonb) INTO v_res
  FROM public.orders o
  WHERE o.status IN ('pending', 'preparing')
    AND (p_store_id IS NULL OR o.store_id = p_store_id);

  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kitchen_orders(uuid) TO anon, authenticated, service_role;

-- 4. Dedicated Atomic Kitchen RPC: update_kitchen_order_status (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_kitchen_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET 
    status = p_status::order_status,
    ready_at = CASE WHEN p_status IN ('ready', 'completed') THEN now() ELSE ready_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_kitchen_order_status(uuid, text) TO anon, authenticated, service_role;
