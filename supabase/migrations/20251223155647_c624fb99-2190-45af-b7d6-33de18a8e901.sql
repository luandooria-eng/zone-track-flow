-- Create customer_tags table for tag definitions
CREATE TABLE public.customer_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for customer-tag relationships
CREATE TABLE public.customer_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_tags
CREATE POLICY "Authenticated can read customer_tags"
ON public.customer_tags
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage customer_tags"
ON public.customer_tags
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for customer_tag_assignments
CREATE POLICY "Authenticated can read customer_tag_assignments"
ON public.customer_tag_assignments
FOR SELECT
USING (true);

CREATE POLICY "Authenticated can manage customer_tag_assignments"
ON public.customer_tag_assignments
FOR ALL
USING (true)
WITH CHECK (true);

-- Insert some default tags
INSERT INTO public.customer_tags (name, color) VALUES
  ('VIP', '#EAB308'),
  ('Frequente', '#22C55E'),
  ('Novo', '#3B82F6'),
  ('Inadimplente', '#EF4444'),
  ('Atacado', '#8B5CF6');