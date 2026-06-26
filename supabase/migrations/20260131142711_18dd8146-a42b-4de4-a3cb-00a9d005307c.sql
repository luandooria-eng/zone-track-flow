-- ========================================
-- FASE 3: RESTRINGIR POLÍTICAS RLS PERMISSIVAS
-- ========================================

-- 3.1 Políticas para order_items - restringir INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Authenticated can update order_items" ON order_items;

CREATE POLICY "Operators can insert order_items" ON order_items
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update order_items" ON order_items
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.2 Políticas para orders - restringir INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated can insert orders" ON orders;
DROP POLICY IF EXISTS "Authenticated can update orders" ON orders;

CREATE POLICY "Operators can insert orders" ON orders
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update orders" ON orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.3 Políticas para customers - restringir INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated can update customers" ON customers;

CREATE POLICY "Operators can insert customers" ON customers
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update customers" ON customers
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.4 Políticas para stock_movements
DROP POLICY IF EXISTS "Authenticated can insert stock_movements" ON stock_movements;

CREATE POLICY "Operators can insert stock_movements" ON stock_movements
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.5 Políticas para credit_entries
DROP POLICY IF EXISTS "Authenticated can insert credit_entries" ON credit_entries;
DROP POLICY IF EXISTS "Authenticated can update credit_entries" ON credit_entries;

CREATE POLICY "Operators can insert credit_entries" ON credit_entries
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator') OR
  has_role(auth.uid(), 'finance')
);

CREATE POLICY "Operators can update credit_entries" ON credit_entries
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator') OR
  has_role(auth.uid(), 'finance')
);

-- 3.6 Políticas para daily_sales_summary - apenas admins/managers podem gerenciar
DROP POLICY IF EXISTS "Authenticated can manage daily_sales_summary" ON daily_sales_summary;

CREATE POLICY "Admins can manage daily_sales_summary" ON daily_sales_summary
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

-- 3.7 Políticas para container_movements
DROP POLICY IF EXISTS "Authenticated can insert container_movements" ON container_movements;

CREATE POLICY "Operators can insert container_movements" ON container_movements
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.8 Políticas para addresses
DROP POLICY IF EXISTS "Authenticated can insert addresses" ON addresses;
DROP POLICY IF EXISTS "Authenticated can update addresses" ON addresses;

CREATE POLICY "Operators can insert addresses" ON addresses
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update addresses" ON addresses
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.9 Políticas para customer_addresses
DROP POLICY IF EXISTS "Authenticated can insert customer_addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Authenticated can update customer_addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Authenticated can delete customer_addresses" ON customer_addresses;

CREATE POLICY "Operators can insert customer_addresses" ON customer_addresses
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update customer_addresses" ON customer_addresses
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can delete customer_addresses" ON customer_addresses
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.10 Políticas para customer_phones
DROP POLICY IF EXISTS "Authenticated can insert customer_phones" ON customer_phones;
DROP POLICY IF EXISTS "Authenticated can update customer_phones" ON customer_phones;
DROP POLICY IF EXISTS "Authenticated can delete customer_phones" ON customer_phones;

CREATE POLICY "Operators can insert customer_phones" ON customer_phones
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update customer_phones" ON customer_phones
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can delete customer_phones" ON customer_phones
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.11 Políticas para streets_index
DROP POLICY IF EXISTS "Authenticated can insert streets_index" ON streets_index;
DROP POLICY IF EXISTS "Authenticated can update streets_index" ON streets_index;

CREATE POLICY "Operators can insert streets_index" ON streets_index
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update streets_index" ON streets_index
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.12 Políticas para customer_tag_assignments
DROP POLICY IF EXISTS "Authenticated can manage customer_tag_assignments" ON customer_tag_assignments;

CREATE POLICY "Operators can manage customer_tag_assignments" ON customer_tag_assignments
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

-- 3.13 Políticas para customer_product_agg e customer_payment_agg
DROP POLICY IF EXISTS "System can manage customer_product_agg" ON customer_product_agg;
DROP POLICY IF EXISTS "System can manage customer_payment_agg" ON customer_payment_agg;
DROP POLICY IF EXISTS "System can manage container_balances" ON container_balances;

CREATE POLICY "System can manage customer_product_agg" ON customer_product_agg
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "System can manage customer_payment_agg" ON customer_payment_agg
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "System can manage container_balances" ON container_balances
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

-- 3.14 Políticas para audit_logs (somente insert por sistema)
DROP POLICY IF EXISTS "System can insert audit_logs" ON audit_logs;

CREATE POLICY "System can insert audit_logs" ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);