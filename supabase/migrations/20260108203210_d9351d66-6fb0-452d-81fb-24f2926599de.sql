-- Drop existing trigger and recreate to handle INSERT and UPDATE
DROP TRIGGER IF EXISTS create_credit_entry_on_order ON public.orders;

-- Create updated function that handles both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.create_credit_entry_for_crediario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payment_is_credit boolean;
  credit_entry_exists boolean;
BEGIN
  -- Check if payment method is credit (Crediário)
  SELECT is_credit INTO payment_is_credit 
  FROM public.payment_methods 
  WHERE id = NEW.payment_method_id;
  
  -- If it's a credit payment and has due_date
  IF payment_is_credit = true AND NEW.due_date IS NOT NULL THEN
    -- Check if credit entry already exists for this order
    SELECT EXISTS(
      SELECT 1 FROM public.credit_entries WHERE order_id = NEW.id
    ) INTO credit_entry_exists;
    
    -- Only create if it doesn't exist yet
    IF NOT credit_entry_exists THEN
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER create_credit_entry_on_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION create_credit_entry_for_crediario();