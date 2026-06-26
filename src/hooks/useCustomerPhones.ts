import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerPhone {
  id: string;
  customer_id: string;
  phone_number: string;
  label: string;
  is_whatsapp: boolean;
  is_primary: boolean;
  created_at: string;
}

export interface PhoneWithCustomer {
  id: string;
  phone_number: string;
  label: string;
  is_whatsapp: boolean;
  is_primary: boolean;
  customer: {
    id: string;
    name: string;
  };
}

export function useCustomerPhones(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-phones', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await supabase
        .from('customer_phones')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data as CustomerPhone[];
    },
    enabled: !!customerId,
  });
}

export function useSearchPhoneNumber() {
  return useMutation({
    mutationFn: async (phoneNumber: string) => {
      // Normalize phone number (remove non-digits)
      const normalized = phoneNumber.replace(/\D/g, '');

      const { data, error } = await supabase
        .from('customer_phones')
        .select(`
          *,
          customer:customers(id, name)
        `)
        .ilike('phone_number', `%${normalized}%`);

      if (error) throw error;
      return data as PhoneWithCustomer[];
    },
  });
}

export function useAddCustomerPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customer_id,
      phone_number,
      label = 'principal',
      is_whatsapp = true,
      is_primary = false,
    }: {
      customer_id: string;
      phone_number: string;
      label?: string;
      is_whatsapp?: boolean;
      is_primary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('customer_phones')
        .insert({
          customer_id,
          phone_number,
          label,
          is_whatsapp,
          is_primary,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-phones', variables.customer_id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomerPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      customer_id,
      ...updates
    }: {
      id: string;
      customer_id: string;
      phone_number?: string;
      label?: string;
      is_whatsapp?: boolean;
      is_primary?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('customer_phones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-phones', variables.customer_id] });
    },
  });
}

export function useDeleteCustomerPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, customer_id }: { id: string; customer_id: string }) => {
      const { error } = await supabase
        .from('customer_phones')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-phones', variables.customer_id] });
    },
  });
}

export function useMovePhoneToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      phone_id,
      from_customer_id,
      to_customer_id,
    }: {
      phone_id: string;
      from_customer_id: string;
      to_customer_id: string;
    }) => {
      const { data, error } = await supabase
        .from('customer_phones')
        .update({ customer_id: to_customer_id, is_primary: false })
        .eq('id', phone_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-phones', variables.from_customer_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-phones', variables.to_customer_id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
