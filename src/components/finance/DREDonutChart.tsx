import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DRECategoryBreakdown } from '@/hooks/useDREData';

interface Props {
  data: DRECategoryBreakdown[];
  isLoading: boolean;
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
}

const COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function DREDonutChart({ data, isLoading, onCategoryClick, selectedCategory }: Props) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        Nenhuma despesa no período
      </div>
    );
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          innerRadius={60}
          outerRadius={100}
          dataKey="total"
          nameKey="category"
          onClick={(entry) => onCategoryClick?.(entry.sourceModule)}
          cursor="pointer"
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={COLORS[index % COLORS.length]}
              opacity={selectedCategory && selectedCategory !== entry.sourceModule ? 0.3 : 1}
              stroke={selectedCategory === entry.sourceModule ? 'hsl(var(--foreground))' : 'none'}
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
          }}
        />
        <Legend 
          onClick={(e) => onCategoryClick?.(data.find(d => d.category === e.value)?.sourceModule || '')}
          wrapperStyle={{ cursor: 'pointer' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
