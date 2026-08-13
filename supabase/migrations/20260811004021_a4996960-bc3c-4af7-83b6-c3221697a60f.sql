-- Step 1: Create dummy stores
INSERT INTO public.stores (id, name, address)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Warung J&J - Store A', 'Jalan A'),
  ('22222222-2222-2222-2222-222222222222', 'Warung J&J - Store B', 'Jalan B')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address;

-- Step 2: Insert dummy orders for each store
INSERT INTO public.orders (id, store_id, type, status, total_amount)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'dine_in', 'pending', 20.00),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'dine_in', 'pending', 15.00)
ON CONFLICT (id) DO UPDATE SET total_amount = EXCLUDED.total_amount, status = EXCLUDED.status;

-- Grant permissions to authenticated role just in case
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.stores TO authenticated;
GRANT SELECT ON public.users TO authenticated;
