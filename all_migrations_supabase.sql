-- ============================================
-- Migration: 20251216172824_66909cea-2990-4122-996a-bfef64e09ff9.sql
-- ============================================

-- Create enum types
DO $do$ BEGIN
CREATE TYPE public.order_status AS ENUM ('accepted', 'preparing', 'sent', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;
DO $do$ BEGIN
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'operator', 'finance', 'deliverer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Neighborhoods/Bairros
CREATE TABLE public.neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales channels
CREATE TABLE public.sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment methods
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  requires_change BOOLEAN DEFAULT false,
  is_credit BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Delivery people
CREATE TABLE public.delivery_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) DEFAULT 0,
  unit TEXT DEFAULT 'un',
  min_stock INTEGER DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  reserved_stock INTEGER DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  neighborhood_id UUID REFERENCES public.neighborhoods(id),
  street TEXT,
  number TEXT,
  complement TEXT,
  reference TEXT,
  notes TEXT,
  credit_limit DECIMAL(10,2) DEFAULT 0,
  credit_balance DECIMAL(10,2) DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  customer_id UUID REFERENCES public.customers(id),
  channel_id UUID REFERENCES public.sales_channels(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  delivery_person_id UUID REFERENCES public.delivery_people(id),
  neighborhood_id UUID REFERENCES public.neighborhoods(id),
  status order_status NOT NULL DEFAULT 'accepted',
  delivery_address TEXT,
  delivery_number TEXT,
  delivery_complement TEXT,
  delivery_reference TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Order items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock movements
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  order_id UUID REFERENCES public.orders(id),
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'reserve', 'release')),
  reason TEXT,
  previous_stock INTEGER,
  new_stock INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credit entries (carteira)
CREATE TABLE public.credit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  order_id UUID REFERENCES public.orders(id),
  amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily sales summary (materialized for dashboard performance)
CREATE TABLE public.daily_sales_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  avg_ticket DECIMAL(10,2) DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  cancelled_orders INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales_summary ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user has any role (authenticated)
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- RLS Policies

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles: only admins can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Config tables: authenticated users can read, admins can manage
CREATE POLICY "Authenticated can read neighborhoods" ON public.neighborhoods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage neighborhoods" ON public.neighborhoods
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated can read sales_channels" ON public.sales_channels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sales_channels" ON public.sales_channels
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated can read payment_methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage payment_methods" ON public.payment_methods
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated can read delivery_people" ON public.delivery_people
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage delivery_people" ON public.delivery_people
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Authenticated can read products" ON public.products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Customers: authenticated can CRUD
CREATE POLICY "Authenticated can read customers" ON public.customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (true);

-- Orders: authenticated can CRUD
CREATE POLICY "Authenticated can read orders" ON public.orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orders" ON public.orders
  FOR UPDATE TO authenticated USING (true);

-- Order items: authenticated can CRUD
CREATE POLICY "Authenticated can read order_items" ON public.order_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert order_items" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update order_items" ON public.order_items
  FOR UPDATE TO authenticated USING (true);

-- Stock movements: authenticated can read/insert
CREATE POLICY "Authenticated can read stock_movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (true);

-- Credit entries: authenticated can CRUD
CREATE POLICY "Authenticated can read credit_entries" ON public.credit_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert credit_entries" ON public.credit_entries
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update credit_entries" ON public.credit_entries
  FOR UPDATE TO authenticated USING (true);

-- Audit logs: authenticated can read, system inserts
CREATE POLICY "Authenticated can read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Daily summary: authenticated can read/manage
CREATE POLICY "Authenticated can read daily_sales_summary" ON public.daily_sales_summary
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage daily_sales_summary" ON public.daily_sales_summary
  FOR ALL TO authenticated USING (true);

-- Triggers

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_neighborhoods_updated_at BEFORE UPDATE ON public.neighborhoods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_delivery_people_updated_at BEFORE UPDATE ON public.delivery_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credit_entries_updated_at BEFORE UPDATE ON public.credit_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  -- Give first user admin role, others get operator
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update stock when order is created
CREATE OR REPLACE FUNCTION public.update_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Decrease stock
  UPDATE public.products
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Log movement
  INSERT INTO public.stock_movements (product_id, order_id, quantity, type, reason)
  VALUES (NEW.product_id, NEW.order_id, -NEW.quantity, 'out', 'Venda');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_item_created
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_order();

-- Function to update customer stats on order status change
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE public.customers
    SET 
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      last_order_at = now()
    WHERE id = NEW.customer_id;
    
    -- Update daily summary
    INSERT INTO public.daily_sales_summary (date, total_revenue, total_orders, delivered_orders, avg_ticket)
    VALUES (CURRENT_DATE, NEW.total, 1, 1, NEW.total)
    ON CONFLICT (date) DO UPDATE SET
      total_revenue = daily_sales_summary.total_revenue + NEW.total,
      total_orders = daily_sales_summary.total_orders + 1,
      delivered_orders = daily_sales_summary.delivered_orders + 1,
      avg_ticket = (daily_sales_summary.total_revenue + NEW.total) / (daily_sales_summary.delivered_orders + 1),
      updated_at = now();
  END IF;
  
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Return stock
    UPDATE public.products p
    SET current_stock = current_stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND p.id = oi.product_id;
    
    -- Update daily summary
    INSERT INTO public.daily_sales_summary (date, cancelled_orders)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET
      cancelled_orders = daily_sales_summary.cancelled_orders + 1,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_stats();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_sales_summary;

-- Create indexes for performance
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_channel_id ON public.orders(channel_id);
CREATE INDEX idx_orders_neighborhood_id ON public.orders(neighborhood_id);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_customers_cpf ON public.customers(cpf);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_neighborhood_id ON public.customers(neighborhood_id);
CREATE INDEX idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX idx_credit_entries_customer_id ON public.credit_entries(customer_id);
CREATE INDEX idx_credit_entries_due_date ON public.credit_entries(due_date);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================
-- Migration: 20251216184332_60ea88a4-7dd4-4f17-99e6-0eab3c9b174f.sql
-- ============================================
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
-- ============================================
-- Migration: 20251216190158_2ba77dbb-6fa0-48a5-ae84-e47c17c6e889.sql
-- ============================================
-- Fix products RLS policy to allow INSERT for admins/managers
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

CREATE POLICY "Admins can manage products" 
ON public.products 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Also fix similar issues on other settings tables

-- payment_methods
DROP POLICY IF EXISTS "Admins can manage payment methods" ON public.payment_methods;
CREATE POLICY "Admins can manage payment methods" 
ON public.payment_methods 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- sales_channels
DROP POLICY IF EXISTS "Admins can manage sales channels" ON public.sales_channels;
CREATE POLICY "Admins can manage sales channels" 
ON public.sales_channels 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- delivery_people
DROP POLICY IF EXISTS "Admins can manage delivery people" ON public.delivery_people;
CREATE POLICY "Admins can manage delivery people" 
ON public.delivery_people 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- neighborhoods
DROP POLICY IF EXISTS "Admins can manage neighborhoods" ON public.neighborhoods;
CREATE POLICY "Admins can manage neighborhoods" 
ON public.neighborhoods 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
-- ============================================
-- Migration: 20251216202758_e5453968-c9a2-46e1-9bc5-8e822c607464.sql
-- ============================================
-- Create function to automatically settle credit entry when order is paid
CREATE OR REPLACE FUNCTION public.settle_credit_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When paid_at is set on an order, settle the corresponding credit entry
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS NULL OR OLD.paid_at != NEW.paid_at) THEN
    UPDATE public.credit_entries
    SET 
      status = 'paid',
      paid_at = NEW.paid_at,
      paid_amount = amount,
      updated_at = now()
    WHERE order_id = NEW.id AND status != 'paid';
    
    -- Decrease customer credit balance
    UPDATE public.customers
    SET credit_balance = GREATEST(0, COALESCE(credit_balance, 0) - NEW.total)
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically settle credit when order is paid
CREATE TRIGGER settle_credit_on_order_payment
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.settle_credit_on_payment();

-- Also handle when order is created with paid_at already set
CREATE OR REPLACE FUNCTION public.create_credit_entry_for_crediario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  payment_is_credit boolean;
BEGIN
  -- Check if payment method is credit (Crediário)
  SELECT is_credit INTO payment_is_credit 
  FROM public.payment_methods 
  WHERE id = NEW.payment_method_id;
  
  -- If it's a credit payment and has due_date, create a credit entry
  IF payment_is_credit = true AND NEW.due_date IS NOT NULL THEN
    INSERT INTO public.credit_entries (
      customer_id,
      order_id,
      amount,
      due_date,
      status,
      paid_at,
      paid_amount,
      notes
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      NEW.total,
      NEW.due_date,
      CASE WHEN NEW.paid_at IS NOT NULL THEN 'paid' ELSE 'open' END,
      NEW.paid_at,
      CASE WHEN NEW.paid_at IS NOT NULL THEN NEW.total ELSE 0 END,
      'Criado automaticamente via pedido #' || NEW.order_number
    );
    
    -- Update customer credit balance only if not already paid
    IF NEW.paid_at IS NULL THEN
      UPDATE public.customers
      SET credit_balance = COALESCE(credit_balance, 0) + NEW.total
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
-- ============================================
-- Migration: 20251217005730_019bc936-368d-43a0-8115-150ccf27f1ff.sql
-- ============================================
-- Create customer product aggregation table
CREATE TABLE public.customer_product_agg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty_total integer NOT NULL DEFAULT 0,
  amount_total numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, product_id)
);

