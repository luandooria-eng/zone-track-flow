
-- Table for OTP codes (simulated, no SMS provider yet)
CREATE TABLE public.portal_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for phone lookups and cleanup
CREATE INDEX idx_portal_otp_phone ON public.portal_otp_codes (phone, created_at DESC);
CREATE INDEX idx_portal_otp_expires ON public.portal_otp_codes (expires_at) WHERE verified = false;

-- Enable RLS
ALTER TABLE public.portal_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) can manage OTP codes - no direct client access
CREATE POLICY "No direct access to otp_codes"
ON public.portal_otp_codes
FOR ALL
TO anon, authenticated
USING (false);

-- Add unique index on customer phone for E.164 normalization
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique 
ON public.customers (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- Update loyalty_client_tokens to add expiration
-- (guarded: this table is created outside tracked migrations on some
-- environments; skip cleanly where it doesn't exist yet)
DO $$ BEGIN
  IF to_regclass('public.loyalty_client_tokens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.loyalty_client_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval ''30 days'')';
  END IF;
END $$;
