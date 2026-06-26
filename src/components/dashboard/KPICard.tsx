import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  prefix?: string;
  suffix?: string;
  className?: string;
  delay?: number;
  tooltip?: string;
}

export function KPICard({
  title,
  value,
  change,
  icon,
  prefix = '',
  suffix = '',
  className,
  delay = 0,
  tooltip,
}: KPICardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const showChange = change !== undefined && change !== 0;

  const cardContent = (
    <div
      className={cn(
        'kpi-card animate-fade-up',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {prefix}
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </p>
            {suffix && (
              <span className="text-xs text-muted-foreground">{suffix}</span>
            )}
          </div>
        </div>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/8 text-primary shrink-0">
            {icon}
          </div>
        )}
      </div>

      {showChange && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              isPositive && 'text-success',
              isNegative && 'text-destructive'
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : isNegative ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground/70">vs anterior</span>
        </div>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
