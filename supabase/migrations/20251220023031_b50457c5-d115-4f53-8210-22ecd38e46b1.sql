-- Add product_id column to sales_goals for product-specific goals
ALTER TABLE public.sales_goals 
ADD COLUMN product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;

-- Add name column for custom goal naming
ALTER TABLE public.sales_goals 
ADD COLUMN name TEXT;

-- Drop the unique constraint and create a new one that includes product_id
ALTER TABLE public.sales_goals DROP CONSTRAINT IF EXISTS sales_goals_type_metric_key;
ALTER TABLE public.sales_goals ADD CONSTRAINT sales_goals_unique_goal UNIQUE(type, metric, product_id);

-- Update existing goals with names
UPDATE public.sales_goals SET name = 'Produtos Vendidos' WHERE metric = 'products_sold' AND product_id IS NULL;
UPDATE public.sales_goals SET name = 'Número de Pedidos' WHERE metric = 'orders_count' AND product_id IS NULL;