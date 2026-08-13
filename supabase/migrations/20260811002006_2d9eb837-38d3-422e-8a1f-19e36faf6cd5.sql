-- Revoke EXECUTE from public/anon to secure functions
REVOKE EXECUTE ON FUNCTION public.get_auth_store_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_member_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_auth_rider_id() FROM PUBLIC, anon;

-- Explicitly GRANT to authenticated role
GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_rider_id() TO authenticated;

-- Ensure service_role can also execute
GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_member_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_rider_id() TO service_role;
