-- ========================================
-- FASE 1: CORREÇÃO DE DADOS HISTÓRICOS
-- ========================================

-- 1.1 Criar cliente genérico "Consumidor Avulso" para pedidos órfãos
INSERT INTO customers (name, notes, is_active)
VALUES ('Consumidor Avulso', 'Cliente genérico para pedidos históricos sem identificação de cliente', true)
ON CONFLICT DO NOTHING;

-- 1.2 Corrigir estoque negativo
UPDATE products SET current_stock = 0 WHERE current_stock < 0;

-- 1.3 Vincular pedidos sem customer_id ao cliente genérico
UPDATE orders 
SET customer_id = (SELECT id FROM customers WHERE name = 'Consumidor Avulso' LIMIT 1)
WHERE customer_id IS NULL;

-- 1.4 Recalcular daily_sales_summary completo
DELETE FROM daily_sales_summary WHERE date >= '2026-01-01';

INSERT INTO daily_sales_summary (date, total_orders, total_revenue, delivered_orders, cancelled_orders, avg_ticket)
SELECT 
  DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as date,
  COUNT(*) as total_orders,
  COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) as total_revenue,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
  COALESCE(AVG(CASE WHEN status = 'delivered' THEN total END), 0) as avg_ticket
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY DATE(created_at AT TIME ZONE 'America/Sao_Paulo');

-- 1.5 Recalcular estatísticas de clientes (total_orders e total_spent)
UPDATE customers c SET
  total_orders = COALESCE(sub.cnt, 0),
  total_spent = COALESCE(sub.spent, 0),
  last_order_at = sub.last_order
FROM (
  SELECT 
    customer_id, 
    COUNT(*) as cnt, 
    SUM(total) as spent,
    MAX(created_at) as last_order
  FROM orders 
  WHERE status = 'delivered'
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;

-- 1.6 Criar finance_transactions para pedidos delivered que não têm
-- Usando source_module = 'sales' e type = 'IN' conforme constraint
INSERT INTO finance_transactions (type, amount, transaction_date, source_module, source_id, payment_method_id, description)
SELECT 
  'IN' as type,
  o.total as amount,
  COALESCE(o.delivered_at, o.created_at) as transaction_date,
  'sales' as source_module,
  o.id as source_id,
  o.payment_method_id,
  'Venda #' || o.order_number as description
FROM orders o
WHERE o.status = 'delivered'
  AND NOT EXISTS (
    SELECT 1 FROM finance_transactions ft 
    WHERE ft.source_id = o.id AND ft.source_module = 'sales'
  );