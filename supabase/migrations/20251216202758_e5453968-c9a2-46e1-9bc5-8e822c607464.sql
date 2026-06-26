-- Create function to automatically settle credit entry when order is paid
CREATE OR REPLACE FUNCTION public.settle_credit_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When paid_at is set on an order, settle the corresponding credit entry
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD.paid_at != NEW.paid_at) THEN
    UPDATE public.credit_entries
    SET 
      status = 'paid',
      paid_at = NEW.paid_at,
      paid_amount = amount,
      updated_at = now()
    WHERE order_id = NEW.id AND status != 'paid';
    
    -- Decrease customer credit balance
    UPDATE public.customers
    SET credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - NEW.total)
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically settle credit when order is paid
CREATE TRIGGER settle_credit_on_order_payment
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.settle_credit_on_payment();

-- Also handle when order is created with paid_at already set
CREATE OR REPLACE FUNCTION public.create_credit_entry_for_crediario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_is_credit boolean;
BEGIN
  -- Check if payment method is credit (Crediário)
  SELECT is_credit INTO payment_is_credit 
  FROM public.payment_methods 
  WHERE id = NEW.payment_method_id;
  
  -- If it's a credit payment and has due_date, create a credit entry
  IF payment_is_credit = true AND NEW.due_date IS NOT NULL THEN
    INSERT INTO public.credit_entries (
      customer_id,
      order_id,
      amount,
      due_date,
      status,
      paid_at,
      paid_amount,
      notes
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      NEW.total,
      NEW.due_date,
      CASE WHEN NEW.paid_at IS NOT NULL THEN 'paid' ELSE 'open' END,
      NEW.paid_at,
      CASE WHEN NEW.paid_at IS NOT NULL THEN NEW.total ELSE 0 END,
      'Criado automaticamente via pedido #' || NEW.order_number
    );
    
    -- Update customer credit balance only if not already paid
    IF NEW.paid_at IS NULL THEN
      UPDATE public.customers
      SET credit_balance = COALESCE(credit_balance, 0) + NEW.total
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;