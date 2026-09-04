ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_payment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_verification';

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lat numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_lng numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending';