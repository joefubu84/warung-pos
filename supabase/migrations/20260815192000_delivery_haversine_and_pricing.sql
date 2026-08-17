-- supabase/migrations/20260815192000_delivery_haversine_and_pricing.sql
-- Server-Authoritative Haversine Distance & Delivery Pricing Function

CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric
) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r numeric := 6371; -- Earth radius in km
  dlat numeric := radians(lat2 - lat1);
  dlng numeric := radians(lng2 - lng1);
  a numeric;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN 0;
  END IF;

  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  RETURN round((r * 2 * asin(sqrt(a)))::numeric, 2);
END;
$$;
