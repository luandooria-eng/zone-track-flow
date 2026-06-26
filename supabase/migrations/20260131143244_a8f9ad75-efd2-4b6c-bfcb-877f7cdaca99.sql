-- Corrigir as 2 políticas RLS restantes

-- 1. customer_alerts
DROP POLICY IF EXISTS "Authenticated can manage customer_alerts" ON customer_alerts;
CREATE POLICY "Operators can manage customer_alerts" ON customer_alerts
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 2. customer_monthly_consumption
DROP POLICY IF EXISTS "System can manage customer_monthly_consumption" ON customer_monthly_consumption;
CREATE POLICY "Admins can manage customer_monthly_consumption" ON customer_monthly_consumption
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);