import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplet, Flame, TrendingUp, Calculator, Info, ChevronRight, Package, Users, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isWaterProduct, isGasProduct } from '@/lib/productClassification';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface ProductProjection {
  productId: string;
  productName: string;
  type: 'water' | 'gas';
  avgPrice: number;
  avgQtyPerOrder: number;
  customersWithHistory: number;
  projectedOrdersPerMonth: number;
  projectedUnits: number;
  projectedRevenue: number;
}

interface ProjectionSummary {
  waterRevenue: number;
  gasRevenue: number;
  totalRevenue: number;
  waterUnits: number;
  gasUnits: number;
  totalCustomersAnalyzed: number;
  products: ProductProjection[];
}

export function RevenueProjectionPanel() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: projection, isLoading } = useQuery<ProjectionSummary>({
    queryKey: ['revenue-projection'],
    queryFn: async () => {
      // Fetch active customers
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id')
        .eq('is_active', true);

      if (customersError) throw customersError;
      if (!customers || customers.length === 0) {
        return {
          waterRevenue: 0,
          gasRevenue: 0,
          totalRevenue: 0,
          waterUnits: 0,
          gasUnits: 0,
          totalCustomersAnalyzed: 0,
          products: [],
        };
      }

      const customerIds = customers.map(c => c.id);

      // Get delivered orders from last 6 months with items
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          customer_id,
          created_at,
          order_items (
            product_id,
            quantity,
            unit_price,
            products:product_id (id, name, price)
          )
        `)
        .eq('status', 'delivered')
        .in('customer_id', customerIds)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (ordersError) throw ordersError;

      // Build customer purchase history per product
      // Structure: { productId: { customerId: { dates: Date[], quantities: number[], prices: number[] } } }
      const productCustomerData: Record<string, {
        productName: string;
        type: 'water' | 'gas' | 'other';
        customers: Record<string, { dates: Date[]; quantities: number[]; prices: number[] }>;
      }> = {};

      orders?.forEach((order: any) => {
        const customerId = order.customer_id;
        if (!customerId) return;

        const orderDate = new Date(order.created_at);

        order.order_items?.forEach((item: any) => {
          const productId = item.products?.id;
          const productName = item.products?.name || '';
          const quantity = item.quantity || 1;
          const price = item.unit_price || item.products?.price || 0;

          if (!productId) return;

          let type: 'water' | 'gas' | 'other' = 'other';
          if (isWaterProduct(productName)) type = 'water';
          else if (isGasProduct(productName)) type = 'gas';
          
          if (type === 'other') return; // Only project water and gas

          if (!productCustomerData[productId]) {
            productCustomerData[productId] = {
              productName,
              type,
              customers: {},
            };
          }

          if (!productCustomerData[productId].customers[customerId]) {
            productCustomerData[productId].customers[customerId] = {
              dates: [],
              quantities: [],
              prices: [],
            };
          }

          const customerData = productCustomerData[productId].customers[customerId];
          
          // Avoid duplicate entries for same order date
          const dateExists = customerData.dates.some(d => d.getTime() === orderDate.getTime());
          if (!dateExists) {
            customerData.dates.push(orderDate);
            customerData.quantities.push(quantity);
            customerData.prices.push(price);
          }
        });
      });

      // Calculate projections per product
      const products: ProductProjection[] = [];
      const customersAnalyzed = new Set<string>();

      Object.entries(productCustomerData).forEach(([productId, data]) => {
        let totalAvgDays = 0;
        let totalAvgQty = 0;
        let totalAvgPrice = 0;
        let validCustomers = 0;

        Object.entries(data.customers).forEach(([customerId, customerData]) => {
          if (customerData.dates.length < 2) return; // Need at least 2 orders for frequency

          customersAnalyzed.add(customerId);
          
          // Sort dates
          const indices = customerData.dates
            .map((_, i) => i)
            .sort((a, b) => customerData.dates[a].getTime() - customerData.dates[b].getTime());

          const sortedDates = indices.map(i => customerData.dates[i]);
          const sortedQtys = indices.map(i => customerData.quantities[i]);
          const sortedPrices = indices.map(i => customerData.prices[i]);

          // Calculate average days between orders
          let totalDays = 0;
          for (let i = 1; i < sortedDates.length; i++) {
            const diffDays = Math.round(
              (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24)
            );
            totalDays += diffDays;
          }
          const avgDays = totalDays / (sortedDates.length - 1);

          // Calculate average quantity and price
          const avgQty = sortedQtys.reduce((a, b) => a + b, 0) / sortedQtys.length;
          const avgPrice = sortedPrices.reduce((a, b) => a + b, 0) / sortedPrices.length;

          totalAvgDays += avgDays;
          totalAvgQty += avgQty;
          totalAvgPrice += avgPrice;
          validCustomers++;
        });

        if (validCustomers === 0) return;

        const avgDaysPerCustomer = totalAvgDays / validCustomers;
        const avgQtyPerOrder = totalAvgQty / validCustomers;
        const avgPrice = totalAvgPrice / validCustomers;

        // Project for 30 days
        const daysInMonth = 30;
        const ordersPerCustomerPerMonth = avgDaysPerCustomer > 0 
          ? daysInMonth / avgDaysPerCustomer 
          : 0;

        const projectedOrdersPerMonth = ordersPerCustomerPerMonth * validCustomers;
        const projectedUnits = projectedOrdersPerMonth * avgQtyPerOrder;
        const projectedRevenue = projectedUnits * avgPrice;

        products.push({
          productId,
          productName: data.productName,
          type: data.type as 'water' | 'gas',
          avgPrice: Math.round(avgPrice * 100) / 100,
          avgQtyPerOrder: Math.round(avgQtyPerOrder * 10) / 10,
          customersWithHistory: validCustomers,
          projectedOrdersPerMonth: Math.round(projectedOrdersPerMonth),
          projectedUnits: Math.round(projectedUnits),
          projectedRevenue: Math.round(projectedRevenue * 100) / 100,
        });
      });

      // Sort by projected revenue
      products.sort((a, b) => b.projectedRevenue - a.projectedRevenue);

      // Calculate totals
      const waterProducts = products.filter(p => p.type === 'water');
      const gasProducts = products.filter(p => p.type === 'gas');

      const waterRevenue = waterProducts.reduce((sum, p) => sum + p.projectedRevenue, 0);
      const gasRevenue = gasProducts.reduce((sum, p) => sum + p.projectedRevenue, 0);
      const waterUnits = waterProducts.reduce((sum, p) => sum + p.projectedUnits, 0);
      const gasUnits = gasProducts.reduce((sum, p) => sum + p.projectedUnits, 0);

      return {
        waterRevenue,
        gasRevenue,
        totalRevenue: waterRevenue + gasRevenue,
        waterUnits,
        gasUnits,
        totalCustomersAnalyzed: customersAnalyzed.size,
        products,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading || !projection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Projeção de Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center text-muted-foreground">
            Calculando projeção...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Projeção de Faturamento
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-medium mb-1">Como essa projeção é calculada</p>
                  <p className="text-xs">
                    Utiliza o histórico de pedidos, frequência média de recompra e quantidade média por pedido 
                    para estimar o faturamento mensal. Considera que os clientes manterão o mesmo padrão de consumo.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Estimativa mensal baseada no comportamento real de consumo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Main projection value */}
          <div className="text-center py-4 mb-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-1">Faturamento Projetado (30 dias)</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(projection.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Base: {projection.totalCustomersAnalyzed} clientes com histórico
            </p>
          </div>

          {/* Breakdown by category */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg border bg-card space-y-2">
              <div className="flex items-center gap-2">
                <Droplet className="h-5 w-5 text-chart-1" />
                <span className="font-medium">Água</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(projection.waterRevenue)}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>{projection.waterUnits} unidades</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card space-y-2">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-warning" />
                <span className="font-medium">Gás</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(projection.gasRevenue)}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                <span>{projection.gasUnits} unidades</span>
              </div>
            </div>
          </div>

          {/* View details button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-full flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
          >
            <span className="text-sm font-medium">Ver detalhes por produto</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Estimativa baseada em dados históricos. Não inclui novos clientes ou ações promocionais.
          </p>
        </CardContent>
      </Card>

      {/* Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Projeção por Produto
            </SheetTitle>
            <SheetDescription>
              Estimativa de faturamento mensal detalhada por produto
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {projection.products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto com histórico suficiente para projeção
              </div>
            ) : (
              projection.products.map((product) => {
                const Icon = product.type === 'water' ? Droplet : Flame;
                const iconColor = product.type === 'water' ? 'text-chart-1' : 'text-warning';

                return (
                  <div
                    key={product.productId}
                    className="p-4 rounded-lg border bg-card space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-5 w-5", iconColor)} />
                        <h4 className="font-medium">{product.productName}</h4>
                      </div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {formatCurrency(product.projectedRevenue)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Clientes:</span>
                        <span className="font-medium">{product.customersWithHistory}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Unidades:</span>
                        <span className="font-medium">{product.projectedUnits}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Preço médio:</span>
                        <span className="font-medium">{formatCurrency(product.avgPrice)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Qtd/pedido:</span>
                        <span className="font-medium">{product.avgQtyPerOrder}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      ~{product.projectedOrdersPerMonth} pedidos projetados/mês
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Methodology section */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Metodologia</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Histórico dos últimos 6 meses</li>
              <li>• Mínimo de 2 pedidos por cliente para projeção</li>
              <li>• Projeção = (30 dias ÷ média de dias entre pedidos) × qtd média × preço médio</li>
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
