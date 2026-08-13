-- Drop existing policy if it exists
DROP POLICY IF EXISTS orders_public_insert ON public.orders;

-- Create the refined policy for public/anon ordering
CREATE POLICY orders_public_insert ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    type = 'dine_in'
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.tables 
      WHERE tables.id = table_id 
      AND tables.store_id = orders.store_id
    )
  );

-- Ensure order_items also has a matching public insert policy
DROP POLICY IF EXISTS order_items_public_insert ON public.order_items;
CREATE POLICY order_items_public_insert ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_id
      AND orders.status = 'pending'
    )
  );
