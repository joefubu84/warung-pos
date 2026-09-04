-- ==============================================================================
-- WARUNG J&J POS - COMPLETE STANDALONE SUPABASE DATABASE SETUP SCRIPT
-- Project ID: gtmzzblomcvgmwzjalja
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'cashier', 'chef', 'staff', 'rider', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.order_type AS ENUM ('dine_in', 'takeaway', 'delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM ('pending', 'preparing', 'ready', 'completed', 'cancelled', 'pending_payment', 'pending_verification');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.fulfillment_type_enum AS ENUM ('dine_in', 'takeaway');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. CORE TABLES
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    name TEXT NOT NULL,
    email TEXT,
    role public.app_role NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    user_id UUID REFERENCES public.users(id),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    user_id UUID REFERENCES public.users(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'offline' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id),
    table_number TEXT NOT NULL,
    qr_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'available',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    image_url TEXT,
    stock_count INTEGER,
    low_stock_threshold INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id),
    type public.order_type NOT NULL DEFAULT 'dine_in',
    status public.order_status NOT NULL DEFAULT 'pending',
    table_id UUID REFERENCES public.tables(id),
    member_id UUID REFERENCES public.members(id),
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    delivery_service TEXT DEFAULT 'jnj',
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    delivery_fee NUMERIC(12, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    discount_type TEXT,
    paid BOOLEAN DEFAULT false,
    payment_status TEXT DEFAULT 'unpaid',
    payment_method TEXT DEFAULT 'cash',
    notes TEXT,
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_order NUMERIC(12, 2) NOT NULL,
    fulfillment_type public.fulfillment_type_enum DEFAULT 'dine_in',
    container_size TEXT,
    container_charge NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id),
    staff_id UUID REFERENCES public.users(id),
    opening_balance NUMERIC(12, 2) NOT NULL,
    closing_balance NUMERIC(12, 2),
    opened_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id),
    receipt_url TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT DEFAULT 'General',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.riders(id),
    tracking_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    store_id UUID,
    table_id UUID,
    device_id TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.printer_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID UNIQUE NOT NULL REFERENCES public.stores(id),
    sound_choice TEXT DEFAULT 'kitchen_bell',
    sound_file_url TEXT,
    badge_colors JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. INSERT DEFAULT STORE & SEED DATA
INSERT INTO public.stores (id, name, address, phone)
VALUES ('1094d737-8104-4a55-b678-0fe9097beba0', 'Warung J&J', 'Penampang, Sabah', '0198887766')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address;

INSERT INTO public.users (id, store_id, name, email, role)
VALUES ('0f81ea5a-e622-4343-a188-62f90dc1ef14', '1094d737-8104-4a55-b678-0fe9097beba0', 'Staff A (Admin)', 'teststaffa@test.com', 'admin')
ON CONFLICT (id) DO NOTHING;

-- INSERT TABLES
INSERT INTO public.tables (id, store_id, table_number, qr_token, status)
VALUES ('abfb46de-019b-4a5d-9d63-17c207d485e9', '1094d737-8104-4a55-b678-0fe9097beba0', 'A1', 'token-a1', 'available')
ON CONFLICT (id) DO UPDATE SET table_number = EXCLUDED.table_number, qr_token = EXCLUDED.qr_token;
INSERT INTO public.tables (id, store_id, table_number, qr_token, status)
VALUES ('f11f5999-68b7-4a9a-83ef-db6eed3f3cf2', '1094d737-8104-4a55-b678-0fe9097beba0', 'A2', 'c228e3c1-a0a9-4b87-a93f-6d8089e993a1', 'available')
ON CONFLICT (id) DO UPDATE SET table_number = EXCLUDED.table_number, qr_token = EXCLUDED.qr_token;
INSERT INTO public.tables (id, store_id, table_number, qr_token, status)
VALUES ('b8254a38-cd57-45c4-85f4-b62c6240e4be', '1094d737-8104-4a55-b678-0fe9097beba0', 'A3', '17eb652c-dd39-4874-a38e-e1dd0a07477c', 'available')
ON CONFLICT (id) DO UPDATE SET table_number = EXCLUDED.table_number, qr_token = EXCLUDED.qr_token;
INSERT INTO public.tables (id, store_id, table_number, qr_token, status)
VALUES ('c76a2ad8-a28a-4578-a782-e47a438fcb79', '1094d737-8104-4a55-b678-0fe9097beba0', 'A4', '6f9859b4-5c08-41f8-8584-e1b59af6b4a5', 'available')
ON CONFLICT (id) DO UPDATE SET table_number = EXCLUDED.table_number, qr_token = EXCLUDED.qr_token;

