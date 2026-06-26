import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CreditEntry, CreditEntryStatus } from '@/types';
import { toast } from 'sonner';

interface CreditEntryFromDB {
  id: string;
  customer_id: string;
  order_id: string | null;
  amount: number;
  paid_amount: number | null;
  due_date: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    street: string | null;
    neighborhood_id: string | null;
  } | null;
  order: {
    id: string;
    order_number: number;
    total: number;
    status: string;
    created_at: string;
    payment_method: {
      id: string;
      name: string;
    } | null;
    order_items: {
      id: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      product: {
        id: string;
        name: string;
      } | null;
    }[];
  } | null;
}

function mapStatusFromDB(dbStatus: string): CreditEntryStatus {
  const statusMap: Record<string, CreditEntryStatus> = {
    'open': 'pending',
    'pending': 'pending',
    'paid': 'paid',
    'partial': 'partial',
    'overdue': 'overdue',
    'renegotiated': 'renegotiated',
  };
  return statusMap[dbStatus] || 'pending';
}

function mapCreditEntryFromDB(entry: CreditEntryFromDB): CreditEntry {
  // Check if overdue (due date passed and not paid)
  const dueDate = new Date(entry.due_date);
  const isOverdue = dueDate < new Date() && entry.status !== 'paid';
  
  return {
    id: entry.id,
    creditAccountId: entry.customer_id,
    customerId: entry.customer_id,
    customerName: entry.customer?.name || 'Cliente Desconhecido',
    orderId: entry.order_id || undefined,
    order: entry.order ? {
      id: entry.order.id,
      customerId: entry.customer_id,
      customerName: entry.customer?.name || '',
      channelId: '',
      channelName: '',
      status: entry.order.status as 'accepted' | 'sent' | 'delivered' | 'canceled',
      totalAmount: entry.order.total,
      paymentMethodId: entry.order.payment_method?.id || '',
      paymentMethodName: entry.order.payment_method?.name || 'Crediário',
      deliveryPersonId: '',
      deliveryPersonName: '',
      deliveryAddress: {
        street: entry.customer?.street || '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
      },
      items: entry.order.order_items.map(item => ({
        id: item.id,
        productId: item.product?.id || '',
        productName: item.product?.name || 'Produto',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
      })),
      createdAt: new Date(entry.order.created_at),
      updatedAt: new Date(entry.order.created_at),
    } : undefined,
    amount: Number(entry.amount) - Number(entry.paid_amount || 0),
    originalAmount: Number(entry.amount),
    dueDate: dueDate,
    status: isOverdue ? 'overdue' : mapStatusFromDB(entry.status),
    paidAt: entry.paid_at ? new Date(entry.paid_at) : undefined,
    paidAmount: Number(entry.paid_amount || 0),
    createdAt: new Date(entry.created_at),
  };
}

