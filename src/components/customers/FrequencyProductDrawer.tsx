import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Droplet, Flame, TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWaterProduct, isGasProduct } from '@/lib/productClassification';

interface FrequencyProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'water' | 'gas';
}

interface ProductFrequency {
  productId: string;
  productName: string;
  avgDays: number;
  recentAvgDays: number;
  customerCount: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

const trendConfig = {
  up: { 
    icon: TrendingUp, 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    label: 'Ciclo aumentando'
  },
  down: { 
    icon: TrendingDown, 
    color: 'text-success', 
    bgColor: 'bg-success/10',
    label: 'Ciclo diminuindo'
  },
  stable: { 
    icon: Minus, 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    label: 'Estável'
  },
};

export function FrequencyProductDrawer({ open, onOpenChange, type }: FrequencyProductDrawerProps) {
  const isWater = type === 'water';
  const Icon = isWater ? Droplet : Flame;
  const iconColor = isWater ? 'text-chart-1' : 'text-warning';
  const title = isWater ? 'Frequência por Produto - Água' : 'Frequência por Produto - Gás';

  const { data: products, isLoading } = useQuery<ProductFrequency[]>({
    queryKey: ['frequency-by-product', type],
    queryFn: async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Get all delivered orders with items
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          created_at,
          order_items (
            product_id,
            products:product_id (id, name)
          )
        `)
        .eq('status', 'delivered')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group orders by product and customer
      const productCustomerOrders: Record<string, Record<string, Date[]>> = {};
      const productNames: Record<string, string> = {};

      orders?.forEach((order: any) => {
        const customerId = order.customer_id;
        if (!customerId) return;

        const orderDate = new Date(order.created_at);

        order.order_items?.forEach((item: any) => {
          const productId = item.products?.id;
          const productName = item.products?.name || '';

          if (!productId) return;

          // Filter by type
          const isMatch = isWater ? isWaterProduct(productName) : isGasProduct(productName);
          if (!isMatch) return;

          productNames[productId] = productName;

          if (!productCustomerOrders[productId]) {
            productCustomerOrders[productId] = {};
          }
          if (!productCustomerOrders[productId][customerId]) {
            productCustomerOrders[productId][customerId] = [];
          }

          // Avoid duplicate dates for same order
          const existingDates = productCustomerOrders[productId][customerId];
          if (!existingDates.some(d => d.getTime() === orderDate.getTime())) {
            existingDates.push(orderDate);
          }
        });
      });

      // Calculate frequencies per product
      const results: ProductFrequency[] = [];

      Object.entries(productCustomerOrders).forEach(([productId, customerOrders]) => {
        let totalAvgDays = 0;
        let totalRecentAvgDays = 0;
        let validCustomers = 0;

        Object.values(customerOrders).forEach((dates) => {
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

            if (sorted[i] >= threeMonthsAgo) {
              recentTotalDays += diffDays;
              recentCount++;
            }
          }

          const avgDays = totalDays / (sorted.length - 1);
          const recentAvgDays = recentCount > 0 ? recentTotalDays / recentCount : avgDays;

          totalAvgDays += avgDays;
          totalRecentAvgDays += recentAvgDays;
          validCustomers++;
        });

        if (validCustomers === 0) return;

        const avgDays = Math.round(totalAvgDays / validCustomers);
        const recentAvgDays = Math.round(totalRecentAvgDays / validCustomers);

        // Calculate trend
        const diff = recentAvgDays - avgDays;
        const percent = avgDays > 0 ? Math.round((diff / avgDays) * 100) : 0;
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (percent > 10) trend = 'up';
        else if (percent < -10) trend = 'down';

        results.push({
          productId,
          productName: productNames[productId],
          avgDays,
          recentAvgDays,
          customerCount: validCustomers,
          trend,
          trendPercent: Math.abs(percent),
        });
      });

      // Sort by customer count descending
      return results.sort((a, b) => b.customerCount - a.customerCount);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconColor)} />
            {title}
          </SheetTitle>
          <SheetDescription>
            Média de dias entre pedidos por produto (últimos 6 meses)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando dados...
            </div>
          ) : !products || products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum produto com histórico suficiente
            </div>
          ) : (
            products.map((product) => {
              const TrendIcon = trendConfig[product.trend].icon;
              
              return (
                <div 
                  key={product.productId}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{product.productName}</h4>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{product.customerCount} clientes</span>
                      </div>
                    </div>
                    
                    {product.trend !== 'stable' ? (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "gap-1",
                          trendConfig[product.trend].bgColor,
                          trendConfig[product.trend].color
                        )}
                      >
                        <TrendIcon className="h-3 w-3" />
                        {product.trendPercent}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 bg-muted text-muted-foreground">
                        <Minus className="h-3 w-3" />
                        Estável
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Média Geral</p>
                      <p className="text-xl font-bold">{product.avgDays} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Últimos 3 meses</p>
                      <p className="text-xl font-bold">{product.recentAvgDays} <span className="text-sm font-normal text-muted-foreground">dias</span></p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
