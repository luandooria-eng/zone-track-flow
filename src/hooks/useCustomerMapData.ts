import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFilters } from './useFilters';
import { addDays } from 'date-fns';

// Brazil timezone offset (UTC-3)
function toBrazilUTCStart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T03:00:00+00:00`;
}

function toBrazilUTCEnd(date: Date): string {
  const nextDay = addDays(date, 1);
  const year = nextDay.getFullYear();
  const month = String(nextDay.getMonth() + 1).padStart(2, '0');
  const day = String(nextDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T03:00:00+00:00`;
}

/**
 * Hook dedicado para CustomerMap com paginação
 * Busca todos os pedidos do período selecionado sem limite de 1000 registros
 */
export function useCustomerMapOrders() {
  const { filters } = useFilters();
  
  const startDateUTC = toBrazilUTCStart(filters.dateRange.from);
  const endDateUTC = toBrazilUTCEnd(filters.dateRange.to);
  
  return useQuery({
    queryKey: ['customer-map-orders', startDateUTC, endDateUTC],
    queryFn: async () => {
      const allOrders: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            total,
            status,
            created_at,
            neighborhood_id,
            customer_id,
            items:order_items(quantity, product:products(id, name))
          `)
          .gte('created_at', startDateUTC)
          .lt('created_at', endDateUTC)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

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
}

/**
 * Hook para buscar pedidos do período anterior (para cálculo de crescimento)
 */
export function useCustomerMapPreviousOrders() {
  const { filters } = useFilters();
  
  const periodDays = Math.ceil((filters.dateRange.to.getTime() - filters.dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const previousStart = new Date(filters.dateRange.from.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const previousEnd = new Date(filters.dateRange.from.getTime() - 24 * 60 * 60 * 1000);
  
  const prevStartUTC = toBrazilUTCStart(previousStart);
  const prevEndUTC = toBrazilUTCEnd(previousEnd);
  
  return useQuery({
    queryKey: ['customer-map-orders-previous', prevStartUTC, prevEndUTC],
    queryFn: async () => {
      const allOrders: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, total, status, created_at, neighborhood_id')
          .gte('created_at', prevStartUTC)
          .lt('created_at', prevEndUTC)
          .range(page * pageSize, (page + 1) * pageSize - 1);

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
}
