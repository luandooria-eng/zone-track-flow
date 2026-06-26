import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Activity, 
  Users, 
  Package, 
  DollarSign, 
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface SupervisorDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ActivityEvent {
  id: string;
  type: 'save' | 'edit' | 'error' | 'create';
  message: string;
  timestamp: Date;
  user?: string;
  rowIndex?: number;
}

export function SupervisorDashboard({ open, onOpenChange }: SupervisorDashboardProps) {
  const { rows, currentSheet, dirtyRowCount, lastSaveTime, isSaving, getErrorRows } = useDailyGridStore();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLive, setIsLive] = useState(true);

  // Simular eventos em tempo real
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      // Atualizar estatísticas
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive]);

  // Registrar atividades baseadas nas mudanças do store
  useEffect(() => {
    if (lastSaveTime) {
      const newActivity: ActivityEvent = {
        id: crypto.randomUUID(),
        type: 'save' as const,
        message: `${dirtyRowCount || 'Linhas'} salvas com sucesso`,
        timestamp: lastSaveTime,
        user: 'Admin',
      };
      setActivities(prev => [newActivity, ...prev].slice(0, 20));
    }
  }, [lastSaveTime]);

  const stats = useMemo(() => {
    const totalRows = rows.length;
    const filledRows = rows.filter(r => r.customerName && r.productName).length;
    const errorRows = getErrorRows();
    const savedRows = rows.filter(r => r.rowStatus === 'saved').length;
    
    const totalValue = rows.reduce((sum, r) => sum + (r.value || 0), 0);
    const totalQuantity = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const uniqueCustomers = new Set(rows.filter(r => r.customerName).map(r => r.customerName)).size;
    
    // Performance metrics
    const avgValuePerOrder = filledRows > 0 ? totalValue / filledRows : 0;
    const completionRate = totalRows > 0 ? (filledRows / totalRows) * 100 : 0;
    const errorRate = totalRows > 0 ? (errorRows.length / totalRows) * 100 : 0;

    return {
      totalRows,
      filledRows,
      errorCount: errorRows.length,
      savedRows,
      pendingRows: dirtyRowCount,
      totalValue,
      totalQuantity,
      uniqueCustomers,
      avgValuePerOrder,
      completionRate,
      errorRate,
    };
  }, [rows, getErrorRows, dirtyRowCount]);

  const getActivityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'save':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'edit':
        return <Activity className="h-4 w-4 text-primary" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'create':
        return <Package className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] sm:w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dashboard do Supervisor
            </span>
            <div className="flex items-center gap-2">
              <Badge 
                variant={isLive ? "default" : "secondary"}
                className={cn(isLive && "bg-success")}
              >
                <Activity className={cn("h-3 w-3 mr-1", isLive && "animate-pulse")} />
                {isLive ? 'AO VIVO' : 'PAUSADO'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLive(!isLive)}
              >
                {isLive ? 'Pausar' : 'Retomar'}
              </Button>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status em tempo real */}
          <div className="grid grid-cols-4 gap-3">
            <Card className={cn(isSaving && "border-primary animate-pulse")}>
              <CardContent className="pt-3 pb-2">
                <div className="flex items-center justify-between">
                  <Activity className="h-4 w-4 text-primary" />
                  {isSaving && <RefreshCw className="h-3 w-3 animate-spin" />}
                </div>
                <p className="text-lg font-bold mt-1">{stats.pendingRows}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-3 pb-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <p className="text-lg font-bold mt-1">{stats.savedRows}</p>
                <p className="text-xs text-muted-foreground">Salvos</p>
              </CardContent>
            </Card>
            
            <Card className={cn(stats.errorCount > 0 && "border-destructive")}>
              <CardContent className="pt-3 pb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-lg font-bold mt-1">{stats.errorCount}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-3 pb-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-lg font-bold mt-1">{stats.uniqueCustomers}</p>
                <p className="text-xs text-muted-foreground">Clientes</p>
              </CardContent>
            </Card>
          </div>

          {/* Métricas principais */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Faturamento do Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-success">
                  R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Ticket médio: R$ {stats.avgValuePerOrder.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Volume de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.filledRows}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.totalQuantity} unidades vendidas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Indicadores de performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Taxa de preenchimento</span>
                  <span className="font-medium">{stats.completionRate.toFixed(0)}%</span>
                </div>
                <Progress value={stats.completionRate} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Taxa de erros</span>
                  <span className={cn(
                    "font-medium",
                    stats.errorRate > 10 && "text-destructive"
                  )}>
                    {stats.errorRate.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={stats.errorRate} 
                  className={cn("h-2", stats.errorRate > 10 && "[&>div]:bg-destructive")} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Feed de atividades */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Atividade em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {activities.length > 0 ? (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      {getActivityIcon(activity.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.user} • {format(activity.timestamp, 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma atividade recente
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Último save */}
          {lastSaveTime && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Última sincronização: {format(lastSaveTime, 'HH:mm:ss')}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
