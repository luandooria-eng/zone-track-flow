import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, subDays, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import { isWaterProduct, isGasProduct } from '@/lib/productClassification';

// Types
export interface MonthlyConsumption {
  id: string;
  customer_id: string;
  year_month: string;
  water_qty: number;
  gas_qty: number;
  other_qty: number;
  total_orders: number;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerAlert {
  id: string;
  customer_id: string;
  alert_type: 'water_drop' | 'gas_drop' | 'water_stopped' | 'gas_stopped' | 'product_stopped' | 'general_risk';
  severity: 'low' | 'medium' | 'high';
  period_ref: string;
  details: {
    percent_drop?: number;
    percent_increase?: number;
    last_purchase_date?: string;
    baseline_months?: number;
    product_name?: string;
    current_qty?: number;
    previous_avg?: number;
  };
  status: 'open' | 'closed' | 'dismissed';
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    neighborhood?: {
      name: string;
    } | null;
  };
}

export interface ConsumptionSettings {
  id: string;
  drop_percent_threshold: number;
  comparison_months: number;
  min_purchases_for_regular: number;
  days_without_purchase: number;
  monitored_product_ids: string[];
}

export interface ConsumptionStats {
  currentMonth: {
    water_qty: number;
    gas_qty: number;
    total_orders: number;
    total_value: number;
  };
  previousMonth: {
    water_qty: number;
    gas_qty: number;
    total_orders: number;
    total_value: number;
  };
  avg3Months: {
    water_qty: number;
    gas_qty: number;
    total_orders: number;
    total_value: number;
  };
  variations: {
    water_vs_prev: number;
    water_vs_avg: number;
    gas_vs_prev: number;
    gas_vs_avg: number;
  };
  trends: {
    water: 'up' | 'down' | 'stable' | 'stopped';
    gas: 'up' | 'down' | 'stable' | 'stopped';
  };
  // Average days between orders (real repurchase frequency)
  avgDaysBetweenOrders: {
    water: number | null; // null = insufficient data
    gas: number | null;
    lastWaterOrder: Date | null;
    lastGasOrder: Date | null;
    daysSinceLastWater: number | null;
    daysSinceLastGas: number | null;
  };
}

export interface CustomerConsumptionSummary {
  customerId: string;
  customerName: string;
  phone: string | null;
  neighborhood: string | null;
  waterCurrent: number;
  waterPrevious: number;
  waterVariation: number;
  waterStopped: boolean;
  gasCurrent: number;
  gasPrevious: number;
  gasVariation: number;
  gasStopped: boolean;
  alerts?: { type: string; severity: string }[];
}

export interface ConsumptionOverview {
  waterAvgVariation: number;
  waterIncrease: number;
  waterDecrease: number;
  waterStopped: number;
  gasAvgVariation: number;
  gasIncrease: number;
  gasDecrease: number;
  gasStopped: number;
  mineralWaterAlerts: number;
  customers: CustomerConsumptionSummary[];
}

// Get current year-month string
function getCurrentYearMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

function getPreviousYearMonth(monthsBack: number = 1): string {
  return format(subMonths(new Date(), monthsBack), 'yyyy-MM');
}

// Hook to get monthly consumption for a customer
export function useCustomerMonthlyConsumption(customerId: string | undefined, months: number = 6) {
  return useQuery({
    queryKey: ['customer-monthly-consumption', customerId, months],
    queryFn: async () => {
      if (!customerId) return [];
      
      const startMonth = format(subMonths(new Date(), months - 1), 'yyyy-MM');
      
      const { data, error } = await supabase
        .from('customer_monthly_consumption')
        .select('*')
        .eq('customer_id', customerId)
        .gte('year_month', startMonth)
        .order('year_month', { ascending: true });

      if (error) throw error;
      return data as MonthlyConsumption[];
    },
    enabled: !!customerId,
  });
}

