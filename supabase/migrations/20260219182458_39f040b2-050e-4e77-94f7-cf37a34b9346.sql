
-- Function to auto-credit loyalty points when order is delivered
CREATE OR REPLACE FUNCTION public.credit_loyalty_points_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_points INTEGER := 0;
  v_rule RECORD;
  v_item RECORD;
  v_item_points INTEGER;
  v_descriptions TEXT[] := '{}';
BEGIN
  -- Only when status changes to 'delivered'
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Skip if no customer
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if points already credited for this order
  IF EXISTS (
    SELECT 1 FROM public.loyalty_ledger
    WHERE reference_id = NEW.id AND type = 'credit' AND origin = 'sale'
  ) THEN
    RETURN NEW;
  END IF;

  -- 1) Per-product rules: match order items to product-specific scoring rules
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.total_price, p.name as product_name
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    -- Check for product-specific rule
    SELECT * INTO v_rule
    FROM public.loyalty_scoring_rules
    WHERE is_active = true
      AND product_id = v_item.product_id
    LIMIT 1;

    IF FOUND THEN
      CASE v_rule.rule_type
        WHEN 'fixed' THEN
          v_item_points := (v_rule.points_value * v_item.quantity)::INTEGER;
        WHEN 'per_value' THEN
          v_item_points := FLOOR(v_item.total_price / GREATEST(v_rule.min_purchase_value, 1) * v_rule.points_value)::INTEGER;
        WHEN 'multiplier' THEN
          v_item_points := FLOOR(v_item.total_price * v_rule.points_value)::INTEGER;
        ELSE
          v_item_points := 0;
      END CASE;
      v_total_points := v_total_points + v_item_points;
    END IF;
  END LOOP;

  -- 2) Global rules (no product_id): apply to the whole order total
  FOR v_rule IN
    SELECT * FROM public.loyalty_scoring_rules
    WHERE is_active = true AND product_id IS NULL
  LOOP
    IF NEW.total >= COALESCE(v_rule.min_purchase_value, 0) THEN
      CASE v_rule.rule_type
        WHEN 'fixed' THEN
          v_total_points := v_total_points + v_rule.points_value::INTEGER;
        WHEN 'per_value' THEN
          v_total_points := v_total_points + FLOOR(NEW.total / GREATEST(v_rule.min_purchase_value, 1) * v_rule.points_value)::INTEGER;
        WHEN 'multiplier' THEN
          v_total_points := v_total_points + FLOOR(NEW.total * v_rule.points_value)::INTEGER;
        ELSE
          v_total_points := v_total_points;
      END CASE;
    END IF;
  END LOOP;

  -- 3) Apply active campaign multipliers/bonuses
  FOR v_rule IN
    SELECT * FROM public.loyalty_campaigns
    WHERE is_active = true
      AND starts_at <= now()
      AND ends_at >= now()
  LOOP
    IF v_rule.campaign_type = 'multiplier' THEN
      v_total_points := FLOOR(v_total_points * v_rule.multiplier)::INTEGER;
    ELSIF v_rule.campaign_type = 'bonus' AND v_rule.bonus_points IS NOT NULL THEN
      v_total_points := v_total_points + v_rule.bonus_points;
    END IF;
  END LOOP;

  -- Only insert if points > 0
  IF v_total_points > 0 THEN
    INSERT INTO public.loyalty_ledger (
      customer_id, type, points, origin, reference_id, description
    ) VALUES (
      NEW.customer_id, 'credit', v_total_points, 'sale', NEW.id,
      'Pontos automáticos - Pedido #' || NEW.order_number
    );

    -- Update customer balance
    UPDATE public.customers
    SET points_balance = COALESCE(points_balance, 0) + v_total_points
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_delivery ON public.orders;
CREATE TRIGGER trg_credit_loyalty_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_points_on_delivery();
