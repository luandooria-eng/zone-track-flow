import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';
import { DailySalesData } from '@/hooks/useDashboardData';

type MetricType = 'revenue' | 'sales';

interface SalesChartProps {
  data: DailySalesData[];
}

export function SalesChart({ data }: SalesChartProps) {
  const [metric, setMetric] = useState<MetricType>('revenue');

  // Format data for chart
  const chartData = data.map(d => ({
    date: format(new Date(d.date), 'dd/MM', { locale: ptBR }),
    revenue: d.revenue,
    sales: d.sales,
  }));

  const hasData = chartData.some(d => d.revenue > 0 || d.sales > 0);

  return (
    <div className="kpi-card">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vendas por Período</h3>
          <p className="text-sm text-muted-foreground">Período selecionado</p>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={metric === 'revenue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMetric('revenue')}
          >
            Faturamento
          </Button>
          <Button
            variant={metric === 'sales' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMetric('sales')}
          >
            Qtd. Vendas
          </Button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">Sem dados no período</p>
          <p className="text-sm">O gráfico será preenchido com os novos pedidos</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickFormatter={(value) =>
                metric === 'revenue'
                  ? `R$ ${(value / 1000).toFixed(1)}k`
                  : value.toString()
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number) =>
                metric === 'revenue'
                  ? [`R$ ${value.toLocaleString('pt-BR')}`, 'Faturamento']
                  : [value, 'Vendas']
              }
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
