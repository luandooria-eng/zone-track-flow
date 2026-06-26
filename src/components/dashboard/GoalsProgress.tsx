import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp, TrendingDown, Package, ShoppingCart, Droplets, Flame, ChevronRight, ChevronLeft, Calendar, ExternalLink } from 'lucide-react';
import { useGoalsProgress, type GoalProgress } from '@/hooks/useSalesGoals';
import { useGoalsHistory } from '@/hooks/useGoalsHistory';
import { cn } from '@/lib/utils';
import { format, getDaysInMonth, getDate, subDays, addDays, isToday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useFilters } from '@/hooks/useFilters';
import { GoalDetailDrawer } from './GoalDetailDrawer';

type ViewMode = 'daily' | 'monthly';

// Sparkline component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60"
      />
    </svg>
  );
}

// Gradient progress bar
function GradientProgressBar({ 
  percentage, 
  status 
}: { 
  percentage: number; 
  status: 'ahead' | 'on-track' | 'behind' | 'critical';
}) {
  const getGradient = () => {
    switch (status) {
      case 'ahead':
        return 'from-emerald-400 to-emerald-500';
      case 'on-track':
        return 'from-blue-400 to-blue-500';
      case 'behind':
        return 'from-amber-400 to-amber-500';
      case 'critical':
        return 'from-rose-400 to-rose-500';
      default:
        return 'from-blue-400 to-blue-500';
    }
  };

  return (
    <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
      <div 
        className={cn(
          "absolute top-0 left-0 h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out",
          getGradient()
        )}
        style={{ width: `${Math.min(100, percentage)}%` }}
      />
    </div>
  );
}

// Calculate pace status
function calculatePaceStatus(
  current: number, 
  target: number, 
  type: 'daily' | 'monthly'
): { status: 'ahead' | 'on-track' | 'behind' | 'critical'; message: string; idealPace: number } {
  const now = new Date();
  
  if (type === 'daily') {
    const hoursElapsed = now.getHours() + now.getMinutes() / 60;
    const hoursTotal = 14; // Assume 14h working day (8am-10pm)
    const hoursWorked = Math.max(0, Math.min(hoursElapsed - 8, hoursTotal));
    const progressExpected = hoursWorked / hoursTotal;
    const idealPace = Math.round(target * progressExpected);
    
    const ratio = current / Math.max(idealPace, 1);
    
    if (current >= target) {
      return { status: 'ahead', message: 'Meta batida!', idealPace };
    } else if (ratio >= 1) {
      return { status: 'ahead', message: 'Acima do ritmo', idealPace };
    } else if (ratio >= 0.8) {
      return { status: 'on-track', message: 'Dentro do ritmo', idealPace };
    } else if (ratio >= 0.5) {
      const remaining = target - current;
      return { status: 'behind', message: `Faltam ${remaining} para a meta`, idealPace };
    } else {
      return { status: 'critical', message: 'Ritmo abaixo do esperado', idealPace };
    }
  } else {
    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    const progressExpected = dayOfMonth / daysInMonth;
    const idealPace = Math.round(target * progressExpected);
    
    const ratio = current / Math.max(idealPace, 1);
    
    if (current >= target) {
      return { status: 'ahead', message: 'Meta do mês batida!', idealPace };
    } else if (ratio >= 1) {
      return { status: 'ahead', message: 'Acima do ritmo mensal', idealPace };
    } else if (ratio >= 0.8) {
      return { status: 'on-track', message: 'No ritmo do mês', idealPace };
    } else if (ratio >= 0.5) {
      const remaining = target - current;
      return { status: 'behind', message: `Faltam ${remaining} para fechar o mês`, idealPace };
    } else {
      return { status: 'critical', message: 'Ritmo mensal abaixo', idealPace };
    }
  }
}

// Get icon for goal
function getGoalIcon(goal: GoalProgress) {
  const productName = goal.productName?.toLowerCase() || goal.label.toLowerCase();
  
  if (productName.includes('água') || productName.includes('water')) {
    return <Droplets className="h-4 w-4" />;
  }
  if (productName.includes('gás') || productName.includes('gas')) {
    return <Flame className="h-4 w-4" />;
  }
  if (goal.metric === 'orders_count') {
    return <ShoppingCart className="h-4 w-4" />;
  }
  return <Package className="h-4 w-4" />;
}

