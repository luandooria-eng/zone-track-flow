import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DREWaterfallItem } from '@/hooks/useDREData';

interface Props {
  data: DREWaterfallItem[];
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
  }).format(value);
};

export function DREWaterfallChart({ data, isLoading }: Props) {
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

  // Transform data for waterfall effect
  let cumulative = 0;
  const waterfallData = data.map((item, index) => {
    const start = item.isTotal ? 0 : cumulative;
    cumulative = item.isTotal ? item.value : cumulative + item.value;
    
    return {
      name: item.name,
      value: Math.abs(item.value),
      start: Math.min(start, cumulative),
      end: Math.max(start, cumulative),
      fill: item.isTotal 
        ? (item.value >= 0 ? '#22c55e' : '#ef4444')
        : (item.value >= 0 ? '#3b82f6' : '#f97316'),
      isNegative: item.value < 0,
      actualValue: item.value,
    };
  });

  const maxValue = Math.max(...waterfallData.map(d => d.end));
  const minValue = Math.min(...waterfallData.map(d => d.start), 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={waterfallData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
        <XAxis 
          type="number"
          domain={[minValue * 1.1, maxValue * 1.1]}
          tickFormatter={formatCurrency}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis 
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
          width={100}
        />
        <Tooltip 
          formatter={(value: number, name: string, props: any) => [
            formatCurrency(props.payload.actualValue), 
            props.payload.isNegative ? 'Redução' : 'Valor'
          ]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
        <Bar dataKey="end" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[0, 4, 4, 0]}>
          {waterfallData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
