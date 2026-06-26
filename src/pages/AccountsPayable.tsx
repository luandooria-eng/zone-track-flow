import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Download,
  FileText
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KPICard } from '@/components/dashboard/KPICard';
import { useApBills, usePayApBill } from '@/hooks/useFinanceData';
import { usePaymentMethods } from '@/hooks/useCreditData';
import { NewApBillModal } from '@/components/finance/NewApBillModal';
import { PayBillModal } from '@/components/finance/PayBillModal';
import { exportApBillsToCSV, generatePDFContent, printPDF, formatCurrency } from '@/lib/exportUtils';
import type { ApBill } from '@/types/finance';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  open: { label: 'Aberto', variant: 'secondary', icon: Clock },
  paid: { label: 'Pago', variant: 'default', icon: CheckCircle },
  overdue: { label: 'Vencido', variant: 'destructive', icon: AlertTriangle },
};

export default function AccountsPayable() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isNewBillOpen, setIsNewBillOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<ApBill | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const { data: bills, isLoading } = useApBills(statusFilter);
  const { data: paymentMethods } = usePaymentMethods();
  const payBill = usePayApBill();

  const filteredBills = (bills || []).filter(bill => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      bill.vendor?.name?.toLowerCase().includes(searchLower) ||
      bill.category?.name?.toLowerCase().includes(searchLower) ||
      bill.notes?.toLowerCase().includes(searchLower)
    );
  });

  // Mark overdue bills
  const today = new Date().toISOString().split('T')[0];
  const processedBills = filteredBills.map(bill => ({
    ...bill,
    status: bill.status === 'open' && bill.due_date < today ? 'overdue' : bill.status,
  }));

  const totals = {
    open: processedBills.filter(b => b.status === 'open').reduce((sum, b) => sum + Number(b.amount), 0),
    overdue: processedBills.filter(b => b.status === 'overdue').reduce((sum, b) => sum + Number(b.amount), 0),
    paid: processedBills.filter(b => b.status === 'paid').reduce((sum, b) => sum + Number(b.amount), 0),
  };

  const handlePayBill = (bill: ApBill) => {
    setSelectedBill(bill);
    setIsPayModalOpen(true);
  };

  const confirmPayment = (paymentMethodId: string) => {
    if (selectedBill) {
      payBill.mutate({ billId: selectedBill.id, paymentMethodId });
      setIsPayModalOpen(false);
      setSelectedBill(null);
    }
  };

  const handleExportCSV = () => {
    const rows = processedBills.map(bill => ({
      vencimento: format(new Date(bill.due_date), 'dd/MM/yyyy'),
      fornecedor: bill.vendor?.name || '-',
      categoria: bill.category?.name || '-',
      valor: formatCurrency(bill.amount),
      status: statusConfig[bill.status]?.label || bill.status,
      pago_em: bill.paid_at ? format(new Date(bill.paid_at), 'dd/MM/yyyy') : '-',
    }));
    
    exportApBillsToCSV(rows, {
      filename: 'contas_a_pagar',
      title: 'Contas a Pagar',
      period: 'Todas as contas',
    });
  };

  const handleExportPDF = () => {
    const tableRows = processedBills.map(bill => `
      <tr>
        <td>${format(new Date(bill.due_date), 'dd/MM/yyyy')}</td>
        <td>${bill.vendor?.name || '-'}</td>
        <td>${bill.category?.name || '-'}</td>
        <td>${formatCurrency(bill.amount)}</td>
        <td>${statusConfig[bill.status]?.label || bill.status}</td>
        <td>${bill.paid_at ? format(new Date(bill.paid_at), 'dd/MM/yyyy') : '-'}</td>
      </tr>
    `).join('');

    const tableHtml = `
      <table>
        <thead>
          <tr>
            <th>Vencimento</th>
            <th>Fornecedor</th>
            <th>Categoria</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Pago em</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr class="total">
            <td colspan="3">Total em Aberto</td>
            <td colspan="3">${formatCurrency(totals.open)}</td>
          </tr>
          <tr class="total">
            <td colspan="3">Total Vencido</td>
            <td colspan="3">${formatCurrency(totals.overdue)}</td>
          </tr>
        </tfoot>
      </table>
    `;

    const htmlContent = generatePDFContent('Contas a Pagar', 'Todas as contas', tableHtml);
    printPDF(htmlContent);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie despesas, compras e salários
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
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
          <Button onClick={() => setIsNewBillOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Em Aberto"
          value={formatCurrency(totals.open)}
          icon={<Clock className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
        <KPICard
          title="Vencido"
          value={formatCurrency(totals.overdue)}
          icon={<AlertTriangle className="h-5 w-5" />}
          className="border-l-4 border-l-red-500"
        />
        <KPICard
          title="Pago (período)"
          value={formatCurrency(totals.paid)}
          icon={<CheckCircle className="h-5 w-5" />}
          className="border-l-4 border-l-green-500"
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
                  placeholder="Buscar por fornecedor, categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Em Aberto</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
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
                <TableHead>Vencimento</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedBills.map((bill) => {
                const status = statusConfig[bill.status] || statusConfig.open;
                const StatusIcon = status.icon;
                
                return (
                  <TableRow key={bill.id}>
                    <TableCell>
                      {format(new Date(bill.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>{bill.vendor?.name || '-'}</TableCell>
                    <TableCell>{bill.category?.name || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {bill.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(bill.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {bill.status !== 'paid' && (
                            <DropdownMenuItem onClick={() => handlePayBill(bill)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marcar como Pago
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {processedBills.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <NewApBillModal open={isNewBillOpen} onOpenChange={setIsNewBillOpen} />
      <PayBillModal
        open={isPayModalOpen}
        onOpenChange={setIsPayModalOpen}
        bill={selectedBill}
        paymentMethods={paymentMethods || []}
        onConfirm={confirmPayment}
        isLoading={payBill.isPending}
      />
    </div>
  );
}
