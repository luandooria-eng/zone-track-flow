import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Droplets, Gift, AlertTriangle, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ReturnablesData {
  totalPurchases: number;
  totalBreakages: number;
  breakagePercent: number;
  breakageValue: number;
  bonusQty: number;
  bonusPercent: number;
  bonusValue: number;
  byProduct: {
    name: string;
    purchases: number;
    breakages: number;
    breakagePercent: number;
    bonusQty: number;
    bonusPercent: number;
  }[];
}

export function ReturnablesMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ['returnables-metrics'],
    queryFn: async (): Promise<ReturnablesData> => {
      // Get all stock movements with product info
      const { data: movements, error } = await supabase
        .from('stock_movements')
        .select(`
          id,
          type,
          quantity,
          reason,
          created_at,
          product_id,
          products (
            id,
            name,
            sku,
            cost,
            bonus_percent
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter for water products (SKU containing "água")
      const waterMovements = (movements || []).filter((m: any) => 
        m.products?.sku?.toLowerCase().includes('água')
      );

      // Calculate purchases (in movements)
      const purchases = waterMovements.filter((m: any) => m.type === 'in');
      const totalPurchases = purchases.reduce((sum: number, m: any) => sum + Math.abs(m.quantity), 0);

      // Calculate breakages
      const breakages = (movements || []).filter((m: any) => 
        m.reason?.toLowerCase().includes('quebra')
      );
      const totalBreakages = breakages.reduce((sum: number, m: any) => sum + Math.abs(m.quantity), 0);
      
      // Get average cost for breakage value
      const avgCost = purchases.length > 0 
        ? purchases.reduce((sum: number, m: any) => sum + (m.products?.cost || 0), 0) / purchases.length
        : 0;
      const breakageValue = totalBreakages * avgCost;
      const breakagePercent = totalPurchases > 0 ? (totalBreakages / totalPurchases) * 100 : 0;

      // Calculate bonus based on product bonus_percent
      let bonusQty = 0;
      let bonusValue = 0;
      
      // Group purchases by product
      const productPurchases: Record<string, { purchases: number; breakages: number; product: any }> = {};
      
      purchases.forEach((m: any) => {
        const productId = m.product_id;
        if (!productPurchases[productId]) {
          productPurchases[productId] = { purchases: 0, breakages: 0, product: m.products };
        }
        productPurchases[productId].purchases += Math.abs(m.quantity);
        
        // Calculate bonus for this purchase
        const bonusPercent = (m.products as any)?.bonus_percent || 0;
        if (bonusPercent > 0) {
          const qty = Math.abs(m.quantity);
          const productBonus = Math.floor((qty * bonusPercent) / 100);
          bonusQty += productBonus;
          bonusValue += productBonus * (m.products?.cost || 0);
        }
      });

      // Count breakages by product
      breakages.forEach((m: any) => {
        const productId = m.product_id;
        if (productPurchases[productId]) {
          productPurchases[productId].breakages += Math.abs(m.quantity);
        }
      });

      const bonusPercent = totalPurchases > 0 ? (bonusQty / totalPurchases) * 100 : 0;

      // Build by product array
      const byProduct = Object.values(productPurchases).map((p: any) => ({
        name: p.product?.name || 'Produto',
        purchases: p.purchases,
        breakages: p.breakages,
        breakagePercent: p.purchases > 0 ? (p.breakages / p.purchases) * 100 : 0,
        bonusQty: p.product?.bonus_percent ? Math.floor((p.purchases * p.product.bonus_percent) / 100) : 0,
        bonusPercent: p.product?.bonus_percent || 0,
      })).sort((a, b) => b.purchases - a.purchases);

      return {
        totalPurchases,
        totalBreakages,
        breakagePercent,
        breakageValue,
        bonusQty,
        bonusPercent,
        bonusValue,
        byProduct,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="kpi-card animate-fade-up space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Main metrics cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Purchases */}
        <div className="kpi-card animate-fade-up flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compras (Água)</p>
            <p className="text-2xl font-semibold mt-1">{data.totalPurchases}</p>
            <p className="text-xs text-muted-foreground mt-0.5">galões adquiridos</p>
          </div>
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Droplets className="h-5 w-5" />
          </div>
        </div>

        {/* Breakages */}
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '40ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quebras</p>
            <p className={`text-2xl font-semibold mt-1 ${data.totalBreakages > 0 ? 'text-destructive' : ''}`}>
              {data.totalBreakages}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.breakagePercent.toFixed(1)}% | R$ {data.breakageValue.toFixed(2)}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${data.totalBreakages > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        {/* Bonus */}
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '80ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bonificações</p>
            <p className="text-2xl font-semibold mt-1 text-primary">+{data.bonusQty}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.bonusPercent.toFixed(1)}% | R$ {data.bonusValue.toFixed(2)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Gift className="h-5 w-5" />
          </div>
        </div>

        {/* Net Result */}
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '120ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo Líquido</p>
            <p className={`text-2xl font-semibold mt-1 ${(data.bonusQty - data.totalBreakages) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {data.bonusQty - data.totalBreakages >= 0 ? '+' : ''}{data.bonusQty - data.totalBreakages}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              R$ {(data.bonusValue - data.breakageValue).toFixed(2)}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${(data.bonusQty - data.totalBreakages) >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* By Product breakdown */}
      {data.byProduct.length > 0 && (
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Detalhamento por Marca
            </h3>
          </div>
          <div className="space-y-3">
            {data.byProduct.map((product, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.purchases} galões comprados</p>
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <p className={`text-sm font-medium ${product.breakages > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      -{product.breakages}
                    </p>
                    <p className="text-xs text-muted-foreground">{product.breakagePercent.toFixed(1)}% quebra</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-primary">+{product.bonusQty}</p>
                    <p className="text-xs text-muted-foreground">{product.bonusPercent.toFixed(1)}% bônus</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
