import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DREDetailedTransaction, DRECategoryBreakdown } from '@/hooks/useDREData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  transactions: DREDetailedTransaction[];
  categoryBreakdown?: DRECategoryBreakdown[];
  selectedCategory?: string | null;
}

const sourceModuleLabels: Record<string, string> = {
  expense: 'Despesas Fixas',
  payroll: 'Salários',
  stock: 'Compras/Estoque',
  sales: 'Vendas',
  wallet: 'Carteira',
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(value));
};

export function DREDrilldownDrawer({ 
  open, 
  onOpenChange, 
  title, 
  transactions,
  categoryBreakdown,
  selectedCategory 
}: Props) {
  const filteredTransactions = selectedCategory 
    ? transactions.filter(t => t.sourceModule === selectedCategory)
    : transactions;

  const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        {/* Category summary if available */}
        {categoryBreakdown && categoryBreakdown.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3">Por Categoria</h3>
            <div className="space-y-2">
              {categoryBreakdown.map((cat, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    selectedCategory === cat.sourceModule 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div>
                    <span className="font-medium">{cat.category}</span>
                    <span className="text-muted-foreground ml-2 text-sm">
                      ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <span className="font-mono font-semibold">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="mb-4 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total</span>
            <span className={`font-mono font-bold text-lg ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Transactions list */}
        <div>
          <h3 className="text-sm font-semibold mb-3">
            Lançamentos ({filteredTransactions.length})
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.slice(0, 50).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {format(new Date(tx.date), 'dd/MM', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm truncate max-w-[200px]">
                          {tx.description}
                        </span>
                        <Badge variant="outline" className="w-fit text-xs">
                          {sourceModuleLabels[tx.sourceModule] || tx.sourceModule}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {tx.amount >= 0 ? (
                          <ArrowUpCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span className={`font-mono text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTransactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                )}
                {filteredTransactions.length > 50 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">
                      Exibindo 50 de {filteredTransactions.length} lançamentos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
