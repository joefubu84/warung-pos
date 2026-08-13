CREATE POLICY stores_admin_update
ON public.stores
FOR UPDATE
TO authenticated
USING (id = get_auth_store_id() AND get_auth_role() = 'admin'::app_role)
WITH CHECK (id = get_auth_store_id() AND get_auth_role() = 'admin'::app_role);

GRANT SELECT, UPDATE ON public.stores TO authenticated;