-- Create enum for alert types
CREATE TYPE public.consumption_alert_type AS ENUM (
  'water_drop',
  'gas_drop',
  'water_stopped',
  'gas_stopped',
  'product_stopped',
  'general_risk'
);

-- Create enum for alert severity
CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high');

-- Create table for monthly customer consumption (materialized for performance)
CREATE TABLE public.customer_monthly_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- Format: YYYY-MM
  water_qty integer NOT NULL DEFAULT 0,
  gas_qty integer NOT NULL DEFAULT 0,
  other_qty integer NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (customer_id, year_month)
);

-- Create table for customer alerts
CREATE TABLE public.customer_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  alert_type consumption_alert_type NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'medium',
  period_ref text NOT NULL, -- Format: YYYY-MM
  details jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'dismissed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create consumption settings table
CREATE TABLE public.consumption_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_percent_threshold integer NOT NULL DEFAULT 30,
  comparison_months integer NOT NULL DEFAULT 3,
  min_purchases_for_regular integer NOT NULL DEFAULT 2,
  days_without_purchase integer NOT NULL DEFAULT 30,
  monitored_product_ids uuid[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.consumption_settings (drop_percent_threshold, comparison_months, min_purchases_for_regular, days_without_purchase)
VALUES (30, 3, 2, 30);

-- Enable RLS
ALTER TABLE public.customer_monthly_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumption_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_monthly_consumption
CREATE POLICY "Authenticated can read customer_monthly_consumption"
ON public.customer_monthly_consumption FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can manage customer_monthly_consumption"
ON public.customer_monthly_consumption FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS Policies for customer_alerts
CREATE POLICY "Authenticated can read customer_alerts"
ON public.customer_alerts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can manage customer_alerts"
ON public.customer_alerts FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS Policies for consumption_settings
CREATE POLICY "Authenticated can read consumption_settings"
ON public.consumption_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage consumption_settings"
ON public.consumption_settings FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Create indexes for performance
CREATE INDEX idx_customer_monthly_consumption_customer ON public.customer_monthly_consumption(customer_id);
CREATE INDEX idx_customer_monthly_consumption_year_month ON public.customer_monthly_consumption(year_month);
CREATE INDEX idx_customer_alerts_customer ON public.customer_alerts(customer_id);
CREATE INDEX idx_customer_alerts_status ON public.customer_alerts(status);
CREATE INDEX idx_customer_alerts_type ON public.customer_alerts(alert_type);

-- Trigger for updated_at
CREATE TRIGGER update_customer_monthly_consumption_updated_at
BEFORE UPDATE ON public.customer_monthly_consumption
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_alerts_updated_at
BEFORE UPDATE ON public.customer_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_consumption_settings_updated_at
BEFORE UPDATE ON public.consumption_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();