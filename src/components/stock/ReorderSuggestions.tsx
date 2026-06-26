import { useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  Clock,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Product } from '@/types';

interface ReorderSuggestion {
  product: Product;
  currentStock: number;
  avgDailySales: number;
  coverageDays: number;
  suggestedQuantity: number;
  urgency: 'critical' | 'warning' | 'normal';
  trend: 'up' | 'down' | 'stable';
  estimatedCost: number;
  leadTimeDays: number;
}

interface ReorderSuggestionsProps {
  products: Product[];
  onCreateOrder?: (productIds: string[]) => void;
}

export function ReorderSuggestions({ products, onCreateOrder }: ReorderSuggestionsProps) {
  const suggestions = useMemo<ReorderSuggestion[]>(() => {
    return products
      .map((product) => {
        // Mock calculations - in real app, these would come from historical data
        const avgDailySales = Math.floor(Math.random() * 15) + 5;
        const coverageDays = Math.floor(product.currentStock / avgDailySales);
        const leadTimeDays = Math.floor(Math.random() * 5) + 2;
        const safetyStockDays = 7;
        
        // Calculate suggested order quantity
        const daysToReorder = leadTimeDays + safetyStockDays;
        const suggestedQuantity = Math.max(0, (daysToReorder * avgDailySales) - product.currentStock);
        
        // Determine urgency
        let urgency: ReorderSuggestion['urgency'] = 'normal';
        if (coverageDays <= 3) urgency = 'critical';
        else if (coverageDays <= 7) urgency = 'warning';
        
        // Mock trend
        const trend: ReorderSuggestion['trend'] = 
          Math.random() > 0.6 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down';
        
        return {
          product,
          currentStock: product.currentStock,
          avgDailySales,
          coverageDays,
          suggestedQuantity: Math.ceil(suggestedQuantity),
          urgency,
          trend,
          estimatedCost: suggestedQuantity * (product.cost || product.price * 0.7),
          leadTimeDays,
        };
      })
      .filter((s) => s.coverageDays <= 14) // Only show products needing attention
      .sort((a, b) => a.coverageDays - b.coverageDays);
  }, [products]);

  const criticalCount = suggestions.filter((s) => s.urgency === 'critical').length;
  const warningCount = suggestions.filter((s) => s.urgency === 'warning').length;
  const totalEstimatedCost = suggestions.reduce((acc, s) => acc + s.estimatedCost, 0);

  const getUrgencyBadge = (urgency: ReorderSuggestion['urgency']) => {
    switch (urgency) {
      case 'critical':
        return <Badge className="bg-destructive/20 text-destructive border-0">Crítico</Badge>;
      case 'warning':
        return <Badge className="bg-warning/20 text-warning border-0">Atenção</Badge>;
      default:
        return <Badge variant="outline">Normal</Badge>;
    }
  };

  const getTrendIcon = (trend: ReorderSuggestion['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <ArrowRight className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success mb-4">
            <CheckCircle className="h-6 w-6" />
          </div>
          <h3 className="font-semibold mb-2">Estoque Saudável</h3>
          <p className="text-sm text-muted-foreground">
            Todos os produtos estão com cobertura adequada.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold">Sugestões de Reabastecimento</h3>
              <p className="text-sm text-muted-foreground">
                {criticalCount > 0 && (
                  <span className="text-destructive font-medium">{criticalCount} críticos</span>
                )}
                {criticalCount > 0 && warningCount > 0 && ' • '}
                {warningCount > 0 && (
                  <span className="text-warning font-medium">{warningCount} em atenção</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Custo estimado</p>
              <p className="font-semibold">R$ {totalEstimatedCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            </div>
            <Button
              className="gap-2"
              onClick={() => onCreateOrder?.(suggestions.map((s) => s.product.id))}
            >
              <ShoppingCart className="h-4 w-4" />
              Criar Pedido
            </Button>
          </div>
        </div>
      </Card>

      {/* Suggestions List */}
      <div className="grid gap-3">
        {suggestions.map((suggestion, index) => (
          <Card
            key={suggestion.product.id}
            className={cn(
              'p-4 animate-fade-up',
              suggestion.urgency === 'critical' && 'border-destructive/30 bg-destructive/5'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    suggestion.urgency === 'critical' && 'bg-destructive/10 text-destructive',
                    suggestion.urgency === 'warning' && 'bg-warning/10 text-warning',
                    suggestion.urgency === 'normal' && 'bg-muted text-muted-foreground'
                  )}
                >
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{suggestion.product.name}</h4>
                    {getUrgencyBadge(suggestion.urgency)}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>SKU: {suggestion.product.sku}</span>
                    <span className="flex items-center gap-1">
                      Tendência: {getTrendIcon(suggestion.trend)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Estoque</p>
                  <p className={cn(
                    'font-semibold',
                    suggestion.urgency === 'critical' && 'text-destructive'
                  )}>
                    {suggestion.currentStock} un
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cobertura</p>
                  <p className={cn(
                    'font-semibold',
                    suggestion.coverageDays <= 3 ? 'text-destructive' : suggestion.coverageDays <= 7 ? 'text-warning' : ''
                  )}>
                    {suggestion.coverageDays} dias
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sugestão</p>
                  <p className="font-semibold text-primary">{suggestion.suggestedQuantity} un</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Custo</p>
                  <p className="font-semibold">R$ {suggestion.estimatedCost.toFixed(0)}</p>
                </div>
              </div>
            </div>

            {/* Coverage Progress */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Cobertura atual</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Lead time: {suggestion.leadTimeDays} dias
                </span>
              </div>
              <Progress
                value={Math.min(100, (suggestion.coverageDays / 14) * 100)}
                className={cn(
                  'h-2',
                  suggestion.coverageDays <= 3 && '[&>div]:bg-destructive',
                  suggestion.coverageDays > 3 && suggestion.coverageDays <= 7 && '[&>div]:bg-warning'
                )}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