// Hook to get consumption stats for a customer (current vs previous vs avg)
// Also calculates average days between orders (real repurchase frequency)
export function useCustomerConsumptionStats(customerId: string | undefined): { data: ConsumptionStats | undefined; isLoading: boolean } {
  const { data: monthlyData, isLoading: loadingMonthly } = useCustomerMonthlyConsumption(customerId, 4);
  
  // Fetch orders with products to calculate real repurchase interval
  const { data: customerOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['customer-orders-for-frequency', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          order_items(quantity, product:products(name))
        `)
        .eq('customer_id', customerId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
  });

  const isLoading = loadingMonthly || loadingOrders;

  if (!monthlyData || monthlyData.length === 0) {
    return { data: undefined, isLoading };
  }

  const currentYearMonth = getCurrentYearMonth();
  const prevYearMonth = getPreviousYearMonth(1);
  
  const currentMonth = monthlyData.find(m => m.year_month === currentYearMonth) || {
    water_qty: 0, gas_qty: 0, total_orders: 0, total_value: 0
  };
  
  const previousMonth = monthlyData.find(m => m.year_month === prevYearMonth) || {
    water_qty: 0, gas_qty: 0, total_orders: 0, total_value: 0
  };
  
  // Calculate 3-month average (excluding current month)
  const last3Months = monthlyData
    .filter(m => m.year_month !== currentYearMonth)
    .slice(-3);
  
  const avg3Months = last3Months.length > 0 ? {
    water_qty: last3Months.reduce((acc, m) => acc + m.water_qty, 0) / last3Months.length,
    gas_qty: last3Months.reduce((acc, m) => acc + m.gas_qty, 0) / last3Months.length,
    total_orders: last3Months.reduce((acc, m) => acc + m.total_orders, 0) / last3Months.length,
    total_value: last3Months.reduce((acc, m) => acc + m.total_value, 0) / last3Months.length,
  } : { water_qty: 0, gas_qty: 0, total_orders: 0, total_value: 0 };

  // Calculate variations
  const calcVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const variations = {
    water_vs_prev: calcVariation(currentMonth.water_qty, previousMonth.water_qty),
    water_vs_avg: calcVariation(currentMonth.water_qty, avg3Months.water_qty),
    gas_vs_prev: calcVariation(currentMonth.gas_qty, previousMonth.gas_qty),
    gas_vs_avg: calcVariation(currentMonth.gas_qty, avg3Months.gas_qty),
  };

  // Determine trends
  const getTrend = (currentQty: number, avgQty: number, variation: number): 'up' | 'down' | 'stable' | 'stopped' => {
    if (currentQty === 0 && avgQty > 0) return 'stopped';
    if (variation > 10) return 'up';
    if (variation < -10) return 'down';
    return 'stable';
  };

  const trends = {
    water: getTrend(currentMonth.water_qty, avg3Months.water_qty, variations.water_vs_avg),
    gas: getTrend(currentMonth.gas_qty, avg3Months.gas_qty, variations.gas_vs_avg),
  };

  // Calculate average days between orders for water and gas
  const calculateAvgDaysBetweenOrders = () => {
    const waterDates: Date[] = [];
    const gasDates: Date[] = [];
    
    for (const order of customerOrders || []) {
      const orderDate = new Date(order.created_at);
      let hasWater = false;
      let hasGas = false;
      
      for (const item of (order.order_items || [])) {
        const productName = (item as any).product?.name || '';
        if (isWaterProduct(productName)) {
          hasWater = true;
        }
        if (isGasProduct(productName)) {
          hasGas = true;
        }
      }
      
      if (hasWater) waterDates.push(orderDate);
      if (hasGas) gasDates.push(orderDate);
    }
    
    const calcAvg = (dates: Date[]): number | null => {
      if (dates.length < 2) return null;
      
      // Sort dates chronologically
      dates.sort((a, b) => a.getTime() - b.getTime());
      
      let totalDays = 0;
      const intervals = dates.length - 1;
      
      for (let i = 1; i < dates.length; i++) {
        const diffMs = dates[i].getTime() - dates[i - 1].getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        totalDays += diffDays;
      }
      
      return Math.round((totalDays / intervals) * 10) / 10; // Round to 1 decimal
    };
    
    const now = new Date();
    const lastWaterOrder = waterDates.length > 0 ? waterDates[waterDates.length - 1] : null;
    const lastGasOrder = gasDates.length > 0 ? gasDates[gasDates.length - 1] : null;
    
    const calcDaysSince = (lastDate: Date | null): number | null => {
      if (!lastDate) return null;
      const diffMs = now.getTime() - lastDate.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    };
    
    return {
      water: calcAvg(waterDates),
      gas: calcAvg(gasDates),
      lastWaterOrder,
      lastGasOrder,
      daysSinceLastWater: calcDaysSince(lastWaterOrder),
      daysSinceLastGas: calcDaysSince(lastGasOrder),
    };
  };

  const avgDaysBetweenOrders = calculateAvgDaysBetweenOrders();

  return {
    data: {
      currentMonth: {
        water_qty: currentMonth.water_qty,
        gas_qty: currentMonth.gas_qty,
        total_orders: currentMonth.total_orders,
        total_value: currentMonth.total_value,
      },
      previousMonth: {
        water_qty: previousMonth.water_qty,
        gas_qty: previousMonth.gas_qty,
        total_orders: previousMonth.total_orders,
        total_value: previousMonth.total_value,
      },
      avg3Months,
      variations,
      trends,
      avgDaysBetweenOrders,
    },
    isLoading,
  };
}

// Hook to get all customer alerts
export function useCustomerAlerts(customerId?: string, status?: 'open' | 'closed' | 'dismissed') {
  return useQuery({
    queryKey: ['customer-alerts', customerId, status],
    queryFn: async () => {
      let query = supabase
        .from('customer_alerts')
        .select(`
          *,
          customer:customers(id, name, phone, neighborhood:neighborhoods(name))
        `)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CustomerAlert[];
    },
  });
}

// Hook to get open alerts count by type
export function useOpenAlertsStats() {
  const { data: alerts = [], isLoading } = useCustomerAlerts(undefined, 'open');
  
  const stats = {
    total: alerts.length,
    water_drop: alerts.filter(a => a.alert_type === 'water_drop').length,
    water_stopped: alerts.filter(a => a.alert_type === 'water_stopped').length,
    gas_drop: alerts.filter(a => a.alert_type === 'gas_drop').length,
    gas_stopped: alerts.filter(a => a.alert_type === 'gas_stopped').length,
    general_risk: alerts.filter(a => a.alert_type === 'general_risk').length,
    product_stopped: alerts.filter(a => a.alert_type === 'product_stopped').length,
  };

  return { data: stats, isLoading, alerts };
}

// Hook to dismiss an alert
export function useDismissAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('customer_alerts')
        .update({ status: 'dismissed' })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-alerts'] });
    },
  });
}

// Hook to close an alert (resolved)
export function useCloseAlert() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('customer_alerts')
        .update({ status: 'closed' })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-alerts'] });
    },
  });
}

// Hook to get consumption settings
export function useConsumptionSettings() {
  return useQuery({
    queryKey: ['consumption-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consumption_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ConsumptionSettings | null;
    },
  });
}

// Hook to update consumption settings
export function useUpdateConsumptionSettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: Partial<ConsumptionSettings>) => {
      const { data: existing } = await supabase
        .from('consumption_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('consumption_settings')
          .update(settings)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('consumption_settings')
          .insert(settings);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consumption-settings'] });
    },
  });
}

// Hook to calculate and refresh consumption data from orders
export function useRefreshConsumptionData() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (customerId?: string) => {
      const startDate = startOfMonth(subMonths(new Date(), 6));
      const endDate = endOfMonth(new Date());
      
      // Get orders with items
      let ordersQuery = supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          total,
          status,
          created_at,
          order_items(
            quantity,
            product_id,
            product:products(name)
          )
        `)
        .neq('status', 'cancelled')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (customerId) {
        ordersQuery = ordersQuery.eq('customer_id', customerId);
      }

      const { data: orders, error } = await ordersQuery;
      if (error) throw error;

      // Group by customer and month
      const consumptionMap = new Map<string, MonthlyConsumption>();

      for (const order of orders || []) {
        if (!order.customer_id) continue;
        
        const yearMonth = format(new Date(order.created_at), 'yyyy-MM');
        const key = `${order.customer_id}_${yearMonth}`;
        
        const existing = consumptionMap.get(key) || {
          id: '',
          customer_id: order.customer_id,
          year_month: yearMonth,
          water_qty: 0,
          gas_qty: 0,
          other_qty: 0,
          total_orders: 0,
          total_value: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        existing.total_orders++;
        existing.total_value += order.total || 0;

        // Categorize items using product classification helper
        for (const item of (order.order_items || [])) {
          const productName = (item as any).product?.name || '';
          const qty = item.quantity || 0;
          
          if (isWaterProduct(productName)) {
            existing.water_qty += qty;
          } else if (isGasProduct(productName)) {
            existing.gas_qty += qty;
          } else {
            existing.other_qty += qty;
          }
        }

        consumptionMap.set(key, existing);
      }

      // Upsert consumption data
      for (const consumption of consumptionMap.values()) {
        const { error: upsertError } = await supabase
          .from('customer_monthly_consumption')
          .upsert({
            customer_id: consumption.customer_id,
            year_month: consumption.year_month,
            water_qty: consumption.water_qty,
            gas_qty: consumption.gas_qty,
            other_qty: consumption.other_qty,
            total_orders: consumption.total_orders,
            total_value: consumption.total_value,
          }, {
            onConflict: 'customer_id,year_month',
          });

        if (upsertError) console.error('Upsert error:', upsertError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-monthly-consumption'] });
      queryClient.invalidateQueries({ queryKey: ['consumption-overview'] });
    },
  });
}

// Hook to generate alerts based on consumption data
export function useGenerateAlerts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const currentMonth = getCurrentYearMonth();
      
      // Get settings
      const { data: settings } = await supabase
        .from('consumption_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      const dropThreshold = settings?.drop_percent_threshold || 30;
      const comparisonMonths = settings?.comparison_months || 3;

      // Get all consumption data
      const { data: allConsumption } = await supabase
        .from('customer_monthly_consumption')
        .select('*')
        .order('year_month', { ascending: false });

      if (!allConsumption) return;

      // Group by customer
      const customerConsumption = new Map<string, MonthlyConsumption[]>();
      for (const c of allConsumption) {
        const existing = customerConsumption.get(c.customer_id) || [];
        existing.push(c);
        customerConsumption.set(c.customer_id, existing);
      }

      const alertsToCreate: Omit<CustomerAlert, 'id' | 'created_at' | 'updated_at' | 'customer'>[] = [];

      for (const [customerId, consumptions] of customerConsumption) {
        const current = consumptions.find(c => c.year_month === currentMonth);
        const previous = consumptions.filter(c => c.year_month !== currentMonth).slice(0, comparisonMonths);
        
        if (previous.length === 0) continue;

        const avgWater = previous.reduce((acc, c) => acc + c.water_qty, 0) / previous.length;
        const avgGas = previous.reduce((acc, c) => acc + c.gas_qty, 0) / previous.length;

        // Check for water drop
        if (avgWater > 0) {
          const currentWater = current?.water_qty || 0;
          const waterDrop = ((avgWater - currentWater) / avgWater) * 100;
          
          if (waterDrop >= dropThreshold) {
            alertsToCreate.push({
              customer_id: customerId,
              alert_type: currentWater === 0 ? 'water_stopped' : 'water_drop',
              severity: waterDrop >= 50 ? 'high' : waterDrop >= 30 ? 'medium' : 'low',
              period_ref: currentMonth,
              details: {
                percent_drop: Math.round(waterDrop),
                current_qty: currentWater,
                previous_avg: Math.round(avgWater * 10) / 10,
              },
              status: 'open',
            });
          }
        }

        // Check for gas drop
        if (avgGas > 0) {
          const currentGas = current?.gas_qty || 0;
          const gasDrop = ((avgGas - currentGas) / avgGas) * 100;
          
          if (gasDrop >= dropThreshold) {
            alertsToCreate.push({
              customer_id: customerId,
              alert_type: currentGas === 0 ? 'gas_stopped' : 'gas_drop',
              severity: gasDrop >= 50 ? 'high' : gasDrop >= 30 ? 'medium' : 'low',
              period_ref: currentMonth,
              details: {
                percent_drop: Math.round(gasDrop),
                current_qty: currentGas,
                previous_avg: Math.round(avgGas * 10) / 10,
              },
              status: 'open',
            });
          }
        }

        // Check for mineral water (high recurrence product) - create alert if any drop
        if (avgWater >= 2) { // Only for regular water buyers
          const currentWater = current?.water_qty || 0;
          if (currentWater < avgWater * 0.8) { // 20% threshold for mineral water
            const drop = ((avgWater - currentWater) / avgWater) * 100;
            alertsToCreate.push({
              customer_id: customerId,
              alert_type: 'product_stopped',
              severity: drop >= 50 ? 'high' : drop >= 30 ? 'medium' : 'low',
              period_ref: currentMonth,
              details: {
                percent_drop: Math.round(drop),
                product_name: 'Água Mineral',
                current_qty: currentWater,
                previous_avg: Math.round(avgWater * 10) / 10,
              },
              status: 'open',
            });
          }
        }
      }

      // Clear old open alerts for current period and insert new ones
      await supabase
        .from('customer_alerts')
        .delete()
        .eq('period_ref', currentMonth)
        .eq('status', 'open');

      if (alertsToCreate.length > 0) {
        const { error } = await supabase
          .from('customer_alerts')
          .insert(alertsToCreate);
        if (error) throw error;
      }

      return alertsToCreate.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['consumption-overview'] });
    },
  });
}

