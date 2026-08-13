-- Enable RLS (idempotent)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- Drop existing functions to ensure fresh creation
DROP FUNCTION IF EXISTS public.get_auth_store_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_role() CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_member_id() CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_rider_id() CASCADE;

-- 2. Helper functions
CREATE FUNCTION public.get_auth_store_id()
RETURNS UUID AS $$
    SELECT store_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE FUNCTION public.get_auth_role()
RETURNS public.app_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE FUNCTION public.get_auth_member_id()
RETURNS UUID AS $$
    SELECT m.id FROM public.members m WHERE m.user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE FUNCTION public.get_auth_rider_id()
RETURNS UUID AS $$
    SELECT r.id FROM public.riders r WHERE r.user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Drop existing policies to avoid conflicts
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. Stores Policies
CREATE POLICY "stores_select_policy" ON public.stores FOR SELECT TO authenticated USING (id = public.get_auth_store_id());

-- 4. Users Policies
CREATE POLICY "users_self_policy" ON public.users FOR ALL TO authenticated USING (id = auth.uid());
CREATE POLICY "users_staff_select_policy" ON public.users FOR SELECT TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 5. Members Policies
CREATE POLICY "members_self_policy" ON public.members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members_staff_manage_policy" ON public.members FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 6. Riders Policies
CREATE POLICY "riders_self_policy" ON public.riders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "riders_staff_manage_policy" ON public.riders FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 7. Menu Items Policies
CREATE POLICY "menu_items_public_select" ON public.menu_items FOR SELECT TO anon, authenticated USING (is_available = true);
CREATE POLICY "menu_items_staff_manage" ON public.menu_items FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 8. Tables Policies
CREATE POLICY "tables_public_select" ON public.tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tables_staff_manage" ON public.tables FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 9. Orders Policies
CREATE POLICY "orders_member_select" ON public.orders FOR SELECT TO authenticated USING (member_id = public.get_auth_member_id());
CREATE POLICY "orders_staff_manage" ON public.orders FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 10. Order Items Policies
CREATE POLICY "order_items_member_select" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND member_id = public.get_auth_member_id()));
CREATE POLICY "order_items_staff_manage" ON public.order_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin')));

-- 11. Cash Sessions Policies
CREATE POLICY "cash_sessions_staff_manage" ON public.cash_sessions FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 12. Expenses Policies
CREATE POLICY "expenses_staff_manage" ON public.expenses FOR ALL TO authenticated USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- 13. Deliveries Policies
-- Split the failing multi-event policy into separate ones
CREATE POLICY "deliveries_rider_select" ON public.deliveries FOR SELECT TO authenticated USING (rider_id = public.get_auth_rider_id());
CREATE POLICY "deliveries_rider_update" ON public.deliveries FOR UPDATE TO authenticated USING (rider_id = public.get_auth_rider_id());
CREATE POLICY "deliveries_staff_manage" ON public.deliveries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin')));

-- 14. Grants
GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_rider_id() TO authenticated;
