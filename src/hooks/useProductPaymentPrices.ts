import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductPaymentPrice {
  id: string;
  product_id: string;
  payment_method_id: string;
  price: number;
  created_at: string;
  updated_at: string;
}

export function useProductPaymentPrices(productId?: string) {
  return useQuery({
    queryKey: ['product-payment-prices', productId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('product_payment_prices')
        .select('*');
      
      if (productId) {
        query = query.eq('product_id', productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ProductPaymentPrice[];
    },
    staleTime: productId ? 0 : 5 * 60 * 1000,
  });
}

export function useUpsertProductPaymentPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ product_id, payment_method_id, price }: { 
      product_id: string; 
      payment_method_id: string; 
      price: number 
    }) => {
      const { data, error } = await supabase
        .from('product_payment_prices')
        .upsert(
          { product_id, payment_method_id, price },
          { onConflict: 'product_id,payment_method_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-payment-prices'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar preço', { description: error.message });
    },
  });
}

export function useDeleteProductPaymentPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_payment_prices')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-payment-prices'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover preço', { description: error.message });
    },
  });
}
