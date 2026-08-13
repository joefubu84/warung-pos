-- Revoke execute from PUBLIC on security definer functions
REVOKE EXECUTE ON FUNCTION public.get_auth_store_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_member_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_rider_id() FROM PUBLIC;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_member_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_rider_id() TO authenticated, service_role;