import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Target,
  Droplets,
  Flame,
  Package,
  ShoppingCart,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, getHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { GoalProgress } from '@/hooks/useSalesGoals';
import { Skeleton } from '@/components/ui/skeleton';

interface GoalDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: GoalProgress | null;
}

interface HourlyComparison {
  hour: number;
  today: number;
  yesterday: number;
  diff: number;
  percentChange: number;
}

// Get icon for goal
function getGoalIcon(goal: GoalProgress) {
  const productName = goal.productName?.toLowerCase() || goal.label.toLowerCase();
  
  if (productName.includes('água') || productName.includes('water')) {
    return <Droplets className="h-5 w-5" />;
  }
  if (productName.includes('gás') || productName.includes('gas')) {
    return <Flame className="h-5 w-5" />;
  }
  if (goal.metric === 'orders_count') {
    return <ShoppingCart className="h-5 w-5" />;
  }
  return <Package className="h-5 w-5" />;
}

function HourlyComparisonBar({ comparison }: { comparison: HourlyComparison }) {
  const maxValue = Math.max(comparison.today, comparison.yesterday, 1);
  const todayWidth = (comparison.today / maxValue) * 100;
  const yesterdayWidth = (comparison.yesterday / maxValue) * 100;
  
  const isIncrease = comparison.diff > 0;
  const isDecrease = comparison.diff < 0;
  
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="w-12 text-xs font-medium text-muted-foreground">
        {String(comparison.hour).padStart(2, '0')}:00
      </div>
      
      <div className="flex-1 space-y-1">
        {/* Today bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs w-8 text-muted-foreground">Hoje</span>
          <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${todayWidth}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">{comparison.today}</span>
        </div>
        
        {/* Yesterday bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs w-8 text-muted-foreground/60">Ontem</span>
          <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-muted-foreground/30 rounded-full transition-all duration-300"
              style={{ width: `${yesterdayWidth}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{comparison.yesterday}</span>
        </div>
      </div>
      
      {/* Change indicator */}
      <div className={cn(
        "flex items-center gap-1 min-w-[60px] justify-end",
        isIncrease && "text-emerald-600",
        isDecrease && "text-rose-600",
        !isIncrease && !isDecrease && "text-muted-foreground"
      )}>
        {isIncrease && <ArrowUp className="h-3 w-3" />}
        {isDecrease && <ArrowDown className="h-3 w-3" />}
        {!isIncrease && !isDecrease && <Minus className="h-3 w-3" />}
        <span className="text-xs font-medium">
          {comparison.diff > 0 ? '+' : ''}{comparison.diff}
        </span>
      </div>
    </div>
  );
}

