import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Building2,
  Phone,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KPICard } from '@/components/dashboard/KPICard';
import { useVendors, useApBills } from '@/hooks/useFinanceData';
import { NewVendorModal } from '@/components/finance/NewVendorModal';

export default function Vendors() {
  const [search, setSearch] = useState('');
  const [isNewVendorOpen, setIsNewVendorOpen] = useState(false);

  const { data: vendors, isLoading } = useVendors();
  const { data: allBills } = useApBills();

  const filteredVendors = (vendors || []).filter(vendor => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      vendor.name.toLowerCase().includes(searchLower) ||
      vendor.document?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate vendor stats
  const vendorStats = filteredVendors.map(vendor => {
    const vendorBills = (allBills || []).filter(b => b.vendor_id === vendor.id);
    const openBills = vendorBills.filter(b => b.status === 'open' || b.status === 'overdue');
    const overdueBills = vendorBills.filter(b => b.status === 'overdue');
    const paidBills = vendorBills.filter(b => b.status === 'paid');

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyPurchases = paidBills
      .filter(b => {
        const paidDate = b.paid_at ? new Date(b.paid_at) : null;
        return paidDate && paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      })
      .reduce((sum, b) => sum + Number(b.amount), 0);

    return {
      ...vendor,
      totalOpen: openBills.reduce((sum, b) => sum + Number(b.amount), 0),
      totalOverdue: overdueBills.reduce((sum, b) => sum + Number(b.amount), 0),
      monthlyPurchases,
      billsCount: vendorBills.length,
    };
  });

  const totals = {
    vendors: vendorStats.length,
    totalOpen: vendorStats.reduce((sum, v) => sum + v.totalOpen, 0),
    totalOverdue: vendorStats.reduce((sum, v) => sum + v.totalOverdue, 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro e gestão de fornecedores
          </p>
        </div>
        <Button onClick={() => setIsNewVendorOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total de Fornecedores"
          value={totals.vendors.toString()}
          icon={<Building2 className="h-5 w-5" />}
        />
        <KPICard
          title="Total a Pagar"
          value={formatCurrency(totals.totalOpen)}
          icon={<FileText className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
        <KPICard
          title="Total Vencido"
          value={formatCurrency(totals.totalOverdue)}
          icon={<FileText className="h-5 w-5" />}
          className={totals.totalOverdue > 0 ? 'border-l-4 border-l-red-500' : ''}
        />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Prazo Padrão</TableHead>
                <TableHead className="text-right">Compras no Mês</TableHead>
                <TableHead className="text-right">A Pagar</TableHead>
                <TableHead className="text-right">Vencido</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorStats.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">{vendor.name}</TableCell>
                  <TableCell>{vendor.document || '-'}</TableCell>
                  <TableCell>{vendor.phone || '-'}</TableCell>
                  <TableCell>{vendor.default_terms} dias</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(vendor.monthlyPurchases)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(vendor.totalOpen)}
                  </TableCell>
                  <TableCell className="text-right">
                    {vendor.totalOverdue > 0 ? (
                      <span className="text-red-600 font-medium">
                        {formatCurrency(vendor.totalOverdue)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Ver Histórico</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {vendorStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum fornecedor encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      <NewVendorModal open={isNewVendorOpen} onOpenChange={setIsNewVendorOpen} />
    </div>
  );
}
