import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { Inbox, TrendingUp, MapPin, Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Premium color palette - blue dominant with soft variations
const COLORS = [
  'hsl(213, 80%, 49%)',   // Primary blue (dominant)
  'hsl(213, 60%, 65%)',   // Light blue
  'hsl(213, 40%, 75%)',   // Softer blue
  'hsl(220, 30%, 80%)',   // Gray-blue
  'hsl(225, 25%, 85%)',   // Very light
];

export interface NeighborhoodDonutData {
  id: string;
  name: string;
  revenue: number;
  customers: number;
  orders: number;
  avgTicket: number;
  growth: number;
  topProducts: { name: string; quantity: number }[];
  customerList: { id: string; name: string; totalSpent: number; orders: number }[];
  prevRevenue?: number;
  currentRevenue?: number;
  prevOrders?: number;
  currentOrders?: number;
}

interface NeighborhoodsDonutProps {
  data: NeighborhoodDonutData[];
  onNeighborhoodClick?: (neighborhood: NeighborhoodDonutData) => void;
}

// Active shape for hover effect
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
      />
    </g>
  );
};

export function NeighborhoodsDonut({ data, onNeighborhoodClick }: NeighborhoodsDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredNeighborhood, setHoveredNeighborhood] = useState<string | null>(null);

  // Total should match the "faturamento geral" for the same period
  const totalValue = useMemo(() => data.reduce((acc, n) => acc + n.revenue, 0), [data]);
  const totalNeighborhoods = data.length;

  // Extended color palette for all neighborhoods
  const EXTENDED_COLORS = [
    'hsl(213, 80%, 49%)',   // Primary blue
    'hsl(213, 60%, 65%)',   // Light blue
    'hsl(180, 60%, 45%)',   // Teal
    'hsl(160, 50%, 50%)',   // Green
    'hsl(45, 70%, 55%)',    // Gold
    'hsl(25, 70%, 55%)',    // Orange
    'hsl(340, 60%, 55%)',   // Pink
    'hsl(280, 50%, 55%)',   // Purple
    'hsl(200, 50%, 60%)',   // Sky blue
    'hsl(140, 45%, 50%)',   // Emerald
    'hsl(60, 60%, 50%)',    // Yellow
    'hsl(0, 60%, 55%)',     // Red
    'hsl(220, 40%, 70%)',   // Soft blue
    'hsl(300, 40%, 60%)',   // Magenta
    'hsl(120, 40%, 55%)',   // Lime
  ];

  const neighborhoodsData = useMemo(() => {
    const totalRevenue = totalValue;

    // Show ALL neighborhoods sorted by revenue (no grouping into "Outros")
    const sorted = [...data].sort((a, b) => b.revenue - a.revenue);

    return sorted.map((n, i) => ({
      ...n,
      value: n.revenue,
      percentage: totalRevenue > 0 ? Math.round((n.revenue / totalRevenue) * 100) : 0,
      fill: EXTENDED_COLORS[i % EXTENDED_COLORS.length],
    }));
  }, [data, totalValue]);

  // Generate automatic insight
  const insight = useMemo(() => {
    if (neighborhoodsData.length === 0) return null;
    
    const topNeighborhood = neighborhoodsData[0];
    const topPercentage = topNeighborhood?.percentage || 0;
    const top3Percentage = neighborhoodsData.slice(0, 3).reduce((acc, n) => acc + n.percentage, 0);
    
    // Check for declining neighborhoods
    const declining = neighborhoodsData.filter(n => n.growth < -10);
    const growing = neighborhoodsData.filter(n => n.growth > 20);
    
    if (declining.length > 0 && declining[0].prevRevenue && declining[0].prevRevenue > 0) {
      return {
        icon: AlertTriangle,
        text: `${declining[0].name} teve queda de ${Math.abs(declining[0].growth).toFixed(0)}% nas vendas`,
        type: 'warning' as const,
      };
    } else if (growing.length > 0 && growing[0].growth > 30) {
      return {
        icon: TrendingUp,
        text: `${growing[0].name} cresceu ${growing[0].growth.toFixed(0)}% no período`,
        type: 'highlight' as const,
      };
    } else if (topPercentage >= 50) {
      return {
        icon: AlertTriangle,
        text: `${topNeighborhood.name} concentra ${topPercentage}% do faturamento`,
        type: 'warning' as const,
      };
    } else if (top3Percentage >= 75) {
      return {
        icon: MapPin,
        text: `Top 3 bairros representam ${top3Percentage}% das vendas`,
        type: 'highlight' as const,
      };
    } else if (neighborhoodsData.length >= 3 && topPercentage < 30) {
      return {
        icon: Sparkles,
        text: 'Faturamento bem distribuído geograficamente',
        type: 'balanced' as const,
      };
    } else if (neighborhoodsData.length > 0) {
      return {
        icon: MapPin,
        text: `${totalNeighborhoods} bairros atendidos no período`,
        type: 'info' as const,
      };
    }
    return null;
  }, [neighborhoodsData, totalNeighborhoods]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Empty state
  if (neighborhoodsData.length === 0) {
    return (
      <div className="kpi-card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Distribuição por Bairro</h3>
          <p className="text-xs text-muted-foreground">Faturamento por região no período</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum bairro registrado</p>
          <p className="text-xs">Os dados aparecerão após os primeiros pedidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Distribuição por Bairro</h3>
        <p className="text-xs text-muted-foreground">Faturamento por região no período</p>
      </div>

      <div className="flex items-start gap-8">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={neighborhoodsData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => {
                  setActiveIndex(index);
                  setHoveredNeighborhood(neighborhoodsData[index].id);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredNeighborhood(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                {neighborhoodsData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.fill}
                    stroke="none"
                    onClick={() => {
                      onNeighborhoodClick?.(entry);
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-semibold text-foreground">{formatCurrency(totalValue)}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">total</span>
          </div>
        </div>

        {/* Compact Ranking */}
        <div className="flex-1 space-y-2 min-w-0">
          {neighborhoodsData.map((neighborhood, index) => {
            const isHovered = hoveredNeighborhood === neighborhood.id;
            const isFirst = index === 0;
            
            return (
              <div 
                key={neighborhood.id}
                className={cn(
                  "group transition-all duration-200 rounded-lg p-2 -mx-2 cursor-pointer",
                  isHovered && "bg-muted/50"
                )}
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setHoveredNeighborhood(neighborhood.id);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredNeighborhood(null);
                }}
                onClick={() => onNeighborhoodClick?.(neighborhood)}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 transition-transform",
                        isHovered && "scale-125"
                      )}
                      style={{ backgroundColor: neighborhood.fill }}
                    />
                    <span className={cn(
                      "text-sm truncate",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                    )}>
                      {neighborhood.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      "text-sm tabular-nums",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-foreground"
                    )}>
                      {formatCurrency(neighborhood.value)}
                    </span>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {neighborhood.percentage}%
                    </span>
                  </div>
                </div>
                
                {/* Ultra-thin progress bar */}
                <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${neighborhood.percentage}%`,
                      backgroundColor: neighborhood.fill,
                      opacity: isHovered ? 1 : 0.7,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Automatic Insight Footer */}
      {insight && (
        <div className="mt-5 pt-4 border-t border-border/30">
          <div className={cn(
            "flex items-center gap-2 text-xs rounded-lg p-2.5",
            insight.type === 'highlight' && "bg-primary/5 text-primary",
            insight.type === 'balanced' && "bg-success-bg text-success",
            insight.type === 'warning' && "bg-warning/10 text-warning",
            insight.type === 'info' && "bg-muted/50 text-muted-foreground"
          )}>
            <insight.icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium">{insight.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