-- Create customer payment method aggregation table
CREATE TABLE public.customer_payment_agg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  count_total integer NOT NULL DEFAULT 0,
  amount_total numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, payment_method_id)
);

-- Enable RLS
ALTER TABLE public.customer_product_agg ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_agg ENABLE ROW LEVEL SECURITY;

-- RLS policies for aggregation tables
CREATE POLICY "Authenticated can read customer_product_agg" ON public.customer_product_agg
FOR SELECT USING (true);

CREATE POLICY "System can manage customer_product_agg" ON public.customer_product_agg
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read customer_payment_agg" ON public.customer_payment_agg
FOR SELECT USING (true);

CREATE POLICY "System can manage customer_payment_agg" ON public.customer_payment_agg
FOR ALL USING (true) WITH CHECK (true);

-- Add top product and payment method columns to customers
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS top_product_id uuid REFERENCES public.products(id),
ADD COLUMN IF NOT EXISTS top_payment_method_id uuid REFERENCES public.payment_methods(id);

-- Function to update customer product aggregation when order items are inserted
CREATE OR REPLACE FUNCTION public.update_customer_product_agg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_top_product_id uuid;
BEGIN
  -- Get customer_id from the order
  SELECT customer_id INTO v_customer_id FROM public.orders WHERE id = NEW.order_id;
  
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Upsert aggregation
  INSERT INTO public.customer_product_agg (customer_id, product_id, qty_total, amount_total)
  VALUES (v_customer_id, NEW.product_id, NEW.quantity, NEW.total_price)
  ON CONFLICT (customer_id, product_id) DO UPDATE SET
    qty_total = customer_product_agg.qty_total + NEW.quantity,
    amount_total = customer_product_agg.amount_total + NEW.total_price,
    updated_at = now();
  
  -- Update top product in customers table
  SELECT product_id INTO v_top_product_id
  FROM public.customer_product_agg
  WHERE customer_id = v_customer_id
  ORDER BY qty_total DESC
  LIMIT 1;
  
  UPDATE public.customers
  SET top_product_id = v_top_product_id
  WHERE id = v_customer_id;
  
  RETURN NEW;
END;
$$;

-- Function to update customer payment aggregation when order is created/updated
CREATE OR REPLACE FUNCTION public.update_customer_payment_agg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_top_payment_method_id uuid;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.payment_method_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only process when order is being created or payment method changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.payment_method_id IS DISTINCT FROM NEW.payment_method_id) THEN
    -- Upsert payment method aggregation
    INSERT INTO public.customer_payment_agg (customer_id, payment_method_id, count_total, amount_total)
    VALUES (NEW.customer_id, NEW.payment_method_id, 1, NEW.total)
    ON CONFLICT (customer_id, payment_method_id) DO UPDATE SET
      count_total = customer_payment_agg.count_total + 1,
      amount_total = customer_payment_agg.amount_total + NEW.total,
      updated_at = now();
    
    -- If it was an update with changed payment method, decrement old one
    IF TG_OP = 'UPDATE' AND OLD.payment_method_id IS NOT NULL THEN
      UPDATE public.customer_payment_agg
      SET count_total = GREATEST(0, count_total - 1),
          amount_total = GREATEST(0, amount_total - OLD.total),
          updated_at = now()
      WHERE customer_id = OLD.customer_id AND payment_method_id = OLD.payment_method_id;
    END IF;
    
    -- Update top payment method in customers table
    SELECT payment_method_id INTO v_top_payment_method_id
    FROM public.customer_payment_agg
    WHERE customer_id = NEW.customer_id
    ORDER BY count_total DESC
    LIMIT 1;
    
    UPDATE public.customers
    SET top_payment_method_id = v_top_payment_method_id
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to update customer stats on order creation (not just status change)
CREATE OR REPLACE FUNCTION public.update_customer_stats_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- On new order, update last_order_at and increment order count
  IF TG_OP = 'INSERT' THEN
    UPDATE public.customers
    SET 
      total_orders = COALESCE(total_orders, 0) + 1,
      last_order_at = GREATEST(COALESCE(last_order_at, '1970-01-01'::timestamptz), NEW.created_at)
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On status change to delivered, add to total_spent
  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE public.customers
    SET total_spent = COALESCE(total_spent, 0) + NEW.total
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On cancellation, decrement order count
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE public.customers
    SET total_orders = GREATEST(0, COALESCE(total_orders, 0) - 1)
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_update_customer_product_agg
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_product_agg();

CREATE TRIGGER trigger_update_customer_payment_agg
AFTER INSERT OR UPDATE OF payment_method_id ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_payment_agg();

CREATE TRIGGER trigger_update_customer_stats_on_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_customer_stats_on_order();

-- Create indexes for performance
CREATE INDEX idx_customer_product_agg_customer ON public.customer_product_agg(customer_id);
CREATE INDEX idx_customer_product_agg_qty ON public.customer_product_agg(customer_id, qty_total DESC);
CREATE INDEX idx_customer_payment_agg_customer ON public.customer_payment_agg(customer_id);
CREATE INDEX idx_customer_payment_agg_count ON public.customer_payment_agg(customer_id, count_total DESC);
-- ============================================
-- Migration: 20251217010524_7999dbca-fa8d-4794-81f7-f4af28bef07e.sql
-- ============================================
-- Recalculate customer stats from existing orders
-- Update total_orders count
UPDATE customers c
SET total_orders = COALESCE(
  (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'),
  0
);

-- Update total_spent from delivered orders
UPDATE customers c
SET total_spent = COALESCE(
  (SELECT SUM(o.total) FROM orders o WHERE o.customer_id = c.id AND o.status = 'delivered'),
  0
);

-- Update last_order_at
UPDATE customers c
SET last_order_at = (
  SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'
);

-- Rebuild customer_product_agg from historical data
TRUNCATE customer_product_agg;
INSERT INTO customer_product_agg (customer_id, product_id, qty_total, amount_total)
SELECT 
  o.customer_id,
  oi.product_id,
  SUM(oi.quantity) as qty_total,
  SUM(oi.total_price) as amount_total
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE o.customer_id IS NOT NULL AND o.status != 'cancelled'
GROUP BY o.customer_id, oi.product_id;

-- Update top_product_id for each customer
UPDATE customers c
SET top_product_id = (
  SELECT product_id 
  FROM customer_product_agg 
  WHERE customer_id = c.id 
  ORDER BY qty_total DESC 
  LIMIT 1
);

-- Rebuild customer_payment_agg from historical data
TRUNCATE customer_payment_agg;
INSERT INTO customer_payment_agg (customer_id, payment_method_id, count_total, amount_total)
SELECT 
  customer_id,
  payment_method_id,
  COUNT(*) as count_total,
  SUM(total) as amount_total
FROM orders
WHERE customer_id IS NOT NULL AND payment_method_id IS NOT NULL AND status != 'cancelled'
GROUP BY customer_id, payment_method_id;

-- Update top_payment_method_id for each customer
UPDATE customers c
SET top_payment_method_id = (
  SELECT payment_method_id 
  FROM customer_payment_agg 
  WHERE customer_id = c.id 
  ORDER BY count_total DESC 
  LIMIT 1
);
-- ============================================
-- Migration: 20251218003650_527dcd32-dfcd-4eb7-a636-5851301dd9a1.sql
-- ============================================
-- Create expense categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'payroll', 'purchase')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  default_terms INTEGER DEFAULT 30,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recurring rules table
CREATE TABLE public.recurring_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('expense', 'payroll')),
  name TEXT NOT NULL,
  amount_default NUMERIC NOT NULL DEFAULT 0,
  day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  category_id UUID REFERENCES public.expense_categories(id),
  vendor_id UUID REFERENCES public.vendors(id),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create accounts payable (ap_bills) table
CREATE TABLE public.ap_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id),
  category_id UUID REFERENCES public.expense_categories(id),
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'overdue')),
  is_recurring BOOLEAN DEFAULT false,
  recurring_rule_id UUID REFERENCES public.recurring_rules(id),
  linked_stock_move_id UUID REFERENCES public.stock_movements(id),
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_payment_method_id UUID REFERENCES public.payment_methods(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create finance transactions table
CREATE TABLE public.finance_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
  amount NUMERIC NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  description TEXT,
  source_module TEXT NOT NULL CHECK (source_module IN ('sales', 'wallet', 'stock', 'expense', 'payroll')),
  source_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for expense_categories
CREATE POLICY "Authenticated can read expense_categories" ON public.expense_categories
FOR SELECT USING (true);

CREATE POLICY "Admins can manage expense_categories" ON public.expense_categories
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'));

-- RLS Policies for vendors
CREATE POLICY "Authenticated can read vendors" ON public.vendors
FOR SELECT USING (true);

CREATE POLICY "Finance can manage vendors" ON public.vendors
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'));

-- RLS Policies for recurring_rules
CREATE POLICY "Authenticated can read recurring_rules" ON public.recurring_rules
FOR SELECT USING (true);

CREATE POLICY "Admins can manage recurring_rules" ON public.recurring_rules
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for ap_bills
CREATE POLICY "Authenticated can read ap_bills" ON public.ap_bills
FOR SELECT USING (true);

CREATE POLICY "Finance can manage ap_bills" ON public.ap_bills
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'));

-- RLS Policies for finance_transactions
CREATE POLICY "Authenticated can read finance_transactions" ON public.finance_transactions
FOR SELECT USING (true);

CREATE POLICY "Finance can insert finance_transactions" ON public.finance_transactions
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'finance'));

