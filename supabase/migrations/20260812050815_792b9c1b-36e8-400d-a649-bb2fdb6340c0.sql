-- Allow public access to read logos
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

-- Allow authenticated users to upload their store logos
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
CREATE POLICY "Authenticated Update" ON storage.objects FOR UPDATE TO authenticated WITH CHECK (bucket_id = 'logos');

-- Add phone_number_2 to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone_number_2 TEXT;

-- Update RLS grants (standard practice)
GRANT ALL ON TABLE public.stores TO authenticated;
GRANT ALL ON TABLE public.stores TO service_role;