// Hook to get consumption overview with period selection (7, 15, 30 days)
export function useConsumptionOverview(days: number = 30) {
  return useQuery({
    queryKey: ['consumption-overview', days],
    queryFn: async () => {
      const now = new Date();
      const startDate = startOfDay(subDays(now, days));
      const previousStartDate = startOfDay(subDays(now, days * 2));
      const previousEndDate = startOfDay(subDays(now, days));

      // Get current period orders
      const { data: currentOrders } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          total,
          created_at,
          customer:customers(id, name, phone, neighborhood:neighborhoods(name)),
          order_items(
            quantity,
            product:products(name)
          )
        `)
        .neq('status', 'cancelled')
        .gte('created_at', startDate.toISOString());

      // Get previous period orders
      const { data: previousOrders } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          created_at,
          order_items(
            quantity,
            product:products(name)
          )
        `)
        .neq('status', 'cancelled')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', previousEndDate.toISOString());

      // Get open alerts
      const { data: alerts } = await supabase
        .from('customer_alerts')
        .select('customer_id, alert_type, severity')
        .eq('status', 'open');

      // Build customer consumption map
      const customerMap = new Map<string, {
        customerId: string;
        customerName: string;
        phone: string | null;
        neighborhood: string | null;
        currentWater: number;
        currentGas: number;
        previousWater: number;
        previousGas: number;
        alerts: { type: string; severity: string }[];
      }>();

      // Process current period
      for (const order of currentOrders || []) {
        if (!order.customer_id || !order.customer) continue;
        
        const existing = customerMap.get(order.customer_id) || {
          customerId: order.customer_id,
          customerName: (order.customer as any).name || '',
          phone: (order.customer as any).phone || null,
          neighborhood: (order.customer as any).neighborhood?.name || null,
          currentWater: 0,
          currentGas: 0,
          previousWater: 0,
          previousGas: 0,
          alerts: [],
        };

        for (const item of order.order_items || []) {
          const productName = ((item as any).product?.name || '').toLowerCase();
          const qty = item.quantity || 0;
          
          if (productName.includes('água') || productName.includes('water') || productName.includes('mineral')) {
            existing.currentWater += qty;
          } else if (productName.includes('gás') || productName.includes('gas')) {
            existing.currentGas += qty;
          }
        }

        customerMap.set(order.customer_id, existing);
      }

      // Process previous period
      for (const order of previousOrders || []) {
        if (!order.customer_id) continue;
        
        const existing = customerMap.get(order.customer_id);
        if (!existing) continue;

        for (const item of order.order_items || []) {
          const productName = ((item as any).product?.name || '').toLowerCase();
          const qty = item.quantity || 0;
          
          if (productName.includes('água') || productName.includes('water') || productName.includes('mineral')) {
            existing.previousWater += qty;
          } else if (productName.includes('gás') || productName.includes('gas')) {
            existing.previousGas += qty;
          }
        }
      }

      // Add alerts to customers
      for (const alert of alerts || []) {
        const existing = customerMap.get(alert.customer_id);
        if (existing) {
          existing.alerts.push({ type: alert.alert_type, severity: alert.severity });
        }
      }

      // Calculate variations and build summary
      const customers: CustomerConsumptionSummary[] = [];
      let totalWaterVariation = 0;
      let totalGasVariation = 0;
      let waterIncreaseCount = 0;
      let waterDecreaseCount = 0;
      let waterStoppedCount = 0;
      let gasIncreaseCount = 0;
      let gasDecreaseCount = 0;
      let gasStoppedCount = 0;
      let mineralAlertCount = 0;
      let validWaterCustomers = 0;
      let validGasCustomers = 0;

      for (const [, data] of customerMap) {
        const waterVariation = data.previousWater > 0 
          ? ((data.currentWater - data.previousWater) / data.previousWater) * 100 
          : (data.currentWater > 0 ? 100 : 0);
        
        const gasVariation = data.previousGas > 0 
          ? ((data.currentGas - data.previousGas) / data.previousGas) * 100 
          : (data.currentGas > 0 ? 100 : 0);

        const waterStopped = data.previousWater > 0 && data.currentWater === 0;
        const gasStopped = data.previousGas > 0 && data.currentGas === 0;

        // Count variations
        if (data.previousWater > 0 || data.currentWater > 0) {
          validWaterCustomers++;
          totalWaterVariation += waterVariation;
          if (waterStopped) waterStoppedCount++;
          else if (waterVariation > 10) waterIncreaseCount++;
          else if (waterVariation < -10) waterDecreaseCount++;
        }

        if (data.previousGas > 0 || data.currentGas > 0) {
          validGasCustomers++;
          totalGasVariation += gasVariation;
          if (gasStopped) gasStoppedCount++;
          else if (gasVariation > 10) gasIncreaseCount++;
          else if (gasVariation < -10) gasDecreaseCount++;
        }

        // Count mineral water alerts
        if (data.alerts.some(a => a.type === 'product_stopped')) {
          mineralAlertCount++;
        }

        customers.push({
          customerId: data.customerId,
          customerName: data.customerName,
          phone: data.phone,
          neighborhood: data.neighborhood,
          waterCurrent: data.currentWater,
          waterPrevious: data.previousWater,
          waterVariation,
          waterStopped,
          gasCurrent: data.currentGas,
          gasPrevious: data.previousGas,
          gasVariation,
          gasStopped,
          alerts: data.alerts,
        });
      }

      const overview: ConsumptionOverview = {
        waterAvgVariation: validWaterCustomers > 0 ? totalWaterVariation / validWaterCustomers : 0,
        waterIncrease: waterIncreaseCount,
        waterDecrease: waterDecreaseCount,
        waterStopped: waterStoppedCount,
        gasAvgVariation: validGasCustomers > 0 ? totalGasVariation / validGasCustomers : 0,
        gasIncrease: gasIncreaseCount,
        gasDecrease: gasDecreaseCount,
        gasStopped: gasStoppedCount,
        mineralWaterAlerts: mineralAlertCount,
        customers: customers.sort((a, b) => 
          Math.abs(b.waterVariation) + Math.abs(b.gasVariation) - 
          Math.abs(a.waterVariation) - Math.abs(a.gasVariation)
        ),
      };

      return overview;
    },
  });
}

