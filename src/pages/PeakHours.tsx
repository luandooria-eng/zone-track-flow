import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  RefreshCw, 
  Calendar,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { usePeakHoursData } from '@/hooks/usePeakHoursData';
import { useFilters } from '@/hooks/useFilters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { PeakHoursHeatmap } from '@/components/peak-hours/PeakHoursHeatmap';
import { HourlyVolumeChart } from '@/components/peak-hours/HourlyVolumeChart';
import { ProductRankingBySlot } from '@/components/peak-hours/ProductRankingBySlot';
import { PeakHoursInsights } from '@/components/peak-hours/PeakHoursInsights';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PeakHours() {
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('12-14');
  const [selectedDay, setSelectedDay] = useState<number | undefined>(undefined);
  const { filters } = useFilters();
  
  const { 
    data, 
    isLoading, 
    refetch, 
    productsForSlot, 
    insights,
    timeSlots,
    days,
  } = usePeakHoursData(selectedTimeSlot, selectedDay);

  const handleCellClick = (timeSlot: string, dayOfWeek: number) => {
    setSelectedTimeSlot(timeSlot);
    setSelectedDay(dayOfWeek);
  };

  // Format period display
  const formatPeriodDisplay = () => {
    const startStr = format(filters.dateRange.from, "dd/MM/yyyy", { locale: ptBR });
    const endStr = format(filters.dateRange.to, "dd/MM/yyyy", { locale: ptBR });
    
    if (startStr === endStr) {
      return startStr;
    }
    return `${startStr} a ${endStr}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Horários de Pico
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Análise de demanda por horário e dia da semana
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardFilters />
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Período: {formatPeriodDisplay()}</span>
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card animate-fade-up">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total de Pedidos</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-semibold">{data?.totalOrders || 0}</p>
          )}
        </div>
        
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Faixa Selecionada</span>
          </div>
          <p className="text-2xl font-semibold text-primary">{selectedTimeSlot}</p>
        </div>
        
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Filter className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Dia Selecionado</span>
          </div>
          <p className="text-2xl font-semibold">
            {selectedDay !== undefined ? days[selectedDay] : 'Todos'}
          </p>
        </div>
      </div>

      {/* Insights */}
      {!isLoading && insights.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <PeakHoursInsights insights={insights} />
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Mapa de Calor
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Clique para filtrar
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <PeakHoursHeatmap
                data={data?.heatmapData || []}
                timeSlots={timeSlots}
                days={days}
                selectedSlot={selectedTimeSlot}
                selectedDay={selectedDay}
                onCellClick={handleCellClick}
              />
            )}
          </CardContent>
        </Card>

        {/* Product Ranking */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Produtos por Faixa
              </CardTitle>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <ProductRankingBySlot
                data={productsForSlot}
                timeSlot={selectedTimeSlot}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Volume Chart */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Volume por Hora
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <HourlyVolumeChart data={data?.hourlyData || []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
