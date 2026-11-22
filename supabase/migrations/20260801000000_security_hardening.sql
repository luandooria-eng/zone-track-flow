-- Security hardening
--  1) Remove permissive `anon` access (customers / loyalty_*), portal now uses edge functions.
--  2) Policies without a role list apply to PUBLIC (incl. anon): pin the permissive ones to `authenticated`.
--  3) whatsapp_config holds provider secrets: admin-only; non-secret status exposed via a view.

-- ---------------------------------------------------------------------------
-- 1) Drop anon policies created for the legacy browser-side loyalty portal
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anon select customers"        ON public.customers;
DROP POLICY IF EXISTS "Allow anon update customer balance" ON public.customers;

DO $$ BEGIN
  IF to_regclass('public.loyalty_vouchers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon insert vouchers" ON public.loyalty_vouchers';
  END IF;
  IF to_regclass('public.loyalty_ledger') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon insert ledger" ON public.loyalty_ledger';
  END IF;
  IF to_regclass('public.loyalty_coupons') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon select coupons" ON public.loyalty_coupons';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon update coupon stock" ON public.loyalty_coupons';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Permissive policies (USING/WITH CHECK true) that target PUBLIC -> authenticated only
--    (service_role bypasses RLS and is unaffected)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = '{public}'
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated',
                   pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) whatsapp_config: admin-only (tokens, app secret, webhook token)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "whatsapp_config_rw" ON public.whatsapp_config;
DROP POLICY IF EXISTS "whatsapp_config_admin_all" ON public.whatsapp_config;

CREATE POLICY "whatsapp_config_admin_all" ON public.whatsapp_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.whatsapp_config FROM anon;

-- Non-secret view for the inbox (any authenticated operator). Runs with the owner's rights
-- on purpose (security_invoker off) so operators see status without reading secrets.
CREATE OR REPLACE VIEW public.whatsapp_config_public
WITH (security_invoker = off) AS
SELECT
  id,
  provider,
  status,
  phone,
  meta_api_version,
  (instance_id IS NOT NULL AND instance_id <> '' AND token IS NOT NULL AND token <> '') AS zapi_configured,
  (meta_phone_number_id IS NOT NULL AND meta_phone_number_id <> ''
     AND meta_access_token IS NOT NULL AND meta_access_token <> '') AS meta_configured
FROM public.whatsapp_config;

REVOKE ALL ON public.whatsapp_config_public FROM anon, public;
GRANT SELECT ON public.whatsapp_config_public TO authenticated;
