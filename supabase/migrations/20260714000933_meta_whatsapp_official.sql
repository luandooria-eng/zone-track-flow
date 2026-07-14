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

DO $pol$ BEGIN
CREATE POLICY "auth view whatsapp_templates" ON public.whatsapp_templates
  FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $pol$;

DO $pol$ BEGIN
CREATE POLICY "admins manage whatsapp_templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $pol$;

DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON public.whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Vínculo opcional de template por fluxo de envio automático
-- (usado como fallback quando o provedor ativo é meta_cloud e o contato
-- está fora da janela de 24h de atendimento)
--
-- NOTA: crm_triggers e auto_reactivation_rules NÃO existem neste banco
-- (CRM Funil / Gatilhos / Reativação Automática não têm schema aplicado
-- aqui ainda). Essas duas ALTER TABLE ficam de fora desta migração até
-- essa decisão ser tomada — ver relatório enviado ao usuário.
-- =====================================================
ALTER TABLE public.crm_campaign_templates
  ADD COLUMN IF NOT EXISTS whatsapp_template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL;

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

-- NOTA: a atualização de crm_get_pending_timer_leads() (usada por
-- crm-timer-processor) fica de fora — a função depende de crm_leads e
-- crm_triggers, que não existem neste banco.
