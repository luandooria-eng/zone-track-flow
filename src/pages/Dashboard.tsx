import React, { useState } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Receipt,
  Package,
  XCircle,
  Clock,
  Plus,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  UserPlus,
  UserCheck,
  AlertTriangle,
  UserX,
  UserRound,
  Repeat,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { ProductsDonut } from '@/components/dashboard/ProductsDonut';
import { ChannelsDonut } from '@/components/dashboard/ChannelsDonut';
import { DeliverersDonut } from '@/components/dashboard/DeliverersDonut';
import { PaymentMethodsDonut } from '@/components/dashboard/PaymentMethodsDonut';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { TopProductsTable } from '@/components/dashboard/TopProductsTable';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { ReturnablesMetrics } from '@/components/dashboard/ReturnablesMetrics';
import { CRMTriggerMetricsCard } from '@/components/dashboard/CRMTriggerMetricsCard';
import { GoalsProgress } from '@/components/dashboard/GoalsProgress';
import { NotReturnedCustomersDrawer } from '@/components/dashboard/NotReturnedCustomersDrawer';
import { Button } from '@/components/ui/button';
import { NewOrderModal } from '@/components/orders/NewOrderModal';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardRealtime } from '@/hooks/useRealtimeSubscription';
import { useFilters } from '@/hooks/useFilters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isNotReturnedOpen, setIsNotReturnedOpen] = useState(false);
  const [isRecoverableOpen, setIsRecoverableOpen] = useState(false);
  const { filters } = useFilters();
  const { metrics, customerMetrics, customerIdentificationMetrics, channelMetrics, delivererMetrics, productSales, paymentMethodData, dailySales, isLoading, refetch } = useDashboardData();
  
  useDashboardRealtime();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const { periodInfo } = useDashboardData();

  // Format period display
  const formatPeriodDisplay = () => {
    const startStr = format(periodInfo.startDate, "dd/MM/yyyy");
    const endStr = format(periodInfo.endDate, "dd/MM/yyyy");
    
    if (startStr === endStr) {
      return `Período: ${startStr}`;
    }
    return `Período: ${startStr} a ${endStr}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isLoading}
            className="text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => setIsNewOrderOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Active Period Badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
          {formatPeriodDisplay()}
        </span>
        {isLoading && (
          <span className="text-xs text-muted-foreground">Carregando...</span>
        )}
      </div>

      {/* Filters */}
      <DashboardFilters />

      {/* Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Faturamento"
          value={formatCurrency(metrics.totalRevenue)}
          change={metrics.revenueGrowth}
          icon={<DollarSign className="h-4 w-4" />}
          delay={0}
          tooltip="Valor total das vendas entregues no período"
        />
        <KPICard
          title="Vendas"
          value={metrics.totalOrders}
          change={metrics.salesGrowth}
          icon={<ShoppingCart className="h-4 w-4" />}
          delay={40}
          tooltip="Número total de pedidos no período"
        />
        <KPICard
          title="Ticket Médio"
          value={formatCurrency(metrics.avgTicket)}
          icon={<Receipt className="h-4 w-4" />}
          delay={80}
          tooltip="Valor médio por pedido"
        />
        <KPICard
          title="Entregues"
          value={metrics.deliveredOrders}
          suffix={`de ${metrics.totalOrders}`}
          icon={<Package className="h-4 w-4" />}
          delay={120}
          tooltip="Pedidos entregues com sucesso"
        />
      </div>

      {/* Goals Progress */}
      <GoalsProgress />

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '160ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hoje</p>
            <p className="text-xl font-semibold mt-1">{metrics.todaySales}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(metrics.todayRevenue)}</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center text-primary">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '200ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Crescimento</p>
            <p className={`text-xl font-semibold mt-1 ${metrics.revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatPercentage(metrics.revenueGrowth)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">receita vs anterior</p>
          </div>
          <div className={`h-8 w-8 rounded-md flex items-center justify-center ${metrics.revenueGrowth >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
            {metrics.revenueGrowth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
        </div>
        
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '240ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cancelamentos</p>
            <p className={`text-xl font-semibold mt-1 ${metrics.cancellationRate > 5 ? 'text-destructive' : 'text-foreground'}`}>
              {metrics.cancellationRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{metrics.pendingOrders} pendentes</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
            <XCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Customer Identification Metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '260ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Clientes Cadastrados</p>
            <p className="text-xl font-semibold mt-1 text-success">{customerIdentificationMetrics.identifiedPercentage.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">{customerIdentificationMetrics.identifiedOrders} de {customerIdentificationMetrics.totalOrdersForMetric} pedidos</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-success/10 flex items-center justify-center text-success">
            <UserRound className="h-4 w-4" />
          </div>
        </div>
        
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '280ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">S.ID (Não Cadastrados)</p>
            <p className={`text-xl font-semibold mt-1 ${customerIdentificationMetrics.unidentifiedPercentage > 20 ? 'text-warning' : 'text-orange-500'}`}>
              {customerIdentificationMetrics.unidentifiedPercentage.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{customerIdentificationMetrics.unidentifiedOrders} de {customerIdentificationMetrics.totalOrdersForMetric} pedidos</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-orange-500/10 flex items-center justify-center text-orange-500">
            <UserX className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Customer Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7">
        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '280ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Clientes</p>
            <p className="text-xl font-semibold mt-1">{customerMetrics.totalCustomers}</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center text-primary">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '320ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Novos (período)</p>
            <p className="text-xl font-semibold mt-1">{customerMetrics.newCustomers}</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center text-primary">
            <UserPlus className="h-4 w-4" />
          </div>
        </div>

        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '360ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ativos</p>
            <p className="text-xl font-semibold mt-1 text-success">{customerMetrics.activeCustomers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{customerMetrics.activePercentage.toFixed(1)}%</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-success/10 flex items-center justify-center text-success">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>

        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '400ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em Risco</p>
            <p className="text-xl font-semibold mt-1 text-warning">{customerMetrics.atRiskCustomers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{customerMetrics.atRiskPercentage.toFixed(1)}%</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-warning/10 flex items-center justify-center text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '440ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Perdidos</p>
            <p className="text-xl font-semibold mt-1 text-destructive">{customerMetrics.lostCustomers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{customerMetrics.lostPercentage.toFixed(1)}%</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-destructive/10 flex items-center justify-center text-destructive">
            <UserX className="h-4 w-4" />
          </div>
        </div>

        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '480ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recorrência</p>
            <p className="text-xl font-semibold mt-1">{customerMetrics.recurrenceRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">clientes que voltam</p>
          </div>
          <div className="h-8 w-8 rounded-md bg-primary/8 flex items-center justify-center text-primary">
            <Repeat className="h-4 w-4" />
          </div>
        </div>

        <button
          onClick={() => setIsNotReturnedOpen(true)}
          className="kpi-card animate-fade-up flex items-center justify-between text-left hover:bg-accent/40 transition-colors"
          style={{ animationDelay: '520ms' }}
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Retenção MoM</p>
            <p className="text-xl font-semibold mt-1">{customerMetrics.repurchase30Rate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerMetrics.repurchase30Returned}/{customerMetrics.repurchase30CohortSize} voltaram · {customerMetrics.repurchase30NotReturnedIds.length} reativar
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-success/10 flex items-center justify-center text-success">
            <Repeat className="h-4 w-4" />
          </div>
        </button>

        <div className="kpi-card animate-fade-up flex items-center justify-between" style={{ animationDelay: '560ms' }}>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ativos da base (30d)</p>
            <p className="text-xl font-semibold mt-1 text-success">{customerMetrics.baseActive30Rate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerMetrics.baseActive30}/{customerMetrics.baseTotal} compraram nos últimos 30d
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-success/10 flex items-center justify-center text-success">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>

        <button
          onClick={() => setIsRecoverableOpen(true)}
          className="kpi-card animate-fade-up flex items-center justify-between text-left hover:bg-accent/40 transition-colors"
          style={{ animationDelay: '600ms' }}
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recuperáveis (30-90d)</p>
            <p className="text-xl font-semibold mt-1 text-warning">{customerMetrics.baseRecoverableRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerMetrics.baseRecoverable}/{customerMetrics.baseTotal} candidatos a reativação
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-warning/10 flex items-center justify-center text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Returnables Metrics - Breakages and Bonuses */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Retornáveis e Bonificações</h2>
        <ReturnablesMetrics />
      </div>

      {/* Channel & Deliverer Metrics - New Premium Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChannelsDonut data={channelMetrics} />
        <DeliverersDonut data={delivererMetrics} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart data={dailySales} />
        </div>
        <ProductsDonut data={productSales} />
      </div>

      {/* Payment Methods - Full Width */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentMethodsDonut data={paymentMethodData} />
        <TopProductsTable data={productSales} />
      </div>

      {/* Alerts - Separate Row */}
      <AlertsPanel />

      {/* CRM trigger metrics */}
      <CRMTriggerMetricsCard />

      <NewOrderModal open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen} />
      <NotReturnedCustomersDrawer
        open={isNotReturnedOpen}
        onOpenChange={setIsNotReturnedOpen}
        customerIds={customerMetrics.repurchase30NotReturnedIds}
      />
      <NotReturnedCustomersDrawer
        open={isRecoverableOpen}
        onOpenChange={setIsRecoverableOpen}
        customerIds={customerMetrics.baseRecoverableIds}
      />
    </div>
  );
}
