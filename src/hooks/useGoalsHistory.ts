import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface DailyGoalData {
  date: string;
  value: number;
}

export function useGoalsHistory(productId?: string | null) {
  return useQuery({
    queryKey: ['goals-history', productId],
    queryFn: async () => {
      const today = new Date();
      const historyDays = 7;
      const dailyData: DailyGoalData[] = [];

      for (let i = historyDays - 1; i >= 0; i--) {
        const date = subDays(today, i);
        const dayStart = startOfDay(date).toISOString();
        const dayEnd = endOfDay(date).toISOString();

        // Fetch orders for this day
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            delivered_at,
            created_at,
            order_items(quantity, product_id)
          `)
          .neq('status', 'cancelled');

        // Filter orders for this specific day
        const dayOrders = (orders || []).filter((order) => {
          const orderDate = order.status === 'delivered' && order.delivered_at
            ? new Date(order.delivered_at)
            : new Date(order.created_at);
          
          return orderDate >= new Date(dayStart) && orderDate <= new Date(dayEnd);
        });

        let value = 0;
        
        if (productId) {
          // Count specific product
          dayOrders.forEach((order) => {
            (order.order_items || []).forEach((item: any) => {
              if (item.product_id === productId) {
                value += item.quantity || 0;
              }
            });
          });
        } else {
          // Count all products
          dayOrders.forEach((order) => {
            (order.order_items || []).forEach((item: any) => {
              value += item.quantity || 0;
            });
          });
        }

        dailyData.push({
          date: format(date, 'dd/MM'),
          value,
        });
      }

      return dailyData;
    },
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000,
  });
}
