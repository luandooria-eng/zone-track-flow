import { PeakHoursInsight } from '@/hooks/usePeakHoursData';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Calendar, Package, Lightbulb } from 'lucide-react';

interface PeakHoursInsightsProps {
  insights: PeakHoursInsight[];
}

export function PeakHoursInsights({ insights }: PeakHoursInsightsProps) {
  if (insights.length === 0) {
    return null;
  }

  const getIcon = (type: PeakHoursInsight['type']) => {
    switch (type) {
      case 'peak_day': return Calendar;
      case 'peak_hour': return Clock;
      case 'peak_slot': return TrendingUp;
      case 'top_product': return Package;
      default: return Lightbulb;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-warning" />
        <span className="text-sm font-medium text-foreground">Insights Automáticos</span>
      </div>
      
      <div className="grid gap-2 sm:grid-cols-3">
        {insights.map((insight, index) => {
          const Icon = getIcon(insight.type);
          
          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                "bg-primary/5 border border-primary/10"
              )}
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{insight.message}</p>
                <p className="text-xs text-primary font-semibold mt-0.5">{insight.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
