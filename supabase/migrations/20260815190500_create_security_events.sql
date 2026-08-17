-- supabase/migrations/20260815190500_create_security_events.sql
-- Server-side Security Events Logging & Admin-Only RLS Policies

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- RATE_LIMIT_EXCEEDED, PRICE_MISMATCH, OCCUPIED_TABLE_BLOCK, SESSION_TERMINATED
  store_id UUID REFERENCES public.stores(id),
  table_id UUID REFERENCES public.tables(id),
  device_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_security_events_store_id ON public.security_events(store_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present
DROP POLICY IF EXISTS "security_events_staff_select" ON public.security_events;

-- RLS Policy: ONLY authenticated staff & admin can view security threat logs (privacy protection)
CREATE POLICY "security_events_staff_select" ON public.security_events
  FOR SELECT TO authenticated
  USING (store_id = public.get_auth_store_id() AND public.get_auth_role() IN ('staff', 'admin'));

-- Grants
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
