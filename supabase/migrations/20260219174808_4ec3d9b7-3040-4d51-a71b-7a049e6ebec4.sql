-- Add password hash column to customers for portal auth
ALTER TABLE public.customers ADD COLUMN portal_password_hash text;

-- We can drop the portal_otp_codes table since OTP is no longer used
-- But let's keep it for now in case there are references
-- Just add a comment
COMMENT ON TABLE public.portal_otp_codes IS 'Legacy OTP table - no longer used after password-based auth migration';