-- Trigger: Create finance transaction when order is delivered with immediate payment
CREATE OR REPLACE FUNCTION public.create_finance_transaction_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  is_credit_payment BOOLEAN;
BEGIN
  -- Only process when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Check if payment method is credit (Crediário)
    SELECT is_credit INTO is_credit_payment
    FROM public.payment_methods
    WHERE id = NEW.payment_method_id;
    
    -- If NOT credit payment, create finance transaction IN
    IF is_credit_payment IS NOT TRUE AND NEW.paid_at IS NOT NULL THEN
      INSERT INTO public.finance_transactions (
        type, amount, transaction_date, payment_method_id, 
        description, source_module, source_id, created_by
      ) VALUES (
        'IN', NEW.total, COALESCE(NEW.paid_at, now()), NEW.payment_method_id,
        'Venda #' || NEW.order_number, 'sales', NEW.id, NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_finance_on_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_finance_transaction_on_delivery();

-- Trigger: Create finance transaction when credit entry is paid
CREATE OR REPLACE FUNCTION public.create_finance_transaction_on_credit_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_name TEXT;
  v_order_number INTEGER;
BEGIN
  -- Only process when payment is registered (paid_amount increases)
  IF NEW.paid_amount > OLD.paid_amount AND NEW.paid_at IS NOT NULL THEN
    -- Get customer name and order number for description
    SELECT c.name, o.order_number INTO v_customer_name, v_order_number
    FROM public.customers c
    LEFT JOIN public.orders o ON o.id = NEW.order_id
    WHERE c.id = NEW.customer_id;
    
    INSERT INTO public.finance_transactions (
      type, amount, transaction_date, payment_method_id,
      description, source_module, source_id, created_by
    ) VALUES (
      'IN', NEW.paid_amount - OLD.paid_amount, NEW.paid_at, NULL,
      'Recebimento crediário - ' || COALESCE(v_customer_name, 'Cliente') || ' #' || COALESCE(v_order_number::text, ''),
      'wallet', NEW.id, auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_finance_on_credit_payment
AFTER UPDATE ON public.credit_entries
FOR EACH ROW
EXECUTE FUNCTION public.create_finance_transaction_on_credit_payment();

-- Trigger: Create finance transaction when ap_bill is paid
CREATE OR REPLACE FUNCTION public.create_finance_transaction_on_bill_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_category_name TEXT;
  v_vendor_name TEXT;
BEGIN
  -- Only process when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Get category and vendor names
    SELECT ec.name INTO v_category_name FROM public.expense_categories ec WHERE ec.id = NEW.category_id;
    SELECT v.name INTO v_vendor_name FROM public.vendors v WHERE v.id = NEW.vendor_id;
    
    INSERT INTO public.finance_transactions (
      type, amount, transaction_date, payment_method_id,
      description, source_module, source_id, created_by
    ) VALUES (
      'OUT', NEW.amount, COALESCE(NEW.paid_at, now()), NEW.paid_payment_method_id,
      COALESCE(v_category_name, 'Despesa') || CASE WHEN v_vendor_name IS NOT NULL THEN ' - ' || v_vendor_name ELSE '' END,
      CASE WHEN NEW.linked_stock_move_id IS NOT NULL THEN 'stock' 
           WHEN NEW.recurring_rule_id IS NOT NULL THEN 
             CASE WHEN (SELECT type FROM public.recurring_rules WHERE id = NEW.recurring_rule_id) = 'payroll' THEN 'payroll' ELSE 'expense' END
           ELSE 'expense' END,
      NEW.id, auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_finance_on_bill_payment
AFTER UPDATE ON public.ap_bills
FOR EACH ROW
EXECUTE FUNCTION public.create_finance_transaction_on_bill_payment();

-- Add vendor_id and purchase_value to stock_movements for purchase tracking
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id),
ADD COLUMN IF NOT EXISTS purchase_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Update trigger for stock movements to create ap_bill
CREATE OR REPLACE FUNCTION public.create_ap_bill_on_stock_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for 'in' type movements with vendor and value
  IF NEW.type = 'in' AND NEW.vendor_id IS NOT NULL AND NEW.purchase_value > 0 THEN
    INSERT INTO public.ap_bills (
      vendor_id, category_id, due_date, amount, status,
      linked_stock_move_id, paid_at, paid_payment_method_id, notes, created_by
    )
    SELECT
      NEW.vendor_id,
      (SELECT id FROM public.expense_categories WHERE type = 'purchase' LIMIT 1),
      COALESCE(NEW.due_date, CURRENT_DATE + 30),
      NEW.purchase_value,
      CASE WHEN NEW.is_paid THEN 'paid' ELSE 'open' END,
      NEW.id,
      CASE WHEN NEW.is_paid THEN now() ELSE NULL END,
      NULL,
      'Compra de estoque - ' || (SELECT name FROM public.products WHERE id = NEW.product_id),
      NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_ap_bill_on_stock_purchase
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.create_ap_bill_on_stock_purchase();

-- Insert default expense categories
INSERT INTO public.expense_categories (name, type) VALUES
('Compras de Fornecedores', 'purchase'),
('Água', 'expense'),
('Energia', 'expense'),
('Internet', 'expense'),
('Aluguel', 'expense'),
('Salários', 'payroll'),
('Prestadores de Serviço', 'payroll'),
('Manutenção', 'expense'),
('Marketing', 'expense'),
('Outros', 'expense');

-- Add updated_at trigger for new tables
CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_rules_updated_at
BEFORE UPDATE ON public.recurring_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ap_bills_updated_at
BEFORE UPDATE ON public.ap_bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- ============================================
-- Migration: 20251220012440_b54a6d26-1df6-4703-aed4-877bedfb1356.sql
-- ============================================

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

-- ============================================
-- Migration: 20251220020505_50d17b00-9742-4017-aadf-85aa0fa18c62.sql
-- ============================================
-- Add bonus_percent column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS bonus_percent numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.products.bonus_percent IS 'Bonus percentage to calculate bonus quantity on purchases';
-- ============================================
-- Migration: 20251220022649_7d959a5f-0829-48df-b589-12803ebcd19c.sql
-- ============================================
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
-- ============================================
-- Migration: 20251220023031_b50457c5-d115-4f53-8210-22ecd38e46b1.sql
-- ============================================
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
-- ============================================
-- Migration: 20251220024844_38295ee4-0ef8-417d-ad52-61438716be5d.sql
-- ============================================
-- Create enum for alert types
DO $do$ BEGIN
CREATE TYPE public.consumption_alert_type AS ENUM (
  'water_drop',
  'gas_drop',
  'water_stopped',
  'gas_stopped',
  'product_stopped',
  'general_risk'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

-- Create enum for alert severity
DO $do$ BEGIN
CREATE TYPE public.alert_severity AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

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
-- ============================================
-- Migration: 20251222214122_617dacd6-06df-4d3c-adf1-620b4b2199e1.sql
-- ============================================
-- Create addresses table (endereço como entidade única)
CREATE TABLE public.addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  street_name TEXT NOT NULL,
  house_number TEXT NOT NULL,
  neighborhood_id UUID REFERENCES public.neighborhoods(id),
  complement TEXT,
  reference_point TEXT,
  city TEXT DEFAULT 'Lagarto',
  zip_code TEXT,
  address_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_phones table (múltiplos telefones por cliente)
CREATE TABLE public.customer_phones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label TEXT DEFAULT 'principal',
  is_whatsapp BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, phone_number)
);

-- Create customer_addresses junction table
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, address_id)
);

-- Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for addresses
CREATE POLICY "Authenticated can read addresses" 
ON public.addresses FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert addresses" 
ON public.addresses FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can update addresses" 
ON public.addresses FOR UPDATE USING (true);

-- RLS Policies for customer_phones
CREATE POLICY "Authenticated can read customer_phones" 
ON public.customer_phones FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert customer_phones" 
ON public.customer_phones FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can update customer_phones" 
ON public.customer_phones FOR UPDATE USING (true);

CREATE POLICY "Authenticated can delete customer_phones" 
ON public.customer_phones FOR DELETE USING (true);

-- RLS Policies for customer_addresses
CREATE POLICY "Authenticated can read customer_addresses" 
ON public.customer_addresses FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert customer_addresses" 
ON public.customer_addresses FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can update customer_addresses" 
ON public.customer_addresses FOR UPDATE USING (true);

CREATE POLICY "Authenticated can delete customer_addresses" 
ON public.customer_addresses FOR DELETE USING (true);

