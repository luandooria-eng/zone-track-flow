
-- 1. Tag → Stage mapping table
CREATE TABLE IF NOT EXISTS public.crm_tag_stage_mapping (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_name text NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.crm_funnel_stages(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'both' CHECK (source IN ('customer','lead','both')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_name, source)
);

ALTER TABLE public.crm_tag_stage_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users select crm_tag_stage_mapping"
  ON public.crm_tag_stage_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users insert crm_tag_stage_mapping"
  ON public.crm_tag_stage_mapping FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth users update crm_tag_stage_mapping"
  ON public.crm_tag_stage_mapping FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth users delete crm_tag_stage_mapping"
  ON public.crm_tag_stage_mapping FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_crm_tag_stage_mapping_updated
  BEFORE UPDATE ON public.crm_tag_stage_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Function: when a customer_tag is assigned, move/create lead to mapped stage
CREATE OR REPLACE FUNCTION public.crm_apply_tag_mapping_on_customer_tag()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tag_name text;
  v_stage_id uuid;
  v_customer record;
  v_lead_id uuid;
BEGIN
  SELECT name INTO v_tag_name FROM public.customer_tags WHERE id = NEW.tag_id;
  IF v_tag_name IS NULL THEN RETURN NEW; END IF;

  SELECT stage_id INTO v_stage_id
  FROM public.crm_tag_stage_mapping
  WHERE LOWER(tag_name) = LOWER(v_tag_name)
    AND source IN ('customer','both')
    AND is_active = true
  LIMIT 1;

  IF v_stage_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, name, phone INTO v_customer FROM public.customers WHERE id = NEW.customer_id;
  IF v_customer.id IS NULL THEN RETURN NEW; END IF;

  -- find existing lead for this customer
  SELECT id INTO v_lead_id FROM public.crm_leads WHERE customer_id = v_customer.id LIMIT 1;

  IF v_lead_id IS NULL THEN
    -- create a new lead at the mapped stage
    INSERT INTO public.crm_leads (name, phone, stage_id, customer_id, source, notes)
    VALUES (v_customer.name, v_customer.phone, v_stage_id, v_customer.id, 'tag_auto',
            'Criado automaticamente pela tag "' || v_tag_name || '"')
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.crm_leads
    SET stage_id = v_stage_id, updated_at = now()
    WHERE id = v_lead_id AND stage_id IS DISTINCT FROM v_stage_id;
  END IF;

  -- mirror tag onto lead (idempotent)
  INSERT INTO public.crm_lead_tags (lead_id, tag) VALUES (v_lead_id, v_tag_name)
  ON CONFLICT (lead_id, tag) DO NOTHING;

  -- log activity
  INSERT INTO public.crm_activities (lead_id, type, content, metadata)
  VALUES (v_lead_id, 'trigger_fired',
          'Tag "' || v_tag_name || '" aplicada no cliente — movido para funil mapeado',
          jsonb_build_object('tag', v_tag_name, 'stage_id', v_stage_id, 'origin', 'customer_tag'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_tag_mapping_customer ON public.customer_tag_assignments;
CREATE TRIGGER trg_crm_tag_mapping_customer
  AFTER INSERT ON public.customer_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION public.crm_apply_tag_mapping_on_customer_tag();

-- 3. Function: when a lead tag is added directly, move lead to mapped stage
CREATE OR REPLACE FUNCTION public.crm_apply_tag_mapping_on_lead_tag()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stage_id uuid;
BEGIN
  SELECT stage_id INTO v_stage_id
  FROM public.crm_tag_stage_mapping
  WHERE LOWER(tag_name) = LOWER(NEW.tag)
    AND source IN ('lead','both')
    AND is_active = true
  LIMIT 1;

  IF v_stage_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.crm_leads
  SET stage_id = v_stage_id, updated_at = now()
  WHERE id = NEW.lead_id AND stage_id IS DISTINCT FROM v_stage_id;

  INSERT INTO public.crm_activities (lead_id, type, content, metadata)
  VALUES (NEW.lead_id, 'trigger_fired',
          'Tag "' || NEW.tag || '" aplicada no lead — movido para funil mapeado',
          jsonb_build_object('tag', NEW.tag, 'stage_id', v_stage_id, 'origin', 'lead_tag'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_tag_mapping_lead ON public.crm_lead_tags;
CREATE TRIGGER trg_crm_tag_mapping_lead
  AFTER INSERT ON public.crm_lead_tags
  FOR EACH ROW EXECUTE FUNCTION public.crm_apply_tag_mapping_on_lead_tag();

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_tag_stage_mapping;
