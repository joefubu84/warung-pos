INSERT INTO public.users (id, store_id, role, name)
VALUES 
  ('0f81ea5a-e622-4343-a188-62f90dc1ef14', '11111111-1111-1111-1111-111111111111', 'staff', 'Staff Store A'),
  ('c9e59f5a-6ef1-41a3-96f5-55dc1c11f6e1', '22222222-2222-2222-2222-222222222222', 'staff', 'Staff Store B')
ON CONFLICT (id) DO UPDATE 
SET store_id = EXCLUDED.store_id, role = EXCLUDED.role, name = EXCLUDED.name;