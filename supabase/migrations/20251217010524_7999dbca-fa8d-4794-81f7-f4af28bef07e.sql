-- Recalculate customer stats from existing orders
-- Update total_orders count
UPDATE customers c
SET total_orders = COALESCE(
  (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'),
  0
);

-- Update total_spent from delivered orders
UPDATE customers c
SET total_spent = COALESCE(
  (SELECT SUM(o.total) FROM orders o WHERE o.customer_id = c.id AND o.status = 'delivered'),
  0
);

-- Update last_order_at
UPDATE customers c
SET last_order_at = (
  SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'
);

-- Rebuild customer_product_agg from historical data
TRUNCATE customer_product_agg;
INSERT INTO customer_product_agg (customer_id, product_id, qty_total, amount_total)
SELECT 
  o.customer_id,
  oi.product_id,
  SUM(oi.quantity) as qty_total,
  SUM(oi.total_price) as amount_total
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE o.customer_id IS NOT NULL AND o.status != 'cancelled'
GROUP BY o.customer_id, oi.product_id;

-- Update top_product_id for each customer
UPDATE customers c
SET top_product_id = (
  SELECT product_id 
  FROM customer_product_agg 
  WHERE customer_id = c.id 
  ORDER BY qty_total DESC 
  LIMIT 1
);

-- Rebuild customer_payment_agg from historical data
TRUNCATE customer_payment_agg;
INSERT INTO customer_payment_agg (customer_id, payment_method_id, count_total, amount_total)
SELECT 
  customer_id,
  payment_method_id,
  COUNT(*) as count_total,
  SUM(total) as amount_total
FROM orders
WHERE customer_id IS NOT NULL AND payment_method_id IS NOT NULL AND status != 'cancelled'
GROUP BY customer_id, payment_method_id;

-- Update top_payment_method_id for each customer
UPDATE customers c
SET top_payment_method_id = (
  SELECT payment_method_id 
  FROM customer_payment_agg 
  WHERE customer_id = c.id 
  ORDER BY count_total DESC 
  LIMIT 1
);