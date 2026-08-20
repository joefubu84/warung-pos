# 🍜 Warung J&J POS & Delivery — Master Architecture & Deployment Guide

> **Project Name:** Warung J&J POS System  
> **Repository:** `https://github.com/joefubu84/warung-pos`  
> **Production Domain:** `https://warungjnj.online`  
> **Primary Location:** Warung J&J, Jalan Penampang, 89500 Penampang, Sabah, Malaysia (`5.918° N, 116.082° E`)  
> **Contact:** `017-222 1784`  

---

## 🏬 1. Store & Tenant Information

### 🏪 Store A (Main Branch — Warung J&J Penampang)
* **Store ID:** `1094d737-8104-4a55-b678-0fe9097beba0`
* **Location:** Penampang, Sabah (`5.918, 116.082`)
* **Delivery Rate:** RM 1.00 / km (Minimum fee: RM 2.00, Max Radius: 15.0 km, Min Order: RM 15.00)
* **Admin Staff User ID:** `0f81ea5a-e622-4343-a188-62f90dc1ef14` (`teststaffa@test.com`)
* **Bank Account:** Alliance Bank (`101960010088888` / `J&J CAFE & CATERING`)

### 🏪 Store B (Expansion Branch)
* **Store ID:** `fcf17ed0-711a-45b7-a8b1-d7a00479f590`
* **Staff User ID:** `c9e59f5a-6ef1-41a3-96f5-55dc1c11f6e1` (`Staff B`)
* **Data Isolation:** Enforced 100% via PostgreSQL Row Level Security (RLS) and `get_auth_store_id()`.

---

## 🛡️ 2. Core Security & Anti-Tampering Rules

1. **Zero-Trust Pricing**: Client price parameters (`unit_price`) are completely ignored. Prices are re-fetched directly from `public.menu_items` in PostgreSQL.
2. **Forced Unpaid Status**: Every order placed is forced to `payment_status = 'unpaid'` and `status = 'pending'`. Only staff or verified webhooks can confirm payment.
3. **Direct-Write Closure**: `order_items_public_insert` and `orders_public_insert` are dropped. All order creation goes through `place_order`.
4. **Server-Side Logistics**:
   * Haversine distance calculated inside PostgreSQL.
   * Delivery fee: `GREATEST(ROUND(v_dist_km * v_rate, 2), 2.00)`.
   * Radius limit: Blocks orders > 15.0 km with SQL exception.
   * Min order: Requires subtotal >= RM 15.00 for delivery orders.
5. **Double-Confirmation Guard**: `confirm_payment` blocks duplicate confirmation and cross-store confirmation.

---

## 🗄️ 3. Complete Production SQL Migration Script

Run this in your **Supabase / Lovable SQL Editor**:

