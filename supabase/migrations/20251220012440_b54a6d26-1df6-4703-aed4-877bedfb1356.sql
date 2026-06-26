
-- Create container_pools table (physical pool of containers)
CREATE TABLE public.container_pools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- 'galao_20l', 'botijao_13kg', 'botijao_45kg'
  name TEXT NOT NULL, -- Display name
  total_physical_qty INTEGER NOT NULL DEFAULT 0,
  unit_value NUMERIC NOT NULL DEFAULT 0, -- Value per unit for breakage cost calculation
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create container_balances table (current balance by state)
CREATE TABLE public.container_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.container_pools(id) ON DELETE CASCADE,
  qty_full INTEGER NOT NULL DEFAULT 0,
  qty_empty INTEGER NOT NULL DEFAULT 0,
  qty_in_field INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pool_id)
);

-- Create container_movements table (all movements)
CREATE TABLE public.container_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.container_pools(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- 'FILL', 'SALE_TO_FIELD', 'RETURN', 'BREAKAGE', 'PURCHASE', 'ADJUSTMENT'
  qty INTEGER NOT NULL,
  from_state TEXT, -- 'full', 'empty', 'in_field'
  to_state TEXT, -- 'full', 'empty', 'in_field'
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_bonuses table
CREATE TABLE public.monthly_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES public.container_pools(id) ON DELETE CASCADE,
  competence_month TEXT NOT NULL, -- 'YYYY-MM' format
  qty_filled INTEGER NOT NULL DEFAULT 0,
  bonus_percent NUMERIC NOT NULL DEFAULT 0,
  bonus_qty INTEGER NOT NULL DEFAULT 0,
  bonus_value_brl NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'predicted', -- 'predicted', 'confirmed'
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pool_id, competence_month)
);

-- Add returnable container fields to products table
ALTER TABLE public.products 
ADD COLUMN has_returnable_container BOOLEAN DEFAULT false,
ADD COLUMN container_pool_id UUID REFERENCES public.container_pools(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.container_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_bonuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for container_pools
CREATE POLICY "Authenticated can read container_pools" ON public.container_pools
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage container_pools" ON public.container_pools
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for container_balances
CREATE POLICY "Authenticated can read container_balances" ON public.container_balances
  FOR SELECT USING (true);

CREATE POLICY "System can manage container_balances" ON public.container_balances
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for container_movements
CREATE POLICY "Authenticated can read container_movements" ON public.container_movements
  FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert container_movements" ON public.container_movements
  FOR INSERT WITH CHECK (true);

-- RLS Policies for monthly_bonuses
CREATE POLICY "Authenticated can read monthly_bonuses" ON public.monthly_bonuses
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage monthly_bonuses" ON public.monthly_bonuses
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'));

-- Trigger to update container_balances on movement
CREATE OR REPLACE FUNCTION public.update_container_balance_on_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ensure balance record exists
  INSERT INTO public.container_balances (pool_id, qty_full, qty_empty, qty_in_field)
  VALUES (NEW.pool_id, 0, 0, 0)
  ON CONFLICT (pool_id) DO NOTHING;

  -- Update balances based on movement type
  CASE NEW.movement_type
    WHEN 'FILL' THEN
      -- Empty -> Full
      UPDATE public.container_balances
      SET qty_empty = qty_empty - NEW.qty,
          qty_full = qty_full + NEW.qty,
          updated_at = now()
      WHERE pool_id = NEW.pool_id;
    
    WHEN 'SALE_TO_FIELD' THEN
      -- Full -> In Field
      UPDATE public.container_balances
      SET qty_full = qty_full - NEW.qty,
          qty_in_field = qty_in_field + NEW.qty,
          updated_at = now()
      WHERE pool_id = NEW.pool_id;
    
    WHEN 'RETURN' THEN
      -- In Field -> Empty
      UPDATE public.container_balances
      SET qty_in_field = qty_in_field - NEW.qty,
          qty_empty = qty_empty + NEW.qty,
          updated_at = now()
      WHERE pool_id = NEW.pool_id;
    
    WHEN 'BREAKAGE' THEN
      -- Reduce from specified state and total pool
      IF NEW.from_state = 'full' THEN
        UPDATE public.container_balances
        SET qty_full = qty_full - NEW.qty, updated_at = now()
        WHERE pool_id = NEW.pool_id;
      ELSIF NEW.from_state = 'empty' THEN
        UPDATE public.container_balances
        SET qty_empty = qty_empty - NEW.qty, updated_at = now()
        WHERE pool_id = NEW.pool_id;
      ELSIF NEW.from_state = 'in_field' THEN
        UPDATE public.container_balances
        SET qty_in_field = qty_in_field - NEW.qty, updated_at = now()
        WHERE pool_id = NEW.pool_id;
      END IF;
      -- Reduce total physical qty
      UPDATE public.container_pools
      SET total_physical_qty = total_physical_qty - NEW.qty, updated_at = now()
      WHERE id = NEW.pool_id;
    
    WHEN 'PURCHASE' THEN
      -- Add to empty and increase total pool
      UPDATE public.container_balances
      SET qty_empty = qty_empty + NEW.qty, updated_at = now()
      WHERE pool_id = NEW.pool_id;
      UPDATE public.container_pools
      SET total_physical_qty = total_physical_qty + NEW.qty, updated_at = now()
      WHERE id = NEW.pool_id;
    
    WHEN 'ADJUSTMENT' THEN
      -- Direct adjustment to specified state
      IF NEW.to_state = 'full' THEN
        UPDATE public.container_balances
        SET qty_full = qty_full + NEW.qty, updated_at = now()
        WHERE pool_id = NEW.pool_id;
      ELSIF NEW.to_state = 'empty' THEN
        UPDATE public.container_balances
        SET qty_empty = qty_empty + NEW.qty, updated_at = now()
        WHERE pool_id = NEW.pool_id;
      ELSIF NEW.to_state = 'in_field' THEN
        UPDATE public.container_balances
        SET qty_in_field = qty_in_field + NEW.qty, updated_at = now()
        WHERE pool_id = NEW.pool_id;
      END IF;
      -- Update total if positive adjustment
      IF NEW.qty > 0 THEN
        UPDATE public.container_pools
        SET total_physical_qty = total_physical_qty + NEW.qty, updated_at = now()
        WHERE id = NEW.pool_id;
      END IF;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_container_balance
AFTER INSERT ON public.container_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_container_balance_on_movement();

-- Updated_at triggers
CREATE TRIGGER update_container_pools_updated_at
BEFORE UPDATE ON public.container_pools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_bonuses_updated_at
BEFORE UPDATE ON public.monthly_bonuses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_container_movements_pool_id ON public.container_movements(pool_id);
CREATE INDEX idx_container_movements_type ON public.container_movements(movement_type);
CREATE INDEX idx_container_movements_created_at ON public.container_movements(created_at);
CREATE INDEX idx_monthly_bonuses_competence ON public.monthly_bonuses(competence_month);
