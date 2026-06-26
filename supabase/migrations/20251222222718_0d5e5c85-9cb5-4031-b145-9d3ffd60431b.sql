-- Habilitar extensão pg_trgm para busca fuzzy (precisa estar antes do índice)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabela de índice de ruas para performance no autocomplete
CREATE TABLE public.streets_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  street_type text NOT NULL DEFAULT 'Rua',
  street_name text NOT NULL,
  street_name_normalized text NOT NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX streets_index_normalized_neighborhood_idx 
ON public.streets_index(street_name_normalized, COALESCE(neighborhood_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Índice para busca por texto com trigrams
CREATE INDEX streets_index_search_idx ON public.streets_index USING gin(street_name_normalized gin_trgm_ops);

-- RLS para streets_index
ALTER TABLE public.streets_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read streets_index" 
ON public.streets_index FOR SELECT 
USING (true);

CREATE POLICY "Authenticated can insert streets_index" 
ON public.streets_index FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated can update streets_index" 
ON public.streets_index FOR UPDATE 
USING (true);

-- View para sugestões de clientes por rua
CREATE OR REPLACE VIEW public.vw_customers_by_street AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.phone as phone_primary,
  a.street_name,
  LOWER(translate(a.street_name, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) as street_name_normalized,
  a.house_number,
  n.name as neighborhood_name,
  a.id as address_id,
  a.complement,
  a.reference_point,
  ca.is_default
FROM public.customers c
INNER JOIN public.customer_addresses ca ON ca.customer_id = c.id
INNER JOIN public.addresses a ON a.id = ca.address_id
LEFT JOIN public.neighborhoods n ON n.id = a.neighborhood_id
WHERE c.is_active = true;

-- Função para normalizar nome de rua
CREATE OR REPLACE FUNCTION public.normalize_street_name(p_street text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN LOWER(translate(
    regexp_replace(COALESCE(p_street, ''), '\s+', ' ', 'g'),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
END;
$$;

-- Função para extrair tipo de rua e nome
CREATE OR REPLACE FUNCTION public.parse_street_type(p_street text)
RETURNS TABLE(street_type text, street_name text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_type text := 'Rua';
  v_name text;
BEGIN
  v_normalized := trim(p_street);
  
  IF v_normalized ~* '^(travessa|trav\.?)[\s]' THEN
    v_type := 'Travessa';
    v_name := regexp_replace(v_normalized, '^(travessa|trav\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(avenida|av\.?)[\s]' THEN
    v_type := 'Avenida';
    v_name := regexp_replace(v_normalized, '^(avenida|av\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(alameda|al\.?)[\s]' THEN
    v_type := 'Alameda';
    v_name := regexp_replace(v_normalized, '^(alameda|al\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(praça|praca|pça\.?)[\s]' THEN
    v_type := 'Praça';
    v_name := regexp_replace(v_normalized, '^(praça|praca|pça\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(estrada|estr\.?)[\s]' THEN
    v_type := 'Estrada';
    v_name := regexp_replace(v_normalized, '^(estrada|estr\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(rodovia|rod\.?)[\s]' THEN
    v_type := 'Rodovia';
    v_name := regexp_replace(v_normalized, '^(rodovia|rod\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(rua|r\.?)[\s]' THEN
    v_type := 'Rua';
    v_name := regexp_replace(v_normalized, '^(rua|r\.?)[\s]+', '', 'i');
  ELSE
    v_name := v_normalized;
  END IF;
  
  RETURN QUERY SELECT v_type, trim(v_name);
END;
$$;

-- Função para atualizar índice de ruas automaticamente
CREATE OR REPLACE FUNCTION public.update_streets_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parsed RECORD;
  v_normalized text;
BEGIN
  SELECT * INTO v_parsed FROM public.parse_street_type(NEW.street_name);
  v_normalized := public.normalize_street_name(v_parsed.street_name);
  
  INSERT INTO public.streets_index (
    street_type, street_name, street_name_normalized, neighborhood_id, usage_count, last_used_at
  )
  VALUES (v_parsed.street_type, NEW.street_name, v_normalized, NEW.neighborhood_id, 1, now())
  ON CONFLICT (street_name_normalized, COALESCE(neighborhood_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    usage_count = streets_index.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar índice quando endereço é criado
CREATE TRIGGER tr_addresses_update_streets_index
AFTER INSERT ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_streets_index();

-- Função para atualizar índice quando pedido é criado
CREATE OR REPLACE FUNCTION public.update_streets_index_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parsed RECORD;
  v_normalized text;
BEGIN
  IF NEW.delivery_address IS NOT NULL AND NEW.delivery_address != '' THEN
    SELECT * INTO v_parsed FROM public.parse_street_type(NEW.delivery_address);
    v_normalized := public.normalize_street_name(v_parsed.street_name);
    
    INSERT INTO public.streets_index (
      street_type, street_name, street_name_normalized, neighborhood_id, usage_count, last_used_at
    )
    VALUES (v_parsed.street_type, NEW.delivery_address, v_normalized, NEW.neighborhood_id, 1, now())
    ON CONFLICT (street_name_normalized, COALESCE(neighborhood_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET
      usage_count = streets_index.usage_count + 1,
      last_used_at = now(),
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_orders_update_streets_index
AFTER INSERT OR UPDATE OF delivery_address ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_streets_index_on_order();

-- Função de busca de endereços para o autocomplete
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
  v_has_number boolean := false;
  v_number_part text := '';
BEGIN
  v_search_normalized := public.normalize_street_name(p_search);
  
  IF v_search_normalized ~ '\s+\d+$' THEN
    v_has_number := true;
    v_number_part := (regexp_match(v_search_normalized, '\s+(\d+)$'))[1];
    v_search_normalized := regexp_replace(v_search_normalized, '\s+\d+$', '');
  END IF;
  
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
    OR cs.customer_name ILIKE '%' || p_search || '%'
  )
  AND (NOT v_has_number OR cs.house_number = v_number_part)
  
  ORDER BY suggestion_type ASC, usage_count DESC, display_text ASC
  LIMIT p_limit;
END;
$$;