```sql
-- ==============================================================================
-- 1. TABLE SAFETY & COLUMNS
-- ==============================================================================
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT 5.918;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT 116.082;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS delivery_rate numeric DEFAULT 1.00;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS fulfillment_type text DEFAULT 'takeaway';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Secure ToyyibPay storage table (service_role only)
CREATE TABLE IF NOT EXISTS public.store_payment_config (
  store_id           uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  toyyibpay_secret   text,
  toyyibpay_category text,
  is_sandbox         boolean DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
ALTER TABLE public.store_payment_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_payment_config FROM anon, authenticated;

-- ==============================================================================
-- 2. UNIFIED STORE RESOLVER HELPER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_auth_store_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;

  BEGIN
    SELECT store_id INTO v_store_id FROM public.profiles WHERE id = auth.uid();
    IF v_store_id IS NOT NULL THEN RETURN v_store_id; END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    SELECT store_id INTO v_store_id FROM public.users WHERE id = auth.uid();
    IF v_store_id IS NOT NULL THEN RETURN v_store_id; END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN NULL;
END;
$$;

-- ==============================================================================
-- 3. PDPA-COMPLIANT GUEST ORDER STATUS TRACKER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'payment_status', o.payment_status,
    'total_amount', o.total_amount,
    'type', o.type,
    'created_at', o.created_at,
    'updated_at', o.updated_at
  ) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  RETURN v_result;
END;
$$;

-- ==============================================================================
-- 4. HARDENED PLACE_ORDER RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.place_order(jsonb, jsonb, jsonb) CASCADE;

CREATE OR REPLACE FUNCTION public.place_order(
  p_order jsonb,
  p_items jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_order_id uuid;
  v_item record;
  v_real_price numeric;
  v_qty int;
  v_food_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total_amount numeric := 0;
  v_order_type_text text;
  v_order_type_enum order_type;
  v_fulfillment_type fulfillment_type_enum;
  v_table_id uuid := NULL;
  v_created_order jsonb;
  v_payment_method payment_method_enum := 'qr'::payment_method_enum;
  
  v_store_lat numeric;
  v_store_lng numeric;
  v_rate numeric;
  v_cust_lat numeric;
  v_cust_lng numeric;
  v_dist_km numeric;
  v_min_order numeric := 15.00;
BEGIN
  -- A. Resolve & validate active store
  IF (p_order->>'store_id') IS NOT NULL AND (p_order->>'store_id') != '' THEN
    v_store_id := (p_order->>'store_id')::uuid;
  ELSIF auth.uid() IS NOT NULL THEN
    v_store_id := get_auth_store_id();
  ELSE
    RAISE EXCEPTION 'store_id is required for placing orders.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = v_store_id AND is_active = true) THEN
    RAISE EXCEPTION 'Invalid or inactive store.';
  END IF;

  -- B. Resolve Order Type & Enum
  v_order_type_text := COALESCE(p_order->>'type', 'takeaway');

  BEGIN
    v_order_type_enum := v_order_type_text::order_type;
  EXCEPTION WHEN OTHERS THEN
    v_order_type_enum := 'takeaway'::order_type;
  END;

  IF (p_order->>'table_id') IS NOT NULL AND (p_order->>'table_id') != '' THEN
    v_table_id := (p_order->>'table_id')::uuid;
  END IF;

  IF v_order_type_text = 'dine_in' THEN
    v_fulfillment_type := 'dine_in'::fulfillment_type_enum;
  ELSE
    v_fulfillment_type := 'takeaway'::fulfillment_type_enum;
  END IF;

  -- C. Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item.';
  END IF;

  -- D. Insert initial order (total 0, unpaid)
  INSERT INTO public.orders (
    store_id, table_id, type, status, payment_status, total_amount,
    customer_name, customer_phone, delivery_address, notes, payment_reference
  ) VALUES (
    v_store_id, v_table_id, v_order_type_enum, 'pending', 'unpaid', 0,
    p_order->>'customer_name', p_order->>'customer_phone',
    p_order->>'delivery_address', p_order->>'notes', p_order->>'payment_reference'
  )
  RETURNING id INTO v_order_id;

  -- E. Recalculate prices from DB ONLY
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT price INTO v_real_price
    FROM public.menu_items
    WHERE id = (v_item.value->>'menu_item_id')::uuid
      AND store_id = v_store_id;

    IF v_real_price IS NULL THEN
      RAISE EXCEPTION 'Menu item % does not exist for this store.', (v_item.value->>'menu_item_id');
    END IF;

    v_qty := GREATEST(COALESCE((v_item.value->>'quantity')::int, 1), 1);
    v_food_subtotal := v_food_subtotal + (v_real_price * v_qty);

    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      quantity,
      price_at_order,
      notes,
      fulfillment_type
    ) VALUES (
      v_order_id,
      (v_item.value->>'menu_item_id')::uuid,
      v_qty,
      v_real_price,
      v_item.value->>'notes',
      v_fulfillment_type
    );
  END LOOP;

  -- F. Delivery validations & Haversine calculation
  IF v_order_type_text = 'delivery' THEN
    IF v_food_subtotal < v_min_order THEN
      RAISE EXCEPTION 'Minimum delivery order is RM%.', to_char(v_min_order, 'FM999990.00');
    END IF;

    SELECT latitude, longitude, COALESCE(delivery_rate, 1.00)
    INTO v_store_lat, v_store_lng, v_rate
    FROM public.stores WHERE id = v_store_id;

    IF v_store_lat IS NULL OR v_store_lng IS NULL THEN
      RAISE EXCEPTION 'Store delivery location not configured.';
    END IF;

    v_cust_lat := (p_order->>'customer_lat')::numeric;
    v_cust_lng := (p_order->>'customer_lng')::numeric;

    IF v_cust_lat IS NOT NULL AND v_cust_lng IS NOT NULL THEN
      v_dist_km := 6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(v_store_lat)) * cos(radians(v_cust_lat)) *
          cos(radians(v_cust_lng) - radians(v_store_lng)) +
          sin(radians(v_store_lat)) * sin(radians(v_cust_lat))
        ))
      );

      IF v_dist_km > 15.0 THEN
        RAISE EXCEPTION 'Delivery address is outside our 15km radius (% km).', ROUND(v_dist_km, 1);
      END IF;

      v_delivery_fee := GREATEST(ROUND(v_dist_km * v_rate, 2), 2.00);
    ELSE
      v_delivery_fee := 2.00;
    END IF;
  END IF;

  -- G. Server-calculated total
  v_total_amount := v_food_subtotal + v_delivery_fee;

  UPDATE public.orders
  SET total_amount = v_total_amount,
      delivery_fee = v_delivery_fee
  WHERE id = v_order_id;

  -- H. Payment intent
  IF p_payments IS NOT NULL AND jsonb_array_length(p_payments) > 0 THEN
    SELECT COALESCE((elem->>'payment_method')::payment_method_enum, 'qr'::payment_method_enum)
    INTO v_payment_method
    FROM jsonb_array_elements(p_payments) AS elem
    LIMIT 1;

    INSERT INTO public.payments (order_id, amount, payment_method, status)
    VALUES (v_order_id, v_total_amount, v_payment_method, 'pending');
  END IF;

  -- I. Return created order
  SELECT to_jsonb(o.*) INTO v_created_order
  FROM public.orders o WHERE o.id = v_order_id;

  RETURN v_created_order;
END;
$$;

-- ==============================================================================
-- 5. STAFF CONFIRM PAYMENT RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.confirm_payment(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.confirm_payment(
  p_order_id uuid,
  p_payment_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_store_id uuid;
  v_order_store_id uuid;
  v_current_payment_status text;
  v_updated_order jsonb;
  v_method_enum payment_method_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to confirm payments.';
  END IF;

  v_staff_store_id := get_auth_store_id();

  IF v_staff_store_id IS NULL THEN
    RAISE EXCEPTION 'Staff user has no store assigned.';
  END IF;

  SELECT store_id, payment_status INTO v_order_store_id, v_current_payment_status
  FROM public.orders
  WHERE id = p_order_id;

  IF v_order_store_id IS NULL THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_staff_store_id != v_order_store_id THEN
    RAISE EXCEPTION 'Unauthorized: You cannot confirm payments for another store.';
  END IF;

  IF v_current_payment_status = 'paid' THEN
    RAISE EXCEPTION 'Order is already paid.';
  END IF;

  UPDATE public.orders
  SET 
    payment_status = 'paid',
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_order_id;

  IF p_payment_method IS NOT NULL THEN
    BEGIN
      v_method_enum := p_payment_method::payment_method_enum;
    EXCEPTION WHEN OTHERS THEN
      v_method_enum := 'qr'::payment_method_enum;
    END;
  ELSE
    v_method_enum := 'qr'::payment_method_enum;
  END IF;

  UPDATE public.payments
  SET 
    status = 'completed',
    payment_method = COALESCE(v_method_enum, payment_method)
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    INSERT INTO public.payments (order_id, amount, payment_method, status)
    SELECT id, total_amount, v_method_enum, 'completed'
    FROM public.orders
    WHERE id = p_order_id;
  END IF;

  SELECT to_jsonb(o.*) INTO v_updated_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  RETURN v_updated_order;
END;
$$;

-- ==============================================================================
-- 6. SERVICE_ROLE TOYYIBPAY WEBHOOK RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.confirm_payment_webhook(uuid, text) CASCADE;

CREATE OR REPLACE FUNCTION public.confirm_payment_webhook(
  p_order_id uuid,
  p_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET payment_status = 'paid',
      status = 'confirmed',
      payment_reference = p_reference,
      updated_at = now()
  WHERE id = p_order_id
    AND payment_status != 'paid';

  UPDATE public.payments
  SET status = 'completed'
  WHERE order_id = p_order_id;
END;
$$;

-- ==============================================================================
-- 7. GRANTS & PERMISSIONS
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_status(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.confirm_payment_webhook(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment_webhook(uuid, text) TO service_role;
```

---

## 🌐 4. aaPanel / VPS Deployment Guide

### A. Point Domain in Hostinger:
* Add `A` record for `@` ➔ `YOUR_VPS_PUBLIC_IP`
* Add `A` record for `www` ➔ `YOUR_VPS_PUBLIC_IP`

### B. aaPanel Nginx Reverse Proxy Config:
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

### C. Sync Code & Restart on aaPanel Terminal:
```bash
cd /www/wwwroot/warungjnj.com
git pull origin main
npm run build
pm2 restart all
```

---

## 💳 5. ToyyibPay FPX Gateway Settings

* **Return URL:** `https://warungjnj.online/delivery`
* **Callback URL (Webhook):** `https://warungjnj.online/api/payment/callback`
* **Admin Settings URL:** `https://warungjnj.online/settings`

---

*Document generated automatically for Warung J&J (joefubu84).*
