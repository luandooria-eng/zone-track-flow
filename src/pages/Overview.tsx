import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import {
  mockKPIData,
  mockOrders,
  mockCustomers,
  mockProducts,
  mockCreditEntries,
} from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function Overview() {
  const segments = [
    { name: 'Gás + Água', count: mockCustomers.filter(c => c.segment === 'gas_agua').length, color: 'bg-primary' },
    { name: 'Só Água', count: mockCustomers.filter(c => c.segment === 'so_agua').length, color: 'bg-chart-1' },
    { name: 'Só Gás', count: mockCustomers.filter(c => c.segment === 'so_gas').length, color: 'bg-warning' },
    { name: 'Recorrente', count: mockCustomers.filter(c => c.segment === 'recorrente').length, color: 'bg-success' },
  ];

  const pipelineSummary = {
    accepted: mockOrders.filter(o => o.status === 'accepted').length,
    sent: mockOrders.filter(o => o.status === 'sent').length,
    delivered: mockOrders.filter(o => o.status === 'delivered').length,
    canceled: mockOrders.filter(o => o.status === 'canceled').length,
  };

  const stockAlerts = mockProducts.filter(p => p.currentStock <= p.minStock * 1.5).length;

  const overdueCount = mockCreditEntries.filter(e => e.status === 'overdue').length;
  const overdueAmount = mockCreditEntries
    .filter(e => e.status === 'overdue')
    .reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Painel Geral</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão unificada da operação</p>
      </div>

      {/* Main KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Faturamento"
          value={mockKPIData.revenue}
          change={mockKPIData.revenueChange}
          prefix="R$ "
          icon={<DollarSign className="h-4 w-4" />}
          delay={0}
        />
        <KPICard
          title="Vendas"
          value={mockKPIData.salesCount}
          change={mockKPIData.salesCountChange}
          icon={<ShoppingCart className="h-4 w-4" />}
          delay={40}
        />
        <KPICard
          title="Clientes Ativos"
          value={mockCustomers.filter(c => c.segment !== 'inativo').length}
          icon={<Users className="h-4 w-4" />}
          delay={80}
        />
        <KPICard
          title="Ticket Médio"
          value={mockKPIData.averageTicket.toFixed(0)}
          change={mockKPIData.averageTicketChange}
          prefix="R$ "
          icon={<DollarSign className="h-4 w-4" />}
          delay={120}
        />
      </div>

      {/* Detail blocks */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales summary */}
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Vendas</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-lg font-semibold">R$ {mockKPIData.revenue.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Pedidos</span>
              <span className="font-medium">{mockKPIData.salesCount}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Cancelamentos</span>
              <span className={cn('font-medium', mockKPIData.cancellationRate > 5 ? 'text-destructive' : 'text-muted-foreground')}>
                {mockKPIData.cancellationRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Customers */}
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-chart-2" />
            <h3 className="text-sm font-medium">Clientes</h3>
          </div>
          <div className="space-y-2">
            {segments.map((segment) => (
              <div key={segment.name} className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', segment.color)} />
                <span className="flex-1 text-xs text-muted-foreground">{segment.name}</span>
                <span className="text-sm font-medium">{segment.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex justify-between">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-sm font-medium">{mockCustomers.length}</span>
          </div>
        </div>

        {/* Pipeline */}
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-medium">Pipeline</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">Aceito</span>
              </div>
              <span className="text-sm font-medium">{pipelineSummary.accepted}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-xs text-muted-foreground">Enviado</span>
              </div>
              <span className="text-sm font-medium">{pipelineSummary.sent}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">Entregue</span>
              </div>
              <span className="text-sm font-medium">{pipelineSummary.delivered}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-xs text-muted-foreground">Cancelado</span>
              </div>
              <span className="text-sm font-medium">{pipelineSummary.canceled}</span>
            </div>
          </div>
        </div>

        {/* Stock */}
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '280ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-chart-4" />
            <h3 className="text-sm font-medium">Estoque</h3>
          </div>
          <div className="space-y-3">
            {mockProducts.slice(0, 3).map((product) => {
              const avgSalesPerDay = Math.floor(Math.random() * 10) + 3;
              const coverageDays = Math.floor(product.currentStock / avgSalesPerDay);
              return (
                <div key={product.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[120px]">{product.name}</span>
                    <span className={cn(
                      'font-medium',
                      coverageDays <= 3 ? 'text-destructive' : coverageDays <= 7 ? 'text-warning' : 'text-muted-foreground'
                    )}>
                      {coverageDays}d
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (product.currentStock / (product.minStock * 3)) * 100)}
                    className={cn(
                      'h-1',
                      coverageDays <= 3 && '[&>div]:bg-destructive',
                      coverageDays > 3 && coverageDays <= 7 && '[&>div]:bg-warning'
                    )}
                  />
                </div>
              );
            })}
          </div>
          {stockAlerts > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              <span>{stockAlerts} em baixa</span>
            </div>
          )}
        </div>

        {/* Wallet */}
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '320ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-medium">Inadimplência</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-2xl font-semibold text-destructive">
                R$ {overdueAmount.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{overdueCount} títulos vencidos</p>
            </div>
            <div className="space-y-1.5">
              {mockCreditEntries.filter(e => e.status === 'overdue').slice(0, 2).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[120px]">{entry.customerName}</span>
                  <span className="font-medium">R$ {entry.amount.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SLA */}
        <div className="kpi-card animate-fade-up" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-success" />
            <h3 className="text-sm font-medium">SLA Entrega</h3>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">No prazo</span>
                <span className="font-medium text-success">92%</span>
              </div>
              <Progress value={92} className="h-1 [&>div]:bg-success" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Atrasados</span>
                <span className="font-medium text-warning">6%</span>
              </div>
              <Progress value={6} className="h-1 [&>div]:bg-warning" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Críticos</span>
                <span className="font-medium text-destructive">2%</span>
              </div>
              <Progress value={2} className="h-1 [&>div]:bg-destructive" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
