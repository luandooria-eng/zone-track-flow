import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  AlertTriangle,
  TrendingDown,
  ChevronRight,
  RefreshCw,
  Phone,
  MapPin,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useOpenAlertsStats,
  useCustomerAlerts,
  useRefreshConsumptionData,
  useGenerateAlerts,
  CustomerAlert,
} from '@/hooks/useCustomerConsumption';

interface ConsumptionAlertsPanelProps {
  onCustomerClick?: (customerId: string, customerName: string) => void;
}

const alertTypeConfig: Record<string, { 
  icon: React.ReactNode; 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  water_drop: {
    icon: <TrendingDown className="h-5 w-5" />,
    label: 'Queda de Água',
    color: 'text-chart-1',
    bgColor: 'bg-chart-1/10',
  },
  water_stopped: {
    icon: <Droplet className="h-5 w-5" />,
    label: 'Pararam Água',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  gas_drop: {
    icon: <TrendingDown className="h-5 w-5" />,
    label: 'Queda de Gás',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  gas_stopped: {
    icon: <Flame className="h-5 w-5" />,
    label: 'Pararam Gás',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  general_risk: {
    icon: <AlertTriangle className="h-5 w-5" />,
    label: 'Risco Geral',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

export function ConsumptionAlertsPanel({ onCustomerClick }: ConsumptionAlertsPanelProps) {
  const [selectedAlertType, setSelectedAlertType] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const { data: stats, isLoading: loadingStats, alerts } = useOpenAlertsStats();
  const refreshData = useRefreshConsumptionData();
  const generateAlerts = useGenerateAlerts();

  const handleRefresh = async () => {
    await refreshData.mutateAsync(undefined);
    await generateAlerts.mutateAsync();
  };

  const isRefreshing = refreshData.isPending || generateAlerts.isPending;

  const handleCardClick = (alertType: string) => {
    setSelectedAlertType(alertType);
    setDrawerOpen(true);
  };

  const filteredAlerts = selectedAlertType 
    ? alerts.filter(a => a.alert_type === selectedAlertType)
    : alerts;

  const alertCards = [
    { 
      type: 'gas_stopped', 
      count: stats?.gas_stopped || 0,
      label: 'Pararam Gás',
      icon: <Flame className="h-6 w-6" />,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
    },
    { 
      type: 'water_stopped', 
      count: stats?.water_stopped || 0,
      label: 'Pararam Água',
      icon: <Droplet className="h-6 w-6" />,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      borderColor: 'border-chart-1/30',
    },
    { 
      type: 'gas_drop', 
      count: stats?.gas_drop || 0,
      label: 'Queda de Gás',
      icon: <TrendingDown className="h-6 w-6" />,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
    },
    { 
      type: 'water_drop', 
      count: stats?.water_drop || 0,
      label: 'Queda de Água',
      icon: <TrendingDown className="h-6 w-6" />,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      borderColor: 'border-chart-1/30',
    },
  ];

  if (loadingStats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas de Consumo
              {(stats?.total || 0) > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats?.total}
                </Badge>
              )}
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(stats?.total || 0) === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum alerta de consumo</p>
              <p className="text-sm">Clique em "Atualizar" para analisar os dados</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {alertCards.map(card => (
                <div
                  key={card.type}
                  className={cn(
                    "rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md",
                    card.borderColor,
                    card.count > 0 ? card.bgColor : "bg-muted/30 opacity-50"
                  )}
                  onClick={() => card.count > 0 && handleCardClick(card.type)}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(card.color)}>{card.icon}</div>
                  </div>
                  <p className={cn("text-2xl font-bold", card.count > 0 ? card.color : "text-muted-foreground")}>
                    {card.count}
                  </p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  {card.count > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <span>Ver clientes</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer with customer list */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedAlertType && alertTypeConfig[selectedAlertType] && (
                <>
                  <span className={alertTypeConfig[selectedAlertType].color}>
                    {alertTypeConfig[selectedAlertType].icon}
                  </span>
                  {alertTypeConfig[selectedAlertType].label}
                </>
              )}
              <Badge variant="outline">{filteredAlerts.length} clientes</Badge>
            </SheetTitle>
            <SheetDescription>
              Clientes com este alerta ativo
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-150px)] mt-4">
            <div className="space-y-3 pr-4">
              {filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="rounded-lg border p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    if (onCustomerClick && alert.customer) {
                      onCustomerClick(alert.customer.id, alert.customer.name);
                      setDrawerOpen(false);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold">{alert.customer?.name || 'Cliente'}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {alert.customer?.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {alert.customer.phone}
                          </span>
                        )}
                        {alert.customer?.neighborhood?.name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {alert.customer.neighborhood.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            alert.severity === 'high' && "bg-destructive-bg text-destructive",
                            alert.severity === 'medium' && "bg-warning-bg text-warning",
                          )}
                        >
                          {alert.details?.percent_drop 
                            ? `Queda de ${alert.details.percent_drop}%`
                            : 'Parou de comprar'
                          }
                        </Badge>
                        {alert.details?.current_qty !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            Atual: {alert.details.current_qty} un
                          </span>
                        )}
                        {alert.details?.previous_avg !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            Média: {alert.details.previous_avg} un
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}

              {filteredAlerts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum cliente com este alerta
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
