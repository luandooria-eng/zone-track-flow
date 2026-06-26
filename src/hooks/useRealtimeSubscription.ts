import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type TableName = 'orders' | 'order_items' | 'products' | 'daily_sales_summary' | 'customers';

export function useRealtimeSubscription(tables: TableName[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload) => {
          const table = payload.table as TableName;
          
          // Invalidate relevant queries based on table
          switch (table) {
            case 'orders':
              queryClient.invalidateQueries({ queryKey: ['orders'] });
              queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
              queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
              break;
            case 'order_items':
              queryClient.invalidateQueries({ queryKey: ['orders'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
              queryClient.invalidateQueries({ queryKey: ['goals-progress'] });
              break;
            case 'products':
              queryClient.invalidateQueries({ queryKey: ['products'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
              break;
            case 'daily_sales_summary':
              queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
              break;
            case 'customers':
              queryClient.invalidateQueries({ queryKey: ['customers'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tables]);
}

// Specific hook for orders realtime
export function useOrdersRealtime() {
  useRealtimeSubscription(['orders', 'order_items', 'daily_sales_summary']);
}

// Specific hook for dashboard realtime
export function useDashboardRealtime() {
  useRealtimeSubscription(['orders', 'daily_sales_summary', 'products', 'customers']);
}
