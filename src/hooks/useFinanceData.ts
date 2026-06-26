import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  FinanceTransaction, 
  ApBill, 
  Vendor, 
  RecurringRule, 
  ExpenseCategory,
  FinanceKPIs,
  DailyCashFlow 
} from '@/types/finance';

// Fetch finance transactions
export function useFinanceTransactions(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['finance-transactions', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('finance_transactions')
        .select(`
          *,
          payment_method:payment_methods(id, name)
        `)
        .order('transaction_date', { ascending: false });

      if (startDate) {
        // Use proper ISO timestamp comparison
        query = query.gte('transaction_date', startDate);
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      console.log('Finance transactions fetched:', data?.length, 'from', startDate, 'to', endDate);
      return data as FinanceTransaction[];
    },
  });
}

// Fetch accounts payable
export function useApBills(status?: string) {
  return useQuery({
    queryKey: ['ap-bills', status],
    queryFn: async () => {
      let query = supabase
        .from('ap_bills')
        .select(`
          *,
          vendor:vendors(id, name),
          category:expense_categories(id, name, type),
          payment_method:payment_methods(id, name)
        `)
        .order('due_date', { ascending: true });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ApBill[];
    },
  });
}

// Fetch vendors
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Vendor[];
    },
  });
}

// Fetch expense categories
export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
}

// Fetch recurring rules
export function useRecurringRules() {
  return useQuery({
    queryKey: ['recurring-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select(`
          *,
          category:expense_categories(id, name, type),
          vendor:vendors(id, name)
        `)
        .order('name');

      if (error) throw error;
      return data as RecurringRule[];
    },
  });
}

// Calculate finance KPIs
export function useFinanceKPIs(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['finance-kpis', startDate, endDate],
    queryFn: async () => {
      // Fetch transactions for the period
      const { data: transactions, error: txError } = await supabase
        .from('finance_transactions')
        .select('type, amount')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      if (txError) throw txError;

      // Fetch all transactions for cash balance
      const { data: allTransactions, error: allTxError } = await supabase
        .from('finance_transactions')
        .select('type, amount');

      if (allTxError) throw allTxError;

      // Fetch credit entries (receivables)
      const { data: creditEntries, error: creditError } = await supabase
        .from('credit_entries')
        .select('amount, paid_amount, status, due_date');

      if (creditError) throw creditError;

      // Fetch accounts payable
      const { data: apBills, error: apError } = await supabase
        .from('ap_bills')
        .select('amount, status, due_date');

      if (apError) throw apError;

      const today = new Date().toISOString().split('T')[0];

      // Calculate KPIs
      const totalIncome = (transactions || [])
        .filter(t => t.type === 'IN')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const totalExpenses = (transactions || [])
        .filter(t => t.type === 'OUT')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const allIncome = (allTransactions || [])
        .filter(t => t.type === 'IN')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const allExpenses = (allTransactions || [])
        .filter(t => t.type === 'OUT')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const cashBalance = allIncome - allExpenses;

      const receivablesOpen = (creditEntries || [])
        .filter(e => e.status === 'open' || e.status === 'partial')
        .reduce((sum, e) => sum + (Number(e.amount) - Number(e.paid_amount || 0)), 0);

      const receivablesOverdue = (creditEntries || [])
        .filter(e => (e.status === 'open' || e.status === 'partial') && e.due_date < today)
        .reduce((sum, e) => sum + (Number(e.amount) - Number(e.paid_amount || 0)), 0);

      const payablesOpen = (apBills || [])
        .filter(b => b.status === 'open')
        .reduce((sum, b) => sum + Number(b.amount), 0);

      const payablesOverdue = (apBills || [])
        .filter(b => b.status === 'open' && b.due_date < today)
        .reduce((sum, b) => sum + Number(b.amount), 0);

      return {
        totalIncome,
        totalExpenses,
        cashBalance,
        receivablesOpen,
        receivablesOverdue,
        payablesOpen,
        payablesOverdue,
        periodResult: totalIncome - totalExpenses,
      } as FinanceKPIs;
    },
  });
}

// Daily cash flow for charts
export function useDailyCashFlow(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['daily-cash-flow', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_transactions')
        .select('type, amount, transaction_date')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date');

      if (error) throw error;

      // Group by date
      const dailyData: Record<string, { income: number; expenses: number }> = {};
      
      (data || []).forEach(tx => {
        const date = tx.transaction_date.split('T')[0];
        if (!dailyData[date]) {
          dailyData[date] = { income: 0, expenses: 0 };
        }
        if (tx.type === 'IN') {
          dailyData[date].income += Number(tx.amount);
        } else {
          dailyData[date].expenses += Number(tx.amount);
        }
      });

      // Convert to array with running balance
      let balance = 0;
      return Object.entries(dailyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { income, expenses }]) => {
          balance += income - expenses;
          return { date, income, expenses, balance };
        }) as DailyCashFlow[];
    },
  });
}

// Create vendor
export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert(vendor)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Fornecedor cadastrado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar fornecedor: ' + error.message);
    },
  });
}

// Create AP Bill
export function useCreateApBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bill: {
      vendor_id?: string | null;
      category_id?: string | null;
      due_date: string;
      amount: number;
      status?: string;
      notes?: string | null;
      is_recurring?: boolean;
      recurring_rule_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('ap_bills')
        .insert(bill)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-bills'] });
      queryClient.invalidateQueries({ queryKey: ['finance-kpis'] });
      toast.success('Conta a pagar cadastrada');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar conta: ' + error.message);
    },
  });
}

// Pay AP Bill
export function usePayApBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      billId, 
      paymentMethodId 
    }: { 
      billId: string; 
      paymentMethodId: string;
    }) => {
      const { data, error } = await supabase
        .from('ap_bills')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          paid_payment_method_id: paymentMethodId,
        })
        .eq('id', billId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-bills'] });
      queryClient.invalidateQueries({ queryKey: ['finance-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-kpis'] });
      toast.success('Pagamento registrado');
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });
}

// Create recurring rule
export function useCreateRecurringRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: {
      type: 'expense' | 'payroll';
      name: string;
      amount_default: number;
      day_of_month: number;
      category_id?: string | null;
      vendor_id?: string | null;
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .insert(rule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-rules'] });
      toast.success('Recorrência cadastrada');
    },
    onError: (error) => {
      toast.error('Erro ao cadastrar recorrência: ' + error.message);
    },
  });
}

// Generate monthly bills from recurring rules
export function useGenerateRecurringBills() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: rules, error: rulesError } = await supabase
        .from('recurring_rules')
        .select('*')
        .eq('is_active', true);

      if (rulesError) throw rulesError;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const billsToCreate = (rules || []).map(rule => ({
        vendor_id: rule.vendor_id,
        category_id: rule.category_id,
        due_date: new Date(currentYear, currentMonth, rule.day_of_month).toISOString().split('T')[0],
        amount: rule.amount_default,
        status: 'open' as const,
        is_recurring: true,
        recurring_rule_id: rule.id,
        notes: `Gerado automaticamente: ${rule.name}`,
      }));

      if (billsToCreate.length === 0) {
        return { created: 0 };
      }

      const { data, error } = await supabase
        .from('ap_bills')
        .insert(billsToCreate)
        .select();

      if (error) throw error;
      return { created: data?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ap-bills'] });
      queryClient.invalidateQueries({ queryKey: ['finance-kpis'] });
      toast.success(`${result.created} contas geradas com sucesso`);
    },
    onError: (error) => {
      toast.error('Erro ao gerar contas: ' + error.message);
    },
  });
}
