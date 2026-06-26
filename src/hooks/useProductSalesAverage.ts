import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, differenceInDays } from 'date-fns';

interface ProductSalesAverage {
  product_id: string;
  totalQty: number;
  avgPerDay: number;
}

export function useProductSalesAverage(days: number = 30) {
  return useQuery({
    queryKey: ['product-sales-average', days],
    queryFn: async () => {
      const startDate = subDays(new Date(), days);
      const startDateISO = startDate.toISOString();

      // Fetch order items from delivered orders in the period
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          product_id,
          quantity,
          order:orders!inner(
            status,
            delivered_at
          )
        `)
        .gte('order.delivered_at', startDateISO)
        .eq('order.status', 'delivered');

      if (error) throw error;

      // Group by product and sum quantities
      const productTotals: Record<string, number> = {};
      
      (data || []).forEach((item: any) => {
        if (!productTotals[item.product_id]) {
          productTotals[item.product_id] = 0;
        }
        productTotals[item.product_id] += item.quantity;
      });

      // Calculate average per day
      const actualDays = Math.max(1, days); // Avoid division by zero
      
      const averages: Record<string, ProductSalesAverage> = {};
      
      Object.entries(productTotals).forEach(([productId, totalQty]) => {
        averages[productId] = {
          product_id: productId,
          totalQty,
          avgPerDay: totalQty / actualDays,
        };
      });

      return averages;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}
