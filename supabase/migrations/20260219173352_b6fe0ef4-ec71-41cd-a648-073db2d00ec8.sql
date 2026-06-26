
-- Table to track link sends by operators
CREATE TABLE public.portal_link_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  operator_id uuid NOT NULL,
  send_method text NOT NULL DEFAULT 'copy', -- 'copy', 'whatsapp', 'sms'
  token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_link_sends ENABLE ROW LEVEL SECURITY;

-- Only authenticated operators can manage
CREATE POLICY "Authenticated can read portal_link_sends"
ON public.portal_link_sends FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operators can insert portal_link_sends"
ON public.portal_link_sends FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

-- Index for operator metrics
CREATE INDEX idx_portal_link_sends_operator ON public.portal_link_sends (operator_id, created_at DESC);
CREATE INDEX idx_portal_link_sends_customer ON public.portal_link_sends (customer_id);
