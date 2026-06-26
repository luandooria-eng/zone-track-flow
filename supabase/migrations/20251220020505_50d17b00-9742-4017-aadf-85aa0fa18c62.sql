-- Add bonus_percent column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS bonus_percent numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.products.bonus_percent IS 'Bonus percentage to calculate bonus quantity on purchases';