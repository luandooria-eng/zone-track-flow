-- CRM Sales Funnel: stages, leads, activities, triggers
-- -------------------------------------------------------

-- 1. Funnel stages (configurable Kanban columns)
CREATE TABLE IF NOT EXISTS crm_funnel_stages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  color         text NOT NULL DEFAULT '#6366f1',
  order_index   integer NOT NULL,
  description   text,
  is_won        boolean NOT NULL DEFAULT false,
  is_lost       boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE crm_funnel_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_funnel_stages"
  ON crm_funnel_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default pipeline stages
INSERT INTO crm_funnel_stages (name, color, order_index, description, is_won, is_lost) VALUES
  ('Novo Lead',        '#3b82f6', 1, 'Lead recém-captado, ainda sem contato',             false, false),
  ('Primeiro Contato', '#8b5cf6', 2, 'Contato inicial realizado via WhatsApp ou ligação',  false, false),
  ('Proposta Enviada', '#f59e0b', 3, 'Proposta de preços e condições enviada ao lead',     false, false),
  ('Em Negociação',    '#f97316', 4, 'Lead em processo ativo de negociação',               false, false),
  ('Fechado - Ganho',  '#10b981', 5, 'Negócio fechado, lead convertido em cliente',        true,  false),
  ('Perdido',          '#ef4444', 6, 'Lead perdido ou desistiu',                           false, true)
ON CONFLICT DO NOTHING;

-- 2. Leads table
CREATE TABLE IF NOT EXISTS crm_leads (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    text NOT NULL,
  phone                   text,
  email                   text,
  address                 text,
  neighborhood_id         uuid REFERENCES neighborhoods(id),
  stage_id                uuid NOT NULL REFERENCES crm_funnel_stages(id),
  estimated_value         numeric(10,2),
  product_interest        text,
  source                  text DEFAULT 'whatsapp',
  notes                   text,
  customer_id             uuid REFERENCES customers(id),
  assigned_to             uuid REFERENCES profiles(id),
  whatsapp_conversation_id uuid REFERENCES whatsapp_conversations(id),
  lost_reason             text,
  stage_changed_at        timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_leads"
  ON crm_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_crm_leads_stage ON crm_leads (stage_id);
CREATE INDEX idx_crm_leads_customer ON crm_leads (customer_id);
CREATE INDEX idx_crm_leads_phone ON crm_leads (phone);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_crm_lead_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_lead_updated_at
  BEFORE UPDATE ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION update_crm_lead_updated_at();

-- 3. Activities / timeline per lead
CREATE TABLE IF NOT EXISTS crm_activities (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     uuid NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  type        text NOT NULL,  -- note | whatsapp_sent | stage_change | call | trigger_fired
  content     text,
  metadata    jsonb DEFAULT '{}',
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_activities"
  ON crm_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_crm_activities_lead ON crm_activities (lead_id, created_at DESC);

-- 4. Automation triggers (auto-WhatsApp when lead enters a stage)
CREATE TABLE IF NOT EXISTS crm_triggers (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text NOT NULL,
  stage_id         uuid NOT NULL REFERENCES crm_funnel_stages(id) ON DELETE CASCADE,
  action_type      text NOT NULL DEFAULT 'whatsapp_message',
  message_template text,
  delay_minutes    integer DEFAULT 0,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE crm_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_triggers"
  ON crm_triggers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default triggers (one per stage)
INSERT INTO crm_triggers (name, stage_id, action_type, message_template, is_active)
SELECT
  'Boas-vindas - Novo Lead',
  id,
  'whatsapp_message',
  'Olá {{name}}! 👋 Sou da *Seu Geraldo Gás e Água*. Vi que você tem interesse em nossos produtos. Posso te passar mais informações? Trabalhamos com gás de cozinha e água mineral com entrega rápida na sua região! 🚚',
  true
FROM crm_funnel_stages WHERE name = 'Novo Lead'
ON CONFLICT DO NOTHING;

INSERT INTO crm_triggers (name, stage_id, action_type, message_template, is_active)
SELECT
  'Catálogo - Primeiro Contato',
  id,
  'whatsapp_message',
  '{{name}}, obrigado pelo contato! 😊 Temos os melhores preços da região:

🔵 *Gás P13* - R$ 89,90
🔵 *Gás P45* - R$ 249,90
💧 *Água 20L* - R$ 12,00

Tudo com *entrega grátis* e rápida! Qual produto te interessa?',
  true
FROM crm_funnel_stages WHERE name = 'Primeiro Contato'
ON CONFLICT DO NOTHING;

INSERT INTO crm_triggers (name, stage_id, action_type, message_template, is_active)
SELECT
  'Follow-up - Proposta Enviada',
  id,
  'whatsapp_message',
  '{{name}}, acabei de preparar uma *proposta especial* para você! 🎯

Para novos clientes temos condições exclusivas:
✅ Primeira entrega sem taxa
✅ Parcelamento em até 3x
✅ Entrega em até 2 horas

Ficou alguma dúvida? Estou à disposição! 😊',
  true
FROM crm_funnel_stages WHERE name = 'Proposta Enviada'
ON CONFLICT DO NOTHING;

INSERT INTO crm_triggers (name, stage_id, action_type, message_template, is_active)
SELECT
  'Oferta Especial - Negociação',
  id,
  'whatsapp_message',
  '{{name}}, que tal fecharmos hoje? 🤝

Tenho uma *oferta especial* só para você:
🎁 *10% de desconto* na primeira compra
🚀 Entrega *prioritária* hoje mesmo
📦 Sem taxa de entrega

Essa oferta é por tempo limitado! O que acha?',
  true
FROM crm_funnel_stages WHERE name = 'Em Negociação'
ON CONFLICT DO NOTHING;

INSERT INTO crm_triggers (name, stage_id, action_type, message_template, is_active)
SELECT
  'Boas-vindas Cliente - Ganho',
  id,
  'whatsapp_message',
  '🎉 Seja bem-vindo(a) à família *Seu Geraldo*, {{name}}!

Seu cadastro foi realizado com sucesso. Agora você tem acesso a:
✅ Pedidos pelo WhatsApp
✅ Entrega rápida na sua região
✅ Programa de fidelidade com descontos

Em breve entraremos em contato para organizar sua primeira entrega. Obrigado pela confiança! 💙',
  true
FROM crm_funnel_stages WHERE name = 'Fechado - Ganho'
ON CONFLICT DO NOTHING;

-- 5. DB trigger: log stage changes and queue trigger execution
CREATE OR REPLACE FUNCTION crm_on_lead_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_stage_name text;
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO v_stage_name FROM crm_funnel_stages WHERE id = NEW.stage_id;

    -- Log the stage change as activity
    INSERT INTO crm_activities (lead_id, type, content, metadata)
    VALUES (
      NEW.id,
      'stage_change',
      'Movido para "' || v_stage_name || '"',
      jsonb_build_object(
        'from_stage_id', OLD.stage_id,
        'to_stage_id', NEW.stage_id,
        'to_stage_name', v_stage_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_lead_stage_change
  AFTER UPDATE OF stage_id ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION crm_on_lead_stage_change();

-- 6. Realtime on crm_leads and crm_activities
ALTER PUBLICATION supabase_realtime ADD TABLE crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_activities;
