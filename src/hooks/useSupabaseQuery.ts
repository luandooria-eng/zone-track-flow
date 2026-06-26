import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Customer,
  Product,
  Order,
  OrderItem,
  Neighborhood,
  SalesChannel,
  PaymentMethod,
  DeliveryPerson,
  CreditEntry,
  DailySalesSummary,
  StockMovement,
  AuditLog,
  CustomerInsert,
  ProductInsert,
  OrderInsert,
  OrderItemInsert,
  NeighborhoodInsert,
  SalesChannelInsert,
  PaymentMethodInsert,
  DeliveryPersonInsert,
  OrderStatus,
} from '@/types/database';
import { toast } from 'sonner';

// ============ CUSTOMERS ============
export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*, neighborhood:neighborhoods(*)')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*, neighborhood:neighborhoods(*)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customer: CustomerInsert) => {
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
      toast.success('Cliente cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar cliente', { description: error.message });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar cliente', { description: error.message });
    },
  });
}

// ============ PRODUCTS ============
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (product: ProductInsert) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto cadastrado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar produto', { description: error.message });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar produto', { description: error.message });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto excluído!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir produto', { description: error.message });
    },
  });
}

// ============ STOCK MOVEMENTS ============
export function useStockMovements(productId?: string) {
  return useQuery({
    queryKey: ['stock-movements', productId],
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StockMovement[];
    },
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (movement: {
      product_id: string;
      quantity: number;
      type: 'in' | 'out' | 'adjustment';
      reason?: string;
      vendor_id?: string;
      purchase_value?: number;
      is_paid?: boolean;
      due_date?: string;
    }) => {
      // Get current stock
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', movement.product_id)
        .single();
      if (productError) throw productError;

      const previousStock = product.current_stock;
      const newStock = previousStock + movement.quantity;

      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', movement.product_id);
      if (updateError) throw updateError;

      // Create movement record with optional vendor and purchase fields
      const movementData = {
        product_id: movement.product_id,
        quantity: movement.quantity,
        type: movement.type,
        reason: movement.reason || null,
        previous_stock: previousStock,
        new_stock: newStock,
        vendor_id: movement.type === 'in' && movement.vendor_id ? movement.vendor_id : null,
        purchase_value: movement.type === 'in' && movement.purchase_value ? movement.purchase_value : null,
        is_paid: movement.type === 'in' ? (movement.is_paid || false) : null,
        due_date: movement.type === 'in' && !movement.is_paid && movement.due_date ? movement.due_date : null,
      };

      const { data, error } = await supabase
        .from('stock_movements')
        .insert(movementData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['ap-bills'] });
      queryClient.invalidateQueries({ queryKey: ['finance-kpis'] });
      toast.success('Movimentação registrada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar movimentação', { description: error.message });
    },
  });
}

