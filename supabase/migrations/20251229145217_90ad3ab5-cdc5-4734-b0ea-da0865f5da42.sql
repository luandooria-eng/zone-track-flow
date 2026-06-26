-- Add order_fee to sales_channels for per-order channel fees
ALTER TABLE public.sales_channels
ADD COLUMN order_fee numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.sales_channels.order_fee IS 'Fee added per order when this channel is used (e.g., app fee)';

-- Create table for product-specific pricing by payment method
CREATE TABLE public.product_payment_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, payment_method_id)
);

-- Enable RLS
ALTER TABLE public.product_payment_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can read product_payment_prices"
ON public.product_payment_prices
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product_payment_prices"
ON public.product_payment_prices
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_product_payment_prices_updated_at
BEFORE UPDATE ON public.product_payment_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();