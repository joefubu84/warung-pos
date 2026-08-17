-- supabase/migrations/20260814174200_create_place_order_rpc.sql
-- Transactional place_order RPC with Minimum Delivery Subtotal, Phone Validation & Haversine Fee

create or replace function public.place_order(
  p_order      jsonb,   -- { type, table_id, customer_name, customer_phone, discount_type, discount_value, device_id, delivery_lat, delivery_lng, delivery_address }
  p_items      jsonb,   -- [{ menu_item_id, quantity, fulfillment_type, container_size, container_charge, notes }]
  p_payments   jsonb    -- [{ amount, payment_method, paid_by }]  (may be empty for unpaid)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id      uuid;
  v_role          app_role;
  v_order_id      uuid;
  v_item          jsonb;
  v_pay           jsonb;
  v_subtotal      numeric(12,2) := 0;
  v_discount_type text;
  v_discount_val  numeric(12,2);
  v_discount_amt  numeric(12,2) := 0;
  v_total         numeric(12,2);
  v_pay_sum       numeric(12,2) := 0;
  v_qty           integer;
  v_menu_price    numeric(12,2);
  v_stock_count   integer;
  v_container     numeric(12,2);
  v_table_id_text text;
  v_device_id     text;
  v_order_type    order_type;
  v_cust_phone    text;

  -- Delivery calculation variables
  v_store_lat     numeric := 3.1390;   -- Warung J&J Base Latitude
  v_store_lng     numeric := 101.6869; -- Warung J&J Base Longitude
  v_cust_lat      numeric;
  v_cust_lng      numeric;
  v_dist_km       numeric := 0;
  v_delivery_fee  numeric(12,2) := 0;
begin
  v_device_id     := p_order->>'device_id';
  v_table_id_text := p_order->>'table_id';
  v_order_type    := coalesce((p_order->>'type')::order_type, 'dine_in'::order_type);
  v_cust_phone    := p_order->>'customer_phone';

  -- 1. Phone Format Validation for Delivery
  if v_order_type = 'delivery' then
    if v_cust_phone is null or length(regexp_replace(v_cust_phone, '\D', '', 'g')) < 9 then
      insert into public.security_events (event_type, store_id, device_id, details)
      values ('INVALID_PHONE_FORMAT', v_store_id, v_device_id, 'Delivery rejected: Invalid phone number format submitted');

      return jsonb_build_object(
        'success', false,
        'error', 'INVALID_PHONE',
        'message', 'Please provide a valid Malaysian mobile phone number (e.g. 0198887766).'
      );
    end if;
  end if;

  -- 2. Re-derive store_id on server
  v_store_id := public.get_auth_store_id();
  if v_store_id is null and v_table_id_text is not null then
    select store_id into v_store_id from public.tables where id = v_table_id_text::uuid;
  end if;

  if v_store_id is null then
    select id into v_store_id from public.stores limit 1;
  end if;

  -- 3. Dine-in Table Lock & Rate Limit Check
  if v_order_type = 'dine_in' and v_table_id_text is not null then
    perform pg_advisory_xact_lock(hashtext('table_order_' || v_table_id_text));
    
    if (
      select count(*) from public.orders 
      where table_id = v_table_id_text::uuid 
      and created_at > now() - interval '1 minute'
    ) >= 10 then
      insert into public.security_events (event_type, store_id, table_id, device_id, details)
      values ('RATE_LIMIT_EXCEEDED', v_store_id, v_table_id_text::uuid, v_device_id, 'Server rate limit triggered: >10 orders/min on table');

      return jsonb_build_object(
        'success', false, 
        'error', 'RATE_LIMIT_EXCEEDED', 
        'message', 'Rate limit exceeded: Max 10 orders per minute allowed per table.'
      );
    end if;
  end if;

  -- 4. Recompute subtotal from AUTHORITATIVE database menu prices (never trust client)
  if jsonb_array_length(p_items) = 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'INVALID_ORDER',
      'message', 'Order must contain at least one item'
    );
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 then
      insert into public.security_events (event_type, store_id, table_id, device_id, details)
      values ('PRICE_MISMATCH', v_store_id, case when v_table_id_text is not null then v_table_id_text::uuid else null end, v_device_id, 'Invalid item quantity submitted');

      return jsonb_build_object(
        'success', false,
        'error', 'PRICE_MISMATCH',
        'message', 'Invalid quantity submitted for item.'
      );
    end if;

    select price, stock_count into v_menu_price, v_stock_count
    from public.menu_items
    where id = (v_item->>'menu_item_id')::uuid
      and is_available = true;

    if v_menu_price is null then
      insert into public.security_events (event_type, store_id, table_id, device_id, details)
      values ('PRICE_MISMATCH', v_store_id, case when v_table_id_text is not null then v_table_id_text::uuid else null end, v_device_id, 'Menu item not found or unavailable in store');

      return jsonb_build_object(
        'success', false,
        'error', 'PRICE_MISMATCH',
        'message', 'Menu item not found or unavailable.'
      );
    end if;

    if v_stock_count = 0 then
      insert into public.security_events (event_type, store_id, table_id, device_id, details)
      values ('PRICE_MISMATCH', v_store_id, case when v_table_id_text is not null then v_table_id_text::uuid else null end, v_device_id, 'Order attempt rejected for sold out item');

      return jsonb_build_object(
        'success', false,
        'error', 'SOLD_OUT',
        'message', 'Selected dish is currently sold out.'
      );
    end if;

    v_container := coalesce((v_item->>'container_charge')::numeric, 0);
    if v_container not in (0, 1.00) then
      insert into public.security_events (event_type, store_id, table_id, device_id, details)
      values ('PRICE_MISMATCH', v_store_id, case when v_table_id_text is not null then v_table_id_text::uuid else null end, v_device_id, 'Invalid container charge submitted');

      return jsonb_build_object(
        'success', false,
        'error', 'PRICE_MISMATCH',
        'message', 'Invalid container charge submitted.'
      );
    end if;

    v_subtotal := v_subtotal + (v_menu_price + v_container) * v_qty;
  end loop;

  -- 5. MINIMUM DELIVERY FOOD SUBTOTAL CHECK (Min RM 15.00)
  if v_order_type = 'delivery' and v_subtotal < 15.00 then
    insert into public.security_events (event_type, store_id, device_id, details)
    values ('MIN_DELIVERY_SUBTOTAL_FAILED', v_store_id, v_device_id, 'Delivery rejected: Subtotal RM ' || v_subtotal || ' is below RM 15.00 minimum');

    return jsonb_build_object(
      'success', false,
      'error', 'MIN_SUBTOTAL',
      'message', 'Minimum food subtotal for delivery is RM 15.00 (Current: RM ' || trim(to_char(v_subtotal, '999990.00')) || ').'
    );
  end if;

  -- 6. Server-Authoritative Delivery Pricing & Zone Validation
  if v_order_type = 'delivery' then
    v_cust_lat := (p_order->>'delivery_lat')::numeric;
    v_cust_lng := (p_order->>'delivery_lng')::numeric;

    if v_cust_lat is not null and v_cust_lng is not null then
      v_dist_km := public.haversine_km(v_store_lat, v_store_lng, v_cust_lat, v_cust_lng);

      -- Max 15km Delivery Radius Rule
      if v_dist_km > 15.0 then
        insert into public.security_events (event_type, store_id, device_id, details)
        values ('OUT_OF_DELIVERY_ZONE', v_store_id, v_device_id, 'Delivery address rejected: Distance is ' || v_dist_km || 'km (Max 15km allowed)');

        return jsonb_build_object(
          'success', false,
          'error', 'OUT_OF_ZONE',
          'message', 'Sorry, your address (' || v_dist_km || 'km away) is outside our 15km delivery area.'
        );
      end if;

      -- RM 1.00 / km with RM 2.00 minimum base fee
      v_delivery_fee := round(greatest(v_dist_km * 1.00, 2.00), 2);
    else
      -- Flat minimum fallback if GPS disabled
      v_delivery_fee := 3.00;
    end if;
  end if;

  -- 7. Compute discount server-side
  v_discount_type := coalesce(p_order->>'discount_type', 'fixed');
  v_discount_val  := coalesce((p_order->>'discount_value')::numeric, 0);
  if v_discount_val < 0 then
    v_discount_val := 0;
  end if;

  if v_discount_type = 'percentage' then
    if v_discount_val > 100 then v_discount_val := 100; end if;
    v_discount_amt := round(v_subtotal * (v_discount_val / 100), 2);
  elsif v_discount_type = 'fixed' then
    v_discount_amt := round(v_discount_val, 2);
  end if;

  if v_discount_amt > v_subtotal then
    v_discount_amt := v_subtotal;
  end if;

  -- Food subtotal - discount + server delivery fee
  v_total := round(v_subtotal - v_discount_amt + v_delivery_fee, 2);

  -- 8. Sum & validate payments
  v_pay_sum := 0;
  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb))
  loop
    v_pay_sum := v_pay_sum + (v_pay->>'amount')::numeric;
  end loop;

  -- 9. Insert Order
  insert into public.orders (
    store_id,
    type,
    status,
    table_id,
    total_amount,
    delivery_fee,
    delivery_address,
    customer_phone
  ) values (
    v_store_id,
    v_order_type,
    case 
      when v_order_type = 'delivery' and jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) = 0 then 'pending'::order_status
      when jsonb_array_length(coalesce(p_payments, '[]'::jsonb)) > 0 then 'preparing'::order_status 
      else 'pending'::order_status 
    end,
    case when v_table_id_text is not null then v_table_id_text::uuid else null end,
    v_total,
    v_delivery_fee,
    p_order->>'delivery_address',
    v_cust_phone
  )
  returning id into v_order_id;

  -- 10. Insert Order Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select price into v_menu_price
    from public.menu_items
    where id = (v_item->>'menu_item_id')::uuid;

    v_container := coalesce((v_item->>'container_charge')::numeric, 0);

    insert into public.order_items (
      order_id,
      menu_item_id,
      quantity,
      price_at_order,
      fulfillment_type,
      notes
    ) values (
      v_order_id,
      (v_item->>'menu_item_id')::uuid,
      (v_item->>'quantity')::int,
      v_menu_price + v_container,
      coalesce(v_item->>'fulfillment_type', 'dine_in'),
      v_item->>'notes'
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'total_amount', v_total,
    'delivery_fee', v_delivery_fee,
    'distance_km', v_dist_km
  );
end;
$$;
