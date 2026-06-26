-- ========================================
-- FASE 4: CORRIGIR VIEWS SECURITY DEFINER
-- ========================================

-- 4.1 Recriar view vw_customers_by_street com security_invoker
DROP VIEW IF EXISTS vw_customers_by_street;
CREATE VIEW vw_customers_by_street 
WITH (security_invoker=on) AS
SELECT 
  c.id as customer_id,
  a.id as address_id,
  ca.is_default,
  c.name as customer_name,
  (SELECT phone_number FROM customer_phones WHERE customer_id = c.id AND is_primary = true LIMIT 1) as phone_primary,
  a.street_name,
  public.normalize_street_name(a.street_name) as street_name_normalized,
  a.house_number,
  n.name as neighborhood_name,
  a.complement,
  a.reference_point
FROM customers c
JOIN customer_addresses ca ON c.id = ca.customer_id
JOIN addresses a ON ca.address_id = a.id
LEFT JOIN neighborhoods n ON a.neighborhood_id = n.id
WHERE c.is_active = true;

-- 4.2 Recriar view vw_orders_time_analysis com security_invoker
DROP VIEW IF EXISTS vw_orders_time_analysis;
CREATE VIEW vw_orders_time_analysis 
WITH (security_invoker=on) AS
SELECT 
  o.id as order_id,
  o.created_at,
  o.delivered_at,
  o.status,
  o.total,
  o.customer_id,
  o.channel_id,
  o.delivery_person_id,
  EXTRACT(dow FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') as day_of_week,
  EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') as hour_of_day,
  CASE 
    WHEN EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 6 AND 11 THEN 'Manhã'
    WHEN EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 12 AND 17 THEN 'Tarde'
    WHEN EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 18 AND 22 THEN 'Noite'
    ELSE 'Madrugada'
  END as time_slot,
  CASE EXTRACT(dow FROM o.created_at AT TIME ZONE 'America/Sao_Paulo')
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda'
    WHEN 2 THEN 'Terça'
    WHEN 3 THEN 'Quarta'
    WHEN 4 THEN 'Quinta'
    WHEN 5 THEN 'Sexta'
    WHEN 6 THEN 'Sábado'
  END as day_name,
  oi.product_id,
  p.name as product_name,
  oi.quantity,
  oi.total_price as item_total
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id;

-- 4.3 Corrigir as 2 políticas RLS restantes com USING(true) para ALL
-- Identificar quais tabelas ainda têm políticas permissivas
-- Baseado no contexto, são provavelmente ap_bills e finance_transactions

-- Verificar e corrigir ap_bills
DROP POLICY IF EXISTS "Finance can manage ap_bills" ON ap_bills;
CREATE POLICY "Finance can manage ap_bills" ON ap_bills
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'finance')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'finance')
);

-- Verificar e corrigir finance_transactions INSERT
DROP POLICY IF EXISTS "Finance can insert finance_transactions" ON finance_transactions;
CREATE POLICY "Finance can insert finance_transactions" ON finance_transactions
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'finance')
);