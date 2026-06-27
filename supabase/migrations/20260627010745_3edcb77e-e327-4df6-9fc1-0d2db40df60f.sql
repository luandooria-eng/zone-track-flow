
-- cart_recovery_config
CREATE TABLE public.cart_recovery_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  test_mode boolean NOT NULL DEFAULT false,
  webhook_secret text,
  message_template text NOT NULL DEFAULT 'Olá {nome}! 👋 Vimos que você deixou alguns itens no carrinho:\n{produtos}\n\nQuer finalizar a compra? {link}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_recovery_config TO authenticated;
GRANT ALL ON public.cart_recovery_config TO service_role;

ALTER TABLE public.cart_recovery_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cart recovery config"
  ON public.cart_recovery_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_cart_recovery_config_updated_at
  BEFORE UPDATE ON public.cart_recovery_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cart_recovery_logs
CREATE TABLE public.cart_recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id text,
  customer_name text,
  phone text,
  email text,
  cart_link text,
  products jsonb,
  message_sent text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cart_recovery_logs_cart_id ON public.cart_recovery_logs (cart_id);
CREATE INDEX idx_cart_recovery_logs_created_at ON public.cart_recovery_logs (created_at DESC);

GRANT SELECT ON public.cart_recovery_logs TO authenticated;
GRANT ALL ON public.cart_recovery_logs TO service_role;

ALTER TABLE public.cart_recovery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view cart recovery logs"
  ON public.cart_recovery_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed default config row
INSERT INTO public.cart_recovery_config (id, active, test_mode)
VALUES ('00000000-0000-0000-0000-000000000098', true, true)
ON CONFLICT (id) DO NOTHING;
