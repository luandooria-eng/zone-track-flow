import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Flame, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightData {
  type: 'danger' | 'warning' | 'success' | 'info';
  text: string;
  neighborhood?: string;
  value?: number;
  change?: number;
}

interface NeighborhoodData {
  id: string;
  name: string;
  revenue: number;
  growth: number;
  orders: number;
  customers: number;
}

interface InsightsChartProps {
  data: NeighborhoodData[];
  onNeighborhoodClick?: (neighborhood: NeighborhoodData) => void;
}

export function InsightsChart({ data, onNeighborhoodClick }: InsightsChartProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}K`;
    return `R$ ${value.toFixed(0)}`;
  };

  // Growing neighborhoods chart data
  const growingData = useMemo(() => {
    return data
      .filter(n => n.growth > 10 && n.revenue > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 5)
      .map(n => ({
        ...n,
        shortName: n.name.length > 12 ? n.name.substring(0, 10) + '...' : n.name,
      }));
  }, [data]);

  // Declining neighborhoods chart data
  const decliningData = useMemo(() => {
    return data
      .filter(n => n.growth < -10 && n.revenue > 0)
      .sort((a, b) => a.growth - b.growth)
      .slice(0, 5)
      .map(n => ({
        ...n,
        shortName: n.name.length > 12 ? n.name.substring(0, 10) + '...' : n.name,
        absGrowth: Math.abs(n.growth),
      }));
  }, [data]);

  // Top revenue neighborhoods
  const topRevenueData = useMemo(() => {
    return data
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(n => ({
        ...n,
        shortName: n.name.length > 12 ? n.name.substring(0, 10) + '...' : n.name,
      }));
  }, [data]);

  const totalRevenue = data.reduce((sum, n) => sum + n.revenue, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold">{d.name}</p>
        <p className="text-muted-foreground">
          {d.growth !== undefined && `Crescimento: ${d.growth > 0 ? '+' : ''}${d.growth.toFixed(0)}%`}
        </p>
        <p className="text-muted-foreground">Faturamento: {formatCurrency(d.revenue)}</p>
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      {/* Growing Neighborhoods Chart */}
      {growingData.length > 0 && (
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-success" />
            <h4 className="text-sm font-semibold text-foreground">Bairros em Alta</h4>
            <span className="text-xs text-muted-foreground ml-auto">{growingData.length} bairros crescendo</span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growingData} layout="vertical" margin={{ left: 0, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="shortName" 
                  width={80}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="growth" 
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => onNeighborhoodClick?.(data)}
                >
                  {growingData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`hsl(142, ${60 + index * 5}%, ${45 + index * 3}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {growingData.map((n, i) => (
              <button
                key={n.id}
                onClick={() => onNeighborhoodClick?.(n as any)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                  "bg-success/10 text-success hover:bg-success/20"
                )}
              >
                <TrendingUp className="h-3 w-3" />
                <span className="font-medium">{n.name}</span>
                <span className="opacity-70">+{n.growth.toFixed(0)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Declining Neighborhoods Chart */}
      {decliningData.length > 0 && (
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Snowflake className="h-4 w-4 text-destructive" />
            <h4 className="text-sm font-semibold text-foreground">Bairros em Queda</h4>
            <span className="text-xs text-muted-foreground ml-auto">{decliningData.length} bairros em declínio</span>
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decliningData} layout="vertical" margin={{ left: 0, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="shortName" 
                  width={80}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="absGrowth" 
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => onNeighborhoodClick?.(data)}
                >
                  {decliningData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`hsl(0, ${60 + index * 5}%, ${50 + index * 3}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {decliningData.map((n, i) => (
              <button
                key={n.id}
                onClick={() => onNeighborhoodClick?.(n as any)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                  "bg-destructive/10 text-destructive hover:bg-destructive/20"
                )}
              >
                <TrendingDown className="h-3 w-3" />
                <span className="font-medium">{n.name}</span>
                <span className="opacity-70">{n.growth.toFixed(0)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Distribution Mini Chart */}
      <div className="kpi-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Top 5 Faturamento</h4>
          <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(totalRevenue)} total</span>
        </div>
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topRevenueData} layout="vertical" margin={{ left: 0, right: 50 }}>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="shortName" 
                width={80}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="revenue" 
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data) => onNeighborhoodClick?.(data)}
              >
                {topRevenueData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`hsl(213, ${70 - index * 10}%, ${45 + index * 5}%)`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 mt-2">
          {topRevenueData.slice(0, 3).map((n, i) => {
            const share = totalRevenue > 0 ? (n.revenue / totalRevenue) * 100 : 0;
            return (
              <div key={n.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{i + 1}. {n.name}</span>
                <span className="font-medium">{formatCurrency(n.revenue)} ({share.toFixed(0)}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Concentration Warning */}
      {topRevenueData.length > 0 && (() => {
        const top1Share = totalRevenue > 0 ? (topRevenueData[0].revenue / totalRevenue) * 100 : 0;
        const top3Share = topRevenueData.slice(0, 3).reduce((sum, n) => sum + n.revenue, 0) / totalRevenue * 100;
        
        if (top1Share > 50) {
          return (
            <div className="kpi-card p-4 border-warning/30 bg-warning/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-warning">Alta Concentração</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {topRevenueData[0].name} concentra {top1Share.toFixed(0)}% do faturamento. 
                    Considere estratégias de expansão para outros bairros.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
