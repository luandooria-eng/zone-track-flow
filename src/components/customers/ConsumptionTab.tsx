import { useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Droplet,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  Loader2,
  Clock,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCustomerMonthlyConsumption,
  useCustomerConsumptionStats,
  useCustomerAlerts,
  useDismissAlert,
  useRefreshConsumptionData,
} from '@/hooks/useCustomerConsumption';

interface ConsumptionTabProps {
  customerId: string;
  customerName: string;
}

const trendConfig = {
  up: { icon: TrendingUp, color: 'text-success', label: 'Subiu' },
  down: { icon: TrendingDown, color: 'text-destructive', label: 'Caiu' },
  stable: { icon: Minus, color: 'text-muted-foreground', label: 'Estável' },
  stopped: { icon: AlertTriangle, color: 'text-warning', label: 'Parou' },
};

const alertTypeLabels: Record<string, string> = {
  water_drop: 'Queda de Água',
  water_stopped: 'Parou de comprar Água',
  gas_drop: 'Queda de Gás',
  gas_stopped: 'Parou de comprar Gás',
  product_stopped: 'Parou de comprar Produto',
  general_risk: 'Cliente em Risco',
};

export function ConsumptionTab({ customerId, customerName }: ConsumptionTabProps) {
  const [period, setPeriod] = useState<string>('6');
  
  const { data: monthlyData = [], isLoading: loadingMonthly } = useCustomerMonthlyConsumption(customerId, parseInt(period));
  const { data: stats, isLoading: loadingStats } = useCustomerConsumptionStats(customerId);
  const { data: alerts = [] } = useCustomerAlerts(customerId);
  const dismissAlert = useDismissAlert();
  const refreshData = useRefreshConsumptionData();

  const chartData = useMemo(() => {
    return monthlyData.map(m => ({
      month: format(new Date(m.year_month + '-01'), 'MMM/yy', { locale: ptBR }),
      yearMonth: m.year_month,
      agua: m.water_qty,
      gas: m.gas_qty,
      valor: m.total_value,
    }));
  }, [monthlyData]);

  const openAlerts = alerts.filter(a => a.status === 'open');

  const handleRefresh = () => {
    refreshData.mutate(customerId);
  };

  if (loadingMonthly || loadingStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">Análise de Consumo</h4>
          <p className="text-sm text-muted-foreground">
            Histórico e tendências de compras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshData.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshData.isPending && "animate-spin")} />
            Atualizar
          </Button>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Repurchase Frequency Cards - Main Focus */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          {/* Water Frequency Card */}
          <Card className={cn(
            "border-l-4",
            stats.avgDaysBetweenOrders.daysSinceLastWater !== null && 
            stats.avgDaysBetweenOrders.water !== null &&
            stats.avgDaysBetweenOrders.daysSinceLastWater > stats.avgDaysBetweenOrders.water * 1.5
              ? "border-l-warning"
              : "border-l-chart-1"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Droplet className="h-5 w-5 text-chart-1" />
                Água
              </CardTitle>
              <CardDescription>Frequência de recompra</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.avgDaysBetweenOrders.water !== null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-3xl font-bold">{stats.avgDaysBetweenOrders.water}</span>
                    <span className="text-sm text-muted-foreground">dias</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Este cliente costuma pedir água a cada <strong>{stats.avgDaysBetweenOrders.water}</strong> dias
                  </p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Dados insuficientes</p>
                  <p className="text-xs">Precisa de pelo menos 2 pedidos para calcular</p>
                </div>
              )}
              
              {stats.avgDaysBetweenOrders.daysSinceLastWater !== null && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Último pedido há</span>
                    <span className={cn(
                      "font-semibold",
                      stats.avgDaysBetweenOrders.water && 
                      stats.avgDaysBetweenOrders.daysSinceLastWater > stats.avgDaysBetweenOrders.water * 1.5
                        ? "text-warning"
                        : "text-foreground"
                    )}>
                      {stats.avgDaysBetweenOrders.daysSinceLastWater} dias
                    </span>
                  </div>
                  {stats.avgDaysBetweenOrders.water && 
                   stats.avgDaysBetweenOrders.daysSinceLastWater > stats.avgDaysBetweenOrders.water * 1.5 && (
                    <Badge variant="outline" className="mt-2 bg-warning/10 text-warning border-warning/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Atrasado - hora de contatar!
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Monthly Stats - Secondary Info */}
              <div className="pt-2 border-t text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  <div>Mês atual: <span className="font-medium text-foreground">{stats.currentMonth.water_qty} un</span></div>
                  <div>Média 3m: <span className="font-medium text-foreground">{stats.avg3Months.water_qty.toFixed(1)} un</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gas Frequency Card */}
          <Card className={cn(
            "border-l-4",
            stats.avgDaysBetweenOrders.daysSinceLastGas !== null && 
            stats.avgDaysBetweenOrders.gas !== null &&
            stats.avgDaysBetweenOrders.daysSinceLastGas > stats.avgDaysBetweenOrders.gas * 1.5
              ? "border-l-warning"
              : "border-l-warning"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="h-5 w-5 text-warning" />
                Gás
              </CardTitle>
              <CardDescription>Frequência de recompra</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.avgDaysBetweenOrders.gas !== null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-3xl font-bold">{stats.avgDaysBetweenOrders.gas}</span>
                    <span className="text-sm text-muted-foreground">dias</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Este cliente costuma pedir gás a cada <strong>{stats.avgDaysBetweenOrders.gas}</strong> dias
                  </p>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Dados insuficientes</p>
                  <p className="text-xs">Precisa de pelo menos 2 pedidos para calcular</p>
                </div>
              )}
              
              {stats.avgDaysBetweenOrders.daysSinceLastGas !== null && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Último pedido há</span>
                    <span className={cn(
                      "font-semibold",
                      stats.avgDaysBetweenOrders.gas && 
                      stats.avgDaysBetweenOrders.daysSinceLastGas > stats.avgDaysBetweenOrders.gas * 1.5
                        ? "text-warning"
                        : "text-foreground"
                    )}>
                      {stats.avgDaysBetweenOrders.daysSinceLastGas} dias
                    </span>
                  </div>
                  {stats.avgDaysBetweenOrders.gas && 
                   stats.avgDaysBetweenOrders.daysSinceLastGas > stats.avgDaysBetweenOrders.gas * 1.5 && (
                    <Badge variant="outline" className="mt-2 bg-warning/10 text-warning border-warning/30">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Atrasado - hora de contatar!
                    </Badge>
                  )}
                </div>
              )}
              
              {/* Monthly Stats - Secondary Info */}
              <div className="pt-2 border-t text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  <div>Mês atual: <span className="font-medium text-foreground">{stats.currentMonth.gas_qty} un</span></div>
                  <div>Média 3m: <span className="font-medium text-foreground">{stats.avg3Months.gas_qty.toFixed(1)} un</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Consumption Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Consumo</CardTitle>
          <CardDescription>Quantidade por mês (água e gás)</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="agua" 
                    name="Água" 
                    fill="hsl(var(--chart-1))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="gas" 
                    name="Gás" 
                    fill="hsl(var(--warning))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Droplet className="h-12 w-12 mb-3 opacity-50" />
              <p>Nenhum dado de consumo encontrado</p>
              <p className="text-sm">Os dados são calculados com base nos pedidos</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Calcular agora
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts Section */}
      {openAlerts.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-warning">
              <AlertTriangle className="h-5 w-5" />
              Alertas Ativos ({openAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openAlerts.map(alert => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  alert.severity === 'high' && "bg-destructive-bg border-destructive/30",
                  alert.severity === 'medium' && "bg-warning-bg border-warning/30",
                  alert.severity === 'low' && "bg-muted border-muted-foreground/30",
                )}
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {alertTypeLabels[alert.alert_type] || alert.alert_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {alert.details?.percent_drop && (
                      <>Queda de {alert.details.percent_drop}% </>
                    )}
                    {alert.details?.current_qty !== undefined && (
                      <>• Atual: {alert.details.current_qty} un </>
                    )}
                    {alert.details?.previous_avg !== undefined && (
                      <>• Média: {alert.details.previous_avg} un</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => dismissAlert.mutate(alert.id)}
                    disabled={dismissAlert.isPending}
                  >
                    Dispensar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {stats && (stats.trends.water === 'stopped' || stats.trends.gas === 'stopped' || stats.trends.water === 'down' || stats.trends.gas === 'down') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações Recomendadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats.trends.water === 'stopped' || stats.trends.gas === 'stopped') && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning-bg/30">
                <MessageCircle className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="font-medium">Enviar mensagem de retorno</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente parou de comprar {stats.trends.water === 'stopped' ? 'água' : 'gás'}
                  </p>
                </div>
                <Button size="sm">Enviar</Button>
              </div>
            )}
            {(stats.trends.water === 'down' || stats.trends.gas === 'down') && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <TrendingDown className="h-5 w-5 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium">Oferecer promoção</p>
                  <p className="text-sm text-muted-foreground">
                    Consumo em queda, considere uma oferta especial
                  </p>
                </div>
                <Button size="sm" variant="outline">Ver ofertas</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