// Main Card Component for a goal
function GoalCard({ 
  goal, 
  isPrimary,
  sparklineData,
  onClick 
}: { 
  goal: GoalProgress; 
  isPrimary: boolean;
  sparklineData?: number[];
  onClick?: () => void;
}) {
  const paceInfo = calculatePaceStatus(goal.current, goal.target, goal.type);
  
  const getStatusColor = () => {
    switch (paceInfo.status) {
      case 'ahead': return 'text-emerald-600';
      case 'on-track': return 'text-blue-600';
      case 'behind': return 'text-amber-600';
      case 'critical': return 'text-rose-600';
    }
  };

  const getSparklineColor = () => {
    switch (paceInfo.status) {
      case 'ahead': return 'hsl(152, 56%, 40%)';
      case 'on-track': return 'hsl(213, 80%, 49%)';
      case 'behind': return 'hsl(43, 70%, 52%)';
      case 'critical': return 'hsl(0, 55%, 58%)';
    }
  };

  const TrendIcon = paceInfo.status === 'ahead' || paceInfo.status === 'on-track' 
    ? TrendingUp 
    : TrendingDown;

  if (isPrimary) {
    return (
      <div 
        onClick={onClick}
        className="bg-card rounded-xl p-5 border border-border/30 hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            {getGoalIcon(goal)}
            <span className="text-xs font-medium uppercase tracking-wide">
              {goal.label} ({goal.type === 'daily' ? 'diária' : 'mensal'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon className={cn("h-4 w-4", getStatusColor())} />
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-semibold text-foreground">
            {goal.current}
          </span>
          <span className="text-lg text-muted-foreground font-medium">
            / {goal.target}
          </span>
          {goal.dailyTarget && goal.type === 'monthly' && (
            <span className="text-xs text-muted-foreground ml-2">
              (~{goal.dailyTarget}/dia)
            </span>
          )}
        </div>

        <div className="mb-3">
          <GradientProgressBar percentage={goal.percentage} status={paceInfo.status} />
        </div>

        <div className="flex items-center justify-between text-xs mb-3">
          <span className={cn("font-medium", getStatusColor())}>
            {paceInfo.message}
          </span>
          <span className="text-muted-foreground">
            {goal.percentage.toFixed(0)}%
          </span>
        </div>

        <div className="text-xs text-muted-foreground border-t border-border/30 pt-3 flex items-center justify-between">
          <span>Ritmo ideal: {paceInfo.idealPace} • Atual: {goal.current}</span>
          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
            Ver detalhes →
          </span>
        </div>

        {/* Month-over-month comparison */}
        {goal.type === 'monthly' && goal.previousMonthCurrent !== undefined && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">vs Mês anterior (mesmo período)</span>
              <span className={cn(
                "text-xs font-semibold flex items-center gap-1",
                (goal.monthGrowth ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {(goal.monthGrowth ?? 0) >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {(goal.monthGrowth ?? 0) >= 0 ? '+' : ''}{(goal.monthGrowth ?? 0).toFixed(1)}%
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
              {/* Previous month bar (background reference) */}
              <div 
                className="absolute top-0 left-0 h-full rounded-full bg-muted-foreground/20 transition-all duration-500"
                style={{ width: `${Math.min(100, goal.target > 0 ? ((goal.previousMonthCurrent ?? 0) / goal.target) * 100 : 0)}%` }}
              />
              {/* Current month bar (foreground) */}
              <div 
                className={cn(
                  "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
                  (goal.monthGrowth ?? 0) >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70"
                )}
                style={{ width: `${Math.min(100, goal.percentage)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>Mês anterior: {goal.previousMonthCurrent ?? 0}</span>
              <span>Atual: {goal.current}</span>
            </div>
          </div>
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="text-xs text-muted-foreground mb-1">Últimos 7 dias</div>
            <Sparkline data={sparklineData} color={getSparklineColor()} />
          </div>
        )}
      </div>
    );
  }

  // Secondary card (compact)
  return (
    <div 
      onClick={onClick}
      className="bg-card rounded-xl p-4 border border-border/30 hover:border-primary/50 hover:shadow-md transition-all duration-200 group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {getGoalIcon(goal)}
          <span className="text-xs font-medium truncate max-w-[100px]">{goal.label}</span>
        </div>
        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-xl font-semibold text-foreground">
          {goal.percentage.toFixed(0)}%
        </span>
        <span className="text-xs text-muted-foreground">
          ({goal.current}/{goal.target})
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-500",
            paceInfo.status === 'ahead' && 'from-emerald-400 to-emerald-500',
            paceInfo.status === 'on-track' && 'from-blue-400 to-blue-500',
            paceInfo.status === 'behind' && 'from-amber-400 to-amber-500',
            paceInfo.status === 'critical' && 'from-rose-400 to-rose-500'
          )}
          style={{ width: `${Math.min(100, goal.percentage)}%` }}
        />
      </div>

      <div className="text-xs mt-2 flex items-center justify-between">
        <span className={cn("font-medium", getStatusColor())}>
          {paceInfo.status === 'ahead' ? 'Acima' : paceInfo.status === 'on-track' ? 'No ritmo' : 'Abaixo'}
        </span>
        {goal.type === 'monthly' && goal.monthGrowth !== undefined ? (
          <span className={cn(
            "font-semibold flex items-center gap-0.5 text-[10px]",
            (goal.monthGrowth ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {(goal.monthGrowth ?? 0) >= 0 ? '▲' : '▼'}
            {Math.abs(goal.monthGrowth ?? 0).toFixed(0)}% vs anterior
          </span>
        ) : (
          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
            Detalhes
          </span>
        )}
      </div>
    </div>
  );
}

export function GoalsProgress() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedGoal, setSelectedGoal] = useState<GoalProgress | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { filters, setFilters } = useFilters();
  const { data: progress, isLoading } = useGoalsProgress();
  const { data: historyData } = useGoalsHistory();
  
  // Always initialize to today when component mounts
  useEffect(() => {
    const today = new Date();
    setFilters({ dateRange: { from: today, to: today } });
  }, []); // Only run on mount
  
  const selectedDate = filters.dateRange?.from || new Date();
  const isCurrentDay = isToday(selectedDate);
  
  const displayDate = format(selectedDate, "dd/MM/yyyy", { locale: ptBR });
  const displayLabel = isCurrentDay ? 'Hoje' : format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  
  const handleGoalClick = (goal: GoalProgress) => {
    setSelectedGoal(goal);
    setDrawerOpen(true);
  };

  // Navigation functions
  const goToPreviousDay = () => {
    const newDate = subDays(selectedDate, 1);
    setFilters({ dateRange: { from: newDate, to: newDate } });
  };

  const goToNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    if (!isToday(newDate) && newDate > new Date()) return; // Don't go to future
    setFilters({ dateRange: { from: newDate, to: newDate } });
  };

  const goToToday = () => {
    const today = new Date();
    setFilters({ dateRange: { from: today, to: today } });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setFilters({ dateRange: { from: date, to: date } });
    }
  };

  // Filter goals by view mode
  const filteredGoals = useMemo(() => {
    if (!progress) return [];
    return progress.filter(g => g.type === viewMode);
  }, [progress, viewMode]);

  // Separate primary and secondary goals
  const primaryGoals = filteredGoals.slice(0, 2);
  const secondaryGoals = filteredGoals.slice(2, 4);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-32" />
          </div>
          <Skeleton className="h-4 w-56 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress || progress.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Metas – Performance</h3>
          </div>
          
          {/* Toggle Dia/Mês */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('daily')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                viewMode === 'daily' 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                viewMode === 'monthly' 
                  ? "bg-card text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mês
            </button>
          </div>
        </div>
        
        {/* Date Navigation */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-xs font-medium hover:bg-muted/50"
                >
                  <Calendar className="h-3.5 w-3.5 mr-1.5" />
                  {displayLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={goToNextDay}
              disabled={isCurrentDay}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {!isCurrentDay && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={goToToday}
            >
              Hoje
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-2">
          {isCurrentDay ? 'Acompanhamento em tempo real' : 'Visualizando histórico'} • {displayDate}
        </p>
      </CardHeader>
      
      <CardContent className="pt-5">
        {filteredGoals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              Nenhuma meta {viewMode === 'daily' ? 'diária' : 'mensal'} configurada
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Primary Goals */}
            <div className="grid gap-4 md:grid-cols-2">
              {primaryGoals.map((goal) => (
                <GoalCard 
                  key={goal.id} 
                  goal={goal} 
                  isPrimary={true}
                  sparklineData={historyData?.map(d => d.value)}
                  onClick={() => handleGoalClick(goal)}
                />
              ))}
            </div>

            {/* Secondary Goals */}
            {secondaryGoals.length > 0 && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {secondaryGoals.map((goal) => (
                  <GoalCard 
                    key={goal.id} 
                    goal={goal} 
                    isPrimary={false}
                    onClick={() => handleGoalClick(goal)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Goal Detail Drawer */}
        <GoalDetailDrawer 
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          goal={selectedGoal}
        />
      </CardContent>
    </Card>
  );
}
