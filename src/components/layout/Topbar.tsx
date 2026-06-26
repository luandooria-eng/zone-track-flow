import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { format, isSameDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilters } from '@/hooks/useFilters';
import { mockSalesChannels, mockDeliveryPeople, mockProducts, mockPaymentMethods } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { NewSaleModal } from '@/components/sales/NewSaleModal';
import { Badge } from '@/components/ui/badge';

type QuickFilterOption = 'today' | 7 | 15 | 30;

export function Topbar() {
  const location = useLocation();
  const { 
    filters, 
    pendingFilters, 
    hasChanges,
    setPendingFilters, 
    applyFilters,
    resetFilters,
    setQuickFilter 
  } = useFilters();
  const [showFilters, setShowFilters] = useState(false);
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Hide date filters on daily grid pages (single day view)
  const isDailyGridPage = location.pathname.startsWith('/daily-grid');

  const hasActiveFilters =
    filters.channelId ||
    filters.deliveryPersonId ||
    filters.productId ||
    filters.paymentMethodId;

  // Determine which quick filter is active based on current filters
  const getActiveQuickFilter = (): QuickFilterOption | null => {
    if (!filters?.dateRange?.from || !filters?.dateRange?.to) return null;
    
    const today = new Date();
    const from = filters.dateRange.from;
    const to = filters.dateRange.to;
    
    if (isSameDay(from, today) && isSameDay(to, today)) return 'today';
    
    const daysDiff = differenceInDays(to, from);
    if (isSameDay(to, today)) {
      if (daysDiff === 6 || daysDiff === 7) return 7;
      if (daysDiff === 14 || daysDiff === 15) return 15;
      if (daysDiff === 29 || daysDiff === 30) return 30;
    }
    return null;
  };

  const activeQuickFilter = getActiveQuickFilter();

  const handleQuickFilter = (option: QuickFilterOption) => {
    setQuickFilter(option);
  };

  const handleApply = () => {
    applyFilters();
    setCalendarOpen(false);
  };

  // Format active period as a chip
  const formatPeriodChip = () => {
    if (!filters?.dateRange?.from) return null;
    const from = filters.dateRange.from;
    const to = filters.dateRange.to;
    return `${format(from, 'dd/MM', { locale: ptBR })} - ${format(to || from, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  // Don't render topbar on daily grid pages
  if (isDailyGridPage) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Quick Filters + Date Range */}
          <div className="flex items-center gap-2">
            {/* Quick Filter Buttons */}
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant={activeQuickFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter('today')}
                className="text-xs"
              >
                Hoje
              </Button>
              <Button
                variant={activeQuickFilter === 7 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter(7)}
                className="text-xs"
              >
                7 dias
              </Button>
              <Button
                variant={activeQuickFilter === 15 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter(15)}
                className="text-xs"
              >
                15 dias
              </Button>
              <Button
                variant={activeQuickFilter === 30 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuickFilter(30)}
                className="text-xs"
              >
                30 dias
              </Button>
            </div>

            {/* Date Range Picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal gap-2',
                    !pendingFilters?.dateRange && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {pendingFilters.dateRange?.from ? (
                    pendingFilters.dateRange.to ? (
                      <>
                        {format(pendingFilters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} -{' '}
                        {format(pendingFilters.dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
                      </>
                    ) : (
                      format(pendingFilters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                    )
                  ) : (
                    <span>Selecionar período</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={pendingFilters?.dateRange?.from}
                  selected={pendingFilters?.dateRange as DateRange | undefined}
                  onSelect={(range) =>
                    setPendingFilters({
                      dateRange: range ? { from: range.from!, to: range.to! } : undefined,
                    })
                  }
                  numberOfMonths={2}
                  className="p-3 pointer-events-auto"
                />
                <div className="border-t p-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCalendarOpen(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleApply} className="gap-1">
                    <Check className="h-4 w-4" />
                    Aplicar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Apply Button (when there are pending changes) */}
            {hasChanges && (
              <Button 
                onClick={handleApply} 
                size="sm" 
                className="gap-1 animate-pulse"
              >
                <Check className="h-4 w-4" />
                Aplicar Filtros
              </Button>
            )}
          </div>

          {/* Active Filters Chips */}
          <div className="flex items-center gap-2">
            {formatPeriodChip() && (
              <Badge variant="secondary" className="gap-1">
                <CalendarIcon className="h-3 w-3" />
                Período: {formatPeriodChip()}
              </Badge>
            )}

            {/* Filters Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'gap-2',
                hasActiveFilters && 'text-primary'
              )}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {[filters.channelId, filters.deliveryPersonId, filters.productId, filters.paymentMethodId].filter(Boolean).length}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>

          {/* New Sale Button */}
          <Button onClick={() => setIsNewSaleOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Venda
          </Button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="border-t border-border bg-muted/30 px-6 py-4 animate-fade-up">
            <div className="flex flex-wrap items-center gap-4">
              <Select
                value={pendingFilters.channelId || ''}
                onValueChange={(value) =>
                  setPendingFilters({ channelId: value || undefined })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  {mockSalesChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={pendingFilters.deliveryPersonId || ''}
                onValueChange={(value) =>
                  setPendingFilters({ deliveryPersonId: value || undefined })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Entregador" />
                </SelectTrigger>
                <SelectContent>
                  {mockDeliveryPeople.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={pendingFilters.productId || ''}
                onValueChange={(value) =>
                  setPendingFilters({ productId: value || undefined })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  {mockProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={pendingFilters.paymentMethodId || ''}
                onValueChange={(value) =>
                  setPendingFilters({ paymentMethodId: value || undefined })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  {mockPaymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Apply Filters Button in Expanded View */}
              {hasChanges && (
                <Button onClick={handleApply} className="gap-1">
                  <Check className="h-4 w-4" />
                  Aplicar
                </Button>
              )}
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
                {filters.channelId && (
                  <Badge variant="secondary" className="gap-1">
                    Canal: {mockSalesChannels.find(c => c.id === filters.channelId)?.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setPendingFilters({ channelId: undefined })} />
                  </Badge>
                )}
                {filters.deliveryPersonId && (
                  <Badge variant="secondary" className="gap-1">
                    Entregador: {mockDeliveryPeople.find(d => d.id === filters.deliveryPersonId)?.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setPendingFilters({ deliveryPersonId: undefined })} />
                  </Badge>
                )}
                {filters.productId && (
                  <Badge variant="secondary" className="gap-1">
                    Produto: {mockProducts.find(p => p.id === filters.productId)?.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setPendingFilters({ productId: undefined })} />
                  </Badge>
                )}
                {filters.paymentMethodId && (
                  <Badge variant="secondary" className="gap-1">
                    Pagamento: {mockPaymentMethods.find(m => m.id === filters.paymentMethodId)?.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setPendingFilters({ paymentMethodId: undefined })} />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <NewSaleModal open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen} />
    </>
  );
}
