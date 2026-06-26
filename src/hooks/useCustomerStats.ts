import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerProductAgg {
  product_id: string;
  qty_total: number;
  amount_total: number;
  product?: {
    name: string;
  };
}

export interface CustomerPaymentAgg {
  payment_method_id: string;
  count_total: number;
  amount_total: number;
  payment_method?: {
    name: string;
  };
}

export interface CustomerOrder {
  id: string;
  order_number: number;
  total: number;
  status: string;
  created_at: string;
}

export function useCustomerProductAgg(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-product-agg', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_product_agg')
        .select(`
          product_id,
          qty_total,
          amount_total,
          products:product_id (name)
        `)
        .eq('customer_id', customerId)
        .order('qty_total', { ascending: false });
      
      if (error) throw error;
      return data as unknown as CustomerProductAgg[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerPaymentAgg(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-payment-agg', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_payment_agg')
        .select(`
          payment_method_id,
          count_total,
          amount_total,
          payment_methods:payment_method_id (name)
        `)
        .eq('customer_id', customerId)
        .order('count_total', { ascending: false });
      
      if (error) throw error;
      return data as unknown as CustomerPaymentAgg[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerOrders(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, status, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data as CustomerOrder[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerOpenCredit(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-open-credit', customerId],
    queryFn: async () => {
      if (!customerId) return 0;
      
      const { data, error } = await supabase
        .from('credit_entries')
        .select('amount, paid_amount')
        .eq('customer_id', customerId)
        .in('status', ['open', 'partial', 'overdue']);
      
      if (error) throw error;
      
      return data.reduce((acc, entry) => {
        const pending = (entry.amount || 0) - (entry.paid_amount || 0);
        return acc + pending;
      }, 0);
    },
    enabled: !!customerId,
  });
}

export function useNeighborhoodRanking(customerId: string | undefined, neighborhoodId: string | undefined) {
  return useQuery({
    queryKey: ['neighborhood-ranking', customerId, neighborhoodId],
    queryFn: async () => {
      if (!customerId || !neighborhoodId) return null;
      
      const { data, error } = await supabase
        .from('customers')
        .select('id, total_spent')
        .eq('neighborhood_id', neighborhoodId)
        .order('total_spent', { ascending: false });
      
      if (error) throw error;
      
      const ranking = data.findIndex(c => c.id === customerId) + 1;
      return ranking > 0 ? ranking : null;
    },
    enabled: !!customerId && !!neighborhoodId,
  });
}
