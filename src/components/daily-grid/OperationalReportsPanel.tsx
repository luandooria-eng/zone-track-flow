import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  XCircle,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  ArrowDownCircle,
  ArrowUpCircle,
  Calculator,
  Wallet,
  Banknote,
  CreditCard
} from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface OperationalReportsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: string;
}

interface PaymentMethodBalance {
  id: string;
  name: string;
  salesIncome: number;
  otherIncome: number;
  expenses: number;
  expectedBalance: number;
}

export function OperationalReportsPanel({ open, onOpenChange, selectedDate }: OperationalReportsPanelProps) {
  const { rows, getErrorRows } = useDailyGridStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const reportDate = selectedDate || new Date().toISOString().split('T')[0];

  // Fetch orders (sales) for the selected date
  const { data: ordersData, refetch: refetchOrders } = useQuery({
    queryKey: ['daily-orders-report', reportDate],
    queryFn: async () => {
      const startOfDay = `${reportDate}T00:00:00`;
      const endOfDay = `${reportDate}T23:59:59`;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          status,
          payment_method_id,
          payment_method:payment_methods(id, name)
        `)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .in('status', ['delivered', 'sent', 'preparing', 'accepted']);
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch finance transactions for the selected date
  const { data: financeTransactions, refetch: refetchTransactions } = useQuery({
    queryKey: ['daily-finance-report', reportDate],
    queryFn: async () => {
      const startOfDay = `${reportDate}T00:00:00`;
      const endOfDay = `${reportDate}T23:59:59`;
      
      const { data, error } = await supabase
        .from('finance_transactions')
        .select(`
          *,
          payment_method:payment_methods(id, name)
        `)
        .gte('transaction_date', startOfDay)
        .lte('transaction_date', endOfDay)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch all payment methods
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Calculate cash balance stats by payment method
  const cashStats = useMemo(() => {
    const paymentBalances: Record<string, PaymentMethodBalance> = {};
    
    // Initialize payment methods
    paymentMethods?.forEach(pm => {
      paymentBalances[pm.id] = {
        id: pm.id,
        name: pm.name,
        salesIncome: 0,
        otherIncome: 0,
        expenses: 0,
        expectedBalance: 0
      };
    });
    
    // Add income from orders (sales)
    ordersData?.forEach(order => {
      if (order.payment_method_id && paymentBalances[order.payment_method_id]) {
        paymentBalances[order.payment_method_id].salesIncome += Number(order.total);
      }
    });
    
    // Add income and expenses from finance_transactions
    financeTransactions?.forEach(tx => {
      const pmId = tx.payment_method_id;
      if (pmId && paymentBalances[pmId]) {
        if (tx.type === 'IN') {
          paymentBalances[pmId].otherIncome += Number(tx.amount);
        } else {
          paymentBalances[pmId].expenses += Number(tx.amount);
        }
      }
    });
    
    // Calculate expected balance for each
    Object.values(paymentBalances).forEach(pm => {
      pm.expectedBalance = pm.salesIncome + pm.otherIncome - pm.expenses;
    });
    
    // Filter to only show payment methods with activity
    const activePayments = Object.values(paymentBalances).filter(
      pm => pm.salesIncome > 0 || pm.otherIncome > 0 || pm.expenses > 0
    );
    
    // Calculate totals
    const totalSalesIncome = ordersData?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
    const totalOtherIncome = financeTransactions?.filter(t => t.type === 'IN').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalExpenses = financeTransactions?.filter(t => t.type === 'OUT').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalIncome = totalSalesIncome + totalOtherIncome;
    const expectedBalance = totalIncome - totalExpenses;
    
    // Get expense transactions for detail listing
    const expenseTransactions = financeTransactions?.filter(t => t.type === 'OUT') || [];
    
    return {
      paymentBalances: activePayments,
      totalSalesIncome,
      totalOtherIncome,
      totalIncome,
      totalExpenses,
      expectedBalance,
      expenseTransactions,
      orderCount: ordersData?.length || 0
    };
  }, [ordersData, financeTransactions, paymentMethods]);

  const stats = useMemo(() => {
    const totalRows = rows.length;
    const filledRows = rows.filter(r => r.customerName && r.productName).length;
    const errorRows = getErrorRows();
    const savedRows = rows.filter(r => r.rowStatus === 'saved').length;
    const pendingRows = rows.filter(r => r.isDirty).length;
    
    const totalValue = rows.reduce((sum, r) => sum + (r.value || 0), 0);
    const totalQuantity = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    
    const uniqueCustomers = new Set(rows.filter(r => r.customerName).map(r => r.customerName)).size;
    
    // Product breakdown
    const productBreakdown = rows.reduce((acc, r) => {
      if (r.productName) {
        acc[r.productName] = (acc[r.productName] || 0) + r.quantity;
      }
      return acc;
    }, {} as Record<string, number>);
    
    // Status breakdown
    const statusBreakdown = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Payment method breakdown
    const paymentBreakdown = rows.reduce((acc, r) => {
      if (r.paymentMethod) {
        acc[r.paymentMethod] = (acc[r.paymentMethod] || 0) + r.value;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRows,
      filledRows,
      errorCount: errorRows.length,
      savedRows,
      pendingRows,
      totalValue,
      totalQuantity,
      uniqueCustomers,
      productBreakdown,
      statusBreakdown,
      paymentBreakdown,
      fillRate: totalRows > 0 ? (filledRows / totalRows) * 100 : 0,
      saveRate: totalRows > 0 ? (savedRows / totalRows) * 100 : 0,
    };
  }, [rows, getErrorRows]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchOrders(), refetchTransactions()]);
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Relatório Operacional
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ============ CONFERÊNCIA DE CAIXA ============ */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Conferência de Caixa
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Resumo financeiro do dia {new Date(reportDate).toLocaleDateString('pt-BR')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Resumo Geral */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-success/10 rounded-lg p-3 text-center">
                  <ArrowDownCircle className="h-4 w-4 mx-auto mb-1 text-success" />
                  <p className="text-xs text-muted-foreground">Entradas</p>
                  <p className="text-sm font-bold text-success">{formatCurrency(cashStats.totalIncome)}</p>
                </div>
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <ArrowUpCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="text-sm font-bold text-destructive">{formatCurrency(cashStats.totalExpenses)}</p>
                </div>
                <div className={cn(
                  "rounded-lg p-3 text-center",
                  cashStats.expectedBalance >= 0 ? "bg-primary/10" : "bg-warning/10"
                )}>
                  <Wallet className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className={cn(
                    "text-sm font-bold",
                    cashStats.expectedBalance >= 0 ? "text-primary" : "text-warning"
                  )}>
                    {formatCurrency(cashStats.expectedBalance)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* ===== SALDO POR FORMA DE PAGAMENTO ===== */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Saldo por Forma de Pagamento
                </h4>
                
                {cashStats.paymentBalances.length > 0 ? (
                  <div className="space-y-2">
                    {cashStats.paymentBalances.map(pm => (
                      <div 
                        key={pm.id} 
                        className={cn(
                          "rounded-lg p-3 border",
                          pm.name.toLowerCase().includes('dinheiro') && "bg-success/5 border-success/30"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm flex items-center gap-2">
                            {pm.name.toLowerCase().includes('dinheiro') && <Banknote className="h-4 w-4 text-success" />}
                            {pm.name}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "font-bold",
                              pm.expectedBalance >= 0 ? "text-success border-success/50" : "text-destructive border-destructive/50"
                            )}
                          >
                            {formatCurrency(pm.expectedBalance)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="block">Vendas</span>
                            <span className="text-success font-medium">+{formatCurrency(pm.salesIncome)}</span>
                          </div>
                          {pm.otherIncome > 0 && (
                            <div>
                              <span className="block">Outras</span>
                              <span className="text-success font-medium">+{formatCurrency(pm.otherIncome)}</span>
                            </div>
                          )}
                          <div>
                            <span className="block">Saídas</span>
                            <span className="text-destructive font-medium">-{formatCurrency(pm.expenses)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 italic">
                    Nenhuma movimentação registrada
                  </p>
                )}
              </div>

              <Separator />

              {/* Detalhamento de Saídas */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-destructive">
                  <ArrowUpCircle className="h-4 w-4" />
                  Saídas Detalhadas
                </h4>
                
                {cashStats.expenseTransactions.length > 0 ? (
                  <div className="space-y-1">
                    {cashStats.expenseTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm border-l-2 border-destructive/20 pl-3 py-1">
                        <div className="flex-1">
                          <p className="text-foreground truncate max-w-[200px]">
                            {tx.description || 'Saída'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.payment_method?.name || 'Sem forma de pagamento'}
                          </p>
                        </div>
                        <span className="text-destructive font-medium">
                          -{formatCurrency(Number(tx.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic pl-3">
                    Nenhuma saída registrada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPIs principais */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-sm text-muted-foreground">Vendas do Dia</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(cashStats.totalSalesIncome)}
                </p>
                <p className="text-xs text-muted-foreground">{cashStats.orderCount} pedidos</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Quantidade</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.totalQuantity}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Clientes</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.uniqueCustomers}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Pedidos Grid</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.filledRows}</p>
              </CardContent>
            </Card>
          </div>

          {/* Status das linhas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status do Grid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Salvos
                  </span>
                  <span>{stats.savedRows} / {stats.totalRows}</span>
                </div>
                <Progress value={stats.saveRate} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-warning" />
                    Pendentes
                  </span>
                  <span>{stats.pendingRows}</span>
                </div>
              </div>
              
              {stats.errorCount > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Com erros
                    </span>
                    <Badge variant="destructive">{stats.errorCount}</Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown por produto */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Por Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.productBreakdown).length > 0 ? (
                  Object.entries(stats.productBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([product, qty]) => (
                      <div key={product} className="flex items-center justify-between">
                        <span className="text-sm">{product}</span>
                        <Badge variant="secondary">{qty} un</Badge>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum produto registrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Breakdown por status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Por Status do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.statusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm">{status}</span>
                    <Badge 
                      variant="outline"
                      className={cn(
                        status === 'Entregue' && 'bg-success/10 text-success border-success/30',
                        status === 'Cancelado' && 'bg-destructive/10 text-destructive border-destructive/30'
                      )}
                    >
                      {count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Breakdown por forma de pagamento */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Por Forma de Pagamento (Grid)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(stats.paymentBreakdown).length > 0 ? (
                  Object.entries(stats.paymentBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([method, value]) => (
                      <div key={method} className="flex items-center justify-between">
                        <span className="text-sm">{method}</span>
                        <span className="text-sm font-medium">
                          {formatCurrency(value)}
                        </span>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum pagamento registrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
