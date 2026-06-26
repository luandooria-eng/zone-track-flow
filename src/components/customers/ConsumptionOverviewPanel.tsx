import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Droplet,
  Flame,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  RefreshCw,
  Phone,
  MapPin,
  Loader2,
  BarChart3,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useConsumptionOverview,
  useRefreshConsumptionData,
  useGenerateAlerts,
  type CustomerConsumptionSummary,
} from '@/hooks/useCustomerConsumption';

interface ConsumptionOverviewPanelProps {
  onCustomerClick?: (customerId: string, customerName: string) => void;
}

export function ConsumptionOverviewPanel({ onCustomerClick }: ConsumptionOverviewPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [period, setPeriod] = useState<'7' | '15' | '30'>('30');
  
  const { data: overview, isLoading } = useConsumptionOverview(parseInt(period));
  const refreshData = useRefreshConsumptionData();
  const generateAlerts = useGenerateAlerts();

  const handleRefresh = async () => {
    await refreshData.mutateAsync(undefined);
    await generateAlerts.mutateAsync();
  };

  const isRefreshing = refreshData.isPending || generateAlerts.isPending;

  const handleCardClick = (category: string) => {
    setSelectedCategory(category);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getFilteredCustomers = (): CustomerConsumptionSummary[] => {
    if (!overview) return [];
    
    switch (selectedCategory) {
      case 'water_increase':
        return overview.customers.filter(c => c.waterVariation > 10);
      case 'water_decrease':
        return overview.customers.filter(c => c.waterVariation < -10);
      case 'gas_increase':
        return overview.customers.filter(c => c.gasVariation > 10);
      case 'gas_decrease':
        return overview.customers.filter(c => c.gasVariation < -10);
      case 'gas_stopped':
        return overview.customers.filter(c => c.gasStopped);
      case 'water_stopped':
        return overview.customers.filter(c => c.waterStopped);
      case 'mineral_alert':
        return overview.customers.filter(c => (c.alerts?.some(a => a.type === 'product_stopped')));
      default:
        return overview.customers;
    }
  };

  const categoryConfig: Record<string, { title: string; icon: React.ReactNode; color: string }> = {
    water_increase: { title: 'Aumento de Água', icon: <TrendingUp className="h-5 w-5" />, color: 'text-success' },
    water_decrease: { title: 'Queda de Água', icon: <TrendingDown className="h-5 w-5" />, color: 'text-destructive' },
    gas_increase: { title: 'Aumento de Gás', icon: <TrendingUp className="h-5 w-5" />, color: 'text-success' },
    gas_decrease: { title: 'Queda de Gás', icon: <TrendingDown className="h-5 w-5" />, color: 'text-warning' },
    gas_stopped: { title: 'Pararam Gás', icon: <Flame className="h-5 w-5" />, color: 'text-warning' },
    water_stopped: { title: 'Pararam Água', icon: <Droplet className="h-5 w-5" />, color: 'text-destructive' },
    mineral_alert: { title: 'Alerta Água Mineral', icon: <Package className="h-5 w-5" />, color: 'text-chart-1' },
  };

  const filteredCustomers = getFilteredCustomers();

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Análise de Consumo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as '7' | '15' | '30')}>
                <TabsList className="h-8">
                  <TabsTrigger value="7" className="text-xs px-2">7 dias</TabsTrigger>
                  <TabsTrigger value="15" className="text-xs px-2">15 dias</TabsTrigger>
                  <TabsTrigger value="30" className="text-xs px-2">30 dias</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            {/* Water Summary */}
            <Card className="border-l-4 border-l-chart-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Droplet className="h-5 w-5 text-chart-1" />
                  <span className="font-medium">Água</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Variação média:</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      overview?.waterAvgVariation && overview.waterAvgVariation >= 0 
                        ? "bg-success-bg text-success" 
                        : "bg-destructive-bg text-destructive"
                    )}
                  >
                    {overview?.waterAvgVariation && overview.waterAvgVariation >= 0 ? '+' : ''}
                    {overview?.waterAvgVariation?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div 
                    className="p-2 rounded bg-success/10 cursor-pointer hover:bg-success/20 transition-colors"
                    onClick={() => handleCardClick('water_increase')}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-success" />
                      <span className="text-xs text-muted-foreground">Subiram</span>
                    </div>
                    <p className="text-lg font-bold text-success">{overview?.waterIncrease || 0}</p>
                  </div>
                  <div 
                    className="p-2 rounded bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => handleCardClick('water_decrease')}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-destructive" />
                      <span className="text-xs text-muted-foreground">Caíram</span>
                    </div>
                    <p className="text-lg font-bold text-destructive">{overview?.waterDecrease || 0}</p>
                  </div>
                </div>
                {overview?.waterStopped && overview.waterStopped > 0 && (
                  <div 
                    className="mt-2 p-2 rounded bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => handleCardClick('water_stopped')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-destructive">Pararam de comprar</span>
                      <span className="font-bold text-destructive">{overview.waterStopped}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gas Summary */}
            <Card className="border-l-4 border-l-warning">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-warning" />
                  <span className="font-medium">Gás</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Variação média:</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      overview?.gasAvgVariation && overview.gasAvgVariation >= 0 
                        ? "bg-success-bg text-success" 
                        : "bg-warning-bg text-warning"
                    )}
                  >
                    {overview?.gasAvgVariation && overview.gasAvgVariation >= 0 ? '+' : ''}
                    {overview?.gasAvgVariation?.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div 
                    className="p-2 rounded bg-success/10 cursor-pointer hover:bg-success/20 transition-colors"
                    onClick={() => handleCardClick('gas_increase')}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-success" />
                      <span className="text-xs text-muted-foreground">Subiram</span>
                    </div>
                    <p className="text-lg font-bold text-success">{overview?.gasIncrease || 0}</p>
                  </div>
                  <div 
                    className="p-2 rounded bg-warning/10 cursor-pointer hover:bg-warning/20 transition-colors"
                    onClick={() => handleCardClick('gas_decrease')}
                  >
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-warning" />
                      <span className="text-xs text-muted-foreground">Caíram</span>
                    </div>
                    <p className="text-lg font-bold text-warning">{overview?.gasDecrease || 0}</p>
                  </div>
                </div>
                {overview?.gasStopped && overview.gasStopped > 0 && (
                  <div 
                    className="mt-2 p-2 rounded bg-warning/10 cursor-pointer hover:bg-warning/20 transition-colors"
                    onClick={() => handleCardClick('gas_stopped')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-warning">Pararam de comprar</span>
                      <span className="font-bold text-warning">{overview.gasStopped}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Mineral Water Alert (High Recurrence Product) */}
          {overview?.mineralWaterAlerts && overview.mineralWaterAlerts > 0 && (
            <div 
              className="p-4 rounded-lg border border-chart-1/30 bg-chart-1/5 cursor-pointer hover:bg-chart-1/10 transition-colors"
              onClick={() => handleCardClick('mineral_alert')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-6 w-6 text-chart-1" />
                  <div>
                    <p className="font-medium">Alerta Água Mineral</p>
                    <p className="text-sm text-muted-foreground">
                      Produto de alta recorrência - Clientes com queda
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-lg px-3 py-1">
                    {overview.mineralWaterAlerts}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer with customer list */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedCategory && categoryConfig[selectedCategory] && (
                <>
                  <span className={categoryConfig[selectedCategory].color}>
                    {categoryConfig[selectedCategory].icon}
                  </span>
                  {categoryConfig[selectedCategory].title}
                </>
              )}
              <Badge variant="outline">{filteredCustomers.length} clientes</Badge>
            </SheetTitle>
            <SheetDescription>
              Período: últimos {period} dias
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-150px)] mt-4">
            <div className="space-y-3 pr-4">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.customerId}
                  className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    if (onCustomerClick) {
                      onCustomerClick(customer.customerId, customer.customerName);
                      setDrawerOpen(false);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{customer.customerName}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.neighborhood && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {customer.neighborhood}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          <Droplet className="h-3 w-3 text-chart-1" />
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              customer.waterVariation >= 0 
                                ? "bg-success-bg text-success" 
                                : "bg-destructive-bg text-destructive"
                            )}
                          >
                            {customer.waterVariation >= 0 ? '+' : ''}{customer.waterVariation.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Flame className="h-3 w-3 text-warning" />
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              customer.gasVariation >= 0 
                                ? "bg-success-bg text-success" 
                                : "bg-warning-bg text-warning"
                            )}
                          >
                            {customer.gasVariation >= 0 ? '+' : ''}{customer.gasVariation.toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}

              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum cliente nesta categoria
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
