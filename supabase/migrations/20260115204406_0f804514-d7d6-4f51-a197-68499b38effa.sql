
-- Fix: Update customer_stats_on_order to also subtract total_spent when delivered order is cancelled
CREATE OR REPLACE FUNCTION public.update_customer_stats_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- On new order, update last_order_at and increment order count
  IF TG_OP = 'INSERT' THEN
    UPDATE public.customers
    SET 
      total_orders = COALESCE(total_orders, 0) + 1,
      last_order_at = GREATEST(COALESCE(last_order_at, '1970-01-01'::timestamptz), NEW.created_at)
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On status change to delivered, add to total_spent
  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE public.customers
    SET total_spent = COALESCE(total_spent, 0) + NEW.total
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On cancellation, decrement order count AND subtract from total_spent if was delivered
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Decrement order count
    UPDATE public.customers
    SET total_orders = GREATEST(0, COALESCE(total_orders, 0) - 1)
    WHERE id = NEW.customer_id;
    
    -- If was previously delivered, also subtract from total_spent
    IF OLD.status = 'delivered' THEN
      UPDATE public.customers
      SET total_spent = GREATEST(0, COALESCE(total_spent, 0) - COALESCE(NEW.total, 0))
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix: Update update_customer_stats to also subtract from daily_sales_summary when delivered order is cancelled
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE public.customers
    SET 
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      last_order_at = now()
    WHERE id = NEW.customer_id;
    
    -- Update daily summary
    INSERT INTO public.daily_sales_summary (date, total_revenue, total_orders, delivered_orders, avg_ticket)
    VALUES (CURRENT_DATE, NEW.total, 1, 1, NEW.total)
    ON CONFLICT (date) DO UPDATE SET
      total_revenue = daily_sales_summary.total_revenue + NEW.total,
      total_orders = daily_sales_summary.total_orders + 1,
      delivered_orders = daily_sales_summary.delivered_orders + 1,
      avg_ticket = (daily_sales_summary.total_revenue + NEW.total) / (daily_sales_summary.delivered_orders + 1),
      updated_at = now();
  END IF;
  
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Return stock
    UPDATE public.products p
    SET current_stock = current_stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND p.id = oi.product_id;
    
    -- Log stock return movement
    INSERT INTO public.stock_movements (product_id, order_id, quantity, type, reason)
    SELECT oi.product_id, NEW.id, oi.quantity, 'in', 'Cancelamento de pedido'
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Update daily summary
    INSERT INTO public.daily_sales_summary (date, cancelled_orders)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET
      cancelled_orders = daily_sales_summary.cancelled_orders + 1,
      updated_at = now();
    
    -- If was previously delivered, subtract from daily_sales_summary revenue and delivered_orders
    IF OLD.status = 'delivered' THEN
      UPDATE public.daily_sales_summary
      SET 
        total_revenue = GREATEST(0, COALESCE(total_revenue, 0) - COALESCE(NEW.total, 0)),
        delivered_orders = GREATEST(0, COALESCE(delivered_orders, 0) - 1),
        avg_ticket = CASE 
          WHEN GREATEST(0, COALESCE(delivered_orders, 0) - 1) > 0 
          THEN GREATEST(0, COALESCE(total_revenue, 0) - COALESCE(NEW.total, 0)) / GREATEST(1, COALESCE(delivered_orders, 0) - 1)
          ELSE 0 
        END,
        updated_at = now()
      WHERE date = DATE(NEW.created_at);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
