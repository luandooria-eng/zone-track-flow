import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { isWaterProduct, isGasProduct } from '@/lib/productClassification';

export function useRecalculateConsumption() {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [progress, setProgress] = useState(0);
  const queryClient = useQueryClient();

  const calculateFrequency = (orderDates: Date[]): { avgDays: number | null; lastOrder: string | null } => {
    if (orderDates.length === 0) {
      return { avgDays: null, lastOrder: null };
    }

    // Sort dates in ascending order
    const sorted = orderDates.sort((a, b) => a.getTime() - b.getTime());
    const lastOrder = sorted[sorted.length - 1].toISOString();

    if (sorted.length < 2) {
      return { avgDays: null, lastOrder };
    }

    // Calculate intervals between consecutive orders
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      const diffMs = sorted[i].getTime() - sorted[i - 1].getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
    }

    const avgDays = Math.round(totalDays / (sorted.length - 1));
    return { avgDays, lastOrder };
  };

  const recalculateAll = async () => {
    setIsRecalculating(true);
    setProgress(0);

    try {
      // Fetch all active customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .eq('is_active', true);

      if (customersError) throw customersError;
      if (!customers || customers.length === 0) {
        return { success: true, processed: 0 };
      }

      const totalCustomers = customers.length;
      let processed = 0;
      const results: { customerId: string; name: string; water: number | null; gas: number | null }[] = [];

      // Process in batches of 10 for better performance
      const batchSize = 10;
      for (let i = 0; i < customers.length; i += batchSize) {
        const batch = customers.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (customer) => {
          // Fetch all delivered orders for this customer with items
          const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select(`
              id,
              created_at,
              status,
              order_items (
                product_id,
                quantity,
                products:product_id (name)
              )
            `)
            .eq('customer_id', customer.id)
            .eq('status', 'delivered')
            .order('created_at', { ascending: true });

          if (ordersError) {
            console.error(`Error fetching orders for customer ${customer.id}:`, ordersError);
            return;
          }

          // Separate orders by product type (water vs gas)
          const waterOrderDates: Date[] = [];
          const gasOrderDates: Date[] = [];

          orders?.forEach((order: any) => {
            order.order_items?.forEach((item: any) => {
              const productName = item.products?.name || '';
              const orderDate = new Date(order.created_at);

              if (isWaterProduct(productName)) {
                // Only add if not already added for this order
                if (!waterOrderDates.some(d => d.getTime() === orderDate.getTime())) {
                  waterOrderDates.push(orderDate);
                }
              }
              if (isGasProduct(productName)) {
                if (!gasOrderDates.some(d => d.getTime() === orderDate.getTime())) {
                  gasOrderDates.push(orderDate);
                }
              }
            });
          });

          const waterFreq = calculateFrequency(waterOrderDates);
          const gasFreq = calculateFrequency(gasOrderDates);

          results.push({
            customerId: customer.id,
            name: customer.name,
            water: waterFreq.avgDays,
            gas: gasFreq.avgDays,
          });

          processed++;
        }));

        setProgress(Math.round((processed / totalCustomers) * 100));
      }

      // Invalidate queries to refresh UI
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['customer-consumption'] });

      return { 
        success: true, 
        processed: results.length,
        results: results.filter(r => r.water !== null || r.gas !== null),
      };
    } catch (error) {
      console.error('Error recalculating consumption:', error);
      throw error;
    } finally {
      setIsRecalculating(false);
      setProgress(100);
    }
  };

  return {
    recalculateAll,
    isRecalculating,
    progress,
  };
}
