import React, { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useFilters } from '@/hooks/useFilters';
import { Badge } from '@/components/ui/badge';

type QuickFilter = 'today' | '7days' | '15days' | '30days' | 'month' | 'custom';

export function DashboardFilters() {
  const { filters, pendingFilters, hasChanges, setPendingFilters, applyFilters, resetFilters, setQuickFilter } = useFilters();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter>('30days');

  const handleQuickFilter = (filter: QuickFilter) => {
    setActiveQuickFilter(filter);
    const today = new Date();
    
    switch (filter) {
      case 'today':
        setQuickFilter('today');
        break;
      case '7days':
        setQuickFilter(7);
        break;
      case '15days':
        setQuickFilter(15);
        break;
      case '30days':
        setQuickFilter(30);
        break;
      case 'month':
        setPendingFilters({
          dateRange: {
            from: startOfMonth(today),
            to: endOfMonth(today),
          },
        });
        break;
      case 'custom':
        setCalendarOpen(true);
        break;
    }
  };

  const handleApply = () => {
    applyFilters();
    setCalendarOpen(false);
  };

  const formatPeriod = () => {
    if (!filters.dateRange?.from || !filters.dateRange?.to) return 'Período não definido';
    const from = format(filters.dateRange.from, 'dd/MM', { locale: ptBR });
    const to = format(filters.dateRange.to, 'dd/MM', { locale: ptBR });
    return `${from} - ${to}`;
  };

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: 'today', label: 'Hoje' },
    { key: '7days', label: '7 dias' },
    { key: '15days', label: '15 dias' },
    { key: '30days', label: '30 dias' },
    { key: 'month', label: 'Mês atual' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Quick filters */}
      <div className="flex flex-wrap gap-1">
        {quickFilters.map((qf) => (
          <Button
            key={qf.key}
            variant={activeQuickFilter === qf.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter(qf.key)}
            className="h-8"
          >
            {qf.label}
          </Button>
        ))}
      </div>

      {/* Custom period selector */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activeQuickFilter === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-2"
            onClick={() => {
              setActiveQuickFilter('custom');
              setCalendarOpen(true);
            }}
          >
            <CalendarIcon className="h-4 w-4" />
            Período
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={pendingFilters.dateRange.from}
            selected={{
              from: pendingFilters.dateRange.from,
              to: pendingFilters.dateRange.to,
            }}
            onSelect={(range) => {
              if (range?.from) {
                setPendingFilters({
                  dateRange: {
                    from: startOfDay(range.from),
                    to: endOfDay(range.to || range.from),
                  },
                });
              }
            }}
            numberOfMonths={2}
            locale={ptBR}
          />
          <div className="border-t p-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCalendarOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply}>
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Apply button when there are pending changes */}
      {hasChanges && (
        <Button size="sm" onClick={handleApply} className="h-8 bg-primary">
          Aplicar Filtros
        </Button>
      )}

      {/* Active period badge */}
      <Badge variant="secondary" className="h-8 px-3 flex items-center gap-2">
        Período: {formatPeriod()}
        <button
          onClick={resetFilters}
          className="ml-1 hover:text-destructive"
        >
          <X className="h-3 w-3" />
        </button>
      </Badge>
    </div>
  );
}