export function useCreditEntries() {
  return useQuery({
    queryKey: ['credit-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_entries')
        .select(`
          *,
          customer:customers(id, name, phone, email, street, neighborhood_id),
          order:orders(
            id,
            order_number,
            total,
            status,
            created_at,
            payment_method:payment_methods(id, name),
            order_items(
              id,
              quantity,
              unit_price,
              total_price,
              product:products(id, name)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar créditos:', error);
        throw error;
      }

      return (data as unknown as CreditEntryFromDB[]).map(mapCreditEntryFromDB);
    },
  });
}

export function useCreditKPIs(entries: CreditEntry[]) {
  const totalOpen = entries
    .filter((e) => e.status === 'pending' || e.status === 'partial' || e.status === 'overdue')
    .reduce((acc, e) => acc + e.amount, 0);

  const dueIn7Days = entries
    .filter((e) => {
      if (e.status !== 'pending' && e.status !== 'partial') return false;
      const daysUntilDue = Math.ceil((e.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue <= 7 && daysUntilDue >= 0;
    })
    .reduce((acc, e) => acc + e.amount, 0);

  const overdue = entries
    .filter((e) => e.status === 'overdue')
    .reduce((acc, e) => acc + e.amount, 0);

  const overdueRate = totalOpen > 0 ? (overdue / totalOpen) * 100 : 0;

  const overdueEntries = entries.filter((e) => e.status === 'overdue');
  const pendingEntries = entries.filter((e) => e.status === 'pending' || e.status === 'partial');

  return {
    totalOpen,
    dueIn7Days,
    overdue,
    overdueRate,
    overdueEntries,
    pendingEntries,
  };
}

interface RegisterPaymentParams {
  creditEntryId: string;
  customerId: string;
  paymentAmount: number;
  paymentMethodId: string;
  currentPaidAmount: number;
  totalAmount: number;
}

export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      creditEntryId,
      customerId,
      paymentAmount,
      paymentMethodId,
      currentPaidAmount,
      totalAmount,
    }: RegisterPaymentParams) => {
      const pendingAmount = totalAmount - currentPaidAmount;

      // Validations
      if (paymentAmount <= 0) {
        throw new Error('O valor do pagamento deve ser maior que zero');
      }
      if (paymentAmount > pendingAmount) {
        throw new Error(`O valor não pode ser maior que o pendente (R$ ${pendingAmount.toFixed(2)})`);
      }

      const newPaidAmount = currentPaidAmount + paymentAmount;
      const newStatus = newPaidAmount >= totalAmount ? 'paid' : 'partial';
      const paidAt = newPaidAmount >= totalAmount ? new Date().toISOString() : null;

      // Update credit entry
      const { error: creditError } = await supabase
        .from('credit_entries')
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          paid_at: paidAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', creditEntryId);

      if (creditError) {
        console.error('Erro ao atualizar título:', creditError);
        throw new Error('Erro ao atualizar título de crédito');
      }

      // Update customer credit balance directly
      const { data: customer } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', customerId)
        .single();

      if (customer) {
        const newBalance = Math.max(0, (customer.credit_balance || 0) - paymentAmount);
        const { error: customerError } = await supabase
          .from('customers')
          .update({ credit_balance: newBalance })
          .eq('id', customerId);

        if (customerError) {
          console.error('Erro ao atualizar saldo do cliente:', customerError);
        }
      }

      return { newStatus, newPaidAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credit-entries'] });
      const statusLabel = data.newStatus === 'paid' ? 'PAGO' : 'PARCIAL';
      toast.success(`Pagamento registrado! Status: ${statusLabel}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

interface BatchMarkAsPaidParams {
  entries: {
    creditEntryId: string;
    customerId: string;
    amount: number;
    paidAmount: number;
  }[];
  paymentMethodId: string;
}

export function useBatchMarkAsPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entries, paymentMethodId }: BatchMarkAsPaidParams) => {
      let successCount = 0;
      let errorCount = 0;

      for (const entry of entries) {
        const pendingAmount = entry.amount;
        const newPaidAmount = entry.paidAmount + pendingAmount;

        // Update credit entry to paid
        const { error: creditError } = await supabase
          .from('credit_entries')
          .update({
            paid_amount: newPaidAmount,
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.creditEntryId);

        if (creditError) {
          console.error('Erro ao atualizar título:', creditError);
          errorCount++;
          continue;
        }

        // Update customer credit balance
        const { data: customer } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', entry.customerId)
          .single();

        if (customer) {
          const newBalance = Math.max(0, (customer.credit_balance || 0) - pendingAmount);
          await supabase
            .from('customers')
            .update({ credit_balance: newBalance })
            .eq('id', entry.customerId);
        }

        successCount++;
      }

      return { successCount, errorCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['credit-entries'] });
      if (data.errorCount === 0) {
        toast.success(`${data.successCount} título(s) marcado(s) como pago!`);
      } else {
        toast.warning(`${data.successCount} pago(s), ${data.errorCount} erro(s)`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
