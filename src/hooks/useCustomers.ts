import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerPhone {
  id: string;
  phone_number: string;
  label: string | null;
  is_whatsapp: boolean | null;
  is_primary: boolean | null;
}

export interface CustomerAddress {
  id: string;
  is_default: boolean | null;
  address: {
    id: string;
    street_name: string;
    house_number: string;
    complement: string | null;
    reference_point: string | null;
    neighborhood: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface CustomerFromDB {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  neighborhood_id: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  reference: string | null;
  notes: string | null;
  credit_limit: number | null;
  credit_balance: number | null;
  last_order_at: string | null;
  total_orders: number | null;
  total_spent: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  top_product_id: string | null;
  top_payment_method_id: string | null;
  neighborhood?: {
    id: string;
    name: string;
  } | null;
  top_product?: {
    id: string;
    name: string;
  } | null;
  top_payment_method?: {
    id: string;
    name: string;
  } | null;
  // New related data
  phones?: CustomerPhone[];
  addresses?: CustomerAddress[];
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      // Fetch customers with related data in a single query
      const { data: customers, error } = await supabase
        .from('customers')
        .select(`
          *,
          neighborhood:neighborhoods(id, name),
          top_product:products!customers_top_product_id_fkey(id, name),
          top_payment_method:payment_methods!customers_top_payment_method_id_fkey(id, name)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      if (!customers || customers.length === 0) return [] as CustomerFromDB[];

      const customerIds = customers.map(c => c.id);

      // Fetch phones and addresses in parallel
      const [phonesResult, addressesResult] = await Promise.all([
        supabase
          .from('customer_phones')
          .select('*')
          .in('customer_id', customerIds),
        supabase
          .from('customer_addresses')
          .select(`
            id,
            customer_id,
            is_default,
            address:addresses(
              id,
              street_name,
              house_number,
              complement,
              reference_point,
              neighborhood:neighborhoods(id, name)
            )
          `)
          .in('customer_id', customerIds)
      ]);

      const phones = phonesResult.data || [];
      const customerAddresses = addressesResult.data || [];

      // Create lookup maps for O(1) access
      const phonesByCustomer = new Map<string, typeof phones>();
      phones.forEach(p => {
        const existing = phonesByCustomer.get(p.customer_id) || [];
        existing.push(p);
        phonesByCustomer.set(p.customer_id, existing);
      });

      const addressesByCustomer = new Map<string, typeof customerAddresses>();
      customerAddresses.forEach((a: any) => {
        const existing = addressesByCustomer.get(a.customer_id) || [];
        existing.push(a);
        addressesByCustomer.set(a.customer_id, existing);
      });

      // Map phones and addresses to customers
      const customersWithRelations = customers.map(customer => {
        const customerPhones = phonesByCustomer.get(customer.id) || [];
        const customerAddrs = addressesByCustomer.get(customer.id) || [];
        
        // Get primary phone
        const primaryPhone = customerPhones.find(p => p.is_primary) || customerPhones[0];
        
        // Get default address
        const defaultAddress = customerAddrs.find((a: any) => a.is_default) || customerAddrs[0];
        
        return {
          ...customer,
          phones: customerPhones,
          addresses: customerAddrs,
          // Update legacy fields from new model for backwards compatibility
          phone: primaryPhone?.phone_number || customer.phone,
          street: defaultAddress?.address?.street_name || customer.street,
          number: defaultAddress?.address?.house_number || customer.number,
          complement: defaultAddress?.address?.complement || customer.complement,
          reference: defaultAddress?.address?.reference_point || customer.reference,
          neighborhood: defaultAddress?.address?.neighborhood || customer.neighborhood,
          neighborhood_id: defaultAddress?.address?.neighborhood?.id || customer.neighborhood_id,
        };
      });

      return customersWithRelations as unknown as CustomerFromDB[];
    },
    staleTime: 30000, // Cache for 30 seconds to prevent rapid re-fetches
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      // Force refetch to update the UI immediately
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.refetchQueries({ queryKey: ['customers'] });
    },
  });
}

export function useAddCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customer: {
      name: string;
      cpf?: string;
      email?: string;
      notes?: string;
      credit_limit?: number;
    }) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
