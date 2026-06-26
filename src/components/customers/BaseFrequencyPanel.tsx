import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplet, Flame, Clock, TrendingUp, TrendingDown, Minus, Info, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isWaterProduct, isGasProduct } from '@/lib/productClassification';
import { FrequencyProductDrawer } from './FrequencyProductDrawer';

interface FrequencyStats {
  avgWaterDays: number | null;
  avgGasDays: number | null;
  customersWithWaterHistory: number;
  customersWithGasHistory: number;
  totalCustomers: number;
  waterTrend: 'up' | 'down' | 'stable';
  gasTrend: 'up' | 'down' | 'stable';
  waterTrendPercent: number;
  gasTrendPercent: number;
}

const trendConfig = {
  up: { 
    icon: TrendingUp, 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    label: 'Ciclo aumentando',
    description: 'Os clientes estão demorando mais para recomprar'
  },
  down: { 
    icon: TrendingDown, 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    label: 'Ciclo diminuindo',
    description: 'Os clientes estão comprando com mais frequência'
  },
  stable: { 
    icon: Minus, 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    label: 'Ciclo estável',
    description: 'O intervalo de recompra está constante'
  },
};

export function BaseFrequencyPanel() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState<'water' | 'gas'>('water');

  const handleCardClick = (type: 'water' | 'gas') => {
    setDrawerType(type);
    setDrawerOpen(true);
  };

  // Fetch all customers' order history to calculate base average
  const { data: stats, isLoading } = useQuery<FrequencyStats>({
    queryKey: ['base-frequency-stats'],
    queryFn: async () => {
      // Fetch all active customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id')
        .eq('is_active', true);

      if (customersError) throw customersError;
      if (!customers || customers.length === 0) {
        return {
          avgWaterDays: null,
          avgGasDays: null,
          customersWithWaterHistory: 0,
          customersWithGasHistory: 0,
          totalCustomers: 0,
          waterTrend: 'stable',
          gasTrend: 'stable',
          waterTrendPercent: 0,
          gasTrendPercent: 0,
        };
      }

      // Get all delivered orders with items - last 6 months for current analysis
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          created_at,
          order_items (
            product_id,
            products:product_id (name)
          )
        `)
        .eq('status', 'delivered')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Group orders by customer and product type
      const customerWaterOrders: Record<string, Date[]> = {};
      const customerGasOrders: Record<string, Date[]> = {};

      orders?.forEach((order: any) => {
        const customerId = order.customer_id;
        if (!customerId) return;

        const orderDate = new Date(order.created_at);
        let hasWater = false;
        let hasGas = false;

        order.order_items?.forEach((item: any) => {
          const productName = item.products?.name || '';
          if (isWaterProduct(productName)) hasWater = true;
          if (isGasProduct(productName)) hasGas = true;
        });

        if (hasWater) {
          if (!customerWaterOrders[customerId]) customerWaterOrders[customerId] = [];
          customerWaterOrders[customerId].push(orderDate);
        }
        if (hasGas) {
          if (!customerGasOrders[customerId]) customerGasOrders[customerId] = [];
          customerGasOrders[customerId].push(orderDate);
        }
      });

      // Calculate average frequency for each customer
      const calculateFrequencies = (customerOrders: Record<string, Date[]>) => {
        const frequencies: { customerId: string; avgDays: number; recentAvgDays: number }[] = [];

        Object.entries(customerOrders).forEach(([customerId, dates]) => {
          if (dates.length < 2) return; // Need at least 2 orders

          const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
          let totalDays = 0;
          let recentTotalDays = 0;
          let recentCount = 0;

          for (let i = 1; i < sorted.length; i++) {
            const diffDays = Math.round(
              (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24)
            );
            totalDays += diffDays;

            // Recent = last 3 months
            if (sorted[i] >= threeMonthsAgo) {
              recentTotalDays += diffDays;
              recentCount++;
            }
          }

          const avgDays = Math.round(totalDays / (sorted.length - 1));
          const recentAvgDays = recentCount > 0 ? Math.round(recentTotalDays / recentCount) : avgDays;

          frequencies.push({ customerId, avgDays, recentAvgDays });
        });

        return frequencies;
      };

      const waterFrequencies = calculateFrequencies(customerWaterOrders);
      const gasFrequencies = calculateFrequencies(customerGasOrders);

      // Calculate base averages
      const calcAverage = (frequencies: typeof waterFrequencies) => {
        if (frequencies.length === 0) return null;
        const sum = frequencies.reduce((acc, f) => acc + f.avgDays, 0);
        return Math.round(sum / frequencies.length);
      };

      const calcRecentAverage = (frequencies: typeof waterFrequencies) => {
        if (frequencies.length === 0) return null;
        const sum = frequencies.reduce((acc, f) => acc + f.recentAvgDays, 0);
        return Math.round(sum / frequencies.length);
      };

      const avgWaterDays = calcAverage(waterFrequencies);
      const avgGasDays = calcAverage(gasFrequencies);
      const recentAvgWaterDays = calcRecentAverage(waterFrequencies);
      const recentAvgGasDays = calcRecentAverage(gasFrequencies);

      // Calculate trends
      const calcTrend = (avg: number | null, recentAvg: number | null): { trend: 'up' | 'down' | 'stable'; percent: number } => {
        if (avg === null || recentAvg === null) return { trend: 'stable', percent: 0 };
        const diff = recentAvg - avg;
        const percent = Math.round((diff / avg) * 100);
        if (percent > 10) return { trend: 'up', percent };
        if (percent < -10) return { trend: 'down', percent: Math.abs(percent) };
        return { trend: 'stable', percent: 0 };
      };

      const waterTrendData = calcTrend(avgWaterDays, recentAvgWaterDays);
      const gasTrendData = calcTrend(avgGasDays, recentAvgGasDays);

      return {
        avgWaterDays,
        avgGasDays,
        customersWithWaterHistory: waterFrequencies.length,
        customersWithGasHistory: gasFrequencies.length,
        totalCustomers: customers.length,
        waterTrend: waterTrendData.trend,
        gasTrend: gasTrendData.trend,
        waterTrendPercent: waterTrendData.percent,
        gasTrendPercent: gasTrendData.percent,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Média Geral da Base
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center text-muted-foreground">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  const WaterTrendIcon = trendConfig[stats.waterTrend].icon;
  const GasTrendIcon = trendConfig[stats.gasTrend].icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Média Geral da Base
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Calculada com base nos clientes que possuem histórico suficiente de compras (mínimo 2 pedidos). Serve como referência para análises individuais.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Intervalo médio de dias entre pedidos na base de clientes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Water Average */}
          <button
            onClick={() => handleCardClick('water')}
            className="space-y-3 p-4 rounded-lg border bg-card text-left hover:bg-accent/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet className="h-5 w-5 text-chart-1" />
                <span className="font-medium">Água</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {stats.avgWaterDays !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stats.avgWaterDays}</span>
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Base: {stats.customersWithWaterHistory} clientes
                  </span>
                  
                  {stats.waterTrend !== 'stable' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "gap-1",
                              trendConfig[stats.waterTrend].bgColor,
                              trendConfig[stats.waterTrend].color
                            )}
                          >
                            <WaterTrendIcon className="h-3 w-3" />
                            {stats.waterTrendPercent}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{trendConfig[stats.waterTrend].label}</p>
                          <p className="text-xs text-muted-foreground">
                            {trendConfig[stats.waterTrend].description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {stats.waterTrend === 'stable' && (
                    <Badge variant="outline" className="gap-1 bg-muted text-muted-foreground">
                      <Minus className="h-3 w-3" />
                      Estável
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Dados insuficientes
              </div>
            )}
          </button>

          {/* Gas Average */}
          <button
            onClick={() => handleCardClick('gas')}
            className="space-y-3 p-4 rounded-lg border bg-card text-left hover:bg-accent/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-warning" />
                <span className="font-medium">Gás</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {stats.avgGasDays !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stats.avgGasDays}</span>
                  <span className="text-sm text-muted-foreground">dias</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Base: {stats.customersWithGasHistory} clientes
                  </span>
                  
                  {stats.gasTrend !== 'stable' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "gap-1",
                              trendConfig[stats.gasTrend].bgColor,
                              trendConfig[stats.gasTrend].color
                            )}
                          >
                            <GasTrendIcon className="h-3 w-3" />
                            {stats.gasTrendPercent}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{trendConfig[stats.gasTrend].label}</p>
                          <p className="text-xs text-muted-foreground">
                            {trendConfig[stats.gasTrend].description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {stats.gasTrend === 'stable' && (
                    <Badge variant="outline" className="gap-1 bg-muted text-muted-foreground">
                      <Minus className="h-3 w-3" />
                      Estável
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Dados insuficientes
              </div>
            )}
          </button>
        </div>
        
        {/* Trend Analysis Legend */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Análise de Cenário (últimos 3 meses vs 6 meses)</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1 text-success">
              <TrendingDown className="h-3 w-3" />
              <span>Ciclo diminuindo = mais compras</span>
            </div>
            <div className="flex items-center gap-1 text-destructive">
              <TrendingUp className="h-3 w-3" />
              <span>Ciclo aumentando = menos compras</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Minus className="h-3 w-3" />
              <span>Variação {'<'} 10% = estável</span>
            </div>
          </div>
        </div>
      </CardContent>

      <FrequencyProductDrawer 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
        type={drawerType} 
      />
    </Card>
  );
}
