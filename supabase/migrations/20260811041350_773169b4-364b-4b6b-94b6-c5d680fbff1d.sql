-- Fix Staff A
INSERT INTO public.users (id, store_id, role, name)
SELECT '0f81ea5a-e622-4343-a188-62f90dc1ef14', id, 'staff'::app_role, 'Staff A'
FROM public.stores WHERE name = 'Store A'
ON CONFLICT (id) DO UPDATE SET store_id = EXCLUDED.store_id, role = EXCLUDED.role, name = EXCLUDED.name;

-- Fix Staff B
INSERT INTO public.users (id, store_id, role, name)
SELECT 'c9e59f5a-6ef1-41a3-96f5-55dc1c11f6e1', id, 'staff'::app_role, 'Staff B'
FROM public.stores WHERE name = 'Store B'
ON CONFLICT (id) DO UPDATE SET store_id = EXCLUDED.store_id, role = EXCLUDED.role, name = EXCLUDED.name;
