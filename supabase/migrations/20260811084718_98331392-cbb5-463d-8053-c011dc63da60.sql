DROP POLICY IF EXISTS order_items_public_insert ON order_items;

CREATE POLICY order_items_public_insert ON order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.status = 'pending'
      AND orders.created_at > now() - interval '5 minutes'
    )
  );