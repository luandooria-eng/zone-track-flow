import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, MessageCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCustomerAlerts, useDismissAlert, useCloseAlert } from '@/hooks/useCustomerConsumption';

interface AlertsTabProps {
  customerId: string;
}

const alertTypeLabels: Record<string, string> = {
  water_drop: 'Queda de Água',
  water_stopped: 'Parou de comprar Água',
  gas_drop: 'Queda de Gás',
  gas_stopped: 'Parou de comprar Gás',
  product_stopped: 'Parou de comprar Produto',
  general_risk: 'Cliente em Risco',
};

export function AlertsTab({ customerId }: AlertsTabProps) {
  const { data: alerts = [], isLoading } = useCustomerAlerts(customerId);
  const dismissAlert = useDismissAlert();
  const closeAlert = useCloseAlert();

  const openAlerts = alerts.filter(a => a.status === 'open');
  const closedAlerts = alerts.filter(a => a.status !== 'open');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-3">Alertas Ativos ({openAlerts.length})</h4>
        {openAlerts.length > 0 ? (
          <div className="space-y-3">
            {openAlerts.map(alert => (
              <Card key={alert.id} className={cn(
                alert.severity === 'high' && "border-destructive/50",
                alert.severity === 'medium' && "border-warning/50",
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          alert.severity === 'high' && "text-destructive",
                          alert.severity === 'medium' && "text-warning",
                        )} />
                        <span className="font-medium">
                          {alertTypeLabels[alert.alert_type] || alert.alert_type}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          alert.severity === 'high' && "bg-destructive-bg text-destructive",
                          alert.severity === 'medium' && "bg-warning-bg text-warning",
                        )}>
                          {alert.severity === 'high' ? 'Alto' : alert.severity === 'medium' ? 'Médio' : 'Baixo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.details?.percent_drop && `Queda de ${alert.details.percent_drop}%`}
                        {alert.details?.current_qty !== undefined && ` • Atual: ${alert.details.current_qty} un`}
                        {alert.details?.previous_avg !== undefined && ` • Média: ${alert.details.previous_avg} un`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => closeAlert.mutate(alert.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Resolvido
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => dismissAlert.mutate(alert.id)}
                      >
                        Dispensar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum alerta ativo</p>
        )}
      </div>

      {closedAlerts.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3 text-muted-foreground">Histórico ({closedAlerts.length})</h4>
          <div className="space-y-2">
            {closedAlerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                <span>{alertTypeLabels[alert.alert_type]}</span>
                <Badge variant="outline" className="text-xs">
                  {alert.status === 'closed' ? 'Resolvido' : 'Dispensado'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
