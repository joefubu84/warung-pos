-- supabase/migrations/20260815202600_manual_refund_queue_rpc.sql
-- Simplified Manual Staff Refund RPC with Idempotency & Rider-Race Guards

CREATE OR REPLACE FUNCTION public.mark_refund_complete(
  p_order_id uuid,
  p_staff_name text,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id      uuid;
  v_total_amt     numeric(12,2);
  v_rider_id      uuid;
  v_pay_status    text;
  v_updated_id    uuid;
BEGIN
  SELECT store_id, total_amount, rider_id, payment_status
  INTO v_store_id, v_total_amt, v_rider_id, v_pay_status
  FROM public.orders
  WHERE id = p_order_id;

  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  -- 1. Rider-Race Guard: Cannot refund if job has been claimed by a rider
  IF v_rider_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'RIDER_ASSIGNED', 
      'message', 'Cannot refund: A rider has already accepted and claimed this delivery job!'
    );
  END IF;

  -- 2. Idempotency Guard: Cannot refund twice
  IF v_pay_status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'ALREADY_REFUNDED', 
      'message', 'This order has already been marked as refunded!'
    );
  END IF;

  -- Atomic update: only if rider_id is still NULL and payment_status is not refunded
  UPDATE public.orders
  SET 
    payment_status = 'refunded',
    status = 'cancelled'::order_status
  WHERE id = p_order_id
    AND rider_id IS NULL
    AND payment_status != 'refunded'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'RACE_CONDITION', 'message', 'Refund failed due to state mismatch.');
  END IF;

  -- 3. Log permanent audit trail to security_events
  INSERT INTO public.security_events (event_type, store_id, details)
  VALUES (
    'MANUAL_REFUND_COMPLETED',
    v_store_id,
    'Order ' || p_order_id || ' (RM ' || v_total_amt || ') manually refunded by staff "' || coalesce(p_staff_name, 'Staff') || '". Notes: ' || coalesce(p_notes, 'DuitNow manual transfer')
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'refund_amount', v_total_amt,
    'message', 'Order marked as refunded successfully. Audit log created.'
  );
END;
$$;