export function GoalDetailDrawer({ open, onOpenChange, goal }: GoalDetailDrawerProps) {
  const today = new Date();
  const yesterday = subDays(today, 1);
  
  // Fetch hourly data for today and yesterday
  const { data: hourlyData, isLoading } = useQuery({
    queryKey: ['goal-hourly-comparison', goal?.id, goal?.productName],
    queryFn: async () => {
      if (!goal) return null;
      
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const yesterdayStart = startOfDay(yesterday).toISOString();
      const yesterdayEnd = endOfDay(yesterday).toISOString();
      
      // Fetch today's orders
      const { data: todayOrders, error: todayError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          delivered_at,
          order_items(quantity, product_id, product:products(name))
        `)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .neq('status', 'cancelled');
      
      if (todayError) throw todayError;
      
      // Fetch yesterday's orders
      const { data: yesterdayOrders, error: yesterdayError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          delivered_at,
          order_items(quantity, product_id, product:products(name))
        `)
        .gte('created_at', yesterdayStart)
        .lte('created_at', yesterdayEnd)
        .neq('status', 'cancelled');
      
      if (yesterdayError) throw yesterdayError;
      
      // Process hourly data
      const todayHourly: Record<number, number> = {};
      const yesterdayHourly: Record<number, number> = {};
      
      // Initialize all hours 6-22
      for (let h = 6; h <= 22; h++) {
        todayHourly[h] = 0;
        yesterdayHourly[h] = 0;
      }
      
      const processOrders = (orders: any[], hourlyMap: Record<number, number>) => {
        orders.forEach((order) => {
          const hour = getHours(new Date(order.created_at));
          if (hour < 6 || hour > 22) return;
          
          if (goal.metric === 'orders_count') {
            hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
          } else {
            // products_sold
            const items = order.order_items || [];
            items.forEach((item: any) => {
              // Check if product matches goal
              const productName = item.product?.name?.toLowerCase() || '';
              const goalProductName = goal.productName?.toLowerCase() || '';
              
              // If goal has specific product, filter
              if (goalProductName && !productName.includes(goalProductName.split(' ')[0])) {
                return;
              }
              
              hourlyMap[hour] = (hourlyMap[hour] || 0) + (item.quantity || 0);
            });
          }
        });
      };
      
      processOrders(todayOrders || [], todayHourly);
      processOrders(yesterdayOrders || [], yesterdayHourly);
      
      // Create comparison array
      const comparisons: HourlyComparison[] = [];
      const currentHour = getHours(today);
      
      for (let h = 6; h <= Math.min(currentHour, 22); h++) {
        const todayVal = todayHourly[h] || 0;
        const yesterdayVal = yesterdayHourly[h] || 0;
        const diff = todayVal - yesterdayVal;
        const percentChange = yesterdayVal > 0 
          ? ((todayVal - yesterdayVal) / yesterdayVal) * 100 
          : todayVal > 0 ? 100 : 0;
        
        comparisons.push({
          hour: h,
          today: todayVal,
          yesterday: yesterdayVal,
          diff,
          percentChange,
        });
      }
      
      // Calculate totals
      const todayTotal = Object.values(todayHourly).reduce((a, b) => a + b, 0);
      const yesterdayTotal = Object.values(yesterdayHourly).reduce((a, b) => a + b, 0);
      
      // Find biggest change
      const biggestIncrease = comparisons.reduce((max, c) => c.diff > max.diff ? c : max, comparisons[0]);
      const biggestDecrease = comparisons.reduce((min, c) => c.diff < min.diff ? c : min, comparisons[0]);
      
      return {
        comparisons,
        todayTotal,
        yesterdayTotal,
        biggestIncrease,
        biggestDecrease,
      };
    },
    enabled: open && !!goal,
    refetchInterval: 60000,
  });
  
  // Generate insights
  const insights = useMemo(() => {
    if (!hourlyData || !goal) return [];
    
    const insightList: { type: 'up' | 'down' | 'neutral'; message: string }[] = [];
    const totalDiff = hourlyData.todayTotal - hourlyData.yesterdayTotal;
    const percentDiff = hourlyData.yesterdayTotal > 0 
      ? ((totalDiff / hourlyData.yesterdayTotal) * 100).toFixed(0) 
      : '0';
    
    // Overall comparison
    if (totalDiff > 0) {
      insightList.push({
        type: 'up',
        message: `Até agora, +${totalDiff} vendas (${percentDiff}%) comparado a ontem no mesmo horário`
      });
    } else if (totalDiff < 0) {
      insightList.push({
        type: 'down',
        message: `Até agora, ${totalDiff} vendas (${percentDiff}%) comparado a ontem no mesmo horário`
      });
    } else {
      insightList.push({
        type: 'neutral',
        message: 'Performance igual a ontem no mesmo horário'
      });
    }
    
    // Best hour
    if (hourlyData.biggestIncrease && hourlyData.biggestIncrease.diff > 0) {
      insightList.push({
        type: 'up',
        message: `Maior aumento às ${hourlyData.biggestIncrease.hour}:00 (+${hourlyData.biggestIncrease.diff})`
      });
    }
    
    // Worst hour
    if (hourlyData.biggestDecrease && hourlyData.biggestDecrease.diff < 0) {
      insightList.push({
        type: 'down',
        message: `Maior queda às ${hourlyData.biggestDecrease.hour}:00 (${hourlyData.biggestDecrease.diff})`
      });
    }
    
    return insightList;
  }, [hourlyData, goal]);
  
  if (!goal) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {getGoalIcon(goal)}
            </div>
            <div>
              <SheetTitle className="text-left">{goal.label}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Meta {goal.type === 'daily' ? 'Diária' : 'Mensal'}
              </p>
            </div>
          </div>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          {/* Progress Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Progresso atual</span>
              <Badge variant={goal.percentage >= 100 ? 'default' : goal.percentage >= 50 ? 'secondary' : 'destructive'}>
                {goal.percentage.toFixed(0)}%
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Progress value={Math.min(goal.percentage, 100)} className="h-3" />
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-foreground">{goal.current}</span>
                <span className="text-muted-foreground">de {goal.target}</span>
              </div>
            </div>
          </div>
          
          {/* Insights */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Insights do Dia
              </h4>
              
              <div className="space-y-2">
                {insights.map((insight, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg",
                      insight.type === 'up' && "bg-emerald-50 dark:bg-emerald-950/30",
                      insight.type === 'down' && "bg-rose-50 dark:bg-rose-950/30",
                      insight.type === 'neutral' && "bg-muted/50"
                    )}
                  >
                    {insight.type === 'up' && <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5" />}
                    {insight.type === 'down' && <TrendingDown className="h-4 w-4 text-rose-600 mt-0.5" />}
                    {insight.type === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground mt-0.5" />}
                    <p className={cn(
                      "text-sm",
                      insight.type === 'up' && "text-emerald-800 dark:text-emerald-200",
                      insight.type === 'down' && "text-rose-800 dark:text-rose-200",
                      insight.type === 'neutral' && "text-muted-foreground"
                    )}>
                      {insight.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Hourly Comparison */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Comparação por Horário
              <span className="text-xs text-muted-foreground font-normal ml-1">
                (Hoje vs Ontem)
              </span>
            </h4>
            
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : hourlyData?.comparisons && hourlyData.comparisons.length > 0 ? (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {hourlyData.comparisons.map((comparison) => (
                  <HourlyComparisonBar key={comparison.hour} comparison={comparison} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum dado disponível ainda
              </p>
            )}
          </div>
          
          {/* Summary */}
          {hourlyData && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Total Hoje</p>
                <p className="text-2xl font-semibold">{hourlyData.todayTotal}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Total Ontem</p>
                <p className="text-2xl font-semibold text-muted-foreground">{hourlyData.yesterdayTotal}</p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}