// Hook to get customers with their consumption data for the list
export function useCustomersWithConsumption() {
  return useQuery({
    queryKey: ['customers-with-consumption'],
    queryFn: async () => {
      const currentMonth = getCurrentYearMonth();
      const prevMonth = getPreviousYearMonth(1);
      
      // Get current and previous month consumption
      const { data: consumption } = await supabase
        .from('customer_monthly_consumption')
        .select('*')
        .in('year_month', [currentMonth, prevMonth]);

      // Get open alerts
      const { data: alerts } = await supabase
        .from('customer_alerts')
        .select('customer_id, alert_type, severity')
        .eq('status', 'open');

      // Build a map of customer consumption
      const consumptionMap = new Map<string, {
        water_current: number;
        water_prev: number;
        water_variation: number;
        gas_current: number;
        gas_prev: number;
        gas_variation: number;
        alerts: { type: string; severity: string }[];
      }>();

      for (const c of consumption || []) {
        const existing = consumptionMap.get(c.customer_id) || {
          water_current: 0,
          water_prev: 0,
          water_variation: 0,
          gas_current: 0,
          gas_prev: 0,
          gas_variation: 0,
          alerts: [],
        };

        if (c.year_month === currentMonth) {
          existing.water_current = c.water_qty;
          existing.gas_current = c.gas_qty;
        } else {
          existing.water_prev = c.water_qty;
          existing.gas_prev = c.gas_qty;
        }

        consumptionMap.set(c.customer_id, existing);
      }

      // Calculate variations
      for (const [id, data] of consumptionMap) {
        if (data.water_prev > 0) {
          data.water_variation = ((data.water_current - data.water_prev) / data.water_prev) * 100;
        }
        if (data.gas_prev > 0) {
          data.gas_variation = ((data.gas_current - data.gas_prev) / data.gas_prev) * 100;
        }
      }

      // Add alerts
      for (const alert of alerts || []) {
        const existing = consumptionMap.get(alert.customer_id);
        if (existing) {
          existing.alerts.push({ type: alert.alert_type, severity: alert.severity });
        }
      }

      return consumptionMap;
    },
  });
}
