import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { HourlyData } from '@/hooks/usePeakHoursData';
import { useMemo } from 'react';

interface HourlyVolumeChartProps {
  data: HourlyData[];
}

export function HourlyVolumeChart({ data }: HourlyVolumeChartProps) {
  // Find peak hour for highlighting
  const peakHour = useMemo(() => {
    return data.reduce((max, d) => d.orderCount > max.orderCount ? d : max, data[0]);
  }, [data]);

  const avgOrders = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.orderCount, 0);
    return total / data.length;
  }, [data]);

  const chartData = data.map(d => ({
    hour: `${d.hour.toString().padStart(2, '0')}h`,
    pedidos: d.orderCount,
    valor: d.totalValue,
    isPeak: d.hour === peakHour?.hour,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis 
          dataKey="hour" 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          interval={1}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'pedidos') return [value, 'Pedidos'];
            return [formatCurrency(value), 'Faturamento'];
          }}
          labelFormatter={(label) => `Horário: ${label}`}
        />
        <ReferenceLine 
          y={avgOrders} 
          stroke="hsl(var(--warning))" 
          strokeDasharray="5 5"
          label={{ 
            value: 'Média', 
            position: 'right',
            fill: 'hsl(var(--muted-foreground))',
            fontSize: 10,
          }}
        />
        <Bar 
          dataKey="pedidos" 
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.isPeak ? 'hsl(213, 80%, 49%)' : 'hsl(213, 60%, 75%)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
