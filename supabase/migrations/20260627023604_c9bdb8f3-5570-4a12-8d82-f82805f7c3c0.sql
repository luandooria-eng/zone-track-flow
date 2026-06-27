DROP POLICY IF EXISTS "auth read cart_recovery_logs" ON public.cart_recovery_logs;
DROP POLICY IF EXISTS "auth read cart_recovery_config" ON public.cart_recovery_config;

CREATE POLICY "auth read cart_recovery_logs" ON public.cart_recovery_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth read cart_recovery_config" ON public.cart_recovery_config
  FOR SELECT TO authenticated USING (true);