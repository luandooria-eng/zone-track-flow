import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { Inbox, TrendingUp, Radio, Sparkles } from 'lucide-react';
import { ChannelMetrics } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

// Premium color palette - blue dominant with soft variations
const COLORS = [
  'hsl(213, 80%, 49%)',   // Primary blue (dominant)
  'hsl(213, 60%, 65%)',   // Light blue
  'hsl(213, 40%, 75%)',   // Softer blue
  'hsl(220, 30%, 80%)',   // Gray-blue
  'hsl(225, 25%, 85%)',   // Very light
];

interface ChannelsDonutProps {
  data: ChannelMetrics[];
  onChannelClick?: (channelId: string) => void;
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

export function ChannelsDonut({ data, onChannelClick }: ChannelsDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredChannel, setHoveredChannel] = useState<string | null>(null);

  const channelsData = useMemo(() => {
    return data.slice(0, 5).map((c, i) => ({
      id: c.channelId,
      name: c.channelName,
      orders: c.orders,
      revenue: c.revenue,
      percentage: Math.round(c.percentage),
      fill: COLORS[i % COLORS.length],
    }));
  }, [data]);

  const totalOrders = channelsData.reduce((acc, c) => acc + c.orders, 0);

  // Generate automatic insight
  const insight = useMemo(() => {
    if (channelsData.length === 0) return null;
    
    const topChannel = channelsData[0];
    const topPercentage = topChannel?.percentage || 0;
    
    if (topPercentage >= 60) {
      return {
        icon: TrendingUp,
        text: `${topChannel.name} concentra ${topPercentage}% dos pedidos`,
        type: 'highlight' as const,
      };
    } else if (channelsData.length >= 3 && topPercentage < 40) {
      return {
        icon: Sparkles,
        text: 'Canais bem diversificados',
        type: 'balanced' as const,
      };
    } else if (channelsData.length > 0) {
      return {
        icon: Radio,
        text: `${topChannel.name} lidera com ${topChannel.orders} pedidos`,
        type: 'info' as const,
      };
    }
    return null;
  }, [channelsData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Empty state
  if (channelsData.length === 0) {
    return (
      <div className="kpi-card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Canais de Atendimento</h3>
          <p className="text-xs text-muted-foreground">Distribuição por canal no período</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhum dado disponível</p>
          <p className="text-xs">Os dados aparecerão após o primeiro pedido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Canais de Atendimento</h3>
        <p className="text-xs text-muted-foreground">Distribuição por canal no período</p>
      </div>

      <div className="flex items-start gap-8">
        {/* Donut Chart */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={channelsData}
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
                  setHoveredChannel(channelsData[index].id);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredChannel(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                {channelsData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fill}
                    stroke="none"
                    onClick={() => onChannelClick?.(entry.id)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-semibold text-foreground">{totalOrders}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">pedidos</span>
          </div>
        </div>

        {/* Compact Ranking */}
        <div className="flex-1 space-y-2 min-w-0">
          {channelsData.map((channel, index) => {
            const isHovered = hoveredChannel === channel.id;
            const isFirst = index === 0;
            
            return (
              <div 
                key={channel.id}
                className={cn(
                  "group cursor-pointer transition-all duration-200 rounded-lg p-2 -mx-2",
                  isHovered && "bg-muted/50"
                )}
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setHoveredChannel(channel.id);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredChannel(null);
                }}
                onClick={() => onChannelClick?.(channel.id)}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 transition-transform",
                        isHovered && "scale-125"
                      )}
                      style={{ backgroundColor: channel.fill }}
                    />
                    <span className={cn(
                      "text-sm truncate",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                    )}>
                      {channel.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      "text-sm tabular-nums",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-foreground"
                    )}>
                      {channel.orders}
                    </span>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {channel.percentage}%
                    </span>
                  </div>
                </div>
                
                {/* Revenue line */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] text-muted-foreground ml-4">
                    {formatCurrency(channel.revenue)}
                  </span>
                </div>
                
                {/* Ultra-thin progress bar */}
                <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${channel.percentage}%`,
                      backgroundColor: channel.fill,
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
