-- Templates de mensagens automáticas (WhatsApp pós-venda)
CREATE TABLE public.whatsapp_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  body TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON public.whatsapp_message_templates FOR SELECT
  USING (public.is_authenticated());

CREATE POLICY "Admins can insert templates"
  ON public.whatsapp_message_templates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update templates"
  ON public.whatsapp_message_templates FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete templates"
  ON public.whatsapp_message_templates FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_whatsapp_message_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Garante apenas 1 template padrão
CREATE OR REPLACE FUNCTION public.ensure_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.whatsapp_message_templates
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_ensure_single_default_template
  BEFORE INSERT OR UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_template();

-- Seed template padrão
INSERT INTO public.whatsapp_message_templates (name, description, body, is_default, sort_order) VALUES
  ('Confirmação padrão', 'Mensagem enviada após confirmar a venda',
$msg$✅ Pedido confirmado!

Olá {{cliente}}, recebemos seu pedido:
📦 {{quantidade}}x {{produto}}
💰 Total: {{total}}
💳 Pagamento: {{pagamento}}

Obrigado pela preferência!$msg$, true, 0),
  ('Pagamento pendente', 'Reforço para Crediário/Pix pendente',
$msg$⏰ Olá {{cliente}}!

Seu pedido foi registrado:
📦 {{quantidade}}x {{produto}}
💰 Total: {{total}}
💳 {{pagamento}} — Vencimento: {{vencimento}}

Aguardamos a confirmação do pagamento. Obrigado!$msg$, false, 1);