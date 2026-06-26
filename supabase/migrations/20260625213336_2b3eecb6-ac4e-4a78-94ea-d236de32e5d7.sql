
-- 1) Recalcula candidatos usando âncora = MAX(último pedido entregue, última mensagem recebida)
CREATE OR REPLACE FUNCTION public.get_reactivation_candidates(
  p_product_type text,
  p_min_avg int,
  p_max_avg int,
  p_tolerance int,
  p_min_samples int,
  p_limit int
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_phone text,
  last_order_at timestamptz,
  avg_days int,
  days_since int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH typed_orders AS (
    SELECT o.customer_id, o.created_at
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'delivered'
      AND o.customer_id IS NOT NULL
      AND (
        (p_product_type = 'water'
          AND lower(p.name) ~ '(agua|água|indai|sao crist|cristov|20l|10l|gal[aã]o)')
        OR
        (p_product_type = 'gas'
          AND lower(p.name) ~ '(g[aá]s|botij|13kg|p13|glp)')
      )
  ),
  agg AS (
    SELECT
      customer_id,
      count(*)::int AS cnt,
      max(created_at) AS last_order_at,
      CASE WHEN count(*) > 1
        THEN GREATEST(1, ROUND(EXTRACT(EPOCH FROM (max(created_at) - min(created_at)))/86400.0/(count(*)-1)))::int
        ELSE NULL
      END AS avg_days
    FROM typed_orders
    GROUP BY customer_id
  ),
  last_inbound AS (
    -- Última mensagem recebida do cliente (resetar relógio)
    SELECT conv.customer_id, MAX(m.created_at) AS last_inbound_at
    FROM whatsapp_conversations conv
    JOIN whatsapp_messages m ON m.conversation_id = conv.id
    WHERE m.direction = 'inbound'
      AND conv.customer_id IS NOT NULL
    GROUP BY conv.customer_id
  ),
  anchored AS (
    SELECT
      a.customer_id,
      a.cnt,
      a.avg_days,
      a.last_order_at,
      GREATEST(a.last_order_at, COALESCE(li.last_inbound_at, a.last_order_at)) AS anchor_at
    FROM agg a
    LEFT JOIN last_inbound li ON li.customer_id = a.customer_id
  )
  SELECT
    c.id,
    c.name,
    c.phone,
    an.last_order_at,
    an.avg_days,
    FLOOR(EXTRACT(EPOCH FROM (now() - an.anchor_at))/86400.0)::int AS days_since
  FROM customers c
  JOIN anchored an ON an.customer_id = c.id
  WHERE c.is_active = true
    AND c.phone IS NOT NULL AND c.phone <> ''
    AND an.cnt >= p_min_samples
    AND an.avg_days IS NOT NULL
    AND an.avg_days BETWEEN p_min_avg AND p_max_avg
    -- Dispara quando dias desde a âncora (pedido OU mensagem) >= avg + tolerância
    AND FLOOR(EXTRACT(EPOCH FROM (now() - an.anchor_at))/86400.0) >= (an.avg_days + p_tolerance)
    AND NOT EXISTS (
      SELECT 1 FROM auto_reactivation_cycles cy
      WHERE cy.customer_id = c.id
        AND cy.product_type = p_product_type
        AND (
          cy.status IN ('waiting','sent','paused')
          OR (cy.status = 'exhausted' AND cy.updated_at > now() - interval '20 days')
        )
    )
  ORDER BY an.anchor_at ASC
  LIMIT p_limit;
$$;

-- 2) Trigger: quando o cliente envia mensagem com um ciclo aberto, encerra-o como "reset_by_message"
CREATE OR REPLACE FUNCTION public.mark_reactivation_response_on_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phone TEXT;
  v_variants TEXT[];
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  SELECT phone INTO v_phone FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN NEW; END IF;
  v_variants := public.phone_match_variants(v_phone);

  -- Marca resposta
  UPDATE public.auto_reactivation_cycles arc
  SET responded_at = COALESCE(arc.responded_at, NEW.created_at), updated_at = now()
  FROM public.customers c
  WHERE arc.customer_id = c.id
    AND arc.status IN ('waiting','sent')
    AND arc.responded_at IS NULL
    AND public.normalize_phone_for_match(c.phone) = ANY(v_variants);

  -- Encerra ciclos abertos como "reiniciado por mensagem" para liberar novo ciclo com nova âncora
  UPDATE public.auto_reactivation_cycles arc
  SET status = 'reset_by_message', updated_at = now()
  FROM public.customers c
  WHERE arc.customer_id = c.id
    AND arc.status IN ('waiting','sent')
    AND public.normalize_phone_for_match(c.phone) = ANY(v_variants);

  RETURN NEW;
END;
$function$;