// ============ ORDERS ============
export function useOrders(filters?: { status?: OrderStatus; date?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:customers(*),
          channel:sales_channels(*),
          payment_method:payment_methods(*),
          delivery_person:delivery_people(*),
          neighborhood:neighborhoods(*),
          items:order_items(*, product:products(*))
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.date) {
        query = query.gte('created_at', `${filters.date}T00:00:00`)
          .lt('created_at', `${filters.date}T23:59:59`);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', `${filters.startDate}T00:00:00`);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', `${filters.endDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Order[];
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ order, items }: { order: OrderInsert; items: Omit<OrderItemInsert, 'order_id'>[] }) => {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single();
      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        ...item,
        order_id: orderData.id,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      if (itemsError) throw itemsError;

      return orderData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar pedido', { description: error.message });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, cancel_reason }: { id: string; status: OrderStatus; cancel_reason?: string }) => {
      const updates: Partial<Order> = { status };
      
      if (status === 'delivered') {
        updates.delivered_at = new Date().toISOString();
      } else if (status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString();
        updates.cancel_reason = cancel_reason;
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      const statusMessages: Record<OrderStatus, string> = {
        accepted: 'Pedido aceito',
        preparing: 'Pedido em preparação',
        sent: 'Pedido enviado',
        delivered: 'Pedido entregue!',
        cancelled: 'Pedido cancelado',
      };
      toast.success(statusMessages[data.status as OrderStatus]);
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status', { description: error.message });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...order }: Partial<Order> & { id: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(order)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pedido atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar pedido', { description: error.message });
    },
  });
}

// ============ CONFIG TABLES ============
export function useNeighborhoods() {
  return useQuery({
    queryKey: ['neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Neighborhood[];
    },
  });
}

export function useCreateNeighborhood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (neighborhood: NeighborhoodInsert) => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .insert(neighborhood)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      toast.success('Bairro cadastrado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar bairro', { description: error.message });
    },
  });
}

export function useUpdateNeighborhood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...neighborhood }: Partial<Neighborhood> & { id: string }) => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .update(neighborhood)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      toast.success('Bairro atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar bairro', { description: error.message });
    },
  });
}

export function useDeleteNeighborhood() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('neighborhoods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      toast.success('Bairro excluído!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir bairro', { description: error.message });
    },
  });
}

export function useSalesChannels() {
  return useQuery({
    queryKey: ['sales-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as SalesChannel[];
    },
  });
}

export function useCreateSalesChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (channel: SalesChannelInsert) => {
      const { data, error } = await supabase
        .from('sales_channels')
        .insert(channel)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] });
      toast.success('Canal cadastrado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar canal', { description: error.message });
    },
  });
}

export function useUpdateSalesChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...channel }: Partial<SalesChannel> & { id: string }) => {
      const { data, error } = await supabase
        .from('sales_channels')
        .update(channel)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-channels'] });
      toast.success('Canal atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar canal', { description: error.message });
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
        .order('name');
      if (error) throw error;
      return data as PaymentMethod[];
    },
  });
}

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (method: PaymentMethodInsert) => {
      const { data, error } = await supabase
        .from('payment_methods')
        .insert(method)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento cadastrada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar', { description: error.message });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...method }: Partial<PaymentMethod> & { id: string }) => {
      const { data, error } = await supabase
        .from('payment_methods')
        .update(method)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Forma de pagamento atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar', { description: error.message });
    },
  });
}

export function useDeliveryPeople() {
  return useQuery({
    queryKey: ['delivery-people'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_people')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as DeliveryPerson[];
    },
  });
}

export function useCreateDeliveryPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (person: DeliveryPersonInsert) => {
      const { data, error } = await supabase
        .from('delivery_people')
        .insert(person)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-people'] });
      toast.success('Entregador cadastrado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar entregador', { description: error.message });
    },
  });
}

export function useUpdateDeliveryPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...person }: Partial<DeliveryPerson> & { id: string }) => {
      const { data, error } = await supabase
        .from('delivery_people')
        .update(person)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-people'] });
      toast.success('Entregador atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar entregador', { description: error.message });
    },
  });
}

export function useDeleteDeliveryPerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('delivery_people').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-people'] });
      toast.success('Entregador excluído!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir entregador', { description: error.message });
    },
  });
}

// ============ DASHBOARD ============
export function useDailySummary(date?: string) {
  return useQuery({
    queryKey: ['daily-summary', date],
    queryFn: async () => {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_sales_summary')
        .select('*')
        .eq('date', targetDate)
        .maybeSingle();
      if (error) throw error;
      return data as DailySalesSummary | null;
    },
  });
}

export function useDailySummaryRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['daily-summary-range', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_sales_summary')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data as DailySalesSummary[];
    },
  });
}

// ============ CREDIT ============
export function useCreditEntries(customerId?: string) {
  return useQuery({
    queryKey: ['credit-entries', customerId],
    queryFn: async () => {
      let query = supabase
        .from('credit_entries')
        .select('*, customer:customers(*), order:orders(*)')
        .order('due_date', { ascending: true });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CreditEntry[];
    },
  });
}

export function useUpdateCreditEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...entry }: Partial<CreditEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('credit_entries')
        .update(entry)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-entries'] });
      toast.success('Título atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar título', { description: error.message });
    },
  });
}

// ============ AUDIT ============
export function useAuditLogs(filters?: { entityType?: string; entityId?: string }) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.entityId) {
        query = query.eq('entity_id', filters.entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });
}

// ============ EXPORT UTILITIES ============
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    toast.error('Nenhum dado para exportar');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  
  toast.success('Relatório exportado com sucesso!');
}
