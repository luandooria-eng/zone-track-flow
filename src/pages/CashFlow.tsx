import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Search, 
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KPICard } from '@/components/dashboard/KPICard';
import { useFinanceTransactions } from '@/hooks/useFinanceData';
import { useFilters } from '@/hooks/useFilters';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';

const sourceModuleLabels: Record<string, string> = {
  sales: 'Vendas',
  wallet: 'Carteira',
  stock: 'Estoque',
  expense: 'Despesa',
  payroll: 'Salário',
};

export default function CashFlow() {
  const { filters } = useFilters();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Use start of day in local timezone and convert to ISO for proper filtering
  const startDate = filters.dateRange.from 
    ? new Date(filters.dateRange.from.setHours(0, 0, 0, 0)).toISOString()
    : new Date(subDays(new Date(), 30).setHours(0, 0, 0, 0)).toISOString();
  const endDate = filters.dateRange.to 
    ? new Date(filters.dateRange.to.setHours(23, 59, 59, 999)).toISOString()
    : new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const { data: transactions, isLoading } = useFinanceTransactions(startDate, endDate);

  const filteredTransactions = (transactions || []).filter(tx => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(searchLower) ||
      tx.payment_method?.name?.toLowerCase().includes(searchLower) ||
      sourceModuleLabels[tx.source_module]?.toLowerCase().includes(searchLower)
    );
  });

  const totals = {
    income: filteredTransactions
      .filter(tx => tx.type === 'IN')
      .reduce((sum, tx) => sum + Number(tx.amount), 0),
    expenses: filteredTransactions
      .filter(tx => tx.type === 'OUT')
      .reduce((sum, tx) => sum + Number(tx.amount), 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleExport = () => {
    const csvContent = [
      ['Data', 'Tipo', 'Descrição', 'Origem', 'Forma de Pagamento', 'Valor'].join(','),
      ...filteredTransactions.map(tx => [
        format(new Date(tx.transaction_date), 'dd/MM/yyyy HH:mm'),
        tx.type === 'IN' ? 'Entrada' : 'Saída',
        `"${tx.description || '-'}"`,
        sourceModuleLabels[tx.source_module] || tx.source_module,
        tx.payment_method?.name || '-',
        tx.amount,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `caixa_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Extrato de movimentações financeiras
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <DashboardFilters />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total de Entradas"
          value={formatCurrency(totals.income)}
          icon={<ArrowUpCircle className="h-5 w-5" />}
          className="border-l-4 border-l-green-500"
        />
        <KPICard
          title="Total de Saídas"
          value={formatCurrency(totals.expenses)}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          className="border-l-4 border-l-red-500"
        />
        <KPICard
          title="Saldo do Período"
          value={formatCurrency(totals.income - totals.expenses)}
          icon={totals.income >= totals.expenses ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
          className={`border-l-4 ${totals.income >= totals.expenses ? 'border-l-green-500' : 'border-l-red-500'}`}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição, origem..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="IN">Entradas</SelectItem>
                <SelectItem value="OUT">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Forma de Pagamento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    {format(new Date(tx.transaction_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {tx.type === 'IN' ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                        Entrada
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
                        <ArrowDownCircle className="h-3 w-3 mr-1" />
                        Saída
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate">
                    {tx.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {sourceModuleLabels[tx.source_module] || tx.source_module}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.payment_method?.name || '-'}</TableCell>
                  <TableCell className={`text-right font-medium ${tx.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredTransactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
