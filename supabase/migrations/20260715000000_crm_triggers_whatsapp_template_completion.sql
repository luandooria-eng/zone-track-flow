-- Completa o suporte a template da Meta Cloud API nos gatilhos de CRM e na
-- reativação automática. A migração original (meta_whatsapp_official) deixou
-- essas duas ALTER TABLE de fora porque crm_triggers/auto_reactivation_rules
-- não existiam no banco da Ladonna na época. Em bancos onde essas tabelas já
-- existem (ex: novos clientes duplicados a partir deste projeto), aplicamos
-- normalmente; onde não existem, os blocos abaixo são pulados sem erro.

DO $$ BEGIN
  IF to_regclass('public.crm_triggers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.crm_triggers
      ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.auto_reactivation_rules') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.auto_reactivation_rules
      ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS followup_whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL';
  END IF;
END $$;

-- crm_get_pending_timer_leads() precisa existir e crm_leads/crm_triggers
-- também, já que a função faz JOIN entre elas.
DO $$ BEGIN
  IF to_regclass('public.crm_leads') IS NOT NULL
     AND to_regclass('public.crm_triggers') IS NOT NULL
     AND to_regclass('public.crm_timer_executions') IS NOT NULL THEN
    EXECUTE 'DROP FUNCTION IF EXISTS public.crm_get_pending_timer_leads()';
    EXECUTE $def$
      CREATE FUNCTION public.crm_get_pending_timer_leads()
       RETURNS TABLE(lead_id uuid, lead_name text, lead_phone text, stage_id uuid, trigger_id uuid, trigger_name text, action_type text, message_template text, target_stage_id uuid, tags text[], filter_tags text[], whatsapp_template_id uuid)
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
          t.filter_tags,
          t.whatsapp_template_id
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
      $function$
    $def$;
  END IF;
END $$;
