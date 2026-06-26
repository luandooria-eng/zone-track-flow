import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Droplet,
  Flame,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ConsumptionFilter = 
  | 'alerts_active'
  | 'gas_stopped'
  | 'water_dropped'
  | 'top_water'
  | 'top_gas'
  | null;

interface ConsumptionFiltersProps {
  selectedFilter: ConsumptionFilter;
  onFilterChange: (filter: ConsumptionFilter) => void;
  alertCounts?: {
    total: number;
    gas_stopped: number;
    water_drop: number;
  };
}

export function ConsumptionFilters({ 
  selectedFilter, 
  onFilterChange,
  alertCounts = { total: 0, gas_stopped: 0, water_drop: 0 }
}: ConsumptionFiltersProps) {
  const filters: { id: ConsumptionFilter; label: string; icon: React.ReactNode; count?: number; color: string }[] = [
    { 
      id: 'alerts_active', 
      label: 'Alertas ativos', 
      icon: <AlertTriangle className="h-4 w-4" />,
      count: alertCounts.total,
      color: 'text-warning',
    },
    { 
      id: 'gas_stopped', 
      label: 'Pararam gás', 
      icon: <Flame className="h-4 w-4" />,
      count: alertCounts.gas_stopped,
      color: 'text-warning',
    },
    { 
      id: 'water_dropped', 
      label: 'Queda água > 30%', 
      icon: <TrendingDown className="h-4 w-4" />,
      count: alertCounts.water_drop,
      color: 'text-destructive',
    },
    { 
      id: 'top_water', 
      label: 'Top consumidores água', 
      icon: <Droplet className="h-4 w-4" />,
      color: 'text-chart-1',
    },
    { 
      id: 'top_gas', 
      label: 'Top consumidores gás', 
      icon: <Flame className="h-4 w-4" />,
      color: 'text-warning',
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(filter => (
        <Button
          key={filter.id}
          variant={selectedFilter === filter.id ? 'default' : 'outline'}
          size="sm"
          className={cn(
            "gap-2",
            selectedFilter !== filter.id && filter.color
          )}
          onClick={() => onFilterChange(selectedFilter === filter.id ? null : filter.id)}
        >
          {filter.icon}
          {filter.label}
          {filter.count !== undefined && filter.count > 0 && (
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs",
                selectedFilter === filter.id && "bg-primary-foreground text-primary"
              )}
            >
              {filter.count}
            </Badge>
          )}
        </Button>
      ))}
      
      {selectedFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange(null)}
          className="gap-1"
        >
          <X className="h-4 w-4" />
          Limpar
        </Button>
      )}
    </div>
  );
}
