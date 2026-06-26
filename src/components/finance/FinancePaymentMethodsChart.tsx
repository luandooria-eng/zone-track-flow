import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { FinanceTransaction } from '@/types/finance';

interface Props {
  transactions: FinanceTransaction[];
  isLoading: boolean;
}

export function FinancePaymentMethodsChart({ transactions, isLoading }: Props) {
  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    
    transactions.forEach(tx => {
      const method = tx.payment_method?.name || 'Outros';
      grouped[method] = (grouped[method] || 0) + Number(tx.amount);
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        Nenhuma entrada no período
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          type="number"
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(value)}
          className="text-muted-foreground"
        />
        <YAxis 
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          width={100}
          className="text-muted-foreground"
        />
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Bar 
          dataKey="value" 
          fill="hsl(142, 76%, 36%)" 
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
