-- ========================================
-- FASE 2: CORRIGIR TRIGGERS
-- ========================================

-- 2.1 Trigger robusto para atualizar daily_sales_summary
CREATE OR REPLACE FUNCTION update_daily_sales_summary()
RETURNS TRIGGER AS $$
DECLARE
  order_date DATE;
BEGIN
  -- Determinar a data do pedido
  IF TG_OP = 'DELETE' THEN
    order_date := DATE(OLD.created_at AT TIME ZONE 'America/Sao_Paulo');
  ELSE
    order_date := DATE(NEW.created_at AT TIME ZONE 'America/Sao_Paulo');
  END IF;
  
  -- Recalcular resumo do dia
  INSERT INTO daily_sales_summary (date, total_orders, total_revenue, delivered_orders, cancelled_orders, avg_ticket)
  SELECT 
    order_date,
    COUNT(*),
    COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'delivered' THEN 1 END),
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END),
    COALESCE(AVG(CASE WHEN status = 'delivered' THEN total END), 0)
  FROM orders
  WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = order_date
  ON CONFLICT (date) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    delivered_orders = EXCLUDED.delivered_orders,
    cancelled_orders = EXCLUDED.cancelled_orders,
    avg_ticket = EXCLUDED.avg_ticket,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_update_daily_sales_summary ON orders;
CREATE TRIGGER trigger_update_daily_sales_summary
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION update_daily_sales_summary();

-- 2.2 Atualizar trigger existente para criar finance_transaction quando pedido é entregue
-- Corrigir para usar 'sales' ao invés de 'orders' e 'IN' ao invés de 'income'
CREATE OR REPLACE FUNCTION create_finance_transaction_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  is_credit_payment BOOLEAN;
BEGIN
  -- Only process when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Check if payment method is credit (Crediário)
    SELECT is_credit INTO is_credit_payment
    FROM public.payment_methods
    WHERE id = NEW.payment_method_id;
    
    -- If NOT credit payment, create finance transaction IN
    IF is_credit_payment IS NOT TRUE AND NEW.paid_at IS NOT NULL THEN
      -- Verificar se já existe
      IF NOT EXISTS (
        SELECT 1 FROM finance_transactions 
        WHERE source_id = NEW.id AND source_module = 'sales'
      ) THEN
        INSERT INTO public.finance_transactions (
          type, amount, transaction_date, payment_method_id, 
          description, source_module, source_id, created_by
        ) VALUES (
          'IN', NEW.total, COALESCE(NEW.paid_at, now()), NEW.payment_method_id,
          'Venda #' || NEW.order_number, 'sales', NEW.id, NEW.created_by
        );
      END IF;
    END IF;
  END IF;
  
  -- Se foi cancelado, remover transaction
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    DELETE FROM finance_transactions 
    WHERE source_id = NEW.id AND source_module = 'sales';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_finance_transaction ON orders;
CREATE TRIGGER trigger_create_finance_transaction
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION create_finance_transaction_on_delivery();

-- 2.3 Trigger aprimorado para atualizar customer stats (substitui o existente)
CREATE OR REPLACE FUNCTION update_customer_stats_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- On status change to delivered, recalculate all stats
  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE customers SET
      total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      total_spent = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered')
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On new order, update last_order_at
  IF TG_OP = 'INSERT' THEN
    UPDATE public.customers
    SET last_order_at = GREATEST(COALESCE(last_order_at, '1970-01-01'::timestamptz), NEW.created_at)
    WHERE id = NEW.customer_id;
  END IF;
  
  -- Se foi cancelado, recalcular
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND NEW.customer_id IS NOT NULL AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE customers SET
      total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      total_spent = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered')
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_customer_stats_on_order ON orders;
CREATE TRIGGER trigger_update_customer_stats_on_order
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_customer_stats_on_order();