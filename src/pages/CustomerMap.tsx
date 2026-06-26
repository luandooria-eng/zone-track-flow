import { useState, useMemo } from 'react';
import { useCustomers, useNeighborhoods } from '@/hooks/useSupabaseQuery';
import { useFilters } from '@/hooks/useFilters';
import { useCustomerMapOrders, useCustomerMapPreviousOrders } from '@/hooks/useCustomerMapData';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, differenceInDays } from 'date-fns';
import { NeighborhoodsDonut, NeighborhoodDonutData } from '@/components/dashboard/NeighborhoodsDonut';
import { NeighborhoodDetailDrawer } from '@/components/dashboard/NeighborhoodDetailDrawer';
import { InsightsChart } from '@/components/dashboard/InsightsChart';
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Search,
  ArrowUpDown,
  Sparkles,
  Target,
  Activity,
  Flame,
  Snowflake,
  ArrowUp,
  ArrowDown,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SortBy = 'revenue' | 'growth' | 'customers' | 'orders';

export default function CustomerMap() {
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<NeighborhoodDonutData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const [showInsightsCharts, setShowInsightsCharts] = useState(true);

  // Use global filters from Dashboard
  const { filters } = useFilters();
  
  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  // Use paginated hook that fetches ALL orders (no 1000 limit)
  const { data: orders, isLoading: loadingOrders } = useCustomerMapOrders();
  const { data: previousOrders, isLoading: loadingPreviousOrders } = useCustomerMapPreviousOrders();
  const { data: neighborhoods, isLoading: loadingNeighborhoods } = useNeighborhoods();

  const isLoading = loadingCustomers || loadingOrders || loadingNeighborhoods;

  // Calculate period based on global filters
  const periodDays = differenceInDays(filters.dateRange.to, filters.dateRange.from) + 1;

  const neighborhoodData = useMemo((): NeighborhoodDonutData[] => {
    if (!customers || !orders || !neighborhoods) return [];

    const data: Record<string, NeighborhoodDonutData & { 
      prevRevenue: number; 
      prevOrders: number;
      currentRevenue: number;
      currentOrders: number;
    }> = {};

    // Initialize all neighborhoods
    neighborhoods.forEach((n) => {
      data[n.id] = {
        id: n.id,
        name: n.name,
        customers: 0,
        orders: 0,
        revenue: 0,
        avgTicket: 0,
        growth: 0,
        topProducts: [],
        customerList: [],
        prevRevenue: 0,
        prevOrders: 0,
        currentRevenue: 0,
        currentOrders: 0,
      };
    });

    // Add "Sem Bairro" category for customers/orders without neighborhood
    const NO_NEIGHBORHOOD_ID = '__no_neighborhood__';
    data[NO_NEIGHBORHOOD_ID] = {
      id: NO_NEIGHBORHOOD_ID,
      name: 'Sem Bairro',
      customers: 0,
      orders: 0,
      revenue: 0,
      avgTicket: 0,
      growth: 0,
      topProducts: [],
      customerList: [],
      prevRevenue: 0,
      prevOrders: 0,
      currentRevenue: 0,
      currentOrders: 0,
    };

    // Count customers per neighborhood (including those without neighborhood)
    customers.forEach((customer) => {
      const neighborhoodId = customer.neighborhood_id || NO_NEIGHBORHOOD_ID;
      if (data[neighborhoodId]) {
        data[neighborhoodId].customers += 1;
        data[neighborhoodId].customerList.push({
          id: customer.id,
          name: customer.name,
          totalSpent: customer.total_spent || 0,
          orders: customer.total_orders || 0,
        });
      }
    });

    const productCount: Record<string, Record<string, number>> = {};

    // Current period orders (from paginated hook - includes ALL orders)
    // Faturamento = apenas pedidos ENTREGUES (consistente com Dashboard)
    orders.forEach((order) => {
      // Skip cancelled orders and non-delivered orders for revenue calculation
      if (order.status === 'cancelled') return;
      
      const neighborhoodId = order.neighborhood_id || NO_NEIGHBORHOOD_ID;
      if (data[neighborhoodId]) {
        data[neighborhoodId].orders += 1;
        // Revenue only counts delivered orders (consistent with Dashboard)
        if (order.status === 'delivered') {
          data[neighborhoodId].revenue += order.total || 0;
          data[neighborhoodId].currentRevenue += order.total || 0;
        }
        data[neighborhoodId].currentOrders += 1;

        if (!productCount[neighborhoodId]) {
          productCount[neighborhoodId] = {};
        }
        order.items?.forEach((item: any) => {
          const productName = item.product?.name || 'Produto';
          productCount[neighborhoodId][productName] = 
            (productCount[neighborhoodId][productName] || 0) + item.quantity;
        });
      }
    });

    // Previous period orders (from separate paginated hook)
    // Revenue only counts delivered orders (consistent with Dashboard)
    (previousOrders || []).forEach((order) => {
      if (order.status !== 'delivered') return;
      
      const neighborhoodId = order.neighborhood_id || NO_NEIGHBORHOOD_ID;
      if (data[neighborhoodId]) {
        data[neighborhoodId].prevRevenue += order.total || 0;
        data[neighborhoodId].prevOrders += 1;
      }
    });

    Object.keys(data).forEach((neighborhoodId) => {
      const n = data[neighborhoodId];
      n.avgTicket = n.orders > 0 ? n.revenue / n.orders : 0;

      if (productCount[neighborhoodId]) {
        n.topProducts = Object.entries(productCount[neighborhoodId])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, quantity]) => ({ name, quantity }));
      }

      // Calculate revenue growth
      n.growth = n.prevRevenue > 0 
        ? ((n.currentRevenue - n.prevRevenue) / n.prevRevenue) * 100 
        : (n.currentRevenue > 0 ? 100 : 0);

      n.customerList.sort((a, b) => b.totalSpent - a.totalSpent);
    });

    return Object.values(data)
      .filter(n => n.customers > 0 || n.orders > 0)
      .sort((a, b) => {
        switch (sortBy) {
          case 'growth': return b.growth - a.growth;
          case 'customers': return b.customers - a.customers;
          case 'orders': return b.orders - a.orders;
          default: return b.revenue - a.revenue;
        }
      });
  }, [customers, orders, previousOrders, neighborhoods, sortBy]);

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchTerm) return neighborhoodData;
    return neighborhoodData.filter(n => 
      n.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [neighborhoodData, searchTerm]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalRevenue = neighborhoodData.reduce((acc, n) => acc + n.revenue, 0);
    const totalCustomers = neighborhoodData.reduce((acc, n) => acc + n.customers, 0);
    const totalOrders = neighborhoodData.reduce((acc, n) => acc + n.orders, 0);
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const growing = neighborhoodData.filter(n => n.growth > 10).length;
    const declining = neighborhoodData.filter(n => n.growth < -10).length;
    const stable = neighborhoodData.length - growing - declining;

    return { totalRevenue, totalCustomers, totalOrders, avgTicket, growing, declining, stable };
  }, [neighborhoodData]);

  // Generate alerts/insights
  const alerts = useMemo(() => {
    const items: { type: 'danger' | 'warning' | 'success' | 'info'; text: string; neighborhood?: string }[] = [];

    neighborhoodData.forEach(n => {
      if (n.growth < -30 && n.prevRevenue > 0) {
        items.push({
          type: 'danger',
          text: `${n.name} teve queda de ${Math.abs(n.growth).toFixed(0)}% nas vendas`,
          neighborhood: n.id,
        });
      } else if (n.growth < -10 && n.prevRevenue > 0) {
        items.push({
          type: 'warning',
          text: `${n.name} apresenta queda de ${Math.abs(n.growth).toFixed(0)}%`,
          neighborhood: n.id,
        });
      } else if (n.growth > 50 && n.currentRevenue > 500) {
        items.push({
          type: 'success',
          text: `${n.name} cresceu ${n.growth.toFixed(0)}% no período`,
          neighborhood: n.id,
        });
      }
    });

    // Concentration alert
    const totalRevenue = neighborhoodData.reduce((acc, n) => acc + n.revenue, 0);
    const top1Share = neighborhoodData[0] ? (neighborhoodData[0].revenue / totalRevenue) * 100 : 0;
    if (top1Share > 60) {
      items.push({
        type: 'warning',
        text: `${neighborhoodData[0].name} concentra ${top1Share.toFixed(0)}% do faturamento`,
      });
    }

    return items.slice(0, 5);
  }, [neighborhoodData]);

  const totalRevenue = neighborhoodData.reduce((acc, n) => acc + n.revenue, 0);

  const handleNeighborhoodClick = (neighborhood: NeighborhoodDonutData) => {
    setSelectedNeighborhood(neighborhood);
    setDrawerOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mapa de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Período: {format(filters.dateRange.from, 'dd/MM/yyyy')} - {format(filters.dateRange.to, 'dd/MM/yyyy')} ({periodDays} dias)
          </p>
        </div>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Faturamento</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(kpis.totalRevenue)}</p>
        </div>
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-xs font-medium">Pedidos</span>
          </div>
          <p className="text-xl font-bold">{kpis.totalOrders}</p>
        </div>
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Clientes</span>
          </div>
          <p className="text-xl font-bold">{kpis.totalCustomers}</p>
        </div>
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <MapPin className="h-4 w-4" />
            <span className="text-xs font-medium">Bairros</span>
          </div>
          <p className="text-xl font-bold">{neighborhoodData.length}</p>
        </div>
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 text-success mb-1">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-medium">Em Alta</span>
          </div>
          <p className="text-xl font-bold text-success">{kpis.growing}</p>
        </div>
        <div className="kpi-card p-4">
          <div className="flex items-center gap-2 text-destructive mb-1">
            <Snowflake className="h-4 w-4" />
            <span className="text-xs font-medium">Em Queda</span>
          </div>
          <p className="text-xl font-bold text-destructive">{kpis.declining}</p>
        </div>
      </div>

      {/* Insights Section with Charts */}
      <div className="kpi-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Insights Automáticos</h3>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {neighborhoodData.filter(n => n.growth > 10).length} em alta · {neighborhoodData.filter(n => n.growth < -10).length} em queda
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setShowInsightsCharts(!showInsightsCharts)}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {showInsightsCharts ? 'Ocultar Gráficos' : 'Ver Gráficos'}
          </Button>
        </div>
        
        {/* Quick Alerts Badges */}
        {alerts.length > 0 && !showInsightsCharts && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-colors text-xs py-1.5 px-3",
                  alert.type === 'danger' && "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
                  alert.type === 'warning' && "border-warning/50 bg-warning/10 text-warning hover:bg-warning/20",
                  alert.type === 'success' && "border-success/50 bg-success/10 text-success hover:bg-success/20",
                  alert.type === 'info' && "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20",
                )}
                onClick={() => {
                  if (alert.neighborhood) {
                    const n = neighborhoodData.find(nd => nd.id === alert.neighborhood);
                    if (n) handleNeighborhoodClick(n);
                  }
                }}
              >
                {alert.type === 'danger' && <AlertTriangle className="h-3 w-3 mr-1.5" />}
                {alert.type === 'warning' && <TrendingDown className="h-3 w-3 mr-1.5" />}
                {alert.type === 'success' && <TrendingUp className="h-3 w-3 mr-1.5" />}
                {alert.text}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Insights Charts */}
        {showInsightsCharts && (
          <InsightsChart 
            data={neighborhoodData} 
            onNeighborhoodClick={handleNeighborhoodClick} 
          />
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut Card */}
        <NeighborhoodsDonut 
          data={filteredData}
          onNeighborhoodClick={handleNeighborhoodClick}
        />

        {/* Full Neighborhood List */}
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Todos os Bairros</h3>
              <p className="text-xs text-muted-foreground">Clique para ver detalhes</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-32 pl-8 text-xs"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Faturamento</SelectItem>
                  <SelectItem value="growth">Crescimento</SelectItem>
                  <SelectItem value="orders">Pedidos</SelectItem>
                  <SelectItem value="customers">Clientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
            {filteredData.map((neighborhood, index) => {
              const share = totalRevenue > 0 ? (neighborhood.revenue / totalRevenue) * 100 : 0;
              const isGrowing = neighborhood.growth > 10;
              const isDeclining = neighborhood.growth < -10;

              return (
                <div
                  key={neighborhood.id}
                  onClick={() => handleNeighborhoodClick(neighborhood)}
                  className="group p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground w-5">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{neighborhood.name}</span>
                          {isGrowing && (
                            <Badge variant="outline" className="h-5 text-[10px] border-success/50 bg-success/10 text-success px-1.5">
                              <ArrowUp className="h-2.5 w-2.5 mr-0.5" />
                              {neighborhood.growth.toFixed(0)}%
                            </Badge>
                          )}
                          {isDeclining && (
                            <Badge variant="outline" className="h-5 text-[10px] border-destructive/50 bg-destructive/10 text-destructive px-1.5">
                              <ArrowDown className="h-2.5 w-2.5 mr-0.5" />
                              {Math.abs(neighborhood.growth).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {neighborhood.customers}
                          </span>
                          <span className="flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            {neighborhood.orders}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(neighborhood.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">{share.toFixed(1)}%</p>
                    </div>
                  </div>
                  {/* MoM comparison bar */}
                  {(() => {
                    const prevRev = (neighborhood as any).prevRevenue || 0;
                    const currRev = (neighborhood as any).currentRevenue || 0;
                    const maxVal = Math.max(prevRev, currRev, 1);
                    const prevWidth = (prevRev / maxVal) * 100;
                    const currWidth = (currRev / maxVal) * 100;
                    return (
                      <div className="mt-2 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground w-12 shrink-0">Anterior</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-muted-foreground/30 transition-all"
                              style={{ width: `${prevWidth}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-16 text-right shrink-0">
                            {formatCurrency(prevRev)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-muted-foreground w-12 shrink-0">Atual</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isDeclining ? "bg-destructive/70" : isGrowing ? "bg-success/70" : "bg-primary/70"
                              )}
                              style={{ width: `${currWidth}%` }}
                            />
                          </div>
                          <span className={cn(
                            "text-[9px] font-medium w-16 text-right shrink-0",
                            isDeclining ? "text-destructive" : isGrowing ? "text-success" : "text-foreground"
                          )}>
                            {formatCurrency(currRev)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            {filteredData.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum bairro encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      <NeighborhoodDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        neighborhood={selectedNeighborhood}
        totalRevenue={totalRevenue}
      />
    </div>
  );
}
