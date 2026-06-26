import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  CreditCard,
  DollarSign,
  Edit,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  Tag,
  TrendingUp,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Bell,
} from 'lucide-react';
import { Customer } from '@/types';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  useCustomerProductAgg,
  useCustomerPaymentAgg,
  useCustomerOrders,
  useCustomerOpenCredit,
  useNeighborhoodRanking,
} from '@/hooks/useCustomerStats';
import { useCustomerAlerts } from '@/hooks/useCustomerConsumption';
import { ConsumptionTab } from './ConsumptionTab';
import { AlertsTab } from './AlertsTab';

interface CustomerProfileDrawerProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (customer: Customer) => void;
}

type EngagementStatus = 'active' | 'at_risk' | 'lost';

const engagementConfig: Record<EngagementStatus, { label: string; className: string; icon: React.ReactNode }> = {
  active: { 
    label: 'Ativo', 
    className: 'bg-success-bg text-success border-success/30',
    icon: <CheckCircle className="h-4 w-4" />
  },
  at_risk: { 
    label: 'Em Risco', 
    className: 'bg-warning-bg text-warning border-warning/30',
    icon: <AlertTriangle className="h-4 w-4" />
  },
  lost: { 
    label: 'Perdido', 
    className: 'bg-destructive-bg text-destructive border-destructive/30',
    icon: <XCircle className="h-4 w-4" />
  },
};

const chartColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

function getEngagementStatus(lastOrderDate?: Date): { status: EngagementStatus; days: number } {
  if (!lastOrderDate) return { status: 'lost', days: 999 };
  const days = differenceInDays(new Date(), lastOrderDate);
  if (days <= 29) return { status: 'active', days };
  if (days <= 60) return { status: 'at_risk', days };
  return { status: 'lost', days };
}

