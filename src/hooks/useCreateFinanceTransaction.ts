import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateTransactionParams {
  type: 'IN' | 'OUT';
  amount: number;
  transaction_date: string;
  payment_method_id?: string | null;
  description?: string | null;
  source_module: 'sales' | 'wallet' | 'stock' | 'expense' | 'payroll';
  source_id?: string | null;
}

export function useCreateFinanceTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: CreateTransactionParams) => {
      const { data, error } = await supabase
        .from('finance_transactions')
        .insert(transaction)
        .select(`
          *,
          payment_method:payment_methods(id, name)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['daily-cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['dre-data'] });
      toast.success('Lançamento registrado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao registrar lançamento: ' + error.message);
    },
  });
}
