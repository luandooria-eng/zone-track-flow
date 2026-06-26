
-- =====================================================
-- CAMPAIGNS
-- =====================================================
CREATE TABLE public.crm_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','paused','done','cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  rate_limit_per_min INT NOT NULL DEFAULT 25,
  send_window_start TIME NOT NULL DEFAULT '09:00',
  send_window_end TIME NOT NULL DEFAULT '19:00',
  attribution_days INT NOT NULL DEFAULT 30,
  audience_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view campaigns" ON public.crm_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert campaigns" ON public.crm_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update campaigns" ON public.crm_campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete campaigns" ON public.crm_campaigns FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_crm_campaigns_updated_at BEFORE UPDATE ON public.crm_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_campaigns_status_sched ON public.crm_campaigns(status, scheduled_at);

-- =====================================================
-- TEMPLATES (A/B variants)
-- =====================================================
CREATE TABLE public.crm_campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 1,
  sent_count INT NOT NULL DEFAULT 0,
  response_count INT NOT NULL DEFAULT 0,
  conversion_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_campaign_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view templates" ON public.crm_campaign_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert templates" ON public.crm_campaign_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update templates" ON public.crm_campaign_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete templates" ON public.crm_campaign_templates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_crm_campaign_templates_updated_at BEFORE UPDATE ON public.crm_campaign_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_campaign_templates_campaign ON public.crm_campaign_templates(campaign_id);

-- =====================================================
-- RECIPIENTS
-- =====================================================
CREATE TABLE public.crm_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('lead','customer','csv')),
  lead_id UUID,
  customer_id UUID,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  template_id UUID REFERENCES public.crm_campaign_templates(id) ON DELETE SET NULL,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  message_id TEXT,
  conversation_id UUID,
  responded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  converted_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, phone_normalized)
);

ALTER TABLE public.crm_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view recipients" ON public.crm_campaign_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert recipients" ON public.crm_campaign_recipients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update recipients" ON public.crm_campaign_recipients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete recipients" ON public.crm_campaign_recipients FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_crm_campaign_recipients_updated_at BEFORE UPDATE ON public.crm_campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_crm_recipients_campaign_status ON public.crm_campaign_recipients(campaign_id, status);
CREATE INDEX idx_crm_recipients_phone_norm ON public.crm_campaign_recipients(phone_normalized);
CREATE INDEX idx_crm_recipients_customer ON public.crm_campaign_recipients(customer_id) WHERE customer_id IS NOT NULL;

-- =====================================================
-- METRICS FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_campaign_metrics(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH base AS (
    SELECT r.*, t.label AS template_label
    FROM crm_campaign_recipients r
    LEFT JOIN crm_campaign_templates t ON t.id = r.template_id
    WHERE r.campaign_id = p_campaign_id
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int AS responded,
      COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::int AS converted
    FROM base
  ),
  by_template AS (
    SELECT
      template_id,
      MAX(template_label) AS template_label,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int AS responded,
      COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::int AS converted
    FROM base
    WHERE template_id IS NOT NULL
    GROUP BY template_id
  ),
  daily AS (
    SELECT
      (date_trunc('day', sent_at AT TIME ZONE 'America/Sao_Paulo'))::date AS day,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::int AS responded,
      COUNT(*) FILTER (WHERE converted_at IS NOT NULL)::int AS converted
    FROM base
    WHERE sent_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  ),
  converted_list AS (
    SELECT id, name, phone, source, converted_at, converted_order_id, template_label
    FROM base
    WHERE converted_at IS NOT NULL
    ORDER BY converted_at DESC
    LIMIT 50
  ),
  responded_no_conv AS (
    SELECT id, name, phone, source, responded_at, template_label
    FROM base
    WHERE responded_at IS NOT NULL AND converted_at IS NULL
    ORDER BY responded_at DESC
    LIMIT 50
  ),
  silent_list AS (
    SELECT id, name, phone, source, sent_at, template_label
    FROM base
    WHERE status = 'sent' AND responded_at IS NULL
    ORDER BY sent_at DESC
    LIMIT 50
  )
  SELECT jsonb_build_object(
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'byTemplate', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM by_template b), '[]'::jsonb),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb),
    'converted', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM converted_list c), '[]'::jsonb),
    'respondedNoConv', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM responded_no_conv r), '[]'::jsonb),
    'silent', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM silent_list s), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- =====================================================
-- CONVERSION TRIGGER on orders
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_campaign_conversion_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_variants TEXT[];
  v_customer_phone TEXT;
  v_phone_norm TEXT;
BEGIN
  -- Only on insert OR when status becomes delivered (we attribute on any new order)
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Resolve phone from customer
  IF NEW.customer_id IS NOT NULL THEN
    SELECT phone INTO v_customer_phone FROM public.customers WHERE id = NEW.customer_id;
  END IF;

  IF v_customer_phone IS NULL OR v_customer_phone = '' THEN
    RETURN NEW;
  END IF;

  v_phone_variants := public.phone_match_variants(v_customer_phone);
  v_phone_norm := public.normalize_phone_for_match(v_customer_phone);

  -- Update matching recipients (within attribution window, not yet converted)
  UPDATE public.crm_campaign_recipients r
  SET converted_at = COALESCE(r.converted_at, NEW.created_at),
      converted_order_id = COALESCE(r.converted_order_id, NEW.id),
      updated_at = now()
  FROM public.crm_campaigns c
  WHERE r.campaign_id = c.id
    AND r.converted_at IS NULL
    AND r.sent_at IS NOT NULL
    AND r.sent_at <= NEW.created_at
    AND NEW.created_at <= r.sent_at + (c.attribution_days || ' days')::interval
    AND (
      r.customer_id = NEW.customer_id
      OR r.phone_normalized = ANY(v_phone_variants)
      OR r.phone_normalized = v_phone_norm
    );

  -- Update template conversion counters
  UPDATE public.crm_campaign_templates t
  SET conversion_count = (
    SELECT COUNT(*) FROM public.crm_campaign_recipients
    WHERE template_id = t.id AND converted_at IS NOT NULL
  )
  WHERE t.id IN (
    SELECT DISTINCT template_id FROM public.crm_campaign_recipients
    WHERE converted_order_id = NEW.id AND template_id IS NOT NULL
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_campaign_conversion
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.mark_campaign_conversion_on_order();
