-- 1. Insert Stores
INSERT INTO public.stores (name, address)
VALUES ('Store A', 'Address A'), ('Store B', 'Address B')
ON CONFLICT (id) DO NOTHING;

-- 2. Link Staff A to Store A
DO $$
DECLARE
    store_a_id uuid;
    store_b_id uuid;
BEGIN
    SELECT id INTO store_a_id FROM public.stores WHERE name = 'Store A' LIMIT 1;
    SELECT id INTO store_b_id FROM public.stores WHERE name = 'Store B' LIMIT 1;

    IF store_a_id IS NOT NULL AND store_b_id IS NOT NULL THEN
        -- Using 'name' column as discovered
        INSERT INTO public.users (id, store_id, role, name)
        VALUES 
            ('0f81ea5a-e622-4343-a188-62f90dc1ef14', store_a_id, 'staff', 'Staff A'),
            ('c9e59f5a-6ef1-41a3-96f5-55dc1c11f6e1', store_b_id, 'staff', 'Staff B')
        ON CONFLICT (id) DO UPDATE SET store_id = EXCLUDED.store_id, role = EXCLUDED.role;

        -- 3. Insert a table for Store A
        INSERT INTO public.tables (table_number, qr_token, store_id, status)
        VALUES ('A1', 'token-a1', store_a_id, 'available')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;