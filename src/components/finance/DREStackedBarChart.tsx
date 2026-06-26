import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DRETimeSeries } from '@/hooks/useDREData';

interface Props {
  data: DRETimeSeries[];
  isLoading: boolean;
  onCategoryClick?: (category: string) => void;
}

const COLORS = {
  despesas: '#ef4444',
  cmv: '#f97316',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
};

export function DREStackedBarChart({ data, isLoading, onCategoryClick }: Props) {
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
      <BarChart data={data}>
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
        <Legend 
          onClick={(e) => onCategoryClick?.(e.dataKey as string)}
          wrapperStyle={{ cursor: 'pointer' }}
        />
        <Bar 
          dataKey="despesas" 
          name="Despesas Op." 
          stackId="a" 
          fill={COLORS.despesas}
          onClick={() => onCategoryClick?.('despesas')}
          cursor="pointer"
        />
        <Bar 
          dataKey="cmv" 
          name="CMV" 
          stackId="a" 
          fill={COLORS.cmv}
          onClick={() => onCategoryClick?.('cmv')}
          cursor="pointer"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
