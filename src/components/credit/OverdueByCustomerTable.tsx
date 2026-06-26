import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  User,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Package,
  CheckCircle,
  MoreVertical,
  ShoppingCart,
  FileText,
  Calendar,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CreditEntry } from '@/types';
import { useBatchMarkAsPaid, usePaymentMethods } from '@/hooks/useCreditData';

interface GroupedCustomer {
  customerId: string;
  customerName: string;
  totalAmount: number;
  totalProducts: number;
  titleCount: number;
  maxDaysOverdue: number;
  entries: CreditEntry[];
}

interface OverdueByCustomerTableProps {
  overdueEntries: CreditEntry[];
  onOpenEntry: (entry: CreditEntry) => void;
}

const orderStatusLabel: Record<string, string> = {
  accepted: 'Aceito',
  sent: 'Enviado',
  delivered: 'Entregue',
  canceled: 'Cancelado',
};

const ITEMS_PER_PAGE = 10;

export function OverdueByCustomerTable({ overdueEntries, onOpenEntry }: OverdueByCustomerTableProps) {
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

  const { data: paymentMethods = [] } = usePaymentMethods();
  const batchMarkAsPaid = useBatchMarkAsPaid();

  // Group entries by customer
  const groupedByCustomer = useMemo(() => {
    const grouped: Record<string, GroupedCustomer> = {};

    overdueEntries.forEach((entry) => {
      const customerId = entry.customerId;
      
      if (!grouped[customerId]) {
        grouped[customerId] = {
          customerId,
          customerName: entry.customerName,
          totalAmount: 0,
          totalProducts: 0,
          titleCount: 0,
          maxDaysOverdue: 0,
          entries: [],
        };
      }

      grouped[customerId].totalAmount += entry.amount;
      grouped[customerId].titleCount += 1;
      grouped[customerId].entries.push(entry);

      // Count products from order items
      if (entry.order?.items) {
        grouped[customerId].totalProducts += entry.order.items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
      }

      // Track max days overdue
      const daysOverdue = Math.abs(differenceInDays(entry.dueDate, new Date()));
      if (daysOverdue > grouped[customerId].maxDaysOverdue) {
        grouped[customerId].maxDaysOverdue = daysOverdue;
      }
    });

    // Sort by customer name alphabetically
    return Object.values(grouped).sort((a, b) =>
      a.customerName.localeCompare(b.customerName, 'pt-BR')
    );
  }, [overdueEntries]);

  // Pagination
  const totalPages = Math.ceil(groupedByCustomer.length / ITEMS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return groupedByCustomer.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [groupedByCustomer, currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    setExpandedCustomers(new Set());
  };

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const toggleEntrySelection = (entryId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const toggleAllCustomerEntries = (customer: GroupedCustomer, event: React.MouseEvent) => {
    event.stopPropagation();
    const customerEntryIds = customer.entries.map(e => e.id);
    const allSelected = customerEntryIds.every(id => selectedEntries.has(id));
    
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        customerEntryIds.forEach(id => next.delete(id));
      } else {
        customerEntryIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBatchMarkAsPaid = async () => {
    if (selectedEntries.size === 0) return;
    if (!selectedPaymentMethod) return;

    const entriesToPay = overdueEntries
      .filter(e => selectedEntries.has(e.id))
      .map(e => ({
        creditEntryId: e.id,
        customerId: e.customerId,
        amount: e.amount,
        paidAmount: e.paidAmount || 0,
      }));

    await batchMarkAsPaid.mutateAsync({
      entries: entriesToPay,
      paymentMethodId: selectedPaymentMethod,
    });

    setSelectedEntries(new Set());
    setSelectedPaymentMethod('');
  };

  const formatItemsSummary = (entry: CreditEntry): string => {
    if (!entry.order?.items) return '-';
    return entry.order.items.map((item) => `${item.productName} (${item.quantity})`).join(', ');
  };

  const selectedTotal = useMemo(() => {
    return overdueEntries
      .filter(e => selectedEntries.has(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [overdueEntries, selectedEntries]);

  if (overdueEntries.length === 0) {
    return (
      <div className="py-12 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-success/50" />
        <p className="mt-4 text-muted-foreground">Nenhum título vencido</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="rounded-lg border border-muted bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Carteira de Títulos Vencidos:</strong> Os títulos são
          agrupados por cliente, exibindo o valor total em aberto, quantidade de produtos e número
          de títulos vencidos. Clique no cliente para visualizar e gerenciar todos os detalhes
          individualmente. <strong>Selecione títulos para dar baixa em lote.</strong>
        </p>
      </div>

      {/* Batch Actions Bar */}
      {selectedEntries.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4 animate-fade-up">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">
                {selectedEntries.size} título(s) selecionado(s)
              </p>
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-destructive">R$ {selectedTotal.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods
                  .filter(pm => !pm.is_credit)
                  .map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleBatchMarkAsPaid}
              disabled={!selectedPaymentMethod || batchMarkAsPaid.isPending}
              className="gap-2"
            >
              {batchMarkAsPaid.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Marcar como Pago
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedEntries(new Set());
                setSelectedPaymentMethod('');
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Grouped Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-center">Qtd. Produtos</TableHead>
              <TableHead className="text-center">Nº Títulos</TableHead>
              <TableHead className="text-center">Maior Atraso</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCustomers.map((customer, index) => {
              const isExpanded = expandedCustomers.has(customer.customerId);
              const customerEntryIds = customer.entries.map(e => e.id);
              const allSelected = customerEntryIds.every(id => selectedEntries.has(id));
              const someSelected = customerEntryIds.some(id => selectedEntries.has(id));

              return (
                <Collapsible
                  key={customer.customerId}
                  open={isExpanded}
                  onOpenChange={() => toggleCustomer(customer.customerId)}
                  asChild
                >
                  <>
                    {/* Customer Summary Row */}
                    <CollapsibleTrigger asChild>
                      <TableRow
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-muted/50',
                          isExpanded && 'bg-destructive/5 border-b-0'
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => toggleAllCustomerEntries(customer, e)}>
                          <Checkbox
                            checked={allSelected}
                            className={cn(someSelected && !allSelected && 'opacity-50')}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
                              <User className="h-4 w-4 text-destructive" />
                            </div>
                            <span className="font-medium">{customer.customerName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-destructive">
                            R$ {customer.totalAmount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>{customer.totalProducts}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-destructive-bg text-destructive border-destructive/30">
                            <FileText className="h-3 w-3 mr-1" />
                            {customer.titleCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-destructive-bg text-destructive border-destructive/30">
                            {customer.maxDaysOverdue} dias
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
                              <DropdownMenuItem onClick={() => toggleCustomer(customer.customerId)}>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                {isExpanded ? 'Ocultar Títulos' : 'Ver Títulos'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>

                    {/* Expanded Detail Rows */}
                    <CollapsibleContent asChild>
                      <>
                        {customer.entries
                          .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
                          .map((entry) => {
                            const isSelected = selectedEntries.has(entry.id);
                            const purchaseDate = entry.order?.createdAt;

                            return (
                              <TableRow
                                key={entry.id}
                                className={cn(
                                  "bg-muted/30 hover:bg-muted/50 cursor-pointer border-l-4 border-l-destructive/30",
                                  isSelected && "bg-primary/10 border-l-primary"
                                )}
                                onClick={() => onOpenEntry(entry)}
                              >
                                <TableCell></TableCell>
                                <TableCell onClick={(e) => toggleEntrySelection(entry.id, e)}>
                                  <Checkbox checked={isSelected} />
                                </TableCell>
                                <TableCell colSpan={2}>
                                  <div className="flex flex-col gap-1 pl-4">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2 min-w-[160px]">
                                        <AlertTriangle className="h-3 w-3 text-destructive" />
                                        <span className="text-sm">
                                          Venceu {format(entry.dueDate, "dd/MM/yyyy", { locale: ptBR })}
                                        </span>
                                      </div>
                                      <span className="text-sm text-muted-foreground">•</span>
                                      <span className="font-medium text-destructive">
                                        R$ {entry.amount.toFixed(2)}
                                      </span>
                                    </div>
                                    {purchaseDate && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3" />
                                        <span>
                                          Compra em {format(purchaseDate, "dd/MM/yyyy", { locale: ptBR })}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center gap-1 text-sm">
                                    <Package className="h-3 w-3 text-muted-foreground" />
                                    <span className="truncate max-w-[120px]" title={formatItemsSummary(entry)}>
                                      {formatItemsSummary(entry)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-xs text-muted-foreground">
                                    {purchaseDate
                                      ? format(purchaseDate, "dd/MM", { locale: ptBR })
                                      : '-'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {entry.order?.status && (
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-xs',
                                        entry.order.status === 'delivered' && 'bg-success-bg text-success',
                                        entry.order.status === 'canceled' && 'bg-destructive-bg text-destructive'
                                      )}
                                    >
                                      {orderStatusLabel[entry.order.status]}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenEntry(entry);
                                    }}
                                  >
                                    Detalhes
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3">
          <p className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, groupedByCustomer.length)} de{' '}
            {groupedByCustomer.length} clientes
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between rounded-lg border bg-destructive/5 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span>
            <strong className="text-foreground">{groupedByCustomer.length}</strong> clientes com
            títulos vencidos
          </span>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total em aberto</p>
          <p className="text-xl font-bold text-destructive">
            R$ {overdueEntries.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
