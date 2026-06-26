import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { FinanceTransaction } from '@/types/finance';

interface Props {
  transactions: FinanceTransaction[];
  isLoading: boolean;
}

const COLORS = [
  'hsl(0, 84%, 60%)',
  'hsl(25, 95%, 53%)',
  'hsl(45, 93%, 47%)',
  'hsl(142, 76%, 36%)',
  'hsl(217, 91%, 60%)',
  'hsl(262, 83%, 58%)',
  'hsl(320, 70%, 50%)',
  'hsl(180, 70%, 45%)',
];

const sourceModuleLabels: Record<string, string> = {
  sales: 'Vendas',
  wallet: 'Carteira',
  stock: 'Compras',
  expense: 'Despesas',
  payroll: 'Salários',
};

export function FinanceExpensesCategoryChart({ transactions, isLoading }: Props) {
  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};
    
    transactions.forEach(tx => {
      const category = sourceModuleLabels[tx.source_module] || 'Outros';
      grouped[category] = (grouped[category] || 0) + Number(tx.amount);
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
        Nenhuma saída no período
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={false}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number) => [formatCurrency(value), 'Valor']}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
