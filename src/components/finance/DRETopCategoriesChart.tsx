import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DRECategoryBreakdown } from '@/hooks/useDREData';

interface Props {
  data: DRECategoryBreakdown[];
  isLoading: boolean;
  title?: string;
  onCategoryClick?: (category: string) => void;
}

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
};

export function DRETopCategoriesChart({ data, isLoading, title, onCategoryClick }: Props) {
  if (isLoading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        Nenhum dado
      </div>
    );
  }

  const top10 = data.slice(0, 10);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={top10} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis 
          type="number"
          tickFormatter={formatCurrency}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis 
          type="category"
          dataKey="category"
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
          width={100}
        />
        <Tooltip 
          formatter={(value: number) => [formatCurrency(value), 'Total']}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Bar 
          dataKey="total" 
          radius={[0, 4, 4, 0]}
          onClick={(entry) => onCategoryClick?.(entry.sourceModule)}
          cursor="pointer"
        >
          {top10.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
