
-- ══════════════════════════════════════════════════
-- PHASE 2: Referral / Indication System
-- ══════════════════════════════════════════════════

CREATE TABLE public.loyalty_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.customers(id),
  referred_phone TEXT NOT NULL,
  referred_customer_id UUID REFERENCES public.customers(id),
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired, cancelled
  bonus_referrer INTEGER NOT NULL DEFAULT 0,
  bonus_referred INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_referrals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all referrals
CREATE POLICY "Authenticated can read loyalty_referrals"
  ON public.loyalty_referrals FOR SELECT
  USING (true);

-- Operators can manage referrals
CREATE POLICY "Operators can manage loyalty_referrals"
  ON public.loyalty_referrals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Anon can read referrals (for client portal)
CREATE POLICY "Anon can read loyalty_referrals"
  ON public.loyalty_referrals FOR SELECT
  USING (true);

-- Anon can insert referrals (client portal creates them)
CREATE POLICY "Anon can insert loyalty_referrals"
  ON public.loyalty_referrals FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_loyalty_referrals_referrer ON public.loyalty_referrals(referrer_id);
CREATE INDEX idx_loyalty_referrals_code ON public.loyalty_referrals(referral_code);
CREATE INDEX idx_loyalty_referrals_referred_phone ON public.loyalty_referrals(referred_phone);

-- Trigger for updated_at
CREATE TRIGGER update_loyalty_referrals_updated_at
  BEFORE UPDATE ON public.loyalty_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
