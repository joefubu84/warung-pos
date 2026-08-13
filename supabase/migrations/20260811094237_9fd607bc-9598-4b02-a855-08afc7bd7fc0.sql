ALTER TABLE public.orders ADD COLUMN customer_name text;
COMMENT ON COLUMN public.orders.customer_name IS 'Name of the customer for takeaway orders.';