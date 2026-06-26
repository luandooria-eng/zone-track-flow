import { AlertTriangle, Calendar, Package, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockProducts, mockCreditEntries, mockOrders } from '@/lib/mockData';
import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';

interface Alert {
  id: string;
  type: 'stock' | 'credit' | 'delivery';
  title: string;
  description: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
}

export function AlertsPanel() {
  // Generate real alerts from data
  const alerts = useMemo(() => {
    const alertsList: Alert[] = [];
    
    // Stock alerts
    mockProducts.forEach(product => {
      if (product.currentStock <= 0) {
        alertsList.push({
          id: `stock-zero-${product.id}`,
          type: 'stock',
          title: 'Estoque zerado',
          description: `${product.name} sem estoque`,
          time: 'Agora',
          priority: 'high',
        });
      } else if (product.currentStock < product.minStock) {
        alertsList.push({
          id: `stock-low-${product.id}`,
          type: 'stock',
          title: 'Estoque baixo',
          description: `${product.name} com ${product.currentStock} unidades`,
          time: 'Agora',
          priority: 'medium',
        });
      }
    });
    
    // Credit alerts
    mockCreditEntries.forEach(entry => {
      if (entry.status === 'overdue') {
        const daysOverdue = Math.abs(differenceInDays(entry.dueDate, new Date()));
        alertsList.push({
          id: `credit-overdue-${entry.id}`,
          type: 'credit',
          title: 'Título vencido',
          description: `${entry.customerName} - R$ ${entry.amount.toFixed(2)} há ${daysOverdue} dias`,
          time: `${daysOverdue}d atrás`,
          priority: 'high',
        });
      } else if (entry.status === 'pending') {
        const daysToDue = differenceInDays(entry.dueDate, new Date());
        if (daysToDue <= 3 && daysToDue >= 0) {
          alertsList.push({
            id: `credit-due-${entry.id}`,
            type: 'credit',
            title: 'Vencimento próximo',
            description: `${entry.customerName} - R$ ${entry.amount.toFixed(2)} em ${daysToDue} dias`,
            time: `${daysToDue}d`,
            priority: 'medium',
          });
        }
      }
    });
    
    // Delivery alerts (orders stuck in accepted status for too long)
    mockOrders.forEach(order => {
      if (order.status === 'accepted' && order.acceptedAt) {
        const hoursWaiting = Math.floor((Date.now() - order.acceptedAt.getTime()) / (1000 * 60 * 60));
        if (hoursWaiting >= 2) {
          alertsList.push({
            id: `delivery-${order.id}`,
            type: 'delivery',
            title: 'Entrega atrasada',
            description: `Pedido #${order.id} há +${hoursWaiting}h aguardando`,
            time: `${hoursWaiting}h`,
            priority: 'medium',
          });
        }
      }
    });
    
    return alertsList.slice(0, 10); // Limit to 10 alerts
  }, []);

  return (
    <div className="kpi-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Alertas</h3>
          <p className="text-sm text-muted-foreground">Ações pendentes</p>
        </div>
        <span className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
          alerts.length > 0 
            ? "bg-destructive text-destructive-foreground" 
            : "bg-success text-success-foreground"
        )}>
          {alerts.length}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <CheckCircle className="h-12 w-12 mb-4 text-success opacity-70" />
          <p className="font-medium text-success">Tudo em ordem!</p>
          <p className="text-sm text-center">Nenhum alerta pendente no momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
                alert.priority === 'high' && 'border-destructive/30 bg-destructive-bg/30',
                alert.priority === 'medium' && 'border-warning/30 bg-warning-bg/30'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  alert.type === 'stock' && 'bg-warning/20 text-warning',
                  alert.type === 'credit' && 'bg-destructive/20 text-destructive',
                  alert.type === 'delivery' && 'bg-primary/20 text-primary'
                )}
              >
                {alert.type === 'stock' ? (
                  <Package className="h-4 w-4" />
                ) : alert.type === 'credit' ? (
                  <Calendar className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {alert.description}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {alert.time}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
