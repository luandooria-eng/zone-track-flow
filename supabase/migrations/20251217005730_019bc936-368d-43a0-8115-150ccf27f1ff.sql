-- Create customer product aggregation table
CREATE TABLE public.customer_product_agg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty_total integer NOT NULL DEFAULT 0,
  amount_total numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Create customer payment method aggregation table
CREATE TABLE public.customer_payment_agg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  count_total integer NOT NULL DEFAULT 0,
  amount_total numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, payment_method_id)
);

-- Enable RLS
ALTER TABLE public.customer_product_agg ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_agg ENABLE ROW LEVEL SECURITY;

-- RLS policies for aggregation tables
CREATE POLICY "Authenticated can read customer_product_agg" ON public.customer_product_agg
FOR SELECT USING (true);

CREATE POLICY "System can manage customer_product_agg" ON public.customer_product_agg
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read customer_payment_agg" ON public.customer_payment_agg
FOR SELECT USING (true);

CREATE POLICY "System can manage customer_payment_agg" ON public.customer_payment_agg
FOR ALL USING (true) WITH CHECK (true);

-- Add top product and payment method columns to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS top_product_id uuid REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS top_payment_method_id uuid REFERENCES public.payment_methods(id);

-- Function to update customer product aggregation when order items are inserted
CREATE OR REPLACE FUNCTION public.update_customer_product_agg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_top_product_id uuid;
BEGIN
  -- Get customer_id from the order
  SELECT customer_id INTO v_customer_id FROM public.orders WHERE id = NEW.order_id;
  
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Upsert aggregation
  INSERT INTO public.customer_product_agg (customer_id, product_id, qty_total, amount_total)
  VALUES (v_customer_id, NEW.product_id, NEW.quantity, NEW.total_price)
  ON CONFLICT (customer_id, product_id) DO UPDATE SET
    qty_total = customer_product_agg.qty_total + NEW.quantity,
    amount_total = customer_product_agg.amount_total + NEW.total_price,
    updated_at = now();
  
  -- Update top product in customers table
  SELECT product_id INTO v_top_product_id
  FROM public.customer_product_agg
  WHERE customer_id = v_customer_id
  ORDER BY qty_total DESC
  LIMIT 1;
  
  UPDATE public.customers
  SET top_product_id = v_top_product_id
  WHERE id = v_customer_id;
  
  RETURN NEW;
END;
$$;

-- Function to update customer payment aggregation when order is created/updated
CREATE OR REPLACE FUNCTION public.update_customer_payment_agg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_payment_method_id uuid;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.payment_method_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only process when order is being created or payment method changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.payment_method_id IS DISTINCT FROM NEW.payment_method_id) THEN
    -- Upsert payment method aggregation
    INSERT INTO public.customer_payment_agg (customer_id, payment_method_id, count_total, amount_total)
    VALUES (NEW.customer_id, NEW.payment_method_id, 1, NEW.total)
    ON CONFLICT (customer_id, payment_method_id) DO UPDATE SET
      count_total = customer_payment_agg.count_total + 1,
      amount_total = customer_payment_agg.amount_total + NEW.total,
      updated_at = now();
    
    -- If it was an update with changed payment method, decrement old one
    IF TG_OP = 'UPDATE' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE public.customer_payment_agg
      SET count_total = GREATEST(0, count_total - 1),
          amount_total = GREATEST(0, amount_total - OLD.total),
          updated_at = now()
      WHERE customer_id = OLD.customer_id AND payment_method_id = OLD.payment_method_id;
    END IF;
    
    -- Update top payment method in customers table
    SELECT payment_method_id INTO v_top_payment_method_id
    FROM public.customer_payment_agg
    WHERE customer_id = NEW.customer_id
    ORDER BY count_total DESC
    LIMIT 1;
    
    UPDATE public.customers
    SET top_payment_method_id = v_top_payment_method_id
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to update customer stats on order creation (not just status change)
CREATE OR REPLACE FUNCTION public.update_customer_stats_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- On cancellation, decrement order count
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE public.customers
    SET total_orders = GREATEST(0, COALESCE(total_orders, 0) - 1)
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_update_customer_product_agg
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_product_agg();

CREATE TRIGGER trigger_update_customer_payment_agg
AFTER INSERT OR UPDATE OF payment_method_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_payment_agg();

CREATE TRIGGER trigger_update_customer_stats_on_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_stats_on_order();

-- Create indexes for performance
CREATE INDEX idx_customer_product_agg_customer ON public.customer_product_agg(customer_id);
CREATE INDEX idx_customer_product_agg_qty ON public.customer_product_agg(customer_id, qty_total DESC);
CREATE INDEX idx_customer_payment_agg_customer ON public.customer_payment_agg(customer_id);
CREATE INDEX idx_customer_payment_agg_count ON public.customer_payment_agg(customer_id, count_total DESC);