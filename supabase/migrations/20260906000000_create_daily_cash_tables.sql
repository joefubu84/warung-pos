-- ==============================================================================
-- WARUNG J&J POS: DAILY CASH & DRAWER MANAGEMENT FULL SETUP
-- Project: gtmzzblomcvgmwzjalja.supabase.co
-- Description: Creates daily_cash, cash_transactions, daily_cash_edit_logs tables,
--              sets RLS policies, grants permissions, and reloads PostgREST schema cache.
-- ==============================================================================

-- 1. Table: daily_cash
CREATE TABLE IF NOT EXISTS public.daily_cash (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) DEFAULT '1094d737-8104-4a55-b678-0fe9097beba0',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    closing_balance NUMERIC(12, 2),
    expected_closing NUMERIC(12, 2),
    variance NUMERIC(12, 2),
    notes TEXT,
    opened_by UUID REFERENCES public.users(id),
    closed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    CONSTRAINT daily_cash_date_unique UNIQUE (date)
);

-- 2. Table: cash_transactions (Drawer petty expenses & cash payments)
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_cash_id UUID REFERENCES public.daily_cash(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id),
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT DEFAULT 'payment',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Table: daily_cash_edit_logs (Audit logs for shift edits & drawer adjustments)
CREATE TABLE IF NOT EXISTS public.daily_cash_edit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_cash_id UUID REFERENCES public.daily_cash(id) ON DELETE CASCADE,
    edited_by UUID REFERENCES public.users(id),
    edited_by_name TEXT,
    previous_values JSONB,
    new_values JSONB,
    change_reason TEXT,
    edited_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.daily_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_cash_edit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Policies for Warung Staff & Admin
DROP POLICY IF EXISTS "daily_cash_all" ON public.daily_cash;
CREATE POLICY "daily_cash_all" ON public.daily_cash FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cash_transactions_all" ON public.cash_transactions;
CREATE POLICY "cash_transactions_all" ON public.cash_transactions FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "daily_cash_edit_logs_all" ON public.daily_cash_edit_logs;
CREATE POLICY "daily_cash_edit_logs_all" ON public.daily_cash_edit_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Grant Permissions to roles
GRANT ALL ON public.daily_cash TO anon, authenticated, service_role;
GRANT ALL ON public.cash_transactions TO anon, authenticated, service_role;
GRANT ALL ON public.daily_cash_edit_logs TO anon, authenticated, service_role;

-- 7. Missing landing_page_config safeguard
CREATE TABLE IF NOT EXISTS public.landing_page_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id),
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.landing_page_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "landing_page_config_all" ON public.landing_page_config;
CREATE POLICY "landing_page_config_all" ON public.landing_page_config FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON public.landing_page_config TO anon, authenticated, service_role;

-- 8. Fix cash_sessions RLS to prevent 42501 permission error
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_sessions_all" ON public.cash_sessions;
CREATE POLICY "cash_sessions_all" ON public.cash_sessions FOR ALL TO public USING (true) WITH CHECK (true);
GRANT ALL ON public.cash_sessions TO anon, authenticated, service_role;

-- 9. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
