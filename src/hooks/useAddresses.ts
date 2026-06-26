import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Address {
  id: string;
  street_name: string;
  house_number: string;
  neighborhood_id: string | null;
  complement: string | null;
  reference_point: string | null;
  city: string | null;
  zip_code: string | null;
  address_key: string;
  created_at: string;
  updated_at: string;
  neighborhood?: {
    id: string;
    name: string;
  } | null;
}

export interface AddressWithCustomers extends Address {
  customers: {
    id: string;
    name: string;
    phone: string | null;
  }[];
}

// Normalize address key locally (same logic as DB function)
export function normalizeAddressKey(
  street: string,
  number: string,
  neighborhoodName: string
): string {
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  return `${normalize(street)}|${number.toLowerCase().trim()}|${normalize(neighborhoodName)}`;
}

export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select(`
          *,
          neighborhood:neighborhoods(id, name)
        `)
        .order('street_name');

      if (error) throw error;
      return data as Address[];
    },
  });
}

export function useSearchAddresses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      street,
      number,
      neighborhoodId,
    }: {
      street: string;
      number: string;
      neighborhoodId: string;
    }) => {
      // First get neighborhood name
      const { data: neighborhood } = await supabase
        .from('neighborhoods')
        .select('name')
        .eq('id', neighborhoodId)
        .single();

      if (!neighborhood) return null;

      const addressKey = normalizeAddressKey(street, number, neighborhood.name);

      // Search for existing address
      const { data: existingAddress, error } = await supabase
        .from('addresses')
        .select(`
          *,
          neighborhood:neighborhoods(id, name)
        `)
        .eq('address_key', addressKey)
        .maybeSingle();

      if (error) throw error;

      if (!existingAddress) return null;

      // Get customers linked to this address
      const { data: customerAddresses } = await supabase
        .from('customer_addresses')
        .select(`
          customer:customers(id, name, phone)
        `)
        .eq('address_id', existingAddress.id);

      const customers = customerAddresses
        ?.map((ca: any) => ca.customer)
        .filter(Boolean) || [];

      return {
        ...existingAddress,
        customers,
      } as AddressWithCustomers;
    },
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      street_name,
      house_number,
      neighborhood_id,
      complement,
      reference_point,
      city,
      zip_code,
    }: {
      street_name: string;
      house_number: string;
      neighborhood_id: string;
      complement?: string;
      reference_point?: string;
      city?: string;
      zip_code?: string;
    }) => {
      // Get neighborhood name to generate address_key
      const { data: neighborhood } = await supabase
        .from('neighborhoods')
        .select('name')
        .eq('id', neighborhood_id)
        .single();

      if (!neighborhood) throw new Error('Bairro não encontrado');

      const address_key = normalizeAddressKey(street_name, house_number, neighborhood.name);

      const { data, error } = await supabase
        .from('addresses')
        .insert({
          street_name,
          house_number,
          neighborhood_id,
          complement: complement || null,
          reference_point: reference_point || null,
          city: city || 'Lagarto',
          zip_code: zip_code || null,
          address_key,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Unique violation - address already exists
          const { data: existing } = await supabase
            .from('addresses')
            .select('*')
            .eq('address_key', address_key)
            .single();
          return existing;
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
    },
  });
}

export function useLinkCustomerToAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customer_id,
      address_id,
      is_default = true,
    }: {
      customer_id: string;
      address_id: string;
      is_default?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id,
          address_id,
          is_default,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Already linked
          return null;
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
    },
  });
}

export function useCustomerAddresses(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('customer_addresses')
        .select(`
          *,
          address:addresses(
            *,
            neighborhood:neighborhoods(id, name)
          )
        `)
        .eq('customer_id', customerId);

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}
