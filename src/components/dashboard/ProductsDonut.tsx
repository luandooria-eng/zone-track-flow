import { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { Inbox, TrendingUp, Sparkles } from 'lucide-react';
import { ProductSales } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

// Premium color palette - blue dominant with soft variations
const COLORS = [
  'hsl(213, 80%, 49%)',   // Primary blue (dominant)
  'hsl(213, 60%, 65%)',   // Light blue
  'hsl(213, 40%, 75%)',   // Softer blue
  'hsl(220, 30%, 80%)',   // Gray-blue
  'hsl(225, 25%, 85%)',   // Very light
];

interface ProductsDonutProps {
  data: ProductSales[];
  onProductClick?: (productName: string) => void;
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

export function ProductsDonut({ data, onProductClick }: ProductsDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  const productsData = useMemo(() => {
    return data.map((p, i) => ({
      name: p.productName,
      quantity: p.quantity,
      percentage: Math.round(p.percentage),
      fill: COLORS[i % COLORS.length],
    }));
  }, [data]);

  const totalQuantity = productsData.reduce((acc, p) => acc + p.quantity, 0);

  // Generate automatic insight
  const insight = useMemo(() => {
    if (productsData.length === 0) return null;
    
    const topProduct = productsData[0];
    const topPercentage = topProduct?.percentage || 0;
    
    if (topPercentage >= 60) {
      return {
        icon: TrendingUp,
        text: `${topProduct.name} domina com ${topPercentage}% das vendas`,
        type: 'highlight' as const,
      };
    } else if (productsData.length >= 3 && topPercentage < 40) {
      return {
        icon: Sparkles,
        text: 'Vendas bem distribuídas entre produtos',
        type: 'balanced' as const,
      };
    } else if (productsData.length > 0) {
      return {
        icon: TrendingUp,
        text: `${topProduct.name} lidera com ${topProduct.quantity} unidades`,
        type: 'info' as const,
      };
    }
    return null;
  }, [productsData]);

  // Empty state
  if (productsData.length === 0) {
    return (
      <div className="kpi-card">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">Produtos Vendidos</h3>
          <p className="text-xs text-muted-foreground">Mix de produtos no período</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm font-medium">Nenhuma venda registrada</p>
          <p className="text-xs">Os dados aparecerão após o primeiro pedido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Produtos Vendidos</h3>
        <p className="text-xs text-muted-foreground">Mix de produtos no período</p>
      </div>

      <div className="flex items-start gap-8">
        {/* Donut Chart - Thinner and more elegant */}
        <div className="relative flex-shrink-0">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={productsData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={3}
                dataKey="percentage"
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, index) => {
                  setActiveIndex(index);
                  setHoveredProduct(productsData[index].name);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredProduct(null);
                }}
                style={{ cursor: 'pointer' }}
              >
                {productsData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.fill}
                    stroke="none"
                    onClick={() => onProductClick?.(entry.name)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-semibold text-foreground">{totalQuantity}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">unidades</span>
          </div>
        </div>

        {/* Compact Ranking */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {productsData.map((product, index) => {
            const isHovered = hoveredProduct === product.name;
            const isFirst = index === 0;
            
            return (
              <div 
                key={product.name}
                className={cn(
                  "group cursor-pointer transition-all duration-200 rounded-lg p-2 -mx-2",
                  isHovered && "bg-muted/50"
                )}
                onMouseEnter={() => {
                  setActiveIndex(index);
                  setHoveredProduct(product.name);
                }}
                onMouseLeave={() => {
                  setActiveIndex(null);
                  setHoveredProduct(null);
                }}
                onClick={() => onProductClick?.(product.name)}
              >
                {/* Product info row */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 transition-transform",
                        isHovered && "scale-125"
                      )}
                      style={{ backgroundColor: product.fill }}
                    />
                    <span className={cn(
                      "text-sm truncate",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                    )}>
                      {product.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      "text-sm tabular-nums",
                      isFirst ? "font-semibold text-foreground" : "font-medium text-foreground"
                    )}>
                      {product.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {product.percentage}%
                    </span>
                  </div>
                </div>
                
                {/* Ultra-thin progress bar */}
                <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      isHovered && "opacity-100"
                    )}
                    style={{ 
                      width: `${product.percentage}%`,
                      backgroundColor: product.fill,
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
