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