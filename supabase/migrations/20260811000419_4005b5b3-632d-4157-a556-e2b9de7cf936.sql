-- The 'deliveries' table was missing store_id, adding it now
ALTER TABLE public.deliveries ADD COLUMN store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- Add foreign key constraints for store_id in other tables (only those that didn't have it or need verification)
ALTER TABLE public.users ADD CONSTRAINT fk_users_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.members ADD CONSTRAINT fk_members_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.riders ADD CONSTRAINT fk_riders_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD CONSTRAINT fk_menu_items_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.tables ADD CONSTRAINT fk_tables_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;

-- Update columns to use proper PostgreSQL enum types
ALTER TABLE public.members ALTER COLUMN kyc_status TYPE public.kyc_status USING kyc_status::text::public.kyc_status;
ALTER TABLE public.riders ALTER COLUMN status TYPE public.rider_status USING status::text::public.rider_status;
ALTER TABLE public.orders ALTER COLUMN type TYPE public.order_type USING type::text::public.order_type;
ALTER TABLE public.orders ALTER COLUMN status TYPE public.order_status USING status::text::public.order_status;

-- Add index on new deliveries.store_id
CREATE INDEX IF NOT EXISTS idx_deliveries_store_id ON public.deliveries(store_id);