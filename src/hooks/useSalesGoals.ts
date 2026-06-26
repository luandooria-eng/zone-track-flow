import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, isSameDay, isSameMonth, getDaysInMonth, subMonths, getDate, min as dateMin } from 'date-fns';
import { useFilters } from './useFilters';

export interface SalesGoal {
  id: string;
  type: 'daily' | 'monthly';
  metric: 'products_sold' | 'orders_count';
  target_value: number;
  product_id: string | null;
  name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product?: { id: string; name: string } | null;
}

export interface GoalProgress {
  id: string;
  type: 'daily' | 'monthly';
  metric: 'products_sold' | 'orders_count';
  target: number;
  current: number;
  percentage: number;
  label: string;
  productName?: string;
  // Derived daily target from monthly goal
  dailyTarget?: number;
  isMonthlyDerived?: boolean;
  // Month-over-month comparison
  previousMonthCurrent?: number;
  monthGrowth?: number; // percentage growth vs previous month same period
}

export function useSalesGoals() {
  return useQuery({
    queryKey: ['sales-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_goals')
        .select(`
          *,
          product:products(id, name)
        `)
        .eq('is_active', true)
        .order('type')
        .order('metric');

      if (error) throw error;
      return data as SalesGoal[];
    },
  });
}

export function useCreateSalesGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goal: {
      type: 'daily' | 'monthly';
      metric: 'products_sold' | 'orders_count';
      target_value: number;
      product_id?: string | null;
      name?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('sales_goals')
        .insert({
          ...goal,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
      toast.success('Meta criada');
    },
    onError: (error) => {
      toast.error('Erro ao criar meta: ' + error.message);
    },
  });
}

export function useUpdateSalesGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id,
      target_value 
    }: { 
      id: string;
      target_value: number;
    }) => {
      const { data, error } = await supabase
        .from('sales_goals')
        .update({ target_value })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
      toast.success('Meta atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar meta: ' + error.message);
    },
  });
}

export function useDeleteSalesGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sales_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
      toast.success('Meta removida');
    },
    onError: (error) => {
      toast.error('Erro ao remover meta: ' + error.message);
    },
  });
}

