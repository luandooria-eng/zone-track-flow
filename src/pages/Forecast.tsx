import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from 'recharts';
import { useOrders, useProducts, useDailySummary } from '@/hooks/useSupabaseQuery';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Forecast() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [tab, setTab] = useState('revenue');

  const { data: orders, isLoading: loadingOrders } = useOrders();
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: dailySummary, isLoading: loadingSummary } = useDailySummary();

  const isLoading = loadingOrders || loadingProducts || loadingSummary;

  // Calculate forecast based on historical data
  const forecastData = useMemo(() => {
    if (!orders) return [];

    const now = new Date();
    const monthlyData: Record<string, { revenue: number; orders: number }> = {};

    // Group orders by month
    orders.forEach((order) => {
      const month = format(new Date(order.created_at), 'yyyy-MM');
      if (!monthlyData[month]) {
        monthlyData[month] = { revenue: 0, orders: 0 };
      }
      if (order.status === 'delivered') {
        monthlyData[month].revenue += order.total;
        monthlyData[month].orders += 1;
      }
    });

    // Generate 12-month view (6 past + current + 5 future)
    const months = [];
    for (let i = -6; i <= 5; i++) {
      const date = addMonths(now, i);
      const monthKey = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMM', { locale: ptBR });
      const isFuture = i > 0;
      const isCurrent = i === 0;

      const historical = monthlyData[monthKey];
      
      // Simple moving average forecast
      const pastMonths = Object.entries(monthlyData)
        .filter(([key]) => key < monthKey)
        .slice(-3)
        .map(([, val]) => val.revenue);
      
      const avgRevenue = pastMonths.length > 0 
        ? pastMonths.reduce((a, b) => a + b, 0) / pastMonths.length 
        : 15000;
      
      // Add some growth trend
      const growthFactor = 1 + (i * 0.02);
      const forecastRevenue = avgRevenue * growthFactor;

      months.push({
        month: monthLabel,
        fullMonth: format(date, 'MMMM yyyy', { locale: ptBR }),
        real: isFuture ? null : (historical?.revenue || 0),
        forecast: isFuture ? forecastRevenue : null,
        target: forecastRevenue * 1.1,
        lower: isFuture ? forecastRevenue * 0.85 : null,
        upper: isFuture ? forecastRevenue * 1.15 : null,
        orders: historical?.orders || 0,
      });
    }

    return months;
  }, [orders]);

  // Product demand forecast
  const productForecast = useMemo(() => {
    if (!products || !orders) return [];

    // Calculate sales velocity per product
    const productSales: Record<string, { total: number; days: number }> = {};
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      if (orderDate >= thirtyDaysAgo && order.status === 'delivered') {
        order.items?.forEach((item: any) => {
          if (!productSales[item.product_id]) {
            productSales[item.product_id] = { total: 0, days: 30 };
          }
          productSales[item.product_id].total += item.quantity;
        });
      }
    });

    return products.map((product) => {
      const sales = productSales[product.id] || { total: 0, days: 30 };
      const avgDailySales = sales.total / sales.days;
      const coverageDays = avgDailySales > 0 ? Math.floor((product.current_stock || 0) / avgDailySales) : 999;
      const forecastDemand = Math.ceil(avgDailySales * 1.1); // 10% growth assumption
      
      return {
        ...product,
        currentDemand: Math.round(avgDailySales * 10) / 10,
        forecastDemand,
        trend: avgDailySales > 1 ? 'up' : avgDailySales < 0.5 ? 'down' : 'stable',
        confidence: Math.min(95, 60 + sales.total),
        coverageDays,
        suggestedOrder: Math.max(0, Math.ceil(forecastDemand * 14 - (product.current_stock || 0))),
      };
    }).sort((a, b) => b.currentDemand - a.currentDemand);
  }, [products, orders]);

  // Seasonality data from actual orders
  const seasonalityData = useMemo(() => {
    if (!orders) return [];

    const dayTotals: Record<number, { revenue: number; count: number }> = {
      0: { revenue: 0, count: 0 }, // Sunday
      1: { revenue: 0, count: 0 },
      2: { revenue: 0, count: 0 },
      3: { revenue: 0, count: 0 },
      4: { revenue: 0, count: 0 },
      5: { revenue: 0, count: 0 },
      6: { revenue: 0, count: 0 }, // Saturday
    };

    orders.forEach((order) => {
      if (order.status === 'delivered') {
        const dayOfWeek = getDay(new Date(order.created_at));
        dayTotals[dayOfWeek].revenue += order.total;
        dayTotals[dayOfWeek].count += 1;
      }
    });

    const totalAvg = Object.values(dayTotals).reduce((a, b) => a + b.revenue, 0) / 7;
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return dayNames.map((day, index) => ({
      day,
      value: dayTotals[index].revenue,
      avg: totalAvg,
      index: totalAvg > 0 ? Math.round((dayTotals[index].revenue / totalAvg) * 100) : 100,
      orders: dayTotals[index].count,
    }));
  }, [orders]);

  // Summary calculations
  const forecastSummary = useMemo(() => {
    const nextMonth = forecastData.find((d) => d.forecast !== null);
    const currentMonth = forecastData.filter((d) => d.real !== null).pop();
    
    return {
      nextMonthForecast: nextMonth?.forecast || 0,
      currentRevenue: currentMonth?.real || 0,
      target: nextMonth?.target || 0,
      growth: nextMonth && currentMonth && currentMonth.real 
        ? ((nextMonth.forecast! - currentMonth.real) / currentMonth.real) * 100 
        : 0,
    };
  }, [forecastData]);

  const bestDay = useMemo(() => {
    if (seasonalityData.length === 0) return { day: '-', index: 0 };
    return seasonalityData.reduce((best, curr) => curr.index > best.index ? curr : best);
  }, [seasonalityData]);

  // Insights
  const insights = useMemo(() => {
    const result = [];

    if (bestDay.index > 130) {
      result.push({
        type: 'positive',
        title: 'Pico de vendas esperado',
        description: `${bestDay.day} representa ${bestDay.index}% da média diária`,
        action: 'Garantir estoque reforçado',
      });
    }

    const criticalProducts = productForecast.filter(p => p.coverageDays <= 7);
    if (criticalProducts.length > 0) {
      result.push({
        type: 'warning',
        title: `${criticalProducts.length} produto(s) em baixo estoque`,
        description: 'Cobertura menor que 7 dias',
        action: 'Verificar reabastecimento',
      });
    }

    const growingProducts = productForecast.filter(p => p.trend === 'up').slice(0, 1);
    if (growingProducts.length > 0) {
      result.push({
        type: 'info',
        title: `${growingProducts[0].name} em alta`,
        description: `Demanda de ${growingProducts[0].currentDemand.toFixed(1)} un/dia`,
        action: 'Negociar com fornecedores',
      });
    }

    return result;
  }, [bestDay, productForecast]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análises Preditivas</h1>
          <p className="text-muted-foreground">
            Forecast de vendas e tendências baseado em dados históricos
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mensal</SelectItem>
            <SelectItem value="quarter">Trimestral</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Forecast KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Previsão Próx. Mês</p>
              <p className="text-2xl font-bold">
                R$ {forecastSummary.nextMonthForecast.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm">
            {forecastSummary.growth > 0 ? (
              <ArrowUpRight className="h-4 w-4 text-success" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-destructive" />
            )}
            <span className={cn(forecastSummary.growth > 0 ? 'text-success' : 'text-destructive')}>
              {forecastSummary.growth.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs mês atual</span>
          </div>
        </Card>

        <Card className="p-4 animate-fade-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/20 text-warning">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Meta do Mês</p>
              <p className="text-2xl font-bold">
                R$ {forecastSummary.target.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <div className="mt-2">
            <Progress 
              value={forecastSummary.target > 0 ? (forecastSummary.currentRevenue / forecastSummary.target) * 100 : 0} 
              className="h-1.5" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              {forecastSummary.target > 0 ? ((forecastSummary.currentRevenue / forecastSummary.target) * 100).toFixed(0) : 0}% atingido
            </p>
          </div>
        </Card>

        <Card className="p-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Melhor Dia</p>
              <p className="text-2xl font-bold">{bestDay.day}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{bestDay.index}% da média diária</p>
        </Card>

        <Card className="p-4 animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20 text-success">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confiança</p>
              <p className="text-2xl font-bold">
                {orders && orders.length > 50 ? '85%' : orders && orders.length > 20 ? '70%' : '50%'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Baseado em {orders?.length || 0} pedidos
          </p>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="revenue">Faturamento</TabsTrigger>
          <TabsTrigger value="demand">Demanda Produtos</TabsTrigger>
          <TabsTrigger value="seasonality">Sazonalidade</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Previsão de Faturamento</h3>
            {forecastData.length === 0 ? (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Dados insuficientes para previsão
              </div>
            ) : (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`R$ ${value?.toLocaleString('pt-BR') || '-'}`, '']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullMonth || label}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="real"
                      name="Realizado"
                      stroke="hsl(var(--primary))"
                      fill="url(#colorReal)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      name="Previsão"
                      stroke="hsl(var(--chart-2))"
                      fill="url(#colorForecast)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Meta"
                      stroke="hsl(var(--warning))"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="demand" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Previsão de Demanda por Produto</h3>
            {productForecast.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Cadastre produtos para ver previsões de demanda
              </div>
            ) : (
              <div className="space-y-4">
                {productForecast.slice(0, 8).map((product, index) => (
                  <div
                    key={product.id}
                    className={cn(
                      'p-4 rounded-lg border animate-fade-up',
                      product.coverageDays <= 7 && 'border-destructive/30 bg-destructive/5'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{product.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            product.trend === 'up'
                              ? 'text-success border-success/30'
                              : product.trend === 'down'
                              ? 'text-destructive border-destructive/30'
                              : 'text-muted-foreground'
                          )}
                        >
                          {product.trend === 'up' ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : product.trend === 'down' ? (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          ) : null}
                          {product.currentDemand.toFixed(1)} un/dia
                        </Badge>
                        {product.coverageDays <= 7 && (
                          <Badge className="bg-destructive/20 text-destructive border-0">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Baixo estoque
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Confiança: {product.confidence}%
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Demanda Atual</p>
                        <p className="font-semibold">{product.currentDemand.toFixed(1)} un/dia</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Previsão</p>
                        <p className="font-semibold">{product.forecastDemand} un/dia</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cobertura</p>
                        <p className={cn(
                          'font-semibold',
                          product.coverageDays <= 7 ? 'text-destructive' : ''
                        )}>
                          {product.coverageDays > 100 ? '100+' : product.coverageDays} dias
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sugestão Compra</p>
                        <p className="font-semibold text-primary">{product.suggestedOrder} un</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="seasonality" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Sazonalidade Semanal</h3>
            {seasonalityData.every(d => d.value === 0) ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Dados insuficientes para análise de sazonalidade
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={seasonalityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => [
                        name === 'index' ? `${value}%` : `R$ ${value.toLocaleString('pt-BR')}`,
                        name === 'index' ? 'Índice' : 'Faturamento'
                      ]}
                    />
                    <Bar
                      dataKey="index"
                      name="Índice de Vendas"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey={() => 100}
                      name="Média"
                      stroke="hsl(var(--warning))"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            Insights e Recomendações
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {insights.map((insight, index) => (
              <div
                key={index}
                className={cn(
                  'p-4 rounded-lg border animate-fade-up',
                  insight.type === 'positive' && 'border-success/30 bg-success/5',
                  insight.type === 'warning' && 'border-warning/30 bg-warning/5',
                  insight.type === 'info' && 'border-primary/30 bg-primary/5'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <h4 className="font-medium mb-1">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                <Button variant="outline" size="sm" className="w-full">
                  {insight.action}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
