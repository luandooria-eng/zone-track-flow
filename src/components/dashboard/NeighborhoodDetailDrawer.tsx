import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  MapPin,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/hooks/useSupabaseQuery';
import { format } from 'date-fns';
import { NeighborhoodDonutData } from './NeighborhoodsDonut';

interface NeighborhoodDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  neighborhood: NeighborhoodDonutData | null;
  totalRevenue: number;
}

export function NeighborhoodDetailDrawer({
  open,
  onOpenChange,
  neighborhood,
  totalRevenue,
}: NeighborhoodDetailDrawerProps) {
  if (!neighborhood) return null;

  const revenueShare = totalRevenue > 0 
    ? ((neighborhood.revenue / totalRevenue) * 100).toFixed(1) 
    : '0';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExportCustomers = () => {
    const exportData = neighborhood.customerList.map(c => ({
      Cliente: c.name,
      Pedidos: c.orders,
      'Total Gasto': c.totalSpent.toFixed(2),
    }));
    exportToCSV(exportData, `clientes-${neighborhood.name}-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            {neighborhood.name}
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Users className="h-4 w-4 mx-auto text-chart-2 mb-1" />
              <p className="text-xl font-bold">{neighborhood.customers}</p>
              <p className="text-[10px] text-muted-foreground">Clientes</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <ShoppingCart className="h-4 w-4 mx-auto text-warning mb-1" />
              <p className="text-xl font-bold">{neighborhood.orders}</p>
              <p className="text-[10px] text-muted-foreground">Pedidos</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <DollarSign className="h-4 w-4 mx-auto text-success mb-1" />
              <p className="text-xl font-bold">{formatCurrency(neighborhood.revenue)}</p>
              <p className="text-[10px] text-muted-foreground">Faturamento</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-xl font-bold">{formatCurrency(neighborhood.avgTicket)}</p>
              <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
            </div>
          </div>

          {/* Growth & Share */}
          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Participação no Faturamento</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(Number(revenueShare), 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold">{revenueShare}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <span className="text-xs text-muted-foreground">Crescimento 30d</span>
              <span className={cn(
                "text-sm font-bold flex items-center gap-1",
                neighborhood.growth >= 0 ? "text-success" : "text-destructive"
              )}>
                {neighborhood.growth >= 0 
                  ? <TrendingUp className="h-3.5 w-3.5" /> 
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {neighborhood.growth >= 0 ? '+' : ''}{neighborhood.growth.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Top Products */}
          {neighborhood.topProducts.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Top Produtos
              </h4>
              <div className="space-y-1.5">
                {neighborhood.topProducts.map((product, idx) => (
                  <div key={product.name} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-5">#{idx + 1}</span>
                      <span className="text-sm">{product.name}</span>
                    </div>
                    <span className="text-xs font-medium">{product.quantity} un</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Customers */}
          {neighborhood.customerList.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-chart-2" />
                Top Clientes
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">Cliente</TableHead>
                    <TableHead className="text-xs text-right h-8">Pedidos</TableHead>
                    <TableHead className="text-xs text-right h-8">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {neighborhood.customerList.slice(0, 5).map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="text-sm font-medium py-2">{customer.name}</TableCell>
                      <TableCell className="text-sm text-right py-2">{customer.orders}</TableCell>
                      <TableCell className="text-sm text-right py-2">
                        {formatCurrency(customer.totalSpent)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {neighborhood.customerList.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  +{neighborhood.customerList.length - 5} clientes
                </p>
              )}
            </div>
          )}

          {/* Export */}
          {neighborhood.customerList.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              className="w-full"
              onClick={handleExportCustomers}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Clientes
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
