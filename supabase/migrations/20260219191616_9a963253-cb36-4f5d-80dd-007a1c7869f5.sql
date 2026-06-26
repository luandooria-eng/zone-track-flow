
-- Create the trigger that was missing
CREATE TRIGGER trg_credit_loyalty_points_on_delivery
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.credit_loyalty_points_on_delivery();
