CREATE TABLE public.whatsapp_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shortcut TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quick replies"
  ON public.whatsapp_quick_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quick replies"
  ON public.whatsapp_quick_replies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update quick replies"
  ON public.whatsapp_quick_replies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete quick replies"
  ON public.whatsapp_quick_replies FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_whatsapp_quick_replies_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_whatsapp_quick_replies_shortcut ON public.whatsapp_quick_replies(shortcut);

INSERT INTO public.whatsapp_quick_replies (shortcut, title, body, sort_order) VALUES
  ('/obrigado', 'Agradecimento', 'Obrigado pelo contato! 🙏 Qualquer dúvida, é só chamar.', 1),
  ('/saudacao', 'Saudação', 'Olá! 👋 Tudo bem? Como podemos te ajudar hoje?', 2),
  ('/pix', 'Chave PIX', 'Segue nossa chave PIX para pagamento. Após o envio, nos mande o comprovante, por favor. 💚', 3),
  ('/horario', 'Horário de funcionamento', 'Nosso horário de atendimento é de Segunda a Sábado, das 7h às 19h.', 4);
