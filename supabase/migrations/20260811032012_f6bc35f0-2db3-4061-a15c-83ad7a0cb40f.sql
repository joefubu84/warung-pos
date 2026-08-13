ALTER TABLE public.tables ADD COLUMN status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved'));

GRANT ALL ON public.tables TO authenticated;
GRANT ALL ON public.tables TO service_role;
GRANT SELECT ON public.tables TO anon;