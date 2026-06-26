import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';
import { useFilters } from './useFilters';
import { useMemo } from 'react';

export interface TimeSlotData {
  timeSlot: string;
  dayOfWeek: number;
  dayName: string;
  orderCount: number;
  totalQuantity: number;
  totalValue: number;
}

export interface HourlyData {
  hour: number;
  orderCount: number;
  totalQuantity: number;
  totalValue: number;
}

export interface ProductByTimeSlot {
  productId: string;
  productName: string;
  quantity: number;
  value: number;
  percentage: number;
}

export interface PeakHoursInsight {
  type: 'peak_day' | 'peak_hour' | 'peak_slot' | 'top_product';
  message: string;
  value: string | number;
}

const TIME_SLOTS = ['06-08', '08-10', '10-12', '12-14', '14-16', '16-18', '18-20', '20-22', '22-06'];
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function usePeakHoursData(selectedTimeSlot?: string, selectedDay?: number) {
  const { filters } = useFilters();
  const dateFrom = filters.dateRange?.from || new Date();
  const dateTo = filters.dateRange?.to || new Date();

  const query = useQuery({
    queryKey: ['peak-hours-analysis', dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const startDate = startOfDay(dateFrom).toISOString();
      const endDate = endOfDay(dateTo).toISOString();

      // Fetch orders with pagination to avoid Supabase 1000 row limit
      const allOrders: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            created_at,
            delivered_at,
            status,
            total,
            order_items(
              product_id,
              quantity,
              total_price,
              product:products(id, name)
            )
          `)
          .neq('status', 'cancelled')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (orders && orders.length > 0) {
          allOrders.push(...orders);
          hasMore = orders.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const orders = allOrders;

      // Process data
      const heatmapData: Record<string, TimeSlotData> = {};
      const hourlyData: Record<number, HourlyData> = {};
      const productsBySlot: Record<string, Record<string, { quantity: number; value: number; name: string }>> = {};

      // Initialize structures
      for (let day = 0; day < 7; day++) {
        for (const slot of TIME_SLOTS) {
          const key = `${day}-${slot}`;
          heatmapData[key] = {
            timeSlot: slot,
            dayOfWeek: day,
            dayName: DAYS[day],
            orderCount: 0,
            totalQuantity: 0,
            totalValue: 0,
          };
        }
      }

      for (let hour = 0; hour < 24; hour++) {
        hourlyData[hour] = {
          hour,
          orderCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        };
      }

      // Process orders
      (orders || []).forEach((order) => {
        const orderDate = order.status === 'delivered' && order.delivered_at
          ? new Date(order.delivered_at)
          : new Date(order.created_at);

        const dayOfWeek = orderDate.getDay();
        const hour = orderDate.getHours();
        const timeSlot = getTimeSlot(hour);
        const key = `${dayOfWeek}-${timeSlot}`;

        // Update heatmap
        if (heatmapData[key]) {
          heatmapData[key].orderCount += 1;
          heatmapData[key].totalValue += order.total || 0;
          
          (order.order_items || []).forEach((item: any) => {
            heatmapData[key].totalQuantity += item.quantity || 0;
          });
        }

        // Update hourly
        hourlyData[hour].orderCount += 1;
        hourlyData[hour].totalValue += order.total || 0;
        (order.order_items || []).forEach((item: any) => {
          hourlyData[hour].totalQuantity += item.quantity || 0;
        });

        // Update products by slot
        if (!productsBySlot[timeSlot]) {
          productsBySlot[timeSlot] = {};
        }
        (order.order_items || []).forEach((item: any) => {
          const productId = item.product_id;
          const productName = item.product?.name || 'Desconhecido';
          if (!productsBySlot[timeSlot][productId]) {
            productsBySlot[timeSlot][productId] = { quantity: 0, value: 0, name: productName };
          }
          productsBySlot[timeSlot][productId].quantity += item.quantity || 0;
          productsBySlot[timeSlot][productId].value += item.total_price || 0;
        });
      });

      return {
        heatmapData: Object.values(heatmapData),
        hourlyData: Object.values(hourlyData).sort((a, b) => a.hour - b.hour),
        productsBySlot,
        totalOrders: orders?.length || 0,
      };
    },
    refetchInterval: 120000,
  });

  // Compute products for selected slot
  const productsForSlot = useMemo(() => {
    if (!query.data?.productsBySlot || !selectedTimeSlot) return [];

    const slotProducts = query.data.productsBySlot[selectedTimeSlot] || {};
    const totalQty = Object.values(slotProducts).reduce((sum, p) => sum + p.quantity, 0);

    return Object.entries(slotProducts)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        quantity: data.quantity,
        value: data.value,
        percentage: totalQty > 0 ? (data.quantity / totalQty) * 100 : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [query.data?.productsBySlot, selectedTimeSlot]);

  // Generate insights
  const insights = useMemo((): PeakHoursInsight[] => {
    if (!query.data) return [];

    const result: PeakHoursInsight[] = [];
    const { heatmapData, hourlyData } = query.data;

    // Find peak day
    const dayTotals = DAYS.map((_, day) => ({
      day,
      dayName: DAYS[day],
      count: heatmapData.filter(d => d.dayOfWeek === day).reduce((sum, d) => sum + d.orderCount, 0),
    }));
    const peakDay = dayTotals.sort((a, b) => b.count - a.count)[0];
    if (peakDay && peakDay.count > 0) {
      result.push({
        type: 'peak_day',
        message: `${peakDay.dayName} é o dia mais movimentado`,
        value: `${peakDay.count} pedidos`,
      });
    }

    // Find peak hour
    const peakHour = [...hourlyData].sort((a, b) => b.orderCount - a.orderCount)[0];
    if (peakHour && peakHour.orderCount > 0) {
      result.push({
        type: 'peak_hour',
        message: `Horário de pico às ${peakHour.hour}h`,
        value: `${peakHour.orderCount} pedidos`,
      });
    }

    // Find peak time slot
    const slotTotals = TIME_SLOTS.map(slot => ({
      slot,
      count: heatmapData.filter(d => d.timeSlot === slot).reduce((sum, d) => sum + d.orderCount, 0),
    }));
    const peakSlot = slotTotals.sort((a, b) => b.count - a.count)[0];
    if (peakSlot && peakSlot.count > 0) {
      result.push({
        type: 'peak_slot',
        message: `Faixa ${peakSlot.slot} concentra mais vendas`,
        value: `${peakSlot.count} pedidos`,
      });
    }

    return result;
  }, [query.data]);

  return {
    ...query,
    productsForSlot,
    insights,
    timeSlots: TIME_SLOTS,
    days: DAYS,
  };
}

function getTimeSlot(hour: number): string {
  if (hour >= 6 && hour < 8) return '06-08';
  if (hour >= 8 && hour < 10) return '08-10';
  if (hour >= 10 && hour < 12) return '10-12';
  if (hour >= 12 && hour < 14) return '12-14';
  if (hour >= 14 && hour < 16) return '14-16';
  if (hour >= 16 && hour < 18) return '16-18';
  if (hour >= 18 && hour < 20) return '18-20';
  if (hour >= 20 && hour < 22) return '20-22';
  return '22-06';
}
