import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DRETimeSeries } from '@/hooks/useDREData';

interface Props {
  data: DRETimeSeries[];
  isLoading: boolean;
  onPointClick?: (date: string) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
};

export function DREResultChart({ data, isLoading, onPointClick }: Props) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        Nenhum dado no período
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart 
        data={data}
        onClick={(e) => {
          if (e?.activeLabel && onPointClick) {
            const point = data.find(d => d.label === e.activeLabel);
            if (point) onPointClick(point.date);
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="label" 
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis 
          tickFormatter={formatCurrency}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip 
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="receitas" 
          name="Receitas" 
          stroke="#22c55e" 
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6, cursor: 'pointer' }}
        />
        <Line 
          type="monotone" 
          dataKey="despesas" 
          name="Despesas" 
          stroke="#ef4444" 
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6, cursor: 'pointer' }}
        />
        <Line 
          type="monotone" 
          dataKey="resultado" 
          name="Resultado" 
          stroke="#3b82f6" 
          strokeWidth={3}
          dot={{ r: 4 }}
          activeDot={{ r: 6, cursor: 'pointer' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
