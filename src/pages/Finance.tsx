import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Download,
  FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KPICard } from '@/components/dashboard/KPICard';
import { useFinanceKPIs, useDailyCashFlow, useFinanceTransactions } from '@/hooks/useFinanceData';
import { useFilters } from '@/hooks/useFilters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { FinanceCashFlowChart } from '@/components/finance/FinanceCashFlowChart';
import { FinanceTransactionsList } from '@/components/finance/FinanceTransactionsList';
import { FinancePaymentMethodsChart } from '@/components/finance/FinancePaymentMethodsChart';
import { FinanceExpensesCategoryChart } from '@/components/finance/FinanceExpensesCategoryChart';
import { exportTransactionsToCSV, generatePDFContent, printPDF, formatCurrency } from '@/lib/exportUtils';

const sourceModuleLabels: Record<string, string> = {
  sales: 'Vendas',
  wallet: 'Carteira',
  stock: 'Estoque',
  expense: 'Despesa',
  payroll: 'Salário',
};

export default function Finance() {
  const { filters } = useFilters();
  
  // Use proper ISO timestamps with timezone for correct date filtering
  const startDate = filters.dateRange.from 
    ? new Date(filters.dateRange.from.setHours(0, 0, 0, 0)).toISOString()
    : new Date(subDays(new Date(), 30).setHours(0, 0, 0, 0)).toISOString();
  const endDate = filters.dateRange.to 
    ? new Date(filters.dateRange.to.setHours(23, 59, 59, 999)).toISOString()
    : new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useFinanceKPIs(startDate, endDate);
  const { data: cashFlow, isLoading: cashFlowLoading } = useDailyCashFlow(startDate, endDate);
  const { data: transactions, isLoading: txLoading } = useFinanceTransactions(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const periodDisplay = useMemo(() => {
    if (filters.dateRange.from && filters.dateRange.to) {
      return `${format(filters.dateRange.from, 'dd/MM', { locale: ptBR })} - ${format(filters.dateRange.to, 'dd/MM', { locale: ptBR })}`;
    }
    return 'Últimos 30 dias';
  }, [filters.dateRange]);

  const handleExportCSV = () => {
    const rows = (transactions || []).map(tx => ({
      data: format(new Date(tx.transaction_date), 'dd/MM/yyyy HH:mm'),
      tipo: tx.type === 'IN' ? 'Entrada' : 'Saída',
      valor: formatCurrency(tx.amount),
      metodo: tx.payment_method?.name || '-',
      origem: sourceModuleLabels[tx.source_module] || tx.source_module,
      descricao: tx.description || '-',
    }));
    
    exportTransactionsToCSV(rows, {
      filename: `financeiro_${startDate}_${endDate}`,
      title: 'Visão Geral Financeira',
      period: periodDisplay,
    });
  };

  const handleExportPDF = () => {
    const tableRows = (transactions || []).map(tx => `
      <tr>
        <td>${format(new Date(tx.transaction_date), 'dd/MM/yyyy')}</td>
        <td class="${tx.type === 'IN' ? 'positive' : 'negative'}">${tx.type === 'IN' ? 'Entrada' : 'Saída'}</td>
        <td>${tx.description || '-'}</td>
        <td class="${tx.type === 'IN' ? 'positive' : 'negative'}">${formatCurrency(tx.amount)}</td>
      </tr>
    `).join('');

    const summaryHtml = `
      <h2 style="font-size: 14px; margin-bottom: 10px;">Resumo do Período</h2>
      <table style="width: 50%; margin-bottom: 20px;">
        <tr><td><strong>Entradas</strong></td><td class="positive">${formatCurrency(kpis?.totalIncome || 0)}</td></tr>
        <tr><td><strong>Saídas</strong></td><td class="negative">${formatCurrency(kpis?.totalExpenses || 0)}</td></tr>
        <tr class="total"><td><strong>Resultado</strong></td><td>${formatCurrency(kpis?.periodResult || 0)}</td></tr>
      </table>
      <h2 style="font-size: 14px; margin-bottom: 10px;">Movimentações</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Descrição</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;

    const htmlContent = generatePDFContent('Visão Geral Financeira', periodDisplay, summaryHtml);
    printPDF(htmlContent);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral das finanças • {periodDisplay}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF (Imprimir)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => refetchKpis()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DashboardFilters />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Entradas"
          value={formatCurrency(kpis?.totalIncome || 0)}
          icon={<ArrowUpCircle className="h-5 w-5" />}
          className="border-l-4 border-l-green-500"
        />
        <KPICard
          title="Saídas"
          value={formatCurrency(kpis?.totalExpenses || 0)}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          className="border-l-4 border-l-red-500"
        />
        <KPICard
          title="Saldo do Caixa"
          value={formatCurrency(kpis?.cashBalance || 0)}
          icon={<Wallet className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
        <KPICard
          title="Resultado do Período"
          value={formatCurrency(kpis?.periodResult || 0)}
          icon={kpis?.periodResult && kpis.periodResult >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          className={`border-l-4 ${kpis?.periodResult && kpis.periodResult >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}
        />
      </div>

      {/* Receivables and Payables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="A Receber (Aberto)"
          value={formatCurrency(kpis?.receivablesOpen || 0)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KPICard
          title="A Receber (Vencido)"
          value={formatCurrency(kpis?.receivablesOverdue || 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={kpis?.receivablesOverdue && kpis.receivablesOverdue > 0 ? 'border-l-4 border-l-amber-500' : ''}
        />
        <KPICard
          title="A Pagar (Aberto)"
          value={formatCurrency(kpis?.payablesOpen || 0)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <KPICard
          title="A Pagar (Vencido)"
          value={formatCurrency(kpis?.payablesOverdue || 0)}
          icon={<AlertTriangle className="h-5 w-5" />}
          className={kpis?.payablesOverdue && kpis.payablesOverdue > 0 ? 'border-l-4 border-l-red-500' : ''}
        />
      </div>

      {/* Charts and Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Fluxo de Caixa Diário</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceCashFlowChart data={cashFlow || []} isLoading={cashFlowLoading} />
          </CardContent>
        </Card>

        {/* Income by Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Entradas por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancePaymentMethodsChart 
              transactions={(transactions || []).filter(t => t.type === 'IN')} 
              isLoading={txLoading} 
            />
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Saídas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceExpensesCategoryChart 
              transactions={(transactions || []).filter(t => t.type === 'OUT')} 
              isLoading={txLoading} 
            />
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Últimas Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceTransactionsList 
              transactions={(transactions || []).slice(0, 10)} 
              isLoading={txLoading} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
