import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DailyCashFlow } from '@/types/finance';

interface Props {
  data: DailyCashFlow[];
  isLoading: boolean;
}

export function FinanceCashFlowChart({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      dateFormatted: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
    }));
  }, [data]);

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        Nenhuma movimentação no período
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
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="dateFormatted" 
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(value)}
          className="text-muted-foreground"
        />
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)}
          labelFormatter={(label) => `Data: ${label}`}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="income" 
          name="Entradas"
          stroke="hsl(142, 76%, 36%)" 
          strokeWidth={2}
          dot={false}
        />
        <Line 
          type="monotone" 
          dataKey="expenses" 
          name="Saídas"
          stroke="hsl(0, 84%, 60%)" 
          strokeWidth={2}
          dot={false}
        />
        <Line 
          type="monotone" 
          dataKey="balance" 
          name="Saldo Acumulado"
          stroke="hsl(217, 91%, 60%)" 
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
