-- WhatsApp Cloud API (Meta oficial) como provedor alternativo ao Z-API
-- + cadastro de templates aprovados para envios proativos (fora da janela de 24h)

ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'zapi' CHECK (provider IN ('zapi', 'meta_cloud')),
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS meta_waba_id text,
  ADD COLUMN IF NOT EXISTS meta_access_token text,
  ADD COLUMN IF NOT EXISTS meta_app_secret text,
  ADD COLUMN IF NOT EXISTS meta_verify_token text,
  ADD COLUMN IF NOT EXISTS meta_api_version text NOT NULL DEFAULT 'v21.0';

-- =====================================================
-- TEMPLATES (Meta Cloud API) — cadastro dos templates já aprovados no Meta Business Manager
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  language      text NOT NULL DEFAULT 'pt_BR',
  category      text NOT NULL DEFAULT 'UTILITY' CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  status        text NOT NULL DEFAULT 'approved',
  header_type   text CHECK (header_type IS NULL OR header_type IN ('none', 'text', 'image', 'document', 'video')),
  body_preview  text NOT NULL,
  variables     jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view whatsapp_templates" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage whatsapp_templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Vínculo opcional de template por fluxo de envio automático
-- (usado como fallback quando o provedor ativo é meta_cloud e o contato
-- está fora da janela de 24h de atendimento)
-- =====================================================
ALTER TABLE public.crm_triggers
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

ALTER TABLE public.crm_campaign_templates
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

ALTER TABLE public.auto_reactivation_rules
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS followup_whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

ALTER TABLE public.cart_recovery_config
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

-- =====================================================
-- Storage bucket for media received via the Meta Cloud API webhook.
-- Meta's media download URLs require an auth header and expire quickly, so inbound
-- media is re-hosted here (public bucket) so the Inbox UI can render it directly.
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- crm_get_pending_timer_leads: also expose whatsapp_template_id so the
-- timer processor can fall back to an approved Meta template when needed.
-- =====================================================
DROP FUNCTION IF EXISTS public.crm_get_pending_timer_leads();

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
$function$;
