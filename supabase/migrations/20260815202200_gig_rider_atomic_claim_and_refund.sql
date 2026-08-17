-- supabase/migrations/20260815202200_gig_rider_atomic_claim_and_refund.sql
-- Atomic Rider Job Claim, Timeout Cancellation & Refund Management RPCs

-- 1. Atomic Rider Job Claim RPC (Prevents Race Conditions)
CREATE OR REPLACE FUNCTION public.claim_delivery_job(
  p_order_id uuid,
  p_rider_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id uuid;
  v_store_id   uuid;
BEGIN
  -- Atomic update: only succeeds if rider_id is still NULL
  UPDATE public.orders
  SET 
    rider_id = p_rider_id,
    status = 'out_for_delivery'::order_status
  WHERE id = p_order_id
    AND rider_id IS NULL
    AND status = 'preparing'::order_status
  RETURNING id, store_id INTO v_updated_id, v_store_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'JOB_ALREADY_CLAIMED',
      'message', 'Sorry, another rider already accepted this delivery job!'
    );
  END IF;

  -- Create delivery tracking record if not existing
  INSERT INTO public.deliveries (
    order_id,
    rider_id,
    tracking_token,
    status
  ) VALUES (
    p_order_id,
    p_rider_id,
    encode(gen_random_bytes(16), 'hex'),
    'picked_up'
  )
  ON CONFLICT (order_id) DO UPDATE 
  SET rider_id = p_rider_id, status = 'picked_up';

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'message', 'Job claimed successfully! Full delivery address unlocked.'
  );
END;
$$;

-- 2. Refund & Timeout Management RPC
CREATE OR REPLACE FUNCTION public.cancel_and_refund_order(
  p_order_id uuid,
  p_reason   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id    uuid;
  v_cur_status  order_status;
  v_total_amt   numeric(12,2);
  v_ref         text;
BEGIN
  SELECT store_id, status, total_amount, payment_reference 
  INTO v_store_id, v_cur_status, v_total_amt, v_ref
  FROM public.orders 
  WHERE id = p_order_id;

  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND', 'message', 'Order not found');
  END IF;

  -- Update status to cancelled
  UPDATE public.orders
  SET 
    status = 'cancelled'::order_status,
    payment_status = 'refunded'
  WHERE id = p_order_id;

  -- Log permanent audit record in security_events
  INSERT INTO public.security_events (event_type, store_id, details)
  VALUES (
    'ORDER_REFUNDED', 
    v_store_id, 
    'Order ' || p_order_id || ' refunded (RM ' || v_total_amt || '). Reason: ' || coalesce(p_reason, 'No rider claimed job within timeout period')
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'refund_amount', v_total_amt,
    'payment_reference', v_ref,
    'message', 'Order cancelled and refund processed successfully.'
  );
END;
$$;
