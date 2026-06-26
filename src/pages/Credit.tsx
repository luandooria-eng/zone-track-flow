import { useState } from 'react';
import {
  Wallet,
  AlertTriangle,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  User,
  MoreVertical,
  CreditCard,
  Search,
  Plus,
  Package,
  ShoppingCart,
  Loader2,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CreditEntryStatus, CreditEntry } from '@/types';
import { CreditEntryDetailDrawer } from '@/components/credit/CreditEntryDetailDrawer';
import { OverdueByCustomerTable } from '@/components/credit/OverdueByCustomerTable';
import { useCreditEntries, useCreditKPIs } from '@/hooks/useCreditData';

const statusConfig: Record<CreditEntryStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning-bg text-warning border-warning/30' },
  paid: { label: 'Pago', className: 'bg-success-bg text-success border-success/30' },
  partial: { label: 'Parcial', className: 'bg-primary/20 text-primary border-primary/30' },
  overdue: { label: 'Vencido', className: 'bg-destructive-bg text-destructive border-destructive/30' },
  renegotiated: { label: 'Renegociado', className: 'bg-muted text-muted-foreground border-muted-foreground/30' },
};

const orderStatusLabel: Record<string, string> = {
  accepted: 'Aceito',
  sent: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
};

export default function Credit() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedEntry, setSelectedEntry] = useState<CreditEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch real data from Supabase
  const { data: creditEntries = [], isLoading, error } = useCreditEntries();
  
  // Calculate KPIs from real data
  const { totalOpen, dueIn7Days, overdue, overdueRate, overdueEntries, pendingEntries } = useCreditKPIs(creditEntries);

  const filteredEntries = creditEntries.filter(
    (entry) =>
      entry.customerName.toLowerCase().includes(search.toLowerCase()) ||
      entry.id.includes(search)
  );

  const dueSoonEntries = creditEntries.filter((e) => {
    if (e.status !== 'pending') return false;
    const daysUntilDue = differenceInDays(e.dueDate, new Date());
    return daysUntilDue <= 7 && daysUntilDue >= 0;
  });

  const openEntryDetail = (entry: CreditEntry) => {
    setSelectedEntry(entry);
    setDrawerOpen(true);
  };

  // Helper to format items summary
  const formatItemsSummary = (entry: CreditEntry): string => {
    if (!entry.order?.items) return '-';
    return entry.order.items.map(item => `${item.productName} (${item.quantity})`).join(', ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando carteira...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <span className="ml-2 text-destructive">Erro ao carregar dados da carteira</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carteira (Crediário)</h1>
          <p className="text-muted-foreground">
            Controle de limites, títulos e pagamentos
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Título
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total em Aberto"
          value={totalOpen}
          prefix="R$ "
          icon={<Wallet className="h-5 w-5" />}
          delay={0}
        />
        <KPICard
          title="A Vencer (7 dias)"
          value={dueIn7Days}
          prefix="R$ "
          icon={<Calendar className="h-5 w-5" />}
          delay={60}
        />
        <KPICard
          title="Vencido"
          value={overdue}
          prefix="R$ "
          icon={<AlertTriangle className="h-5 w-5" />}
          delay={120}
        />
        <KPICard
          title="Inadimplência"
          value={`${overdueRate.toFixed(1)}%`}
          change={0}
          icon={<TrendingUp className="h-5 w-5" />}
          delay={180}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="overdue">Títulos Vencidos</TabsTrigger>
          <TabsTrigger value="entries">Todos os Títulos</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* All Pending Entries Section */}
          <div className="kpi-card">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Todos os Títulos Pendentes</h3>
              <Badge variant="outline" className="bg-warning-bg text-warning">
                {pendingEntries.length} títulos
              </Badge>
            </div>
            <div className="rounded-xl border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor em Aberto</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <CheckCircle className="mx-auto h-8 w-8 text-success/50 mb-2" />
                        <p className="text-muted-foreground">Nenhum título pendente</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingEntries.map((entry, index) => (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openEntryDetail(entry)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{entry.customerName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-warning">
                          R$ {entry.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {format(entry.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig[entry.status].className}>
                            {statusConfig[entry.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEntryDetail(entry)}>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Registrar Pagamento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Overdue Entries Summary */}
            <div className="kpi-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Títulos Vencidos</h3>
                <Badge variant="outline" className="bg-destructive-bg text-destructive">
                  {overdueEntries.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {overdueEntries.slice(0, 4).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive-bg/30 p-3 cursor-pointer hover:bg-destructive-bg/50 transition-colors"
                    onClick={() => openEntryDetail(entry)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{entry.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          Vencido há {Math.abs(differenceInDays(entry.dueDate, new Date()))} dias
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {entry.amount.toFixed(2)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEntryDetail(entry);
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                ))}
                {overdueEntries.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum título vencido
                  </p>
                )}
                {overdueEntries.length > 4 && (
                  <Button variant="ghost" className="w-full" onClick={() => setActiveTab('overdue')}>
                    Ver todos ({overdueEntries.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Due Soon */}
            <div className="kpi-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Próximos a Vencer (7 dias)</h3>
                <Badge variant="outline" className="bg-warning-bg text-warning">
                  {dueSoonEntries.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {dueSoonEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning-bg/30 p-3 cursor-pointer hover:bg-warning-bg/50 transition-colors"
                    onClick={() => openEntryDetail(entry)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10 text-warning">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{entry.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          Vence em {differenceInDays(entry.dueDate, new Date())} dias
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {entry.amount.toFixed(2)}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEntryDetail(entry);
                        }}
                      >
                        Ver Detalhes
                      </Button>
                    </div>
                  </div>
                ))}
                {dueSoonEntries.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum título próximo do vencimento
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Overdue Tab - Grouped by Customer */}
        <TabsContent value="overdue" className="space-y-4">
          <OverdueByCustomerTable 
            overdueEntries={overdueEntries} 
            onOpenEntry={openEntryDetail} 
          />
        </TabsContent>

        {/* All Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead className="text-right">Valor em Aberto</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Wallet className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">
                        Nenhum título de crediário encontrado
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Lance vendas com forma de pagamento "Crediário" para alimentar a carteira
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry, index) => (
                    <TableRow
                      key={entry.id}
                      className={cn(
                        'animate-fade-up cursor-pointer',
                        entry.status === 'overdue' && 'bg-destructive/5'
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => openEntryDetail(entry)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {entry.customerName}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.orderId ? `#${entry.order?.id?.slice(0, 8) || entry.orderId.slice(0, 8)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {entry.originalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {entry.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(entry.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', statusConfig[entry.status].className)}
                        >
                          {statusConfig[entry.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEntryDetail(entry)}>
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            {entry.status !== 'paid' && (
                              <DropdownMenuItem>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Registrar Pagamento
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Renegociar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Entry Detail Drawer */}
      <CreditEntryDetailDrawer
        entry={selectedEntry}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
