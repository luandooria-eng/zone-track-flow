import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, addDays, startOfDay, isSameDay } from 'date-fns';
import { useFilters } from './useFilters';

// Brazil timezone offset (UTC-3)
const BRAZIL_OFFSET_HOURS = -3;

/**
 * Convert a local Brazil date to UTC ISO string for database queries
 * When user selects "17/12 00:00" in Brazil, we need to query "17/12 03:00 UTC"
 */
function toBrazilUTCStart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  // Brazil is UTC-3, so midnight Brazil = 03:00 UTC
  return `${year}-${month}-${day}T03:00:00+00:00`;
}

function toBrazilUTCEnd(date: Date): string {
  // End of day in Brazil = next day 03:00 UTC (exclusive)
  const nextDay = addDays(date, 1);
  const year = nextDay.getFullYear();
  const month = String(nextDay.getMonth() + 1).padStart(2, '0');
  const day = String(nextDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T03:00:00+00:00`;
}

export interface DashboardFilters {
  startDate: string;
  endDate: string;
  channelId?: string;
  deliveryPersonId?: string;
  productId?: string;
  paymentMethodId?: string;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  deliveredOrders: number;
  cancelledOrders: number;
  cancellationRate: number;
  pendingOrders: number;
  todaySales: number;
  todayRevenue: number;
  revenueGrowth: number;
  salesGrowth: number;
}

export interface CustomerIdentificationMetrics {
  identifiedOrders: number;
  unidentifiedOrders: number;
  identifiedPercentage: number;
  unidentifiedPercentage: number;
  totalOrdersForMetric: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  atRiskCustomers: number;
  lostCustomers: number;
  activePercentage: number;
  atRiskPercentage: number;
  lostPercentage: number;
  recurrenceRate: number;
  repurchase30Rate: number;
  repurchase30CohortSize: number;
  repurchase30Returned: number;
  repurchase30NotReturnedIds: string[];
  // Base-wide views (over total registered customer base)
  baseTotal: number;
  baseActive30: number;
  baseActive30Rate: number;
  baseRecoverable: number;
  baseRecoverableRate: number;
  baseRecoverableIds: string[];
  baseDormant: number;
  baseDormantRate: number;
}

export interface ChannelMetrics {
  channelId: string;
  channelName: string;
  orders: number;
  revenue: number;
  percentage: number;
}

export interface DelivererMetrics {
  delivererId: string;
  delivererName: string;
  orders: number;
  revenue: number;
  percentage: number;
}

export interface ProductSales {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  percentage: number;
}

export interface PaymentMethodData {
  paymentMethodId: string;
  paymentMethodName: string;
  type: string;
  total: number;
  transactions: number;
  percentage: number;
}

export interface DailySalesData {
  date: string;
  revenue: number;
  sales: number;
}

export function useDashboardData() {
  const { filters } = useFilters();
  
  // Format dates for display (local Brazil dates)
  const startDateDisplay = format(filters.dateRange.from, 'yyyy-MM-dd');
  const endDateDisplay = format(filters.dateRange.to, 'yyyy-MM-dd');
  
  // Convert to UTC for database queries (Brazil timezone UTC-3)
  const startDateUTC = toBrazilUTCStart(filters.dateRange.from);
  const endDateUTC = toBrazilUTCEnd(filters.dateRange.to);
  
  // Today in Brazil timezone
  const today = new Date();
  const todayStartUTC = toBrazilUTCStart(today);
  const todayEndUTC = toBrazilUTCEnd(today);
  
  // Get previous period for comparison (same duration before start date)
  const periodDays = Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const previousStart = subDays(filters.dateRange.from, periodDays);
  const previousEnd = subDays(filters.dateRange.from, 1);
  const previousStartUTC = toBrazilUTCStart(previousStart);
  const previousEndUTC = toBrazilUTCEnd(previousEnd);

  // Main orders query with filters - applies to orders table directly
  // Uses pagination to fetch all orders (Supabase default limit is 1000)
  const ordersQuery = useQuery({
    queryKey: ['dashboard-orders', startDateUTC, endDateUTC, filters.channelId, filters.deliveryPersonId, filters.paymentMethodId],
    queryFn: async () => {
      const allOrders: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('orders')
          .select(`
            *,
            customer:customers(id, name),
            channel:sales_channels(id, name),
            payment_method:payment_methods(id, name, icon),
            delivery_person:delivery_people(id, name),
            neighborhood:neighborhoods(id, name),
            items:order_items(*, product:products(id, name, price))
          `)
          // Filter using Brazil timezone (UTC-3)
          .gte('created_at', startDateUTC)
          .lt('created_at', endDateUTC)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (filters.channelId) {
          query = query.eq('channel_id', filters.channelId);
        }
        if (filters.deliveryPersonId) {
          query = query.eq('delivery_person_id', filters.deliveryPersonId);
        }
        if (filters.paymentMethodId) {
          query = query.eq('payment_method_id', filters.paymentMethodId);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allOrders.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allOrders;
    },
  });

  // Previous period orders for comparison
  const previousOrdersQuery = useQuery({
    queryKey: ['dashboard-orders-previous', previousStartUTC, previousEndUTC],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status, created_at')
        .gte('created_at', previousStartUTC)
        .lt('created_at', previousEndUTC);

      if (error) throw error;
      return data || [];
    },
  });

  // Today's orders - separate query for "Vendas Hoje" card (Brazil timezone)
  const todayOrdersQuery = useQuery({
    queryKey: ['dashboard-orders-today', todayStartUTC],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, status')
        // Today in Brazil timezone
        .gte('created_at', todayStartUTC)
        .lt('created_at', todayEndUTC);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate metrics - all from filtered orders, using COALESCE pattern (default 0)
  const orders = ordersQuery.data || [];
  const previousOrders = previousOrdersQuery.data || [];
  const todayOrders = todayOrdersQuery.data || [];

  // COALESCE pattern: reduce with initial value 0, filter ensures empty arrays return 0
  // Faturamento = apenas pedidos ENTREGUES (delivered) - consistente com o lançamento de vendas
  const nonCancelledOrders = orders.filter(o => o.status !== 'cancelled');
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  
  // Total revenue = apenas pedidos ENTREGUES (não inclui aceitos/enviados)
  const totalRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const totalOrders = orders.length;
  const deliveredCount = deliveredOrders.length;
  const nonCancelledCount = nonCancelledOrders.length;
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
  const pendingCount = orders.filter(o => ['accepted', 'preparing', 'sent'].includes(o.status)).length;

  // Today metrics from dedicated query (not affected by period filter)
  // Includes all non-cancelled orders (accepted, sent, delivered) for consistency with Daily Sales Grid
  const todayNonCancelled = todayOrders.filter(o => o.status !== 'cancelled');
  const todaySalesCount = todayNonCancelled.length;
  const todayRevenueValue = todayNonCancelled.reduce((sum, o) => sum + (o.total ?? 0), 0);

  // Calculate metrics with proper defaults (COALESCE pattern)
  // Faturamento = soma dos pedidos ENTREGUES, Ticket Médio = faturamento / qtd entregues
  const metrics: DashboardMetrics = {
    totalRevenue: totalRevenue,
    totalOrders: totalOrders,
    avgTicket: deliveredCount > 0 ? totalRevenue / deliveredCount : 0,
    deliveredOrders: deliveredCount,
    cancelledOrders: cancelledCount,
    cancellationRate: totalOrders > 0 ? (cancelledCount / totalOrders) * 100 : 0,
    pendingOrders: pendingCount,
    todaySales: todaySalesCount,
    todayRevenue: todayRevenueValue,
    revenueGrowth: 0,
    salesGrowth: 0,
  };

  // Customer identification metrics
  // Exclude generic customers (S.ID and Consumidor Avulso) from "identified" count
  const GENERIC_CUSTOMER_IDS = [
    '5b18b37c-0cd2-4e2d-bf80-8c4cc3f25e65', // S.ID
    'e720fd07-01b1-4aa6-a119-b0f3c295ca4f', // Consumidor Avulso
  ];
  
  const identifiedOrders = orders.filter(o => 
    o.customer_id !== null && !GENERIC_CUSTOMER_IDS.includes(o.customer_id)
  ).length;
  const unidentifiedOrders = orders.filter(o => 
    o.customer_id === null || GENERIC_CUSTOMER_IDS.includes(o.customer_id)
  ).length;
  const customerIdentificationMetrics: CustomerIdentificationMetrics = {
    identifiedOrders,
    unidentifiedOrders,
    identifiedPercentage: totalOrders > 0 ? (identifiedOrders / totalOrders) * 100 : 0,
    unidentifiedPercentage: totalOrders > 0 ? (unidentifiedOrders / totalOrders) * 100 : 0,
    totalOrdersForMetric: totalOrders,
  };

  // Calculate growth compared to previous period (using delivered orders only)
  const previousDelivered = previousOrders.filter(o => o.status === 'delivered');
  const previousRevenue = previousDelivered.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const previousSalesCount = previousOrders.length;

  if (previousRevenue > 0) {
    metrics.revenueGrowth = ((metrics.totalRevenue - previousRevenue) / previousRevenue) * 100;
  }
  if (previousSalesCount > 0) {
    metrics.salesGrowth = ((metrics.totalOrders - previousSalesCount) / previousSalesCount) * 100;
  }

  // Product sales - only from filtered orders (non-cancelled)
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  orders.forEach(order => {
    if (order.status !== 'cancelled' && order.items) {
      order.items.forEach((item: any) => {
        const productId = item.product_id;
        const productName = item.product?.name || 'Produto';
        const existing = productSalesMap.get(productId) || { name: productName, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity ?? 0;
        existing.revenue += item.total_price ?? 0;
        productSalesMap.set(productId, existing);
      });
    }
  });

  const totalProductQuantity = Array.from(productSalesMap.values()).reduce((sum, p) => sum + p.quantity, 0);
  const productSales: ProductSales[] = Array.from(productSalesMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
      percentage: totalProductQuantity > 0 ? (data.quantity / totalProductQuantity) * 100 : 0,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Payment methods - only from DELIVERED orders (consistent with revenue KPI)
  // Include orders without payment method as "Não definido"
  const paymentMap = new Map<string, { name: string; type: string; total: number; transactions: number }>();
  deliveredOrders.forEach(order => {
    const pmId = order.payment_method_id || 'undefined';
    const pmName = order.payment_method?.name || 'Não definido';
    const pmType = order.payment_method?.icon || 'other';
    const existing = paymentMap.get(pmId) || { name: pmName, type: pmType, total: 0, transactions: 0 };
    existing.total += order.total ?? 0;
    existing.transactions += 1;
    paymentMap.set(pmId, existing);
  });

  const totalPaymentValue = Array.from(paymentMap.values()).reduce((sum, p) => sum + p.total, 0);
  const paymentMethodData: PaymentMethodData[] = Array.from(paymentMap.entries())
    .map(([paymentMethodId, data]) => ({
      paymentMethodId,
      paymentMethodName: data.name,
      type: data.type,
      total: data.total,
      transactions: data.transactions,
      percentage: totalPaymentValue > 0 ? (data.total / totalPaymentValue) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Daily sales for chart - only from filtered period
  // Revenue = apenas pedidos ENTREGUES para consistência com o faturamento
  const dailySalesMap = new Map<string, { revenue: number; sales: number }>();
  orders.forEach(order => {
    const date = format(new Date(order.created_at), 'yyyy-MM-dd');
    const existing = dailySalesMap.get(date) || { revenue: 0, sales: 0 };
    existing.sales += 1;
    // Receita apenas de pedidos entregues (consistente com faturamento total)
    if (order.status === 'delivered') {
      existing.revenue += order.total ?? 0;
    }
    dailySalesMap.set(date, existing);
  });

  const dailySales: DailySalesData[] = Array.from(dailySalesMap.entries())
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      sales: data.sales,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Channel metrics - from non-cancelled orders
  const channelMap = new Map<string, { name: string; orders: number; revenue: number }>();
  orders.forEach(order => {
    if (order.status !== 'cancelled' && order.channel) {
      const channelId = order.channel_id;
      const channelName = order.channel?.name || 'Outro';
      const existing = channelMap.get(channelId) || { name: channelName, orders: 0, revenue: 0 };
      existing.orders += 1;
      if (order.status === 'delivered') {
        existing.revenue += order.total ?? 0;
      }
      channelMap.set(channelId, existing);
    }
  });

  const totalChannelOrders = Array.from(channelMap.values()).reduce((sum, c) => sum + c.orders, 0);
  const channelMetrics: ChannelMetrics[] = Array.from(channelMap.entries())
    .map(([channelId, data]) => ({
      channelId,
      channelName: data.name,
      orders: data.orders,
      revenue: data.revenue,
      percentage: totalChannelOrders > 0 ? (data.orders / totalChannelOrders) * 100 : 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  // Deliverer metrics - from non-cancelled orders
  const delivererMap = new Map<string, { name: string; orders: number; revenue: number }>();
  orders.forEach(order => {
    if (order.status !== 'cancelled' && order.delivery_person) {
      const delivererId = order.delivery_person_id;
      const delivererName = order.delivery_person?.name || 'Outro';
      const existing = delivererMap.get(delivererId) || { name: delivererName, orders: 0, revenue: 0 };
      existing.orders += 1;
      if (order.status === 'delivered') {
        existing.revenue += order.total ?? 0;
      }
      delivererMap.set(delivererId, existing);
    }
  });

  const totalDelivererOrders = Array.from(delivererMap.values()).reduce((sum, d) => sum + d.orders, 0);
  const delivererMetrics: DelivererMetrics[] = Array.from(delivererMap.entries())
    .map(([delivererId, data]) => ({
      delivererId,
      delivererName: data.name,
      orders: data.orders,
      revenue: data.revenue,
      percentage: totalDelivererOrders > 0 ? (data.orders / totalDelivererOrders) * 100 : 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  // Period info for display
  const periodInfo = {
    startDate: filters.dateRange.from,
    endDate: filters.dateRange.to,
    startDateStr: startDateDisplay,
    endDateStr: endDateDisplay,
    isToday: isSameDay(filters.dateRange.from, filters.dateRange.to) && isSameDay(filters.dateRange.from, today),
  };

  // Customer metrics query
  const customersQuery = useQuery({
    queryKey: ['dashboard-customers', startDateUTC],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, created_at, last_order_at, total_orders, is_active');

      if (error) throw error;
      return data || [];
    },
  });

  // Query to count orders per customer (only identified orders - excludes S.ID)
  const customerOrdersCountQuery = useQuery({
    queryKey: ['dashboard-customer-orders-count'],
    queryFn: async () => {
      // Paginate to bypass Supabase's 1000-row default cap
      const pageSize = 1000;
      let from = 0;
      const all: { customer_id: string; created_at: string }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('orders')
          .select('customer_id, created_at')
          .not('customer_id', 'is', null)
          .eq('status', 'delivered')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Count orders per customer
      const orderCounts = new Map<string, number>();
      const orderDates = new Map<string, Date[]>();
      all.forEach((order: any) => {
        const count = orderCounts.get(order.customer_id) || 0;
        orderCounts.set(order.customer_id, count + 1);
        const arr = orderDates.get(order.customer_id) || [];
        arr.push(new Date(order.created_at));
        orderDates.set(order.customer_id, arr);
      });
      
      return { orderCounts, orderDates };
    },
  });

  // Calculate customer metrics
  const customers = customersQuery.data || [];
  const now = new Date();
  
  // New customers in period
  const newCustomersInPeriod = customers.filter(c => {
    const createdAt = new Date(c.created_at);
    return createdAt >= filters.dateRange.from && createdAt <= filters.dateRange.to;
  }).length;

  // Active customers = is_active = true (from database)
  const activeCustomersList = customers.filter(c => c.is_active === true);
  
  // Classify inactive customers by engagement (based on last_order_at)
  const classifyEngagement = (lastOrderAt: string | null): 'atRisk' | 'lost' => {
    if (!lastOrderAt) return 'lost';
    const lastOrder = new Date(lastOrderAt);
    const daysSinceLastOrder = Math.floor((now.getTime() - lastOrder.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastOrder <= 60) return 'atRisk';
    return 'lost';
  };

  // At-risk and lost are only from inactive customers
  const inactiveCustomers = customers.filter(c => c.is_active !== true);
  const atRiskCustomersList = inactiveCustomers.filter(c => classifyEngagement(c.last_order_at) === 'atRisk');
  const lostCustomersList = inactiveCustomers.filter(c => classifyEngagement(c.last_order_at) === 'lost');
  
  // Total customers should only count ACTIVE customers (consistent with Customers page)
  const totalCustomersCount = activeCustomersList.length;
  
  // Recurrence rate: calculated from actual delivered orders with customer_id (excludes S.ID)
  const orderCounts = customerOrdersCountQuery.data?.orderCounts || new Map<string, number>();
  const orderDates = customerOrdersCountQuery.data?.orderDates || new Map<string, Date[]>();
  const customersWithIdentifiedOrders = Array.from(orderCounts.keys()).length;
  const recurringCustomers = Array.from(orderCounts.values()).filter(count => count > 1).length;
  const recurrenceRate = customersWithIdentifiedOrders > 0 
    ? (recurringCustomers / customersWithIdentifiedOrders) * 100 
    : 0;

  // Repurchase 30d (rolling window): of customers that bought in the
  // previous 30-day window (days 60-30 ago), how many bought again in
  // the last 30 days. Measures recent retention, not lifetime cohort.
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  let repurchase30CohortSize = 0;
  let repurchase30Returned = 0;
  const repurchase30NotReturnedIds: string[] = [];
  orderDates.forEach((dates, customerId) => {
    if (!dates.length) return;
    const boughtPrev = dates.some(d => d >= sixtyDaysAgo && d < thirtyDaysAgo);
    if (!boughtPrev) return;
    repurchase30CohortSize++;
    const boughtRecent = dates.some(d => d >= thirtyDaysAgo && d <= now);
    if (boughtRecent) {
      repurchase30Returned++;
    } else {
      repurchase30NotReturnedIds.push(customerId);
    }
  });
  const repurchase30Rate = repurchase30CohortSize > 0
    ? (repurchase30Returned / repurchase30CohortSize) * 100
    : 0;

  // Base-wide retention (denominator = total registered customers).
  // Uses each customer's last_order_at to bucket the whole base.
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const baseTotal = customers.length;
  let baseActive30 = 0;
  let baseRecoverable = 0;
  const baseRecoverableIds: string[] = [];
  let baseDormant = 0;
  customers.forEach(c => {
    if (!c.last_order_at) { baseDormant++; return; }
    const last = new Date(c.last_order_at);
    if (last >= thirtyDaysAgo) baseActive30++;
    else if (last >= ninetyDaysAgo) { baseRecoverable++; baseRecoverableIds.push(c.id); }
    else baseDormant++;
  });
  const baseActive30Rate = baseTotal > 0 ? (baseActive30 / baseTotal) * 100 : 0;
  const baseRecoverableRate = baseTotal > 0 ? (baseRecoverable / baseTotal) * 100 : 0;
  const baseDormantRate = baseTotal > 0 ? (baseDormant / baseTotal) * 100 : 0;

  const customerMetrics: CustomerMetrics = {
    totalCustomers: totalCustomersCount,
    newCustomers: newCustomersInPeriod,
    activeCustomers: activeCustomersList.length,
    atRiskCustomers: atRiskCustomersList.length,
    lostCustomers: lostCustomersList.length,
    activePercentage: totalCustomersCount > 0 ? (activeCustomersList.length / totalCustomersCount) * 100 : 0,
    atRiskPercentage: totalCustomersCount > 0 ? (atRiskCustomersList.length / totalCustomersCount) * 100 : 0,
    lostPercentage: totalCustomersCount > 0 ? (lostCustomersList.length / totalCustomersCount) * 100 : 0,
    recurrenceRate,
    repurchase30Rate,
    repurchase30CohortSize,
    repurchase30Returned,
    repurchase30NotReturnedIds,
    baseTotal,
    baseActive30,
    baseActive30Rate,
    baseRecoverable,
    baseRecoverableRate,
    baseRecoverableIds,
    baseDormant,
    baseDormantRate,
  };

  return {
    metrics,
    customerMetrics,
    customerIdentificationMetrics,
    channelMetrics,
    delivererMetrics,
    productSales,
    paymentMethodData,
    dailySales,
    orders,
    periodInfo,
    isLoading: ordersQuery.isLoading || previousOrdersQuery.isLoading || todayOrdersQuery.isLoading || customersQuery.isLoading || customerOrdersCountQuery.isLoading,
    refetch: () => {
      ordersQuery.refetch();
      previousOrdersQuery.refetch();
      todayOrdersQuery.refetch();
      customersQuery.refetch();
      customerOrdersCountQuery.refetch();
    },
  };
}