export function useGoalsProgress() {
  const { filters } = useFilters();
  const dateFrom = filters.dateRange?.from || new Date();
  const dateTo = filters.dateRange?.to || new Date();

  // Determine if we're looking at a single day or a month range
  const isSingleDay = isSameDay(dateFrom, dateTo);
  const isFullMonth = isSameMonth(dateFrom, dateTo) && 
    isSameDay(dateFrom, startOfMonth(dateFrom)) && 
    isSameDay(dateTo, endOfMonth(dateTo));

  return useQuery({
    queryKey: ['goals-progress', dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      // Fetch goals with product info
      const { data: goals, error: goalsError } = await supabase
        .from('sales_goals')
        .select(`
          *,
          product:products(id, name)
        `)
        .eq('is_active', true);

      if (goalsError) throw goalsError;

      // Get filter date range
      const filterStart = startOfDay(dateFrom).toISOString();
      const filterEnd = endOfDay(dateTo).toISOString();

      // Fetch orders in the filtered period
      // Note: created_at is the authoritative timestamp for goal calculations
      // (delivered_at can be null even for delivered orders)
      const pageSize = 1000;
      let allOrders: any[] = [];

      for (let offset = 0; ; offset += pageSize) {
        const { data: page, error } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            created_at,
            order_items(quantity, product_id)
          `)
          .neq('status', 'cancelled')
          .gte('created_at', filterStart)
          .lte('created_at', filterEnd)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        allOrders = allOrders.concat(page);
        if (page.length < pageSize) break;
      }

      const filteredOrders = allOrders;

      // ---- Previous month comparison (same day range) ----
      const prevMonthStart = startOfMonth(subMonths(dateFrom, 1));
      const currentDayOfMonth = getDate(dateTo);
      const prevMonthDays = getDaysInMonth(prevMonthStart);
      const prevDayOfMonth = Math.min(currentDayOfMonth, prevMonthDays);
      const prevMonthEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth(), prevDayOfMonth, 23, 59, 59, 999);
      
      const prevStart = startOfDay(prevMonthStart).toISOString();
      const prevEnd = endOfDay(prevMonthEnd).toISOString();

      let allPrevOrders: any[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data: page, error } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            created_at,
            order_items(quantity, product_id)
          `)
          .neq('status', 'cancelled')
          .gte('created_at', prevStart)
          .lte('created_at', prevEnd)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;
        allPrevOrders = allPrevOrders.concat(page);
        if (page.length < pageSize) break;
      }

      // Previous month metrics
      const prevOrdersCount = allPrevOrders.length;
      const prevProductsSold = allPrevOrders.reduce((sum, order) => {
        const orderQty = (order.order_items || []).reduce(
          (s: number, item: any) => s + (item.quantity || 0), 0
        );
        return sum + orderQty;
      }, 0);

      const prevProductQty: Record<string, number> = {};
      allPrevOrders.forEach((order) => {
        (order.order_items || []).forEach((item: any) => {
          if (item.product_id) {
            prevProductQty[item.product_id] =
              (prevProductQty[item.product_id] || 0) + (item.quantity || 0);
          }
        });
      });

      // Calculate metrics for the period
      const periodOrdersCount = filteredOrders.length;
      const periodProductsSold = filteredOrders.reduce((sum, order) => {
        const orderQty = (order.order_items || []).reduce(
          (s: number, item: any) => s + (item.quantity || 0),
          0
        );
        return sum + orderQty;
      }, 0);

      // Calculate per-product quantities
      const periodProductQty: Record<string, number> = {};
      filteredOrders.forEach((order) => {
        (order.order_items || []).forEach((item: any) => {
          if (item.product_id) {
            periodProductQty[item.product_id] =
              (periodProductQty[item.product_id] || 0) + (item.quantity || 0);
          }
        });
      });

      // Build progress array
      const progress: GoalProgress[] = [];
      const currentDate = dateFrom;
      const daysInCurrentMonth = getDaysInMonth(currentDate);

      (goals || []).forEach((goal: any) => {
        let current = 0;
        let prevCurrent = 0;
        let label = goal.name || '';

        // Calculate current value based on metric
        if (goal.metric === 'products_sold') {
          if (goal.product_id) {
            current = periodProductQty[goal.product_id] || 0;
            prevCurrent = prevProductQty[goal.product_id] || 0;
            label = goal.name || `${goal.product?.name || 'Produto'}`;
          } else {
            current = periodProductsSold;
            prevCurrent = prevProductsSold;
            label = goal.name || 'Produtos Vendidos';
          }
        } else {
          current = periodOrdersCount;
          prevCurrent = prevOrdersCount;
          label = goal.name || 'Pedidos';
        }

        const monthGrowth = prevCurrent > 0 ? ((current - prevCurrent) / prevCurrent) * 100 : (current > 0 ? 100 : 0);

        // For monthly goals, create both monthly and derived daily goal
        if (goal.type === 'monthly') {
          const dailyTarget = Math.ceil(goal.target_value / daysInCurrentMonth);

          // Add monthly goal with previous month comparison
          progress.push({
            id: goal.id,
            type: 'monthly',
            metric: goal.metric,
            target: goal.target_value,
            current,
            percentage: goal.target_value > 0 ? (current / goal.target_value) * 100 : 0,
            label,
            productName: goal.product?.name,
            dailyTarget,
            previousMonthCurrent: prevCurrent,
            monthGrowth,
          });

          // Add derived daily goal (for daily view)
          progress.push({
            id: `${goal.id}-daily`,
            type: 'daily',
            metric: goal.metric,
            target: dailyTarget,
            current: 0, // Will be calculated separately for single day view
            percentage: 0,
            label: `${label} (diária)`,
            productName: goal.product?.name,
            isMonthlyDerived: true,
          });
        } else {
          // Regular daily goal
          const percentage = goal.target_value > 0 ? (current / goal.target_value) * 100 : 0;

          progress.push({
            id: goal.id,
            type: goal.type,
            metric: goal.metric,
            target: goal.target_value,
            current,
            percentage,
            label,
            productName: goal.product?.name,
          });
        }
      });

      // Update derived daily goals with correct current values for single day
      if (isSingleDay) {
        progress.forEach((p) => {
          if (!p.isMonthlyDerived) return;

          const baseGoalId = p.id.replace('-daily', '');
          const baseGoal = (goals || []).find((g: any) => g.id === baseGoalId);

          if (p.metric === 'products_sold') {
            if (baseGoal?.product_id) {
              p.current = periodProductQty[baseGoal.product_id] || 0;
            } else {
              p.current = periodProductsSold;
            }
          } else {
            p.current = periodOrdersCount;
          }

          p.percentage = p.target > 0 ? (p.current / p.target) * 100 : 0;
        });
      }

      return progress;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
