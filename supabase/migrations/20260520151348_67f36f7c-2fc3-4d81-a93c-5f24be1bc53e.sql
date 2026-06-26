
CREATE OR REPLACE FUNCTION public.mark_campaign_response_on_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_variants TEXT[];
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;

  SELECT phone INTO v_phone FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF v_phone IS NULL OR v_phone = '' THEN RETURN NEW; END IF;

  v_variants := public.phone_match_variants(v_phone);

  UPDATE public.crm_campaign_recipients r
  SET responded_at = COALESCE(r.responded_at, NEW.created_at), updated_at = now()
  WHERE r.responded_at IS NULL
    AND r.sent_at IS NOT NULL
    AND NEW.created_at > r.sent_at
    AND r.phone_normalized = ANY(v_variants);

  -- update template response counts
  UPDATE public.crm_campaign_templates t
  SET response_count = (
    SELECT COUNT(*) FROM public.crm_campaign_recipients
    WHERE template_id = t.id AND responded_at IS NOT NULL
  )
  WHERE t.id IN (
    SELECT DISTINCT template_id FROM public.crm_campaign_recipients
    WHERE phone_normalized = ANY(v_variants) AND template_id IS NOT NULL
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_campaign_response
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.mark_campaign_response_on_inbound();
