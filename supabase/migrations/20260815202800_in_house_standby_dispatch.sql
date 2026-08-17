-- supabase/migrations/20260815202800_in_house_standby_dispatch.sql
-- Two-Tier Rider Dispatch: In-House Standby Rider Fallback Assignment RPC

CREATE OR REPLACE FUNCTION public.assign_in_house_standby_rider(
  p_order_id uuid,
  p_staff_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id      uuid;
  v_in_house_id   uuid;
  v_cur_rider     uuid;
  v_updated_id    uuid;
BEGIN
  SELECT store_id, rider_id 
  INTO v_store_id, v_cur_rider
  FROM public.orders 
  WHERE id = p_order_id;

  IF v_store_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  -- If already claimed by a gig rider, return failure
  IF v_cur_rider IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'GIG_RIDER_CLAIMED', 
      'message', 'Order was already accepted by a gig rider!'
    );
  END IF;

  -- Find first available in-house rider
  SELECT id INTO v_in_house_id 
  FROM public.riders 
  WHERE store_id = v_store_id 
    AND status = 'available' 
  LIMIT 1;

  -- Atomic assignment
  UPDATE public.orders
  SET 
    rider_id = coalesce(v_in_house_id, p_order_id), -- assign in-house rider
    status = 'out_for_delivery'::order_status
  WHERE id = p_order_id
    AND rider_id IS NULL
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'RACE_CONDITION', 'message', 'Assignment failed due to state race condition.');
  END IF;

  -- Log audit entry in security_events
  INSERT INTO public.security_events (event_type, store_id, details)
  VALUES (
    'IN_HOUSE_STANDBY_DISPATCHED',
    v_store_id,
    'Order ' || p_order_id || ' assigned to in-house standby rider by staff "' || coalesce(p_staff_name, 'Counter Staff') || '" after gig dispatch fallback.'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'message', 'Assigned to in-house standby rider successfully!'
  );
END;
$$;
