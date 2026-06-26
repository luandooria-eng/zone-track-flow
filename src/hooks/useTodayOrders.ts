import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Order } from '@/types/database';
import { useEffect, useRef } from 'react';

// Maceio timezone is UTC-3
const MACEIO_OFFSET_HOURS = -3;

/**
 * Get today's date boundaries in Maceio timezone (America/Maceio UTC-3)
 * Returns start and end of day as UTC ISO strings for database queries
 */
export function getTodayBoundariesMaceio(): { startOfDay: string; endOfDay: string; localDate: string } {
  const now = new Date();
  
  // Calculate Maceio local time by adding offset
  const maceioTime = new Date(now.getTime() + (MACEIO_OFFSET_HOURS * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
  
  // Get the date parts in Maceio time
  const year = maceioTime.getFullYear();
  const month = String(maceioTime.getMonth() + 1).padStart(2, '0');
  const day = String(maceioTime.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;
  
  // Start of day in Maceio = 00:00:00 Maceio time = 03:00:00 UTC
  const startOfDayUTC = new Date(`${localDate}T00:00:00.000Z`);
  startOfDayUTC.setHours(startOfDayUTC.getHours() - MACEIO_OFFSET_HOURS);
  
  // End of day in Maceio = 23:59:59.999 Maceio time
  const endOfDayUTC = new Date(`${localDate}T23:59:59.999Z`);
  endOfDayUTC.setHours(endOfDayUTC.getHours() - MACEIO_OFFSET_HOURS);
  
  return {
    startOfDay: startOfDayUTC.toISOString(),
    endOfDay: endOfDayUTC.toISOString(),
    localDate,
  };
}

/**
 * Get current date in Maceio timezone as YYYY-MM-DD
 */
export function getCurrentDateMaceio(): string {
  return getTodayBoundariesMaceio().localDate;
}

/**
 * Hook to fetch only today's orders (Maceio timezone)
 * Automatically refreshes when day changes
 */
export function useTodayOrders() {
  const queryClient = useQueryClient();
  const currentDateRef = useRef(getCurrentDateMaceio());

  // Check for day change every minute
  useEffect(() => {
    const checkDayChange = () => {
      const newDate = getCurrentDateMaceio();
      if (newDate !== currentDateRef.current) {
        console.log('[Pipeline] Day changed from', currentDateRef.current, 'to', newDate);
        currentDateRef.current = newDate;
        // Invalidate orders cache to fetch new day's orders
        queryClient.invalidateQueries({ queryKey: ['orders-today'] });
      }
    };

    // Check immediately
    checkDayChange();

    // Check every 30 seconds for day change
    const interval = setInterval(checkDayChange, 30000);

    // Also check at midnight precisely
    const now = new Date();
    const { endOfDay } = getTodayBoundariesMaceio();
    const msUntilMidnight = new Date(endOfDay).getTime() - now.getTime() + 1000;
    
    let midnightTimeout: ReturnType<typeof setTimeout> | null = null;
    if (msUntilMidnight > 0 && msUntilMidnight < 24 * 60 * 60 * 1000) {
      midnightTimeout = setTimeout(() => {
        console.log('[Pipeline] Midnight reached, refreshing orders');
        currentDateRef.current = getCurrentDateMaceio();
        queryClient.invalidateQueries({ queryKey: ['orders-today'] });
      }, msUntilMidnight);
    }

    return () => {
      clearInterval(interval);
      if (midnightTimeout) clearTimeout(midnightTimeout);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['orders-today', currentDateRef.current],
    queryFn: async () => {
      const { startOfDay, endOfDay, localDate } = getTodayBoundariesMaceio();
      
      console.log('[Pipeline] Fetching orders for', localDate, '| Range:', startOfDay, 'to', endOfDay);

      const { data, error } = await supabase
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
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Order[];
    },
    refetchOnWindowFocus: true,
    staleTime: 30000, // Consider data stale after 30 seconds
  });
}
