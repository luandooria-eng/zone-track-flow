import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { Inbox, TrendingUp, Truck, Sparkles, Award } from 'lucide-react';
import { DelivererMetrics } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

// Premium color palette - blue dominant with soft variations
const COLORS = [
  'hsl(213, 80%, 49%)',   // Primary blue (dominant)
  'hsl(213, 60%, 65%)',   // Light blue
  'hsl(213, 40%, 75%)',   // Softer blue
  'hsl(220, 30%, 80%)',   // Gray-blue
  'hsl(225, 25%, 85%)',   // Very light
];

interface DeliverersDonutProps {
  data: DelivererMetrics[];
  onDelivererClick?: (delivererId: string) => void;
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

export function DeliverersDonut({ data, onDelivererClick }: DeliverersDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredDeliverer, setHoveredDeliverer] = useState<string | null>(null);

  const deliverersData = useMemo(() => {
    return data.slice(0, 5).map((d, i) => ({
      id: d.delivererId,
      name: d.delivererName,
      orders: d.orders,
      revenue: d.revenue,
      percentage: Math.round(d.percentage),
      fill: COLORS[i % COLORS.length],
    }));
  }, [data]);

  const totalDeliveries = deliverersData.reduce((acc, d) => acc + d.orders, 0);

  // Generate automatic insight
  const insight = useMemo(() => {
    if (deliverersData.length === 0) return null;
    
    const topDeliverer = deliverersData[0];
    const topPercentage = topDeliverer?.percentage || 0;
    
    if (topPercentage >= 50) {
      return {
        icon: Award,
        text: `${topDeliverer.name} lidera com ${topPercentage}% das entregas`,
        type: 'highlight' as const,
      };
    } else if (deliverersData.length >= 3 && topPercentage < 35) {
      return {
        icon: Sparkles,
        text: 'Carga bem distribuída entre entregadores',
        type: 'balanced' as const,
      };
    } else if (deliverersData.length > 0) {
      return {
        icon: Truck,
        text: `${topDeliverer.name} completou ${topDeliverer.orders} entregas`,
        type: 'info' as const,
      };
    }
    return null;
  }, [deliverersData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Empty state
  if (deliverersData.length === 0) {
    return (
      <div className="kpi-card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Entregadores</h3>
          <p className="text-xs text-muted-foreground">Performance por entregador no período</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhuma entrega registrada</p>
          <p className="text-xs">Os dados aparecerão após a primeira entrega</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Entregadores</h3>
        <p className="text-xs text-muted-foreground">Performance por entregador no período</p>
      </div>

      <div className="flex items-start gap-8">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={deliverersData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="percentage"
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => {
                  setActiveIndex(index);
                  setHoveredDeliverer(deliverersData[index].id);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredDeliverer(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                {deliverersData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fill}
                    stroke="none"
                    onClick={() => onDelivererClick?.(entry.id)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-semibold text-foreground">{totalDeliveries}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">entregas</span>
          </div>
        </div>

        {/* Compact Ranking */}
        <div className="flex-1 space-y-2 min-w-0">
          {deliverersData.map((deliverer, index) => {
            const isHovered = hoveredDeliverer === deliverer.id;
            const isFirst = index === 0;
            
            return (
              <div 
                key={deliverer.id}
                className={cn(
                  "group cursor-pointer transition-all duration-200 rounded-lg p-2 -mx-2",
                  isHovered && "bg-muted/50"
                )}
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setHoveredDeliverer(deliverer.id);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredDeliverer(null);
                }}
                onClick={() => onDelivererClick?.(deliverer.id)}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 transition-transform",
                        isHovered && "scale-125"
                      )}
                      style={{ backgroundColor: deliverer.fill }}
                    />
                    <span className={cn(
                      "text-sm truncate",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                    )}>
                      {deliverer.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      "text-sm tabular-nums",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-foreground"
                    )}>
                      {deliverer.orders}
                    </span>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {deliverer.percentage}%
                    </span>
                  </div>
                </div>
                
                {/* Ultra-thin progress bar */}
                <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${deliverer.percentage}%`,
                      backgroundColor: deliverer.fill,
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
