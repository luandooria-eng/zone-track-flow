-- Add unique constraint for product_payment_prices upsert
ALTER TABLE public.product_payment_prices 
ADD CONSTRAINT product_payment_prices_product_payment_unique 
UNIQUE (product_id, payment_method_id);

-- Create table for product prices by sales channel
CREATE TABLE public.product_channel_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.sales_channels(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT product_channel_prices_unique UNIQUE (product_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.product_channel_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can read product_channel_prices"
ON public.product_channel_prices FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product_channel_prices"
ON public.product_channel_prices FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_product_channel_prices_updated_at
BEFORE UPDATE ON public.product_channel_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();