-- Function to normalize address key
CREATE OR REPLACE FUNCTION public.normalize_address_key(
  p_street TEXT,
  p_number TEXT,
  p_neighborhood_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_neighborhood_name TEXT;
  v_normalized TEXT;
BEGIN
  -- Get neighborhood name
  SELECT LOWER(COALESCE(name, '')) INTO v_neighborhood_name
  FROM public.neighborhoods WHERE id = p_neighborhood_id;
  
  -- Normalize: lowercase, remove accents, trim spaces
  v_normalized := LOWER(COALESCE(p_street, ''));
  v_normalized := translate(v_normalized, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := trim(v_normalized);
  
  -- Normalize neighborhood
  v_neighborhood_name := translate(v_neighborhood_name, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_neighborhood_name := regexp_replace(v_neighborhood_name, '\s+', ' ', 'g');
  v_neighborhood_name := trim(v_neighborhood_name);
  
  RETURN v_normalized || '|' || LOWER(COALESCE(p_number, '')) || '|' || v_neighborhood_name;
END;
$$;

-- Trigger to ensure only one primary phone per customer
CREATE OR REPLACE FUNCTION public.ensure_single_primary_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.customer_phones
    SET is_primary = false
    WHERE customer_id = NEW.customer_id AND id != NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_primary_phone_trigger
BEFORE INSERT OR UPDATE ON public.customer_phones
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_primary_phone();

-- Trigger to ensure only one default address per customer
CREATE OR REPLACE FUNCTION public.ensure_single_default_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.customer_addresses
    SET is_default = false
    WHERE customer_id = NEW.customer_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_default_address_trigger
BEFORE INSERT OR UPDATE ON public.customer_addresses
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_address();

-- Add updated_at trigger for addresses
CREATE TRIGGER update_addresses_updated_at
BEFORE UPDATE ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_customer_phones_customer_id ON public.customer_phones(customer_id);
CREATE INDEX idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_address_id ON public.customer_addresses(address_id);
CREATE INDEX idx_addresses_address_key ON public.addresses(address_key);
-- ============================================
-- Migration: 20251222214218_1d98da29-a434-46d8-b6b6-7820182f02be.sql
-- ============================================
-- Fix function search path for normalize_address_key
CREATE OR REPLACE FUNCTION public.normalize_address_key(
  p_street TEXT,
  p_number TEXT,
  p_neighborhood_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_neighborhood_name TEXT;
  v_normalized TEXT;
BEGIN
  -- Get neighborhood name
  SELECT LOWER(COALESCE(name, '')) INTO v_neighborhood_name
  FROM public.neighborhoods WHERE id = p_neighborhood_id;
  
  -- Normalize: lowercase, remove accents, trim spaces
  v_normalized := LOWER(COALESCE(p_street, ''));
  v_normalized := translate(v_normalized, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
  v_normalized := trim(v_normalized);
  
  -- Normalize neighborhood
  v_neighborhood_name := translate(v_neighborhood_name, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  v_neighborhood_name := regexp_replace(v_neighborhood_name, '\s+', ' ', 'g');
  v_neighborhood_name := trim(v_neighborhood_name);
  
  RETURN v_normalized || '|' || LOWER(COALESCE(p_number, '')) || '|' || v_neighborhood_name;
END;
$$;
-- ============================================
-- Migration: 20251222222718_0d5e5c85-9cb5-4031-b145-9d3ffd60431b.sql
-- ============================================
-- Habilitar extensão pg_trgm para busca fuzzy (precisa estar antes do índice)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabela de índice de ruas para performance no autocomplete
CREATE TABLE public.streets_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  street_type text NOT NULL DEFAULT 'Rua',
  street_name text NOT NULL,
  street_name_normalized text NOT NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id),
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX streets_index_normalized_neighborhood_idx 
ON public.streets_index(street_name_normalized, COALESCE(neighborhood_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Índice para busca por texto com trigrams
CREATE INDEX streets_index_search_idx ON public.streets_index USING gin(street_name_normalized gin_trgm_ops);

-- RLS para streets_index
ALTER TABLE public.streets_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read streets_index" 
ON public.streets_index FOR SELECT 
USING (true);

CREATE POLICY "Authenticated can insert streets_index" 
ON public.streets_index FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated can update streets_index" 
ON public.streets_index FOR UPDATE 
USING (true);

-- View para sugestões de clientes por rua
CREATE OR REPLACE VIEW public.vw_customers_by_street AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.phone as phone_primary,
  a.street_name,
  LOWER(translate(a.street_name, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')) as street_name_normalized,
  a.house_number,
  n.name as neighborhood_name,
  a.id as address_id,
  a.complement,
  a.reference_point,
  ca.is_default
FROM public.customers c
INNER JOIN public.customer_addresses ca ON ca.customer_id = c.id
INNER JOIN public.addresses a ON a.id = ca.address_id
LEFT JOIN public.neighborhoods n ON n.id = a.neighborhood_id
WHERE c.is_active = true;

-- Função para normalizar nome de rua
CREATE OR REPLACE FUNCTION public.normalize_street_name(p_street text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN LOWER(translate(
    regexp_replace(COALESCE(p_street, ''), '\s+', ' ', 'g'),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
END;
$$;

-- Função para extrair tipo de rua e nome
CREATE OR REPLACE FUNCTION public.parse_street_type(p_street text)
RETURNS TABLE(street_type text, street_name text)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_type text := 'Rua';
  v_name text;
BEGIN
  v_normalized := trim(p_street);
  
  IF v_normalized ~* '^(travessa|trav\.?)[\s]' THEN
    v_type := 'Travessa';
    v_name := regexp_replace(v_normalized, '^(travessa|trav\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(avenida|av\.?)[\s]' THEN
    v_type := 'Avenida';
    v_name := regexp_replace(v_normalized, '^(avenida|av\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(alameda|al\.?)[\s]' THEN
    v_type := 'Alameda';
    v_name := regexp_replace(v_normalized, '^(alameda|al\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(praça|praca|pça\.?)[\s]' THEN
    v_type := 'Praça';
    v_name := regexp_replace(v_normalized, '^(praça|praca|pça\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(estrada|estr\.?)[\s]' THEN
    v_type := 'Estrada';
    v_name := regexp_replace(v_normalized, '^(estrada|estr\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(rodovia|rod\.?)[\s]' THEN
    v_type := 'Rodovia';
    v_name := regexp_replace(v_normalized, '^(rodovia|rod\.?)[\s]+', '', 'i');
  ELSIF v_normalized ~* '^(rua|r\.?)[\s]' THEN
    v_type := 'Rua';
    v_name := regexp_replace(v_normalized, '^(rua|r\.?)[\s]+', '', 'i');
  ELSE
    v_name := v_normalized;
  END IF;
  
  RETURN QUERY SELECT v_type, trim(v_name);
END;
$$;

-- Função para atualizar índice de ruas automaticamente
CREATE OR REPLACE FUNCTION public.update_streets_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parsed RECORD;
  v_normalized text;
BEGIN
  SELECT * INTO v_parsed FROM public.parse_street_type(NEW.street_name);
  v_normalized := public.normalize_street_name(v_parsed.street_name);
  
  INSERT INTO public.streets_index (
    street_type, street_name, street_name_normalized, neighborhood_id, usage_count, last_used_at
  )
  VALUES (v_parsed.street_type, NEW.street_name, v_normalized, NEW.neighborhood_id, 1, now())
  ON CONFLICT (street_name_normalized, COALESCE(neighborhood_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    usage_count = streets_index.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar índice quando endereço é criado
CREATE TRIGGER tr_addresses_update_streets_index
AFTER INSERT ON public.addresses
FOR EACH ROW
EXECUTE FUNCTION public.update_streets_index();

-- Função para atualizar índice quando pedido é criado
CREATE OR REPLACE FUNCTION public.update_streets_index_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parsed RECORD;
  v_normalized text;
BEGIN
  IF NEW.delivery_address IS NOT NULL AND NEW.delivery_address != '' THEN
    SELECT * INTO v_parsed FROM public.parse_street_type(NEW.delivery_address);
    v_normalized := public.normalize_street_name(v_parsed.street_name);
    
    INSERT INTO public.streets_index (
      street_type, street_name, street_name_normalized, neighborhood_id, usage_count, last_used_at
    )
    VALUES (v_parsed.street_type, NEW.delivery_address, v_normalized, NEW.neighborhood_id, 1, now())
    ON CONFLICT (street_name_normalized, COALESCE(neighborhood_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET
      usage_count = streets_index.usage_count + 1,
      last_used_at = now(),
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_orders_update_streets_index
AFTER INSERT OR UPDATE OF delivery_address ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_streets_index_on_order();

-- Função de busca de endereços para o autocomplete
CREATE OR REPLACE FUNCTION public.search_addresses_autocomplete(
  p_search text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  suggestion_type text,
  display_text text,
  street_type text,
  street_name text,
  house_number text,
  neighborhood_name text,
  neighborhood_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  address_id uuid,
  usage_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search_normalized text;
  v_has_number boolean := false;
  v_number_part text := '';
BEGIN
  v_search_normalized := public.normalize_street_name(p_search);
  
  IF v_search_normalized ~ '\s+\d+$' THEN
    v_has_number := true;
    v_number_part := (regexp_match(v_search_normalized, '\s+(\d+)$'))[1];
    v_search_normalized := regexp_replace(v_search_normalized, '\s+\d+$', '');
  END IF;
  
  v_search_normalized := regexp_replace(v_search_normalized, '^(rua|r\.|travessa|trav\.|avenida|av\.|alameda|al\.|praca|praça|pca\.|estrada|estr\.|rodovia|rod\.)\s*', '', 'i');
  
  RETURN QUERY
  SELECT 
    'street'::text as suggestion_type,
    si.street_type || ' ' || si.street_name || COALESCE(' — ' || n.name, '') as display_text,
    si.street_type,
    si.street_name,
    NULL::text as house_number,
    n.name as neighborhood_name,
    si.neighborhood_id,
    NULL::uuid as customer_id,
    NULL::text as customer_name,
    NULL::text as customer_phone,
    NULL::uuid as address_id,
    si.usage_count
  FROM public.streets_index si
  LEFT JOIN public.neighborhoods n ON n.id = si.neighborhood_id
  WHERE si.street_name_normalized ILIKE '%' || v_search_normalized || '%'
  
  UNION ALL
  
  SELECT 
    'customer'::text as suggestion_type,
    cs.customer_name || ' — ' || cs.street_name || ', ' || COALESCE(cs.house_number, 'S/N') || ' — ' || COALESCE(cs.neighborhood_name, '') as display_text,
    NULL::text as street_type,
    cs.street_name,
    cs.house_number,
    cs.neighborhood_name,
    NULL::uuid as neighborhood_id,
    cs.customer_id,
    cs.customer_name,
    cs.phone_primary as customer_phone,
    cs.address_id,
    0 as usage_count
  FROM public.vw_customers_by_street cs
  WHERE (
    cs.street_name_normalized ILIKE '%' || v_search_normalized || '%'
    OR cs.customer_name ILIKE '%' || p_search || '%'
  )
  AND (NOT v_has_number OR cs.house_number = v_number_part)
  
  ORDER BY suggestion_type ASC, usage_count DESC, display_text ASC
  LIMIT p_limit;
END;
$$;
-- ============================================
-- Migration: 20251223155647_c624fb99-2190-45af-b7d6-33de18a8e901.sql
-- ============================================
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
-- ============================================
-- Migration: 20251229022329_b6b61a64-d581-4073-96de-5aa2164f8ba9.sql
-- ============================================
-- Create view for orders time analysis
CREATE OR REPLACE VIEW public.vw_orders_time_analysis AS
SELECT 
  o.id AS order_id,
  o.created_at,
  o.delivered_at,
  o.status,
  o.total,
  o.customer_id,
  o.channel_id,
  o.delivery_person_id,
  
  -- Time extraction (use delivered_at for delivered orders, created_at for others)
  EXTRACT(DOW FROM COALESCE(o.delivered_at, o.created_at)) AS day_of_week,
  EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) AS hour_of_day,
  
  -- Time slot (2-hour blocks)
  CASE 
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 6 AND 7 THEN '06-08'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 8 AND 9 THEN '08-10'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 10 AND 11 THEN '10-12'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 12 AND 13 THEN '12-14'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 14 AND 15 THEN '14-16'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 16 AND 17 THEN '16-18'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 18 AND 19 THEN '18-20'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) BETWEEN 20 AND 21 THEN '20-22'
    WHEN EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) >= 22 OR EXTRACT(HOUR FROM COALESCE(o.delivered_at, o.created_at)) < 6 THEN '22-06'
    ELSE 'other'
  END AS time_slot,
  
  -- Day name in Portuguese
  CASE EXTRACT(DOW FROM COALESCE(o.delivered_at, o.created_at))
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda'
    WHEN 2 THEN 'Terça'
    WHEN 3 THEN 'Quarta'
    WHEN 4 THEN 'Quinta'
    WHEN 5 THEN 'Sexta'
    WHEN 6 THEN 'Sábado'
  END AS day_name,
  
  -- Order items details
  oi.product_id,
  p.name AS product_name,
  oi.quantity,
  oi.total_price AS item_total

FROM public.orders o
LEFT JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.status != 'cancelled';

-- Grant access to authenticated users
GRANT SELECT ON public.vw_orders_time_analysis TO authenticated;
-- ============================================
-- Migration: 20251229145217_90ad3ab5-cdc5-4734-b0ea-da0865f5da42.sql
-- ============================================
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
-- ============================================
-- Migration: 20260103153321_f29b8d64-32cf-47c5-be83-2e3159fe6f62.sql
-- ============================================
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
-- ============================================
-- Migration: 20260108203210_d9351d66-6fb0-452d-81fb-24f2926599de.sql
-- ============================================
-- Drop existing trigger and recreate to handle INSERT and UPDATE
DROP TRIGGER IF EXISTS create_credit_entry_on_order ON public.orders;

-- Create updated function that handles both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.create_credit_entry_for_crediario()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  payment_is_credit boolean;
  credit_entry_exists boolean;
BEGIN
  -- Check if payment method is credit (Crediário)
  SELECT is_credit INTO payment_is_credit 
  FROM public.payment_methods 
  WHERE id = NEW.payment_method_id;
  
  -- If it's a credit payment and has due_date
  IF payment_is_credit = true AND NEW.due_date IS NOT NULL THEN
    -- Check if credit entry already exists for this order
    SELECT EXISTS(
      SELECT 1 FROM public.credit_entries WHERE order_id = NEW.id
    ) INTO credit_entry_exists;
    
    -- Only create if it doesn't exist yet
    IF NOT credit_entry_exists THEN
      INSERT INTO public.credit_entries (
        customer_id,
        order_id,
        amount,
        due_date,
        status,
        paid_at,
        paid_amount,
        notes
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        NEW.total,
        NEW.due_date,
        CASE WHEN NEW.paid_at IS NOT NULL THEN 'paid' ELSE 'open' END,
        NEW.paid_at,
        CASE WHEN NEW.paid_at IS NOT NULL THEN NEW.total ELSE 0 END,
        'Criado automaticamente via pedido #' || NEW.order_number
      );
      
      -- Update customer credit balance only if not already paid
      IF NEW.paid_at IS NULL THEN
        UPDATE public.customers
        SET credit_balance = COALESCE(credit_balance, 0) + NEW.total
        WHERE id = NEW.customer_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER create_credit_entry_on_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION create_credit_entry_for_crediario();
-- ============================================
-- Migration: 20260115204406_0f804514-d7d6-4f51-a197-68499b38effa.sql
-- ============================================

-- Fix: Update customer_stats_on_order to also subtract total_spent when delivered order is cancelled
CREATE OR REPLACE FUNCTION public.update_customer_stats_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- On new order, update last_order_at and increment order count
  IF TG_OP = 'INSERT' THEN
    UPDATE public.customers
    SET 
      total_orders = COALESCE(total_orders, 0) + 1,
      last_order_at = GREATEST(COALESCE(last_order_at, '1970-01-01'::timestamptz), NEW.created_at)
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On status change to delivered, add to total_spent
  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE public.customers
    SET total_spent = COALESCE(total_spent, 0) + NEW.total
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On cancellation, decrement order count AND subtract from total_spent if was delivered
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Decrement order count
    UPDATE public.customers
    SET total_orders = GREATEST(0, COALESCE(total_orders, 0) - 1)
    WHERE id = NEW.customer_id;
    
    -- If was previously delivered, also subtract from total_spent
    IF OLD.status = 'delivered' THEN
      UPDATE public.customers
      SET total_spent = GREATEST(0, COALESCE(total_spent, 0) - COALESCE(NEW.total, 0))
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix: Update update_customer_stats to also subtract from daily_sales_summary when delivered order is cancelled
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE public.customers
    SET 
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      last_order_at = now()
    WHERE id = NEW.customer_id;
    
    -- Update daily summary
    INSERT INTO public.daily_sales_summary (date, total_revenue, total_orders, delivered_orders, avg_ticket)
    VALUES (CURRENT_DATE, NEW.total, 1, 1, NEW.total)
    ON CONFLICT (date) DO UPDATE SET
      total_revenue = daily_sales_summary.total_revenue + NEW.total,
      total_orders = daily_sales_summary.total_orders + 1,
      delivered_orders = daily_sales_summary.delivered_orders + 1,
      avg_ticket = (daily_sales_summary.total_revenue + NEW.total) / (daily_sales_summary.delivered_orders + 1),
      updated_at = now();
  END IF;
  
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Return stock
    UPDATE public.products p
    SET current_stock = current_stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND p.id = oi.product_id;
    
    -- Log stock return movement
    INSERT INTO public.stock_movements (product_id, order_id, quantity, type, reason)
    SELECT oi.product_id, NEW.id, oi.quantity, 'in', 'Cancelamento de pedido'
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Update daily summary
    INSERT INTO public.daily_sales_summary (date, cancelled_orders)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date) DO UPDATE SET
      cancelled_orders = daily_sales_summary.cancelled_orders + 1,
      updated_at = now();
    
    -- If was previously delivered, subtract from daily_sales_summary revenue and delivered_orders
    IF OLD.status = 'delivered' THEN
      UPDATE public.daily_sales_summary
      SET 
        total_revenue = GREATEST(0, COALESCE(total_revenue, 0) - COALESCE(NEW.total, 0)),
        delivered_orders = GREATEST(0, COALESCE(delivered_orders, 0) - 1),
        avg_ticket = CASE 
          WHEN GREATEST(0, COALESCE(delivered_orders, 0) - 1) > 0 
          THEN GREATEST(0, COALESCE(total_revenue, 0) - COALESCE(NEW.total, 0)) / GREATEST(1, COALESCE(delivered_orders, 0) - 1)
          ELSE 0 
        END,
        updated_at = now()
      WHERE date = DATE(NEW.created_at);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================
-- Migration: 20260131141916_ddbcb2a6-c857-4408-b556-f09fcfa2b4a2.sql
-- ============================================
-- ========================================
-- FASE 1: CORREÇÃO DE DADOS HISTÓRICOS
-- ========================================

-- 1.1 Criar cliente genérico "Consumidor Avulso" para pedidos órfãos
INSERT INTO customers (name, notes, is_active)
VALUES ('Consumidor Avulso', 'Cliente genérico para pedidos históricos sem identificação de cliente', true)
ON CONFLICT DO NOTHING;

-- 1.2 Corrigir estoque negativo
UPDATE products SET current_stock = 0 WHERE current_stock < 0;

-- 1.3 Vincular pedidos sem customer_id ao cliente genérico
UPDATE orders 
SET customer_id = (SELECT id FROM customers WHERE name = 'Consumidor Avulso' LIMIT 1)
WHERE customer_id IS NULL;

-- 1.4 Recalcular daily_sales_summary completo
DELETE FROM daily_sales_summary WHERE date >= '2026-01-01';

INSERT INTO daily_sales_summary (date, total_orders, total_revenue, delivered_orders, cancelled_orders, avg_ticket)
SELECT 
  DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as date,
  COUNT(*) as total_orders,
  COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0) as total_revenue,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
  COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
  COALESCE(AVG(CASE WHEN status = 'delivered' THEN total END), 0) as avg_ticket
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY DATE(created_at AT TIME ZONE 'America/Sao_Paulo');

-- 1.5 Recalcular estatísticas de clientes (total_orders e total_spent)
UPDATE customers c SET
  total_orders = COALESCE(sub.cnt, 0),
  total_spent = COALESCE(sub.spent, 0),
  last_order_at = sub.last_order
FROM (
  SELECT 
    customer_id, 
    COUNT(*) as cnt, 
    SUM(total) as spent,
    MAX(created_at) as last_order
  FROM orders 
  WHERE status = 'delivered'
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;

-- 1.6 Criar finance_transactions para pedidos delivered que não têm
-- Usando source_module = 'sales' e type = 'IN' conforme constraint
INSERT INTO finance_transactions (type, amount, transaction_date, source_module, source_id, payment_method_id, description)
SELECT 
  'IN' as type,
  o.total as amount,
  COALESCE(o.delivered_at, o.created_at) as transaction_date,
  'sales' as source_module,
  o.id as source_id,
  o.payment_method_id,
  'Venda #' || o.order_number as description
FROM orders o
WHERE o.status = 'delivered'
  AND NOT EXISTS (
    SELECT 1 FROM finance_transactions ft 
    WHERE ft.source_id = o.id AND ft.source_module = 'sales'
  );
-- ============================================
-- Migration: 20260131142057_078d0adc-5c93-4716-ba5e-b0e16a46e002.sql
-- ============================================
-- ========================================
-- FASE 2: CORRIGIR TRIGGERS
-- ========================================

-- 2.1 Trigger robusto para atualizar daily_sales_summary
CREATE OR REPLACE FUNCTION update_daily_sales_summary()
RETURNS TRIGGER AS $$
DECLARE
  order_date DATE;
BEGIN
  -- Determinar a data do pedido
  IF TG_OP = 'DELETE' THEN
    order_date := DATE(OLD.created_at AT TIME ZONE 'America/Sao_Paulo');
  ELSE
    order_date := DATE(NEW.created_at AT TIME ZONE 'America/Sao_Paulo');
  END IF;
  
  -- Recalcular resumo do dia
  INSERT INTO daily_sales_summary (date, total_orders, total_revenue, delivered_orders, cancelled_orders, avg_ticket)
  SELECT 
    order_date,
    COUNT(*),
    COALESCE(SUM(CASE WHEN status = 'delivered' THEN total ELSE 0 END), 0),
    COUNT(CASE WHEN status = 'delivered' THEN 1 END),
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END),
    COALESCE(AVG(CASE WHEN status = 'delivered' THEN total END), 0)
  FROM orders
  WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = order_date
  ON CONFLICT (date) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    delivered_orders = EXCLUDED.delivered_orders,
    cancelled_orders = EXCLUDED.cancelled_orders,
    avg_ticket = EXCLUDED.avg_ticket,
    updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_update_daily_sales_summary ON orders;
CREATE TRIGGER trigger_update_daily_sales_summary
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION update_daily_sales_summary();

-- 2.2 Atualizar trigger existente para criar finance_transaction quando pedido é entregue
-- Corrigir para usar 'sales' ao invés de 'orders' e 'IN' ao invés de 'income'
CREATE OR REPLACE FUNCTION create_finance_transaction_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  is_credit_payment BOOLEAN;
BEGIN
  -- Only process when status changes to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Check if payment method is credit (Crediário)
    SELECT is_credit INTO is_credit_payment
    FROM public.payment_methods
    WHERE id = NEW.payment_method_id;
    
    -- If NOT credit payment, create finance transaction IN
    IF is_credit_payment IS NOT TRUE AND NEW.paid_at IS NOT NULL THEN
      -- Verificar se já existe
      IF NOT EXISTS (
        SELECT 1 FROM finance_transactions 
        WHERE source_id = NEW.id AND source_module = 'sales'
      ) THEN
        INSERT INTO public.finance_transactions (
          type, amount, transaction_date, payment_method_id, 
          description, source_module, source_id, created_by
        ) VALUES (
          'IN', NEW.total, COALESCE(NEW.paid_at, now()), NEW.payment_method_id,
          'Venda #' || NEW.order_number, 'sales', NEW.id, NEW.created_by
        );
      END IF;
    END IF;
  END IF;
  
  -- Se foi cancelado, remover transaction
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    DELETE FROM finance_transactions 
    WHERE source_id = NEW.id AND source_module = 'sales';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_create_finance_transaction ON orders;
CREATE TRIGGER trigger_create_finance_transaction
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION create_finance_transaction_on_delivery();

-- 2.3 Trigger aprimorado para atualizar customer stats (substitui o existente)
CREATE OR REPLACE FUNCTION update_customer_stats_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- On status change to delivered, recalculate all stats
  IF TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    UPDATE customers SET
      total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      total_spent = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered')
    WHERE id = NEW.customer_id;
  END IF;
  
  -- On new order, update last_order_at
  IF TG_OP = 'INSERT' THEN
    UPDATE public.customers
    SET last_order_at = GREATEST(COALESCE(last_order_at, '1970-01-01'::timestamptz), NEW.created_at)
    WHERE id = NEW.customer_id;
  END IF;
  
  -- Se foi cancelado, recalcular
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND NEW.customer_id IS NOT NULL AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE customers SET
      total_orders = (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      total_spent = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered'),
      last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = NEW.customer_id AND status = 'delivered')
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_customer_stats_on_order ON orders;
CREATE TRIGGER trigger_update_customer_stats_on_order
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_customer_stats_on_order();
-- ============================================
-- Migration: 20260131142711_18dd8146-a42b-4de4-a3cb-00a9d005307c.sql
-- ============================================
-- ========================================
-- FASE 3: RESTRINGIR POLÍTICAS RLS PERMISSIVAS
-- ========================================

-- 3.1 Políticas para order_items - restringir INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Authenticated can update order_items" ON order_items;

CREATE POLICY "Operators can insert order_items" ON order_items
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update order_items" ON order_items
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.2 Políticas para orders - restringir INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated can insert orders" ON orders;
DROP POLICY IF EXISTS "Authenticated can update orders" ON orders;

CREATE POLICY "Operators can insert orders" ON orders
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update orders" ON orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.3 Políticas para customers - restringir INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated can update customers" ON customers;

CREATE POLICY "Operators can insert customers" ON customers
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update customers" ON customers
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.4 Políticas para stock_movements
DROP POLICY IF EXISTS "Authenticated can insert stock_movements" ON stock_movements;

CREATE POLICY "Operators can insert stock_movements" ON stock_movements
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.5 Políticas para credit_entries
DROP POLICY IF EXISTS "Authenticated can insert credit_entries" ON credit_entries;
DROP POLICY IF EXISTS "Authenticated can update credit_entries" ON credit_entries;

CREATE POLICY "Operators can insert credit_entries" ON credit_entries
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator') OR
  has_role(auth.uid(), 'finance')
);

CREATE POLICY "Operators can update credit_entries" ON credit_entries
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator') OR
  has_role(auth.uid(), 'finance')
);

-- 3.6 Políticas para daily_sales_summary - apenas admins/managers podem gerenciar
DROP POLICY IF EXISTS "Authenticated can manage daily_sales_summary" ON daily_sales_summary;

CREATE POLICY "Admins can manage daily_sales_summary" ON daily_sales_summary
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

-- 3.7 Políticas para container_movements
DROP POLICY IF EXISTS "Authenticated can insert container_movements" ON container_movements;

CREATE POLICY "Operators can insert container_movements" ON container_movements
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.8 Políticas para addresses
DROP POLICY IF EXISTS "Authenticated can insert addresses" ON addresses;
DROP POLICY IF EXISTS "Authenticated can update addresses" ON addresses;

CREATE POLICY "Operators can insert addresses" ON addresses
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update addresses" ON addresses
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.9 Políticas para customer_addresses
DROP POLICY IF EXISTS "Authenticated can insert customer_addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Authenticated can update customer_addresses" ON customer_addresses;
DROP POLICY IF EXISTS "Authenticated can delete customer_addresses" ON customer_addresses;

CREATE POLICY "Operators can insert customer_addresses" ON customer_addresses
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update customer_addresses" ON customer_addresses
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can delete customer_addresses" ON customer_addresses
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.10 Políticas para customer_phones
DROP POLICY IF EXISTS "Authenticated can insert customer_phones" ON customer_phones;
DROP POLICY IF EXISTS "Authenticated can update customer_phones" ON customer_phones;
DROP POLICY IF EXISTS "Authenticated can delete customer_phones" ON customer_phones;

CREATE POLICY "Operators can insert customer_phones" ON customer_phones
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update customer_phones" ON customer_phones
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can delete customer_phones" ON customer_phones
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.11 Políticas para streets_index
DROP POLICY IF EXISTS "Authenticated can insert streets_index" ON streets_index;
DROP POLICY IF EXISTS "Authenticated can update streets_index" ON streets_index;

CREATE POLICY "Operators can insert streets_index" ON streets_index
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

CREATE POLICY "Operators can update streets_index" ON streets_index
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.12 Políticas para customer_tag_assignments
DROP POLICY IF EXISTS "Authenticated can manage customer_tag_assignments" ON customer_tag_assignments;

CREATE POLICY "Operators can manage customer_tag_assignments" ON customer_tag_assignments
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 3.13 Políticas para customer_product_agg e customer_payment_agg
DROP POLICY IF EXISTS "System can manage customer_product_agg" ON customer_product_agg;
DROP POLICY IF EXISTS "System can manage customer_payment_agg" ON customer_payment_agg;
DROP POLICY IF EXISTS "System can manage container_balances" ON container_balances;

CREATE POLICY "System can manage customer_product_agg" ON customer_product_agg
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "System can manage customer_payment_agg" ON customer_payment_agg
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

CREATE POLICY "System can manage container_balances" ON container_balances
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);

-- 3.14 Políticas para audit_logs (somente insert por sistema)
DROP POLICY IF EXISTS "System can insert audit_logs" ON audit_logs;

CREATE POLICY "System can insert audit_logs" ON audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);
-- ============================================
-- Migration: 20260131143144_ad6286bd-6eb3-473e-b7b6-80f503c01510.sql
-- ============================================
-- ========================================
-- FASE 4: CORRIGIR VIEWS SECURITY DEFINER
-- ========================================

-- 4.1 Recriar view vw_customers_by_street com security_invoker
DROP VIEW IF EXISTS vw_customers_by_street;
CREATE VIEW vw_customers_by_street 
WITH (security_invoker=on) AS
SELECT 
  c.id as customer_id,
  a.id as address_id,
  ca.is_default,
  c.name as customer_name,
  (SELECT phone_number FROM customer_phones WHERE customer_id = c.id AND is_primary = true LIMIT 1) as phone_primary,
  a.street_name,
  public.normalize_street_name(a.street_name) as street_name_normalized,
  a.house_number,
  n.name as neighborhood_name,
  a.complement,
  a.reference_point
FROM customers c
JOIN customer_addresses ca ON c.id = ca.customer_id
JOIN addresses a ON ca.address_id = a.id
LEFT JOIN neighborhoods n ON a.neighborhood_id = n.id
WHERE c.is_active = true;

-- 4.2 Recriar view vw_orders_time_analysis com security_invoker
DROP VIEW IF EXISTS vw_orders_time_analysis;
CREATE VIEW vw_orders_time_analysis 
WITH (security_invoker=on) AS
SELECT 
  o.id as order_id,
  o.created_at,
  o.delivered_at,
  o.status,
  o.total,
  o.customer_id,
  o.channel_id,
  o.delivery_person_id,
  EXTRACT(dow FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') as day_of_week,
  EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') as hour_of_day,
  CASE 
    WHEN EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 6 AND 11 THEN 'Manhã'
    WHEN EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 12 AND 17 THEN 'Tarde'
    WHEN EXTRACT(hour FROM o.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN 18 AND 22 THEN 'Noite'
    ELSE 'Madrugada'
  END as time_slot,
  CASE EXTRACT(dow FROM o.created_at AT TIME ZONE 'America/Sao_Paulo')
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda'
    WHEN 2 THEN 'Terça'
    WHEN 3 THEN 'Quarta'
    WHEN 4 THEN 'Quinta'
    WHEN 5 THEN 'Sexta'
    WHEN 6 THEN 'Sábado'
  END as day_name,
  oi.product_id,
  p.name as product_name,
  oi.quantity,
  oi.total_price as item_total
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id;

-- 4.3 Corrigir as 2 políticas RLS restantes com USING(true) para ALL
-- Identificar quais tabelas ainda têm políticas permissivas
-- Baseado no contexto, são provavelmente ap_bills e finance_transactions

-- Verificar e corrigir ap_bills
DROP POLICY IF EXISTS "Finance can manage ap_bills" ON ap_bills;
CREATE POLICY "Finance can manage ap_bills" ON ap_bills
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'finance')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'finance')
);

-- Verificar e corrigir finance_transactions INSERT
DROP POLICY IF EXISTS "Finance can insert finance_transactions" ON finance_transactions;
CREATE POLICY "Finance can insert finance_transactions" ON finance_transactions
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'finance')
);
-- ============================================
-- Migration: 20260131143244_a8f9ad75-efd2-4b6c-bfcb-877f7cdaca99.sql
-- ============================================
-- Corrigir as 2 políticas RLS restantes

-- 1. customer_alerts
DROP POLICY IF EXISTS "Authenticated can manage customer_alerts" ON customer_alerts;
CREATE POLICY "Operators can manage customer_alerts" ON customer_alerts
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR 
  has_role(auth.uid(), 'operator')
);

-- 2. customer_monthly_consumption
DROP POLICY IF EXISTS "System can manage customer_monthly_consumption" ON customer_monthly_consumption;
CREATE POLICY "Admins can manage customer_monthly_consumption" ON customer_monthly_consumption
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager')
);
-- ============================================
-- Migration: 20260219152926_0103fffd-8e8c-4baf-9d76-1626fce07ccc.sql
-- ============================================

-- ══════════════════════════════════════════════════
-- PHASE 2: Referral / Indication System
-- ══════════════════════════════════════════════════

CREATE TABLE public.loyalty_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES public.customers(id),
  referred_phone TEXT NOT NULL,
  referred_customer_id UUID REFERENCES public.customers(id),
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, expired, cancelled
  bonus_referrer INTEGER NOT NULL DEFAULT 0,
  bonus_referred INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_referrals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all referrals
CREATE POLICY "Authenticated can read loyalty_referrals"
  ON public.loyalty_referrals FOR SELECT
  USING (true);

-- Operators can manage referrals
CREATE POLICY "Operators can manage loyalty_referrals"
  ON public.loyalty_referrals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

-- Anon can read referrals (for client portal)
CREATE POLICY "Anon can read loyalty_referrals"
  ON public.loyalty_referrals FOR SELECT
  USING (true);

-- Anon can insert referrals (client portal creates them)
CREATE POLICY "Anon can insert loyalty_referrals"
  ON public.loyalty_referrals FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_loyalty_referrals_referrer ON public.loyalty_referrals(referrer_id);
CREATE INDEX idx_loyalty_referrals_code ON public.loyalty_referrals(referral_code);
CREATE INDEX idx_loyalty_referrals_referred_phone ON public.loyalty_referrals(referred_phone);

-- Trigger for updated_at
CREATE TRIGGER update_loyalty_referrals_updated_at
  BEFORE UPDATE ON public.loyalty_referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Migration: 20260219160955_966bc439-1b45-4d3b-a3d6-2289609cd073.sql
-- ============================================

-- Table for OTP codes (simulated, no SMS provider yet)
CREATE TABLE public.portal_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for phone lookups and cleanup
CREATE INDEX idx_portal_otp_phone ON public.portal_otp_codes (phone, created_at DESC);
CREATE INDEX idx_portal_otp_expires ON public.portal_otp_codes (expires_at) WHERE verified = false;

-- Enable RLS
ALTER TABLE public.portal_otp_codes ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) can manage OTP codes - no direct client access
CREATE POLICY "No direct access to otp_codes"
ON public.portal_otp_codes
FOR ALL
TO anon, authenticated
USING (false);

-- Add unique index on customer phone for E.164 normalization
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique 
ON public.customers (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- Update loyalty_client_tokens to add expiration
ALTER TABLE public.loyalty_client_tokens 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '30 days');

-- ============================================
-- Migration: 20260219173352_b6fe0ef4-ec71-41cd-a648-073db2d00ec8.sql
-- ============================================

-- Table to track link sends by operators
CREATE TABLE public.portal_link_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  operator_id uuid NOT NULL,
  send_method text NOT NULL DEFAULT 'copy', -- 'copy', 'whatsapp', 'sms'
  token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portal_link_sends ENABLE ROW LEVEL SECURITY;

-- Only authenticated operators can manage
CREATE POLICY "Authenticated can read portal_link_sends"
ON public.portal_link_sends FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operators can insert portal_link_sends"
ON public.portal_link_sends FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'operator'::app_role));

-- Index for operator metrics
CREATE INDEX idx_portal_link_sends_operator ON public.portal_link_sends (operator_id, created_at DESC);
CREATE INDEX idx_portal_link_sends_customer ON public.portal_link_sends (customer_id);

-- ============================================
-- Migration: 20260219174808_4ec3d9b7-3040-4d51-a71b-7a049e6ebec4.sql
-- ============================================
-- Add password hash column to customers for portal auth
ALTER TABLE public.customers ADD COLUMN portal_password_hash text;

-- We can drop the portal_otp_codes table since OTP is no longer used
-- But let's keep it for now in case there are references
-- Just add a comment
COMMENT ON TABLE public.portal_otp_codes IS 'Legacy OTP table - no longer used after password-based auth migration';
-- ============================================
-- Migration: 20260219182458_39f040b2-050e-4e77-94f7-cf37a34b9346.sql
-- ============================================

-- Function to auto-credit loyalty points when order is delivered
CREATE OR REPLACE FUNCTION public.credit_loyalty_points_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_points INTEGER := 0;
  v_rule RECORD;
  v_item RECORD;
  v_item_points INTEGER;
  v_descriptions TEXT[] := '{}';
BEGIN
  -- Only when status changes to 'delivered'
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Skip if no customer
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if points already credited for this order
  IF EXISTS (
    SELECT 1 FROM public.loyalty_ledger
    WHERE reference_id = NEW.id AND type = 'credit' AND origin = 'sale'
  ) THEN
    RETURN NEW;
  END IF;

  -- 1) Per-product rules: match order items to product-specific scoring rules
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.total_price, p.name as product_name
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    -- Check for product-specific rule
    SELECT * INTO v_rule
    FROM public.loyalty_scoring_rules
    WHERE is_active = true
      AND product_id = v_item.product_id
    LIMIT 1;

    IF FOUND THEN
      CASE v_rule.rule_type
        WHEN 'fixed' THEN
          v_item_points := (v_rule.points_value * v_item.quantity)::INTEGER;
        WHEN 'per_value' THEN
          v_item_points := FLOOR(v_item.total_price / GREATEST(v_rule.min_purchase_value, 1) * v_rule.points_value)::INTEGER;
        WHEN 'multiplier' THEN
          v_item_points := FLOOR(v_item.total_price * v_rule.points_value)::INTEGER;
        ELSE
          v_item_points := 0;
      END CASE;
      v_total_points := v_total_points + v_item_points;
    END IF;
  END LOOP;

  -- 2) Global rules (no product_id): apply to the whole order total
  FOR v_rule IN
    SELECT * FROM public.loyalty_scoring_rules
    WHERE is_active = true AND product_id IS NULL
  LOOP
    IF NEW.total >= COALESCE(v_rule.min_purchase_value, 0) THEN
      CASE v_rule.rule_type
        WHEN 'fixed' THEN
          v_total_points := v_total_points + v_rule.points_value::INTEGER;
        WHEN 'per_value' THEN
          v_total_points := v_total_points + FLOOR(NEW.total / GREATEST(v_rule.min_purchase_value, 1) * v_rule.points_value)::INTEGER;
        WHEN 'multiplier' THEN
          v_total_points := v_total_points + FLOOR(NEW.total * v_rule.points_value)::INTEGER;
        ELSE
          v_total_points := v_total_points;
      END CASE;
    END IF;
  END LOOP;

  -- 3) Apply active campaign multipliers/bonuses
  FOR v_rule IN
    SELECT * FROM public.loyalty_campaigns
    WHERE is_active = true
      AND starts_at <= now()
      AND ends_at >= now()
  LOOP
    IF v_rule.campaign_type = 'multiplier' THEN
      v_total_points := FLOOR(v_total_points * v_rule.multiplier)::INTEGER;
    ELSIF v_rule.campaign_type = 'bonus' AND v_rule.bonus_points IS NOT NULL THEN
      v_total_points := v_total_points + v_rule.bonus_points;
    END IF;
  END LOOP;

  -- Only insert if points > 0
  IF v_total_points > 0 THEN
    INSERT INTO public.loyalty_ledger (
      customer_id, type, points, origin, reference_id, description
    ) VALUES (
      NEW.customer_id, 'credit', v_total_points, 'sale', NEW.id,
      'Pontos automáticos - Pedido #' || NEW.order_number
    );

    -- Update customer balance
    UPDATE public.customers
    SET points_balance = COALESCE(points_balance, 0) + v_total_points
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trg_credit_loyalty_on_delivery ON public.orders;
CREATE TRIGGER trg_credit_loyalty_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_points_on_delivery();

-- ============================================
-- Migration: 20260219183402_76144706-7e81-4d85-a393-1d787d15ad8c.sql
-- ============================================

-- Replace the trigger function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.credit_loyalty_points_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_points INTEGER := 0;
  v_rule RECORD;
  v_item RECORD;
  v_item_points INTEGER;
BEGIN
  -- For UPDATE: only when status changes TO 'delivered'
  -- For INSERT: only when inserted with status 'delivered'
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status::text != 'delivered' OR OLD.status::text = 'delivered' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status::text != 'delivered' THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Skip if no customer
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if points already credited for this order (idempotency)
  IF EXISTS (
    SELECT 1 FROM public.loyalty_ledger
    WHERE reference_id = NEW.id AND type = 'credit' AND origin = 'sale'
  ) THEN
    RETURN NEW;
  END IF;

  -- 1) Per-product rules
  FOR v_item IN
    SELECT oi.product_id, oi.quantity, oi.total_price, p.name as product_name
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id
  LOOP
    SELECT * INTO v_rule
    FROM public.loyalty_scoring_rules
    WHERE is_active = true AND product_id = v_item.product_id
    LIMIT 1;

    IF FOUND THEN
      CASE v_rule.rule_type
        WHEN 'fixed' THEN
          v_item_points := (v_rule.points_value * v_item.quantity)::INTEGER;
        WHEN 'per_value' THEN
          v_item_points := FLOOR(v_item.total_price / GREATEST(v_rule.min_purchase_value, 1) * v_rule.points_value)::INTEGER;
        WHEN 'multiplier' THEN
          v_item_points := FLOOR(v_item.total_price * v_rule.points_value)::INTEGER;
        ELSE
          v_item_points := 0;
      END CASE;
      v_total_points := v_total_points + v_item_points;
    END IF;
  END LOOP;

  -- 2) Global rules (no product_id)
  FOR v_rule IN
    SELECT * FROM public.loyalty_scoring_rules
    WHERE is_active = true AND product_id IS NULL
  LOOP
    IF NEW.total >= COALESCE(v_rule.min_purchase_value, 0) THEN
      CASE v_rule.rule_type
        WHEN 'fixed' THEN
          v_total_points := v_total_points + v_rule.points_value::INTEGER;
        WHEN 'per_value' THEN
          v_total_points := v_total_points + FLOOR(NEW.total / GREATEST(v_rule.min_purchase_value, 1) * v_rule.points_value)::INTEGER;
        WHEN 'multiplier' THEN
          v_total_points := v_total_points + FLOOR(NEW.total * v_rule.points_value)::INTEGER;
        ELSE
          v_total_points := v_total_points;
      END CASE;
    END IF;
  END LOOP;

  -- 3) Apply active campaign multipliers/bonuses
  FOR v_rule IN
    SELECT * FROM public.loyalty_campaigns
    WHERE is_active = true AND starts_at <= now() AND ends_at >= now()
  LOOP
    IF v_rule.campaign_type = 'multiplier' THEN
      v_total_points := FLOOR(v_total_points * v_rule.multiplier)::INTEGER;
    ELSIF v_rule.campaign_type = 'bonus' AND v_rule.bonus_points IS NOT NULL THEN
      v_total_points := v_total_points + v_rule.bonus_points;
    END IF;
  END LOOP;

  -- Only insert if points > 0
  IF v_total_points > 0 THEN
    INSERT INTO public.loyalty_ledger (
      customer_id, type, points, origin, reference_id, description
    ) VALUES (
      NEW.customer_id, 'credit', v_total_points, 'sale', NEW.id,
      'Pontos automáticos - Pedido #' || NEW.order_number
    );

    UPDATE public.customers
    SET points_balance = COALESCE(points_balance, 0) + v_total_points
    WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Add INSERT trigger (the UPDATE trigger already exists)
