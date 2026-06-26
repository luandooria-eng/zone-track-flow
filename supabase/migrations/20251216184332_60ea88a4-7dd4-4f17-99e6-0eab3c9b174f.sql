-- Create trigger function to automatically create credit entries for Crediário payments
CREATE OR REPLACE FUNCTION public.create_credit_entry_for_crediario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_is_credit boolean;
BEGIN
  -- Check if payment method is credit (Crediário)
  SELECT is_credit INTO payment_is_credit 
  FROM public.payment_methods 
  WHERE id = NEW.payment_method_id;
  
  -- If it's a credit payment, create a credit entry
  IF payment_is_credit = true AND NEW.due_date IS NOT NULL THEN
    INSERT INTO public.credit_entries (
      customer_id,
      order_id,
      amount,
      due_date,
      status,
      notes
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      NEW.total,
      NEW.due_date,
      'open',
      'Criado automaticamente via pedido #' || NEW.order_number
    );
    
    -- Update customer credit balance
    UPDATE public.customers
    SET credit_balance = COALESCE(credit_balance, 0) + NEW.total
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger on orders table
DROP TRIGGER IF EXISTS create_credit_entry_on_order ON public.orders;
CREATE TRIGGER create_credit_entry_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_credit_entry_for_crediario();

-- Update existing Crediário payment method to have is_credit = true
UPDATE public.payment_methods 
SET is_credit = true 
WHERE LOWER(name) LIKE '%crediário%' OR LOWER(name) LIKE '%crediario%';

-- If no Crediário exists, create one
INSERT INTO public.payment_methods (name, is_credit, is_active, icon)
SELECT 'Crediário', true, true, 'CreditCard'
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods 
  WHERE LOWER(name) LIKE '%crediário%' OR LOWER(name) LIKE '%crediario%'
);