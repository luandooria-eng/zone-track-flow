-- Create table for sales goals/targets
CREATE TABLE public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('daily', 'monthly')),
  metric TEXT NOT NULL CHECK (metric IN ('products_sold', 'orders_count')),
  target_value INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(type, metric)
);

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can read sales_goals"
  ON public.sales_goals
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sales_goals"
  ON public.sales_goals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default goals
INSERT INTO public.sales_goals (type, metric, target_value) VALUES
  ('daily', 'products_sold', 100),
  ('daily', 'orders_count', 30),
  ('monthly', 'products_sold', 3000),
  ('monthly', 'orders_count', 900);