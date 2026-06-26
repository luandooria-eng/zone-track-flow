-- CRM Advanced: timer triggers, tags, stage CRUD, recurrence rules, auto-lead from WhatsApp
-- -------------------------------------------------------------------------------------

-- 1. Expand crm_triggers: add condition type, target stage, tags, timer tracking
ALTER TABLE crm_triggers
  ADD COLUMN IF NOT EXISTS trigger_condition text NOT NULL DEFAULT 'on_enter',
  -- on_enter | time_in_stage
  ADD COLUMN IF NOT EXISTS target_stage_id uuid REFERENCES crm_funnel_stages(id) ON DELETE SET NULL,
  -- used when action_type = 'move_stage'
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
  -- used when action_type = 'add_tag'

-- action_type values:  whatsapp_message | move_stage | add_tag
-- trigger_condition:   on_enter (immediate) | time_in_stage (after delay_minutes in stage)

-- 2. Lead tags
CREATE TABLE IF NOT EXISTS crm_lead_tags (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id    uuid NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  tag        text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (lead_id, tag)
);
ALTER TABLE crm_lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_lead_tags"
  ON crm_lead_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Timer execution log — prevents double-firing time_in_stage triggers
CREATE TABLE IF NOT EXISTS crm_timer_executions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id     uuid NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  trigger_id  uuid NOT NULL REFERENCES crm_triggers(id) ON DELETE CASCADE,
  stage_id    uuid NOT NULL REFERENCES crm_funnel_stages(id) ON DELETE CASCADE,
  fired_at    timestamptz DEFAULT now(),
  UNIQUE (lead_id, trigger_id, stage_id)
);
ALTER TABLE crm_timer_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_timer_executions"
  ON crm_timer_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Clear timer executions when lead changes stage (so timers reset in new stage)
CREATE OR REPLACE FUNCTION crm_clear_timer_on_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    DELETE FROM crm_timer_executions
    WHERE lead_id = NEW.id AND stage_id = OLD.stage_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_crm_clear_timer
  AFTER UPDATE OF stage_id ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION crm_clear_timer_on_stage_change();

-- 4. Recurrence rules — for water/gas re-purchase triggers
CREATE TABLE IF NOT EXISTS crm_recurrence_rules (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  text NOT NULL,
  product_keyword       text,               -- NULL = all products, or 'água', 'gás', etc.
  days_since_last_order integer NOT NULL DEFAULT 7,
  message_template      text NOT NULL,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);
ALTER TABLE crm_recurrence_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users manage crm_recurrence_rules"
  ON crm_recurrence_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default recurrence rules for water and gas
INSERT INTO crm_recurrence_rules (name, product_keyword, days_since_last_order, message_template, is_active)
VALUES
  (
    'Reposição de Água 20L',
    'água',
    5,
    'Oi {{name}}! 💧 Tá acabando a água lá em casa? Já faz {{days}} dias desde seu último pedido. Posso já separar um galão de 20L pra você? Entregamos ainda hoje! 🚚',
    true
  ),
  (
    'Reposição de Gás de Cozinha',
    'gás',
    30,
    'Olá {{name}}! ⛽ Passando pra lembrar que já faz {{days}} dias desde seu último pedido de gás. Não deixe acabar! Posso te enviar um botijão ainda hoje. Confirma? 😊',
    true
  ),
  (
    'Follow-up Geral',
    NULL,
    14,
    'Oi {{name}}! 👋 Sentimos sua falta! Já faz {{days}} dias desde sua última compra. Que tal aproveitar nossa entrega rápida hoje? Aceitamos Pix, dinheiro e cartão. 💙',
    true
  )
ON CONFLICT DO NOTHING;

-- 5. crm_funnel_stages: allow updates (color, name, order, is_entry)
ALTER TABLE crm_funnel_stages
  ADD COLUMN IF NOT EXISTS is_entry boolean NOT NULL DEFAULT false;

-- Mark first stage as entry
UPDATE crm_funnel_stages SET is_entry = true WHERE order_index = 1;

-- 6. Helper function: get all leads needing timer triggers to fire
-- Returns leads where (now - stage_changed_at) >= trigger.delay_minutes
-- and the timer hasn't fired yet for that lead+trigger+stage combo
CREATE OR REPLACE FUNCTION crm_get_pending_timer_leads()
RETURNS TABLE (
  lead_id     uuid,
  lead_name   text,
  lead_phone  text,
  stage_id    uuid,
  trigger_id  uuid,
  trigger_name text,
  action_type text,
  message_template text,
  target_stage_id uuid,
  tags        text[]
)
LANGUAGE sql STABLE AS $$
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
    t.tags
  FROM crm_leads l
  JOIN crm_triggers t ON t.stage_id = l.stage_id
    AND t.trigger_condition = 'time_in_stage'
    AND t.is_active = true
    AND t.delay_minutes > 0
  LEFT JOIN crm_timer_executions e
    ON e.lead_id = l.id
    AND e.trigger_id = t.id
    AND e.stage_id = l.stage_id
  WHERE e.id IS NULL  -- not yet fired
    AND (now() - l.stage_changed_at) >= (t.delay_minutes * interval '1 minute')
  ORDER BY l.stage_changed_at ASC;
$$;

-- 7. Realtime on new tables
ALTER PUBLICATION supabase_realtime ADD TABLE crm_lead_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_timer_executions;
