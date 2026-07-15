
-- (guarded: loyalty_coupons is created outside tracked migrations on some
-- environments; skip cleanly where it doesn't exist yet)
DO $$ BEGIN
  IF to_regclass('public.loyalty_coupons') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.loyalty_coupons
    ADD COLUMN IF NOT EXISTS whatsapp_phone text,
    ADD COLUMN IF NOT EXISTS whatsapp_message text DEFAULT ''Olá! Resgatei o cupom *{codigo}* do programa de fidelidade. Gostaria de utilizar meu voucher!''';
  END IF;
END $$;