-- INSERT MENU ITEMS
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('86c3e2fc-86a0-4a18-85cb-2d26c5f864ba', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Ikan Talapia', 'Fish', 15, true, 'https://arleta.site/interactivelink/1709/01-nasi-ikan-talapia.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('67685108-c70a-4ea2-97bc-f46d51347b57', '1094d737-8104-4a55-b678-0fe9097beba0', 'Chicken Popcorn', 'Chicken', 10, true, 'https://arleta.site/interactivelink/1709/02-chicken-popcorn.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('99cffa93-f4f9-47d9-b576-7921ac365b69', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Ayam Paha', 'Chicken', 8, true, 'https://arleta.site/interactivelink/1709/03-nasi-ayam-paha.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('e209c572-6d9e-4077-857f-8d43eb805df7', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Ayam Butter', 'Chicken', 12, true, 'https://arleta.site/interactivelink/1709/04-nasi-ayam-butter.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('5fb5dc1e-c812-4a8d-9572-31964a5f4d25', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Set Udang', 'Food', 15, true, 'https://arleta.site/interactivelink/1709/05-nasi-set-udang.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('3f168be6-19b6-4987-86bd-d3737e59a8ad', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Ikan Boulu', 'Fish', 15, true, 'https://i.postimg.cc/mkMDhhMn/IMG-20260525-WA0007.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('2c185a35-2053-43de-8b5d-b1f4d3fa4cd0', '1094d737-8104-4a55-b678-0fe9097beba0', 'Chicken Katsu', 'Chicken', 12, true, 'https://arleta.site/interactivelink/1709/07-chicken-katsu.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('63b6963b-f810-4915-8c4c-f2aeecaf3f7c', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Chicken Chop', 'Chicken', 12, true, 'https://arleta.site/interactivelink/1709/08-nasi-chicken-chop.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('8b540371-9c52-431d-8b89-a490d7da592e', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Honey Chicken', 'Chicken', 10, true, 'https://arleta.site/interactivelink/1709/09-nasi-honey-chicken.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('e070dde8-5d10-4fdd-aa8c-161a778e9bd7', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Ayam Geprek', 'Chicken', 15, true, 'https://arleta.site/interactivelink/1709/10-set-ayam-geprek.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('402f8806-44e7-4f97-aeaa-009510afa50f', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Ayam Penyet', 'Chicken', 14, true, 'https://arleta.site/interactivelink/1709/11-nasi-ayam-penyet.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('2b753e7a-cfa8-4a9f-827d-6c5d224039c4', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Orange Chicken', 'Chicken', 10, true, 'https://arleta.site/interactivelink/1709/12-nasi-orange-chicken.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('73401ef8-7d69-4418-aba6-1983c37228be', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Udang Butter', 'Food', 15, true, 'https://arleta.site/interactivelink/1709/13-nasi-udang-butter.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('c3e9aedc-052a-4b27-bf47-fc10604b07c9', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Nasi SIAKAP', 'Fish', 20, true, 'https://i.postimg.cc/ZRFwrmM4/IMG-20260525-WA0006.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('98ce946c-1ce4-43c8-b7a6-250cb5a5a8fa', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Nasi Dorry Fillet', 'Fish', 12, true, 'https://i.postimg.cc/k4npYD8M/IMG-20260525-WA0004.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('8d9c33d1-6f9a-4b2f-8887-ac6f2f4f1710', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set LENGKUNIS', 'Fish', 15, true, 'https://i.postimg.cc/SssGz9CN/IMG-20260525-WA0009.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('9ef9c6cb-be6a-423f-a94b-080406e982e5', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Lelapan Ayam', 'Chicken', 12, true, 'https://i.postimg.cc/cJJDfPN6/IMG-20260525-WA0008.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('045a606a-e5e2-4430-bf94-581dbff84211', '1094d737-8104-4a55-b678-0fe9097beba0', 'Whole Spring Fried Chicken', 'Today Special', 25, true, 'https://i.postimg.cc/XNsFYBTV/IMG-20260525-204900-579.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('1dfcbeac-fdd4-4563-af96-37c53ec5d3bb', '1094d737-8104-4a55-b678-0fe9097beba0', 'set siakap+sayur rebus', 'Fish', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('60f0170d-e322-45ba-b7c1-6299e9b4f74a', '1094d737-8104-4a55-b678-0fe9097beba0', 'Sweet N Sour Isi Ikan Titir', 'Fish', 12, true, 'https://i.postimg.cc/5NPxvh9w/IMG-20260530-161301-461.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('42f7d54a-ad9a-43df-b65c-4f4a9db1ccbc', '1094d737-8104-4a55-b678-0fe9097beba0', 'Sweet N Sour Ayam', 'Chicken', 12, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('9b009803-0c4f-423b-b9a0-abf37dc2bc4e', '1094d737-8104-4a55-b678-0fe9097beba0', 'BLACK PEPPER AYAM', 'Chicken', 12, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('1bede08d-7f72-48e9-8d5b-1e3649d745c7', '1094d737-8104-4a55-b678-0fe9097beba0', 'BASUNGAN IKAN TAUSI(ori)', 'Fish', 15, true, 'https://i.postimg.cc/SNMgDVQq/IMG-20260610-090407-116.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('63fdfca3-b7d7-4e78-8774-22a65c43bc61', '1094d737-8104-4a55-b678-0fe9097beba0', 'Lada Kasturi', 'New', 10, true, 'https://i.postimg.cc/Lsysh6Bc/IMG-20260611-100245-948.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('d3c2ac18-27a8-482d-bff8-e07d4cc4272e', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Ikan tuna', 'Fish', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('f094930d-f512-464f-bc52-6c5200c06fe1', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Isi Ikan Titir', 'Fish', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('9791c701-54e0-4e84-b22c-7ff61d2399ee', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Talapia Merah', 'Fish', 17, true, 'https://i.postimg.cc/Z5pV3LHZ/IMG-20260612-152003-973.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('f1b0fa5a-5dfc-4096-a0ce-fcfbaed63dd7', '1094d737-8104-4a55-b678-0fe9097beba0', 'basung kerbau', 'Fish', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('c6e09faf-d146-4066-8757-3d8208949d51', '1094d737-8104-4a55-b678-0fe9097beba0', 'SET SIAKAP 1KG', 'Today Special', 35, true, 'https://i.postimg.cc/bN8PPdk6/IMG-20260614-112452-326.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('34a67e24-ef61-4158-a944-bdc8d3c11009', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Sotong + Chic pop', 'New', 15, true, 'https://i.postimg.cc/d0fPqFgc/IMG-20260616-103734-236.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('0d925ac6-7426-4520-8a13-8d56869e9d6b', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Sotong Ring', 'New', 13, true, 'https://i.postimg.cc/nrCBVQDP/IMG-20260626-093410-790.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('b75bbdb1-8ec4-48bf-b406-741641fcb175', '1094d737-8104-4a55-b678-0fe9097beba0', 'Talapia kecil', 'Fish', 12, true, 'https://arleta.site/interactivelink/1709/01-nasi-ikan-talapia.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('78a99482-3e17-40ae-a786-feef81d892e2', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Sotong Ring Buttermilk', 'New', 14, true, 'https://i.postimg.cc/JnsKRJPK/IMG-20260623-093530-828.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('ed1b34cb-371c-4942-8855-5c66a18783b1', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Sayur Cap Chai + Telur Mata  Isi ayam', 'Today Special', 10, true, 'https://i.postimg.cc/VNK1xyVt/IMG-20260623-093530-696.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('15b121e1-42d7-4688-9b36-96a1f41bebb7', '1094d737-8104-4a55-b678-0fe9097beba0', 'Sambal Kelate', 'New', 10, true, 'https://i.postimg.cc/1z2VyLfV/IMG-20260625-104336-978.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('eaec427d-e607-41cf-b375-5b6801f62f52', '1094d737-8104-4a55-b678-0fe9097beba0', 'Set Ikan Goreng Titir Dabu²', 'Today Special', 15, true, 'https://i.postimg.cc/j58mPw1n/IMG-20260603-221608-840.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('537ee1ca-043f-46a8-a49c-a06836c2076d', '1094d737-8104-4a55-b678-0fe9097beba0', 'set nasi Talapia fillet', 'Fish', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('8a6bf64a-0992-4bde-93aa-417fbcb5ff75', '1094d737-8104-4a55-b678-0fe9097beba0', 'TELUR DADAR ISI AYAM', 'New', 10, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('25654a13-2a7b-4616-ab5f-60e839db7a83', '1094d737-8104-4a55-b678-0fe9097beba0', 'lada tuhau kecil', 'New', 10, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('2a1e896b-3f0d-45a6-895c-3fa1d7a1ead4', '1094d737-8104-4a55-b678-0fe9097beba0', 'Lada tuhau besar', 'New', 12, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('209bf7d4-5a2b-49ab-a340-181c23684fb1', '1094d737-8104-4a55-b678-0fe9097beba0', 'Lemon Chicken', 'Food', 12, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('90f1f957-5e59-4de3-917c-32c65cc2098f', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Ikan Bulu', 'Fish', 15, true, 'https://arleta.site/interactivelink/1709/06-nasi-ikan-bulu.webp', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('5c8693b8-9e5b-4c6f-a0c6-bffc3f258e71', '1094d737-8104-4a55-b678-0fe9097beba0', 'NASI KAK WOK', 'New', 12, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('faac6f2c-732e-4548-ba59-260ff71f1d49', '1094d737-8104-4a55-b678-0fe9097beba0', 'Ayam Gepuk', 'Chicken', 14, true, 'https://i.postimg.cc/4NDNwXDR/IMG-20260525-211356-393.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('61cfd985-4861-4bcf-a683-5b75c8153312', '1094d737-8104-4a55-b678-0fe9097beba0', 'PACKAGING', 'Food', 1, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('ddcf6a5e-109d-47b3-9c53-e2d5b48c225d', '1094d737-8104-4a55-b678-0fe9097beba0', 'PACKAGING KECIL', 'Food', 0.5, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('618f4fd6-2636-4806-9650-5ad699017eee', '1094d737-8104-4a55-b678-0fe9097beba0', 'SET SALMON SARDIN', 'Food', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('1012cc55-dc7e-4341-bfcf-7e0297a7cafe', '1094d737-8104-4a55-b678-0fe9097beba0', 'SET MIX UDANG & SOTONG (BUTTERMILK)', 'Food', 15, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('f3d37047-ee2c-4db6-a8e7-12cac6e89ab9', '1094d737-8104-4a55-b678-0fe9097beba0', 'black paper ikan tator', 'Fish', 12, true, 'https://i.postimg.cc/nzQswHrx/IMG-20260530-161301-004.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('70f35d00-d035-45da-93a7-a92da6c878ac', '1094d737-8104-4a55-b678-0fe9097beba0', 'Ayam Sahaja', 'Add-ons / Sampingan', 6, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('51a03e4a-7664-4879-b5f8-51b849acff61', '1094d737-8104-4a55-b678-0fe9097beba0', 'Geprek Sahaja', 'Add-ons / Sampingan', 13, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('d3a7f2b6-199c-4bfe-a1f4-1321cdb2896e', '1094d737-8104-4a55-b678-0fe9097beba0', 'Telur Mata', 'Add-ons / Sampingan', 2, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('adddefb5-082e-4bb2-a54f-456beaa9223d', '1094d737-8104-4a55-b678-0fe9097beba0', 'Popcorn', 'Add-ons / Sampingan', 5, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('e69ccca5-06cd-4087-ac37-6a0c792281a8', '1094d737-8104-4a55-b678-0fe9097beba0', 'Timun Sahaja', 'Add-ons / Sampingan', 5, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('946713a5-6c3d-49b9-b8d4-9fcb076d06e7', '1094d737-8104-4a55-b678-0fe9097beba0', 'Paha Sahaja', 'Add-ons / Sampingan', 6, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('94bb306e-0819-4769-b6ea-53a4316225b8', '1094d737-8104-4a55-b678-0fe9097beba0', 'Penyet Sahaja', 'Add-ons / Sampingan', 12, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('cacfdf8e-d3b1-40b9-9972-3260a1fbb7f4', '1094d737-8104-4a55-b678-0fe9097beba0', 'Popcorn Sahaja', 'Add-ons / Sampingan', 8, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('c2a04428-7b71-463b-8718-356ce41733a7', '1094d737-8104-4a55-b678-0fe9097beba0', 'Talapia Sahaja', 'Add-ons / Sampingan', 13, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('19c71334-b403-4fa0-ae26-7d3c1edc0e88', '1094d737-8104-4a55-b678-0fe9097beba0', 'Boulu & nasi Sahaja', 'Add-ons / Sampingan', 10, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('eca30c72-7b51-4bb8-9b9d-43be0dec509e', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nasi Kosong', 'Add-ons / Sampingan', 2, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('59df1543-16bf-4e86-97b4-4a9e040d3cc8', '1094d737-8104-4a55-b678-0fe9097beba0', 'Nenas', 'Add-ons / Sampingan', 3, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('cd82975e-dfb3-497c-9b23-71d3abd40158', '1094d737-8104-4a55-b678-0fe9097beba0', 'Telur Dadar', 'Add-ons / Sampingan', 2, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('f1a82f73-8a99-409c-b6c5-2fa9bdd9f48a', '1094d737-8104-4a55-b678-0fe9097beba0', 'TELUR DADAR KRIWIL', 'Add-ons / Sampingan', 8, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('160fda80-ff0f-40fd-87ec-499195e3cd0a', '1094d737-8104-4a55-b678-0fe9097beba0', 'UDANG TIADA NASI', 'Add-ons / Sampingan', 13, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('5df0da92-5396-413a-9695-b7fa4b32e2a3', '1094d737-8104-4a55-b678-0fe9097beba0', 'ayam penyet double', 'Add-ons / Sampingan', 20, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('6e913a7a-cd97-413f-8f86-cc6973986bf7', '1094d737-8104-4a55-b678-0fe9097beba0', 'Telur Mata (Fried Egg)', 'Add-ons / Sampingan', 1.5, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('146f1e77-a540-4305-9d21-2264cc13d847', '1094d737-8104-4a55-b678-0fe9097beba0', 'Extra Sambal Special', 'Add-ons / Sampingan', 1, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('f4d1c528-6260-412e-8dab-aeb85cc89ef3', '1094d737-8104-4a55-b678-0fe9097beba0', 'Extra Nasi (Extra Rice)', 'Add-ons / Sampingan', 1.5, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('60ba30ea-c26c-4815-a950-89cb74809ee3', '1094d737-8104-4a55-b678-0fe9097beba0', 'Melted Cheese Slice', 'Add-ons / Sampingan', 2, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('f9435475-b307-4890-9053-2037591231bf', '1094d737-8104-4a55-b678-0fe9097beba0', 'Extra Soup Bowl', 'Add-ons / Sampingan', 1, true, NULL, 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;
INSERT INTO public.menu_items (id, store_id, name, category, price, is_available, image_url, low_stock_threshold)
VALUES ('a7392604-21d5-416a-80d5-44f0db37c5b5', '1094d737-8104-4a55-b678-0fe9097beba0', 'Kepingan Keju (Cheese)', 'Add-ons / Sampingan', 2, true, 'https://ilvbuhinmasmdsjcxfbn.supabase.co/storage/v1/object/public/menu-items/addon_ompazjwk6t.jpg', 5)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_available = EXCLUDED.is_available;

-- ==============================================================================
-- 5. RPC FUNCTIONS & AUTH HELPERS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_auth_store_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce((SELECT store_id FROM public.users WHERE id = auth.uid()), '1094d737-8104-4a55-b678-0fe9097beba0'::uuid);
$$;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT coalesce((SELECT role FROM public.users WHERE id = auth.uid()), 'admin'::public.app_role);
$$;

-- ATOMIC PLACE_ORDER RPC
CREATE OR REPLACE FUNCTION public.place_order(
  p_order jsonb,
  p_items jsonb,
  p_payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id      uuid;
  v_store_id      uuid;
  v_item          jsonb;
  v_menu_price    numeric(12,2);
  v_qty           integer;
  v_subtotal      numeric(12,2) := 0;
  v_total         numeric(12,2);
  v_table_id_text text;
  v_order_type    order_type;
BEGIN
  v_table_id_text := p_order->>'table_id';
  v_order_type    := coalesce((p_order->>'type')::order_type, 'dine_in'::order_type);

  IF p_order->>'store_id' IS NOT NULL AND (p_order->>'store_id') != '' THEN
    v_store_id := (p_order->>'store_id')::uuid;
  ELSE
    v_store_id := '1094d737-8104-4a55-b678-0fe9097beba0'::uuid;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := coalesce((v_item->>'quantity')::int, 1);
    SELECT price INTO v_menu_price FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid;
    IF v_menu_price IS NULL THEN v_menu_price := 10.00; END IF;
    v_subtotal := v_subtotal + (v_menu_price * v_qty);
  END LOOP;

  v_total := v_subtotal;

  INSERT INTO public.orders (
    store_id, type, status, table_id, total_amount, customer_phone, delivery_address
  ) VALUES (
    v_store_id, v_order_type, 'pending'::order_status,
    CASE WHEN v_table_id_text IS NOT NULL AND v_table_id_text != '' THEN v_table_id_text::uuid ELSE NULL END,
    v_total, p_order->>'customer_phone', p_order->>'delivery_address'
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price INTO v_menu_price FROM public.menu_items WHERE id = (v_item->>'menu_item_id')::uuid;
    IF v_menu_price IS NULL THEN v_menu_price := 10.00; END IF;

    INSERT INTO public.order_items (
      order_id, menu_item_id, quantity, price_at_order, fulfillment_type, notes
    ) VALUES (
      v_order_id,
      (v_item->>'menu_item_id')::uuid,
      coalesce((v_item->>'quantity')::int, 1),
      v_menu_price,
      CASE WHEN v_item->>'fulfillment_type' = 'dine_in' THEN 'dine_in'::public.fulfillment_type_enum ELSE 'takeaway'::public.fulfillment_type_enum END,
      v_item->>'notes'
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'id', v_order_id,
    'total_amount', v_total
  );
END;
$$;

-- ATOMIC GET_KITCHEN_ORDERS RPC
CREATE OR REPLACE FUNCTION public.get_kitchen_orders(p_store_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'store_id', o.store_id,
      'status', o.status,
      'type', o.type,
      'delivery_service', o.delivery_service,
      'customer_name', o.customer_name,
      'table_id', o.table_id,
      'paid', coalesce(o.paid, false),
      'payment_status', coalesce(o.payment_status, 'unpaid'),
      'payment_method', o.payment_method,
      'customer_phone', o.customer_phone,
      'delivery_address', o.delivery_address,
      'created_at', o.created_at,
      'ready_at', o.ready_at,
      'order_items', (
        SELECT coalesce(jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'menu_item_id', oi.menu_item_id,
            'quantity', oi.quantity,
            'fulfillment_type', oi.fulfillment_type,
            'notes', oi.notes,
            'menu_items', jsonb_build_object('name', coalesce(mi.name, 'Hidangan'))
          )
        ), '[]'::jsonb)
        FROM public.order_items oi
        LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id = o.id
      )
    ) ORDER BY o.created_at ASC
  ), '[]'::jsonb) INTO v_res
  FROM public.orders o
  WHERE o.status IN ('pending', 'preparing')
    AND (p_store_id IS NULL OR o.store_id = p_store_id);

  RETURN v_res;
