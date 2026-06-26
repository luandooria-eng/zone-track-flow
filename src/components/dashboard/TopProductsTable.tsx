import { Inbox } from 'lucide-react';
import { ProductSales } from '@/hooks/useDashboardData';

interface TopProductsTableProps {
  data: ProductSales[];
}

export function TopProductsTable({ data }: TopProductsTableProps) {
  // Calculate total quantity for percentage
  const totalQuantity = data.reduce((acc, p) => acc + p.quantity, 0);
  
  const topProducts = data.map((product) => {
    const percentage = totalQuantity > 0 ? (product.quantity / totalQuantity) * 100 : 0;
    return {
      id: product.productId,
      name: product.productName,
      count: product.quantity,
      revenue: product.revenue,
      percentage: percentage,
    };
  });

  if (topProducts.length === 0) {
    return (
      <div className="kpi-card">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Top Produtos</h3>
          <p className="text-sm text-muted-foreground">Mais vendidos no período</p>
        </div>

        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">Nenhuma venda registrada</p>
          <p className="text-sm">O ranking aparecerá após o primeiro pedido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kpi-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Top Produtos</h3>
        <p className="text-sm text-muted-foreground">Mais vendidos no período</p>
      </div>

      <div className="space-y-3">
        {topProducts.map((product, index) => (
          <div
            key={product.id}
            className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.count} vendas
              </p>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all" 
                  style={{ width: `${Math.min(product.percentage, 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground min-w-[40px] text-right">
                {product.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
