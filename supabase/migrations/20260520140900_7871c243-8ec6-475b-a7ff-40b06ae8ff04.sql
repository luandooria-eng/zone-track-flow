CREATE OR REPLACE FUNCTION public.get_crm_trigger_metrics(
  p_start timestamptz DEFAULT (now() - interval '30 days'),
  p_end timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Base: every trigger_fired activity in range with lead phone + trigger metadata
  WITH fires AS (
    SELECT
      a.id              AS activity_id,
      a.created_at      AS fired_at,
      a.lead_id,
      (a.metadata->>'trigger_id')::uuid   AS trigger_id,
      COALESCE(a.metadata->>'trigger_name', t.name, '(sem nome)') AS trigger_name,
      l.phone           AS lead_phone
    FROM crm_activities a
    LEFT JOIN crm_leads     l ON l.id = a.lead_id
    LEFT JOIN crm_triggers  t ON t.id = NULLIF(a.metadata->>'trigger_id','')::uuid
    WHERE a.type = 'trigger_fired'
      AND a.metadata ? 'trigger_id'
      AND a.created_at >= p_start
      AND a.created_at <  p_end
  ),
  -- For each fire, find first inbound whatsapp message from same phone AFTER fire
  with_response AS (
    SELECT
      f.*,
      (
        SELECT MIN(m.created_at)
        FROM whatsapp_messages m
        JOIN whatsapp_conversations c ON c.id = m.conversation_id
        WHERE m.direction = 'inbound'
          AND m.created_at > f.fired_at
          AND f.lead_phone IS NOT NULL
          AND public.normalize_phone_for_match(c.phone)
              = ANY (public.phone_match_variants(f.lead_phone))
      ) AS first_response_at
    FROM fires f
  ),
  enriched AS (
    SELECT
      activity_id, fired_at, trigger_id, trigger_name, lead_phone,
      first_response_at,
      CASE WHEN first_response_at IS NOT NULL
           THEN EXTRACT(EPOCH FROM (first_response_at - fired_at))/60.0
      END AS response_minutes,
      (date_trunc('day', fired_at AT TIME ZONE 'America/Sao_Paulo'))::date AS day_local
    FROM with_response
  ),
  daily AS (
    SELECT day_local AS day,
           COUNT(*)::int AS sent,
           COUNT(first_response_at)::int AS responded
    FROM enriched
    GROUP BY day_local
    ORDER BY day_local
  ),
  by_trigger AS (
    SELECT trigger_id,
           trigger_name,
           COUNT(*)::int AS sent,
           COUNT(first_response_at)::int AS responded,
           ROUND(AVG(response_minutes)::numeric, 1) AS avg_response_minutes
    FROM enriched
    GROUP BY trigger_id, trigger_name
    ORDER BY sent DESC
  ),
  totals AS (
    SELECT
      COUNT(*)::int                                 AS total_sent,
      COUNT(first_response_at)::int                 AS total_responded,
      ROUND(AVG(response_minutes)::numeric, 1)      AS avg_response_minutes
    FROM enriched
  )
  SELECT jsonb_build_object(
    'totals',    (SELECT to_jsonb(t) FROM totals t),
    'daily',     COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb),
    'byTrigger', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM by_trigger b), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_crm_trigger_metrics(timestamptz, timestamptz) TO authenticated;
