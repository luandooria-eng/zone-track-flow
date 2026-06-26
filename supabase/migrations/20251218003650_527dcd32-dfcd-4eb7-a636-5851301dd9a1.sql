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