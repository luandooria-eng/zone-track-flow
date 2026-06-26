
CREATE OR REPLACE FUNCTION public.search_addresses_autocomplete(
  p_search text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  suggestion_type text,
  display_text text,
  street_type text,
  street_name text,
  house_number text,
  neighborhood_name text,
  neighborhood_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  address_id uuid,
  usage_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_normalized text;
  v_search_name_normalized text;
  v_has_number boolean := false;
  v_number_part text := '';
BEGIN
  v_search_normalized := public.normalize_street_name(p_search);

  IF v_search_normalized ~ '\s+\d+$' THEN
    v_has_number := true;
    v_number_part := (regexp_match(v_search_normalized, '\s+(\d+)$'))[1];
    v_search_normalized := regexp_replace(v_search_normalized, '\s+\d+$', '');
  END IF;

  v_search_name_normalized := v_search_normalized;

  v_search_normalized := regexp_replace(v_search_normalized, '^(rua|r\.|travessa|trav\.|avenida|av\.|alameda|al\.|praca|praça|pca\.|estrada|estr\.|rodovia|rod\.)\s*', '', 'i');

  RETURN QUERY
  SELECT
    'street'::text as suggestion_type,
    si.street_type || ' ' || si.street_name || COALESCE(' — ' || n.name, '') as display_text,
    si.street_type,
    si.street_name,
    NULL::text as house_number,
    n.name as neighborhood_name,
    si.neighborhood_id,
    NULL::uuid as customer_id,
    NULL::text as customer_name,
    NULL::text as customer_phone,
    NULL::uuid as address_id,
    si.usage_count
  FROM public.streets_index si
  LEFT JOIN public.neighborhoods n ON n.id = si.neighborhood_id
  WHERE si.street_name_normalized ILIKE '%' || v_search_normalized || '%'

  UNION ALL

  SELECT
    'customer'::text as suggestion_type,
    cs.customer_name || ' — ' || cs.street_name || ', ' || COALESCE(cs.house_number, 'S/N') || ' — ' || COALESCE(cs.neighborhood_name, '') as display_text,
    NULL::text as street_type,
    cs.street_name,
    cs.house_number,
    cs.neighborhood_name,
    NULL::uuid as neighborhood_id,
    cs.customer_id,
    cs.customer_name,
    cs.phone_primary as customer_phone,
    cs.address_id,
    0 as usage_count
  FROM public.vw_customers_by_street cs
  WHERE (
    cs.street_name_normalized ILIKE '%' || v_search_normalized || '%'
    OR public.normalize_street_name(cs.customer_name) ILIKE '%' || v_search_name_normalized || '%'
  )
  AND (NOT v_has_number OR cs.house_number = v_number_part)

  ORDER BY suggestion_type ASC, usage_count DESC, display_text ASC
  LIMIT p_limit;
END;
$$;
