
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
      max(created_at) AS last_at,
      CASE WHEN count(*) > 1
        THEN GREATEST(1, ROUND(EXTRACT(EPOCH FROM (max(created_at) - min(created_at)))/86400.0/(count(*)-1)))::int
        ELSE NULL
      END AS avg_days
    FROM typed_orders
    GROUP BY customer_id
  )
  SELECT
    c.id,
    c.name,
    c.phone,
    a.last_at,
    a.avg_days,
    FLOOR(EXTRACT(EPOCH FROM (now() - a.last_at))/86400.0)::int AS days_since
  FROM customers c
  JOIN agg a ON a.customer_id = c.id
  WHERE c.is_active = true
    AND c.phone IS NOT NULL AND c.phone <> ''
    AND a.cnt >= p_min_samples
    AND a.avg_days IS NOT NULL
    AND a.avg_days BETWEEN p_min_avg AND p_max_avg
    AND FLOOR(EXTRACT(EPOCH FROM (now() - a.last_at))/86400.0) >= (a.avg_days + p_tolerance)
    AND NOT EXISTS (
      SELECT 1 FROM auto_reactivation_cycles cy
      WHERE cy.customer_id = c.id
        AND cy.product_type = p_product_type
        AND (
          cy.status IN ('waiting','sent','paused')
          OR (cy.status = 'exhausted' AND cy.updated_at > now() - interval '20 days')
        )
    )
    -- Skip customers who sent any inbound WhatsApp message in the last 3 days:
    -- if they're already talking to us, don't ask if they want water.
    AND NOT EXISTS (
      SELECT 1
      FROM whatsapp_conversations conv
      JOIN whatsapp_messages m ON m.conversation_id = conv.id
      WHERE conv.customer_id = c.id
        AND m.direction = 'inbound'
        AND m.created_at > now() - interval '3 days'
    )
  ORDER BY a.last_at ASC
  LIMIT p_limit;
$$;
