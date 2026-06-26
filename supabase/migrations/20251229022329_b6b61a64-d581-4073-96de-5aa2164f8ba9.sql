-- Create view for orders time analysis
CREATE OR REPLACE VIEW public.vw_orders_time_analysis AS
SELECT 
  o.id AS order_id,
  o.created_at,
  o.delivered_at,
  o.status,
  o.total,
  o.customer_id,
  o.channel_id,
  o.delivery_person_id,
  
  -- Time extraction (use delivered_at for delivered orders, created_at for others)
  EXTRACT(DOW FROM COALESCE(o.delivered_at, o.created_at)) AS day_of_week,
  EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) AS hour_of_day,
  
  -- Time slot (2-hour blocks)
  CASE 
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 6 AND 7 THEN '06-08'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 8 AND 9 THEN '08-10'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 10 AND 11 THEN '10-12'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 12 AND 13 THEN '12-14'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 14 AND 15 THEN '14-16'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 16 AND 17 THEN '16-18'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 18 AND 19 THEN '18-20'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 20 AND 21 THEN '20-22'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) >= 22 OR EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) < 6 THEN '22-06'
    ELSE 'other'
  END AS time_slot,
  
  -- Day name in Portuguese
  CASE EXTRACT(DOW FROM COALESCE(o.delivered_at, o.created_at))
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda'
    WHEN 2 THEN 'Terça'
    WHEN 3 THEN 'Quarta'
    WHEN 4 THEN 'Quinta'
    WHEN 5 THEN 'Sexta'
    WHEN 6 THEN 'Sábado'
  END AS day_name,
  
  -- Order items details
  oi.product_id,
  p.name AS product_name,
  oi.quantity,
  oi.total_price AS item_total

FROM public.orders o
LEFT JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.status != 'cancelled';

-- Grant access to authenticated users
GRANT SELECT ON public.vw_orders_time_analysis TO authenticated;