END;
$$;

-- ATOMIC UPDATE_KITCHEN_ORDER_STATUS RPC
CREATE OR REPLACE FUNCTION public.update_kitchen_order_status(p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET 
    status = p_status::order_status,
    ready_at = CASE WHEN p_status IN ('ready', 'completed') THEN now() ELSE ready_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_store_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_kitchen_orders(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_kitchen_order_status(uuid, text) TO anon, authenticated, service_role;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_public_select" ON public.stores;
CREATE POLICY "stores_public_select" ON public.stores FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tables_public_all" ON public.tables;
CREATE POLICY "tables_public_all" ON public.tables FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "menu_items_public_all" ON public.menu_items;
CREATE POLICY "menu_items_public_all" ON public.menu_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "orders_public_all" ON public.orders;
CREATE POLICY "orders_public_all" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_public_all" ON public.order_items;
CREATE POLICY "order_items_public_all" ON public.order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. SUPABASE REALTIME CONFIGURATION
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tables') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
  END IF;
END $$;

-- 8. STORAGE BUCKET FOR LOGOS / IMAGES
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public Access Logos" ON storage.objects;
CREATE POLICY "Public Access Logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "Public Insert Logos" ON storage.objects;
CREATE POLICY "Public Insert Logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "Public Update Logos" ON storage.objects;
CREATE POLICY "Public Update Logos" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'logos');