function getTagStyle(color: string) {
  return {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}50`,
  };
}

export function CustomerProfileDrawer({ customer, open, onOpenChange, onEdit }: CustomerProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  // All hooks must be called before any conditional returns
  const customerId = customer?.id;
  const neighborhoodId = (customer as any)?.neighborhood_id;
  
  const { data: productAgg = [] } = useCustomerProductAgg(customerId);
  const { data: paymentAgg = [] } = useCustomerPaymentAgg(customerId);
  const { data: recentOrders = [] } = useCustomerOrders(customerId);
  const { data: openCredit = 0 } = useCustomerOpenCredit(customerId);
  const { data: neighborhoodRanking } = useNeighborhoodRanking(customerId, neighborhoodId);
  const { data: alerts = [] } = useCustomerAlerts(customerId);
  
  if (!customer) return null;
  
  const openAlertsCount = alerts.filter(a => a.status === 'open').length;

  // Handle both Date objects and string dates from Supabase
  const lastOrderDate = customer.lastOrderDate 
    ? (customer.lastOrderDate instanceof Date ? customer.lastOrderDate : new Date(customer.lastOrderDate))
    : (customer as any).last_order_at 
      ? new Date((customer as any).last_order_at)
      : undefined;
  
  const engagement = getEngagementStatus(lastOrderDate);
  
  // Use real customer stats from database
  const totalRevenue = customer.totalRevenue || (customer as any).total_spent || 0;
  const totalOrders = customer.totalOrders || (customer as any).total_orders || 0;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Calculate product mix from real aggregation data
  const totalProductQty = productAgg.reduce((acc, p) => acc + p.qty_total, 0);
  const productMix = productAgg.slice(0, 5).map((p, index) => ({
    name: (p as any).products?.name || 'Produto',
    value: totalProductQty > 0 ? Math.round((p.qty_total / totalProductQty) * 100) : 0,
    fill: chartColors[index % chartColors.length],
  }));

  // Calculate payment preferences from real aggregation data
  const totalPaymentCount = paymentAgg.reduce((acc, p) => acc + p.count_total, 0);
  const paymentPreferences = paymentAgg.slice(0, 5).map(p => ({
    method: (p as any).payment_methods?.name || 'Pagamento',
    percentage: totalPaymentCount > 0 ? Math.round((p.count_total / totalPaymentCount) * 100) : 0,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {customer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              {customer.name}
            </SheetTitle>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => {
                if (onEdit && customer) {
                  onEdit(customer);
                  onOpenChange(false);
                }
              }}
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </div>
          <SheetDescription>
          Perfil completo do cliente
          </SheetDescription>
        </SheetHeader>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="orders">Compras</TabsTrigger>
            <TabsTrigger value="consumption" className="gap-1">
              <BarChart3 className="h-3 w-3" />
              Consumo
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1">
              <Bell className="h-3 w-3" />
              Alertas
              {openAlertsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                  {openAlertsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            {/* Engagement Status */}
            <div className={cn(
              "flex items-center justify-between rounded-lg border p-4",
              engagement.status === 'active' && "bg-success-bg/30 border-success/30",
              engagement.status === 'at_risk' && "bg-warning-bg/30 border-warning/30",
              engagement.status === 'lost' && "bg-destructive-bg/30 border-destructive/30",
            )}>
              <div className="flex items-center gap-3">
                {engagementConfig[engagement.status].icon}
                <div>
                  <p className="font-semibold">Status de Engajamento</p>
                  <p className="text-sm text-muted-foreground">
                    {engagement.days} dias desde última compra
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={cn(engagementConfig[engagement.status].className)}>
                {engagementConfig[engagement.status].label}
              </Badge>
            </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="font-semibold">Dados Cadastrais</h4>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">CPF:</span>
                <span className="font-mono">{customer.cpf}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Telefone:</span>
                <span>{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">E-mail:</span>
                  <span>{customer.email}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Endereço:</span>
                  <p>
                    {(customer as any).street || customer.address?.street}
                    {((customer as any).number || customer.address?.number) && `, ${(customer as any).number || customer.address?.number}`}
                  </p>
                  <p className="text-muted-foreground">
                    {(customer as any).neighborhood?.name || customer.address?.neighborhood || 'Bairro não informado'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {(customer.tags?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {customer.tags?.map(tag => (
                  <Badge key={tag.id} variant="outline" className="text-xs" style={getTagStyle(tag.color)}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <ShoppingCart className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">Pedidos</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-success mb-1" />
              <p className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-muted-foreground">Faturamento</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-chart-1 mb-1" />
              <p className="text-2xl font-bold">R$ {avgTicket.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Ticket Médio</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <CreditCard className={cn("h-5 w-5 mx-auto mb-1", openCredit > 0 ? "text-warning" : "text-muted-foreground")} />
              <p className={cn("text-2xl font-bold", openCredit > 0 && "text-warning")}>
                R$ {openCredit.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Crédito em Aberto</p>
            </div>
          </div>

          {/* Product Mix */}
          <div className="space-y-3">
            <h4 className="font-semibold">Mix de Produtos</h4>
            <div className="flex items-center gap-4">
              <div className="h-32 w-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={productMix}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {productMix.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {productMix.map((product) => (
                  <div key={product.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: product.fill }} />
                      <span>{product.name}</span>
                    </div>
                    <span className="font-medium">{product.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Preferences */}
          <div className="space-y-3">
            <h4 className="font-semibold">Formas de Pagamento Preferidas</h4>
            <div className="space-y-2">
              {paymentPreferences.map((pref) => (
                <div key={pref.method} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{pref.method}</span>
                    <span className="font-medium">{pref.percentage}%</span>
                  </div>
                  <Progress value={pref.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          {/* Location Ranking */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">
                    {(customer as any).neighborhood?.name || customer.address?.neighborhood || 'Bairro'}
                  </p>
                  <p className="text-sm text-muted-foreground">Ranking no bairro</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {neighborhoodRanking ? `#${neighborhoodRanking}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">por faturamento</p>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="space-y-3">
            <h4 className="font-semibold">Últimos Pedidos</h4>
            {recentOrders.length > 0 ? (
              <div className="space-y-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">Pedido #{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {order.total.toFixed(2)}</p>
                      <Badge variant="outline" className={cn(
                        'text-xs',
                        order.status === 'delivered' && 'bg-success-bg text-success',
                        order.status === 'cancelled' && 'bg-destructive-bg text-destructive',
                      )}>
                        {order.status === 'delivered' ? 'Entregue' : 
                         order.status === 'cancelled' ? 'Cancelado' : 
                         order.status === 'sent' ? 'Enviado' : 
                         order.status === 'preparing' ? 'Preparando' : 'Aceito'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">Nenhum pedido encontrado</p>
            )}
          </div>

          {/* Customer Since */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>Cliente desde</span>
            <span>
              {customer.createdAt 
                ? format(new Date(customer.createdAt), "dd/MM/yyyy", { locale: ptBR })
                : '-'
              }
            </span>
          </div>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            {/* Recent Orders */}
            <div className="space-y-3">
              <h4 className="font-semibold">Histórico de Pedidos</h4>
              {recentOrders.length > 0 ? (
                <div className="space-y-2">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <div>
                        <p className="font-medium">Pedido #{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">R$ {order.total.toFixed(2)}</p>
                        <Badge variant="outline" className={cn(
                          'text-xs',
                          order.status === 'delivered' && 'bg-success-bg text-success',
                          order.status === 'cancelled' && 'bg-destructive-bg text-destructive',
                        )}>
                          {order.status === 'delivered' ? 'Entregue' : 
                           order.status === 'cancelled' ? 'Cancelado' : 
                           order.status === 'sent' ? 'Enviado' : 
                           order.status === 'preparing' ? 'Preparando' : 'Aceito'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="consumption" className="mt-4">
            <ConsumptionTab customerId={customer.id} customerName={customer.name} />
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <AlertsTab customerId={customer.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