CREATE TRIGGER trg_credit_loyalty_on_delivery_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_loyalty_points_on_delivery();

-- ============================================
-- Migration: 20260219184943_ade06563-d90a-4008-bf59-f0fbd5c2f1df.sql
-- ============================================
-- Allow anon to insert vouchers (portal redemption)
CREATE POLICY "Allow anon insert vouchers" ON public.loyalty_vouchers
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to insert ledger entries (portal redemption debit)
CREATE POLICY "Allow anon insert ledger" ON public.loyalty_ledger
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anon to read/update customers for balance (portal)
CREATE POLICY "Allow anon select customers" ON public.customers
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anon update customer balance" ON public.customers
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anon to read/update coupons stock
CREATE POLICY "Allow anon select coupons" ON public.loyalty_coupons
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow anon update coupon stock" ON public.loyalty_coupons
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
-- ============================================
-- Migration: 20260219190420_0c5a54a0-9443-488c-9ca8-dc85709e9d79.sql
-- ============================================

ALTER TABLE public.loyalty_coupons
ADD COLUMN whatsapp_phone text,
ADD COLUMN whatsapp_message text DEFAULT 'Olá! Resgatei o cupom *{codigo}* do programa de fidelidade. Gostaria de utilizar meu voucher!';

-- ============================================
-- Migration: 20260219191616_9a963253-cb36-4f5d-80dd-007a1c7869f5.sql
-- ============================================

