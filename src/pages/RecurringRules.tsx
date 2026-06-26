import { useState } from 'react';
import { 
  Plus, 
  Search, 
  RefreshCw,
  Calendar,
  Repeat,
  DollarSign,
  MoreHorizontal,
  Play
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
import { useRecurringRules, useGenerateRecurringBills } from '@/hooks/useFinanceData';
import { NewRecurringRuleModal } from '@/components/finance/NewRecurringRuleModal';

const typeLabels: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
  expense: { label: 'Despesa Fixa', variant: 'secondary' },
  payroll: { label: 'Salário', variant: 'default' },
};

export default function RecurringRules() {
  const [search, setSearch] = useState('');
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);

  const { data: rules, isLoading } = useRecurringRules();
  const generateBills = useGenerateRecurringBills();

  const filteredRules = (rules || []).filter(rule => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      rule.name.toLowerCase().includes(searchLower) ||
      rule.category?.name?.toLowerCase().includes(searchLower)
    );
  });

  const activeRules = filteredRules.filter(r => r.is_active);
  const totalMonthly = activeRules.reduce((sum, r) => sum + Number(r.amount_default), 0);
  const expenseTotal = activeRules
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + Number(r.amount_default), 0);
  const payrollTotal = activeRules
    .filter(r => r.type === 'payroll')
    .reduce((sum, r) => sum + Number(r.amount_default), 0);

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
          <h1 className="text-2xl font-bold text-foreground">Recorrências</h1>
          <p className="text-sm text-muted-foreground">
            Despesas fixas e salários mensais
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => generateBills.mutate()}
            disabled={generateBills.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            {generateBills.isPending ? 'Gerando...' : 'Gerar Contas do Mês'}
          </Button>
          <Button onClick={() => setIsNewRuleOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Recorrência
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Mensal"
          value={formatCurrency(totalMonthly)}
          icon={<Repeat className="h-5 w-5" />}
          className="border-l-4 border-l-blue-500"
        />
        <KPICard
          title="Despesas Fixas"
          value={formatCurrency(expenseTotal)}
          icon={<Calendar className="h-5 w-5" />}
        />
        <KPICard
          title="Salários"
          value={formatCurrency(payrollTotal)}
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou categoria..."
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
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Dia do Vencimento</TableHead>
                <TableHead className="text-right">Valor Padrão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRules.map((rule) => {
                const typeConfig = typeLabels[rule.type] || typeLabels.expense;
                
                return (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant={typeConfig.variant}>
                        {typeConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{rule.category?.name || '-'}</TableCell>
                    <TableCell>{rule.vendor?.name || '-'}</TableCell>
                    <TableCell>Dia {rule.day_of_month}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(rule.amount_default)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Ativo' : 'Inativo'}
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
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem>
                            {rule.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma recorrência encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      <NewRecurringRuleModal open={isNewRuleOpen} onOpenChange={setIsNewRuleOpen} />
    </div>
  );
}
