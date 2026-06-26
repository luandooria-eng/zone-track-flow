
-- 1) Rules table: one row per product type (water/gas)
CREATE TABLE public.auto_reactivation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL UNIQUE CHECK (product_type IN ('water','gas')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  message_template TEXT NOT NULL,
  followup_message_template TEXT,
  tolerance_days INTEGER NOT NULL DEFAULT 1 CHECK (tolerance_days >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts >= 1 AND max_attempts <= 10),
  followup_interval_days INTEGER NOT NULL DEFAULT 5 CHECK (followup_interval_days >= 1),
  min_avg_days INTEGER NOT NULL DEFAULT 5,
  max_avg_days INTEGER NOT NULL DEFAULT 90,
  send_window_start TIME NOT NULL DEFAULT '09:00',
  send_window_end TIME NOT NULL DEFAULT '19:00',
  rate_limit_per_run INTEGER NOT NULL DEFAULT 30 CHECK (rate_limit_per_run >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_reactivation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view rules" ON public.auto_reactivation_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rules" ON public.auto_reactivation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_auto_reactivation_rules_updated
  BEFORE UPDATE ON public.auto_reactivation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rules
INSERT INTO public.auto_reactivation_rules (product_type, message_template, followup_message_template) VALUES
('water',
  'Oi {{primeiro_nome}}! 👋 Notamos que sua água deve estar acabando. Quer que a gente já separe sua próxima? 💧',
  'Olá {{primeiro_nome}}, passando aqui de novo! Posso já agendar sua entrega de água? 💧'),
('gas',
  'Oi {{primeiro_nome}}! 🔥 Pelo seu histórico, seu botijão deve estar próximo do fim. Posso já agendar a troca?',
  'Olá {{primeiro_nome}}, ainda quer agendar a troca do botijão? 🔥');

-- 2) Cycles table: one row per (customer, product_type)
CREATE TABLE public.auto_reactivation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('water','gas')),
  cycle_anchor_at TIMESTAMPTZ NOT NULL, -- last delivered order of this product type
  avg_days_at_cycle INTEGER, -- avg_days frozen for this cycle
  next_due_at TIMESTAMPTZ NOT NULL, -- when next message should be sent
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  last_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','sent','completed','exhausted','paused')),
  responded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  converted_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_type)
);

CREATE INDEX idx_arc_due ON public.auto_reactivation_cycles (status, next_due_at) WHERE status IN ('waiting','sent');
CREATE INDEX idx_arc_customer ON public.auto_reactivation_cycles (customer_id);

ALTER TABLE public.auto_reactivation_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view cycles" ON public.auto_reactivation_cycles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cycles" ON public.auto_reactivation_cycles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_arc_updated
  BEFORE UPDATE ON public.auto_reactivation_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Log/history table
CREATE TABLE public.auto_reactivation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES public.auto_reactivation_cycles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  phone TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_id TEXT,
  conversation_id UUID,
  status TEXT NOT NULL CHECK (status IN ('sent','failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_arl_customer ON public.auto_reactivation_log (customer_id, sent_at DESC);
CREATE INDEX idx_arl_cycle ON public.auto_reactivation_log (cycle_id);

ALTER TABLE public.auto_reactivation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view log" ON public.auto_reactivation_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service writes log" ON public.auto_reactivation_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4) Trigger on orders: when a delivered order arrives, close current cycle for the product type(s) involved
CREATE OR REPLACE FUNCTION public.close_reactivation_cycle_on_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_water BOOLEAN := false;
  v_has_gas BOOLEAN := false;
  v_item RECORD;
  v_name TEXT;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.status::text <> 'delivered' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- detect product types in this order via simple name heuristic
  FOR v_item IN
    SELECT lower(p.name) AS pname
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    v_name := v_item.pname;
    IF v_name ~ '(agua|água|indai|sao crist|cristov|20l|10l|galão|galao)' THEN
      v_has_water := true;
    END IF;
    IF v_name ~ '(gas|gás|botij|13kg|p13|glp)' THEN
      v_has_gas := true;
    END IF;
  END LOOP;

  IF v_has_water THEN
    UPDATE public.auto_reactivation_cycles
    SET status = 'completed',
        converted_at = COALESCE(converted_at, NEW.created_at),
        converted_order_id = COALESCE(converted_order_id, NEW.id),
        updated_at = now()
    WHERE customer_id = NEW.customer_id
      AND product_type = 'water'
      AND status IN ('waiting','sent');
  END IF;

  IF v_has_gas THEN
    UPDATE public.auto_reactivation_cycles
    SET status = 'completed',
        converted_at = COALESCE(converted_at, NEW.created_at),
        converted_order_id = COALESCE(converted_order_id, NEW.id),
        updated_at = now()
    WHERE customer_id = NEW.customer_id
      AND product_type = 'gas'
      AND status IN ('waiting','sent');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_close_reactivation_on_delivery
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.close_reactivation_cycle_on_delivery();

-- 5) Trigger on inbound whatsapp messages: mark cycle responded
CREATE OR REPLACE FUNCTION public.mark_reactivation_response_on_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_phone TEXT;
  v_variants TEXT[];
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  SELECT phone INTO v_phone FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN NEW; END IF;
  v_variants := public.phone_match_variants(v_phone);

  UPDATE public.auto_reactivation_cycles arc
  SET responded_at = COALESCE(arc.responded_at, NEW.created_at), updated_at = now()
  FROM public.customers c
  WHERE arc.customer_id = c.id
    AND arc.status = 'sent'
    AND arc.responded_at IS NULL
    AND public.normalize_phone_for_match(c.phone) = ANY(v_variants);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_reactivation_response
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.mark_reactivation_response_on_inbound();