-- Create the trigger that was missing
CREATE TRIGGER trg_credit_loyalty_points_on_delivery
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.credit_loyalty_points_on_delivery();

-- ============================================
-- Migration: 20260304154251_5d87fe0c-98d2-4955-9a62-05fdb8c8625f.sql
-- ============================================
ALTER TABLE public.sales_channels ADD COLUMN delivery_fee numeric DEFAULT 0;
-- ============================================
-- Migration: 20260417000000_whatsapp_zapi.sql
-- ============================================
-- Z-API WhatsApp Integration

-- Configuration (single row, stores Z-API credentials)
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL DEFAULT '',
  token text NOT NULL DEFAULT '',
  phone text,
  status text NOT NULL DEFAULT 'disconnected',
  webhook_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_config_rw" ON public.whatsapp_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.whatsapp_config (id, instance_id, token)
VALUES ('00000000-0000-0000-0000-000000000099', '', '')
ON CONFLICT (id) DO NOTHING;

-- Conversations (one row per phone number)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  contact_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversations_phone_key UNIQUE (phone)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_conversations_rw" ON public.whatsapp_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Messages (individual messages per conversation)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'sent',
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_message_id_key UNIQUE (message_id)
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages_rw" ON public.whatsapp_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for live updates in the inbox
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

