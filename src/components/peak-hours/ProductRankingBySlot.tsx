import { ProductByTimeSlot } from '@/hooks/usePeakHoursData';
import { cn } from '@/lib/utils';
import { Package, Inbox } from 'lucide-react';

interface ProductRankingBySlotProps {
  data: ProductByTimeSlot[];
  timeSlot: string;
  onProductClick?: (productId: string) => void;
}

// Premium color palette
const COLORS = [
  'hsl(213, 80%, 49%)',
  'hsl(213, 60%, 65%)',
  'hsl(213, 40%, 75%)',
  'hsl(220, 30%, 80%)',
  'hsl(225, 25%, 85%)',
];

export function ProductRankingBySlot({ data, timeSlot, onProductClick }: ProductRankingBySlotProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Inbox className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm font-medium">Sem dados para esta faixa</p>
        <p className="text-xs">Selecione outra faixa de horário</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          Top produtos ({timeSlot})
        </span>
      </div>
      
      {data.map((product, index) => {
        const isFirst = index === 0;
        const color = COLORS[index % COLORS.length];
        
        return (
          <div
            key={product.productId}
            className={cn(
              "group cursor-pointer transition-all duration-200 rounded-lg p-2.5 -mx-1",
              "hover:bg-muted/50"
            )}
            onClick={() => onProductClick?.(product.productId)}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                  isFirst 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {index + 1}
                </span>
                <span className={cn(
                  "text-sm truncate",
                  isFirst ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                )}>
                  {product.productName}
                </span>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn(
                  "text-sm tabular-nums",
                  isFirst ? "font-semibold text-foreground" : "font-medium text-foreground"
                )}>
                  {product.quantity}
                </span>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {product.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
            
            {/* Ultra-thin progress bar */}
            <div className="h-1 rounded-full bg-muted/50 overflow-hidden ml-7">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${product.percentage}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
