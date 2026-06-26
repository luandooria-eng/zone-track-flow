-- Fix function search path for normalize_address_key
CREATE OR REPLACE FUNCTION public.normalize_address_key(
  p_street TEXT,
  p_number TEXT,
  p_neighborhood_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_neighborhood_name TEXT;
  v_normalized TEXT;
BEGIN
  -- Get neighborhood name
  SELECT LOWER(COALESCE(name, '')) INTO v_neighborhood_name
  FROM public.neighborhoods WHERE id = p_neighborhood_id;
  
  -- Normalize: lowercase, remove accents, trim spaces
  v_normalized := LOWER(COALESCE(p_street, ''));
  v_normalized := translate(v_normalized, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := trim(v_normalized);
  
  -- Normalize neighborhood
  v_neighborhood_name := translate(v_neighborhood_name, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_neighborhood_name := regexp_replace(v_neighborhood_name, '\s+', ' ', 'g');
  v_neighborhood_name := trim(v_neighborhood_name);
  
  RETURN v_normalized || '|' || LOWER(COALESCE(p_number, '')) || '|' || v_neighborhood_name;
END;
$$;