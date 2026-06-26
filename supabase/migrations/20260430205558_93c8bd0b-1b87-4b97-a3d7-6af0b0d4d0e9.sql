ALTER TABLE public.crm_triggers
  ADD COLUMN IF NOT EXISTS filter_tags text[] NOT NULL DEFAULT '{}'::text[];

DROP FUNCTION IF EXISTS public.crm_get_pending_timer_leads();

CREATE FUNCTION public.crm_get_pending_timer_leads()
 RETURNS TABLE(lead_id uuid, lead_name text, lead_phone text, stage_id uuid, trigger_id uuid, trigger_name text, action_type text, message_template text, target_stage_id uuid, tags text[], filter_tags text[])
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    l.id            AS lead_id,
    l.name          AS lead_name,
    l.phone         AS lead_phone,
    l.stage_id,
    t.id            AS trigger_id,
    t.name          AS trigger_name,
    t.action_type,
    t.message_template,
    t.target_stage_id,
    t.tags,
    t.filter_tags
  FROM crm_leads l
  JOIN crm_triggers t ON t.stage_id = l.stage_id
    AND t.trigger_condition = 'time_in_stage'
    AND t.is_active = true
    AND t.delay_minutes > 0
  LEFT JOIN crm_timer_executions e
    ON e.lead_id = l.id
    AND e.trigger_id = t.id
    AND e.stage_id = l.stage_id
  WHERE e.id IS NULL
    AND (now() - l.stage_changed_at) >= (t.delay_minutes * interval '1 minute')
    AND (
      COALESCE(array_length(t.filter_tags, 1), 0) = 0
      OR EXISTS (
        SELECT 1 FROM crm_lead_tags lt
        WHERE lt.lead_id = l.id
          AND LOWER(lt.tag) = ANY (SELECT LOWER(unnest(t.filter_tags)))
      )
      OR EXISTS (
        SELECT 1
        FROM customer_tag_assignments cta
        JOIN customer_tags ct ON ct.id = cta.tag_id
        WHERE cta.customer_id = l.customer_id
          AND LOWER(ct.name) = ANY (SELECT LOWER(unnest(t.filter_tags)))
      )
    )
  ORDER BY l.stage_changed_at ASC;
$function$;