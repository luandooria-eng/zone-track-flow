
-- 1) Phone normalizer (digits only, strips country prefix variations)
CREATE OR REPLACE FUNCTION public.normalize_phone_for_match(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE regexp_replace(p, '[^0-9]', '', 'g')
  END;
$$;

-- 2) Helper: given a normalized digits string, return list of likely variants
--    BR phones: 55 + DDD(2) + 9? + number(8). We try with/without leading 55 and with/without the 9 digit.
CREATE OR REPLACE FUNCTION public.phone_match_variants(p text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text := public.normalize_phone_for_match(p);
  out text[] := ARRAY[]::text[];
  no55 text;
BEGIN
  IF digits IS NULL OR length(digits) < 8 THEN
    RETURN out;
  END IF;

  out := array_append(out, digits);

  -- Without country prefix 55
  IF left(digits, 2) = '55' AND length(digits) > 10 THEN
    no55 := substring(digits FROM 3);
    out := array_append(out, no55);
  ELSE
    no55 := digits;
  END IF;

  -- With country prefix 55
  IF left(digits, 2) <> '55' THEN
    out := array_append(out, '55' || digits);
  END IF;

  -- BR mobile: insert/remove the 9 after DDD
  -- Pattern with 55 + DDD(2) + rest
  IF length(no55) = 11 AND substring(no55 FROM 3 FOR 1) = '9' THEN
    -- has 9 → also try without 9
    out := array_append(out, substring(no55 FROM 1 FOR 2) || substring(no55 FROM 4));
    out := array_append(out, '55' || substring(no55 FROM 1 FOR 2) || substring(no55 FROM 4));
  ELSIF length(no55) = 10 THEN
    -- missing 9 → also try with 9
    out := array_append(out, substring(no55 FROM 1 FOR 2) || '9' || substring(no55 FROM 3));
    out := array_append(out, '55' || substring(no55 FROM 1 FOR 2) || '9' || substring(no55 FROM 3));
  END IF;

  RETURN ARRAY(SELECT DISTINCT unnest(out));
END;
$$;

-- 3) Link orphan WhatsApp conversations to a customer by phone
CREATE OR REPLACE FUNCTION public.link_whatsapp_conversations_to_customer(
  p_customer_id uuid,
  p_phone text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  variants text[];
  affected integer := 0;
BEGIN
  IF p_customer_id IS NULL OR p_phone IS NULL THEN
    RETURN 0;
  END IF;

  variants := public.phone_match_variants(p_phone);
  IF array_length(variants, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.whatsapp_conversations
  SET customer_id = p_customer_id,
      updated_at = now()
  WHERE customer_id IS NULL
    AND public.normalize_phone_for_match(phone) = ANY (variants);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4) Trigger function for customers table
CREATE OR REPLACE FUNCTION public.tg_customers_link_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    PERFORM public.link_whatsapp_conversations_to_customer(NEW.id, NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_link_whatsapp ON public.customers;
CREATE TRIGGER trg_customers_link_whatsapp
AFTER INSERT OR UPDATE OF phone ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.tg_customers_link_whatsapp();

-- 5) Trigger function for customer_phones table
CREATE OR REPLACE FUNCTION public.tg_customer_phones_link_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL AND NEW.phone_number <> '' THEN
    PERFORM public.link_whatsapp_conversations_to_customer(NEW.customer_id, NEW.phone_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_phones_link_whatsapp ON public.customer_phones;
CREATE TRIGGER trg_customer_phones_link_whatsapp
AFTER INSERT OR UPDATE OF phone_number ON public.customer_phones
FOR EACH ROW EXECUTE FUNCTION public.tg_customer_phones_link_whatsapp();

-- 6) Backfill: link all currently-orphan conversations
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, phone FROM public.customers WHERE phone IS NOT NULL AND phone <> ''
  LOOP
    PERFORM public.link_whatsapp_conversations_to_customer(rec.id, rec.phone);
  END LOOP;

  FOR rec IN
    SELECT customer_id AS id, phone_number AS phone FROM public.customer_phones WHERE phone_number IS NOT NULL AND phone_number <> ''
  LOOP
    PERFORM public.link_whatsapp_conversations_to_customer(rec.id, rec.phone);
  END LOOP;
END;
$$;
