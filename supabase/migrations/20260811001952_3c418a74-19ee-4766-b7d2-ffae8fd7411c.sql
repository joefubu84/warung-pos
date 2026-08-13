-- 1. Ensure RLS is enabled on all tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('stores', 'users', 'members', 'riders', 'menu_items', 'tables', 'orders', 'order_items', 'cash_sessions', 'expenses', 'deliveries') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 2. Drop existing policies to ensure a clean slate
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('stores', 'users', 'members', 'riders', 'menu_items', 'tables', 'orders', 'order_items', 'cash_sessions', 'expenses', 'deliveries') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Create or Update helper functions (Security Definer to bypass RLS for lookups)
CREATE OR REPLACE FUNCTION public.get_auth_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT store_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_rider_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.riders WHERE user_id = auth.uid();
$$;

-- 4. Policies for 'stores'
CREATE POLICY "stores_select_own" ON public.stores
    FOR SELECT TO authenticated
    USING (id = public.get_auth_store_id());

-- 5. Universal store_id policy for other tables (Authenticated users scoped to their store)

-- USERS: Self management + staff see store users
CREATE POLICY "users_self_manage" ON public.users
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_staff_view_store" ON public.users
    FOR SELECT TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- MEMBERS: Self view + staff manage
CREATE POLICY "members_self_view" ON public.members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "members_staff_manage" ON public.members
    FOR ALL TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- RIDERS: Staff manage
CREATE POLICY "riders_staff_manage" ON public.riders
    FOR ALL TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- MENU ITEMS: Public select + Staff manage
CREATE POLICY "menu_items_public_select" ON public.menu_items
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "menu_items_staff_manage_insert" ON public.menu_items
    FOR INSERT TO authenticated
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

CREATE POLICY "menu_items_staff_manage_update" ON public.menu_items
    FOR UPDATE TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

CREATE POLICY "menu_items_staff_manage_delete" ON public.menu_items
    FOR DELETE TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- TABLES: Public select + Staff manage
CREATE POLICY "tables_public_select" ON public.tables
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "tables_staff_manage" ON public.tables
    FOR ALL TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- ORDERS: Staff manage + Member self view
CREATE POLICY "orders_staff_manage" ON public.orders
    FOR ALL TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

CREATE POLICY "orders_member_view" ON public.orders
    FOR SELECT TO authenticated
    USING (member_id = public.get_auth_member_id());

-- ORDER ITEMS: Staff manage + Member view via order
CREATE POLICY "order_items_staff_manage" ON public.order_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE id = order_items.order_id 
        AND store_id = public.get_auth_store_id() 
        AND public.get_auth_role() IN ('staff', 'admin')
    ));

CREATE POLICY "order_items_member_view" ON public.order_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE id = order_items.order_id 
        AND member_id = public.get_auth_member_id()
    ));

-- CASH SESSIONS: Staff manage
CREATE POLICY "cash_sessions_staff_manage" ON public.cash_sessions
    FOR ALL TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- EXPENSES: Staff manage
CREATE POLICY "expenses_staff_manage" ON public.expenses
    FOR ALL TO authenticated
    USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'))
    WITH CHECK (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- DELIVERIES: Staff manage + Rider self view/update
CREATE POLICY "deliveries_staff_manage" ON public.deliveries
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE id = deliveries.order_id 
        AND store_id = public.get_auth_store_id() 
        AND public.get_auth_role() IN ('staff', 'admin')
    ));

CREATE POLICY "deliveries_rider_access" ON public.deliveries
    FOR SELECT TO authenticated
    USING (rider_id = public.get_auth_rider_id());

CREATE POLICY "deliveries_rider_update" ON public.deliveries
    FOR UPDATE TO authenticated
    USING (rider_id = public.get_auth_rider_id())
    WITH CHECK (rider_id = public.get_auth_rider_id());

-- 6. Ensure GRANTs are correct for all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.menu_items, public.tables TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
