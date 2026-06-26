import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FinanceTransaction } from '@/types/finance';

interface Props {
  transactions: FinanceTransaction[];
  isLoading: boolean;
}

const sourceModuleLabels: Record<string, string> = {
  sales: 'Vendas',
  wallet: 'Carteira',
  stock: 'Estoque',
  expense: 'Despesa',
  payroll: 'Salário',
};

export function FinanceTransactionsList({ transactions, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground">
        Nenhuma movimentação no período
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto">
      {transactions.map((tx) => (
        <div 
          key={tx.id} 
          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {tx.type === 'IN' ? (
              <ArrowUpCircle className="h-5 w-5 text-green-500" />
            ) : (
              <ArrowDownCircle className="h-5 w-5 text-red-500" />
            )}
            <div>
              <p className="text-sm font-medium">
                {tx.description || sourceModuleLabels[tx.source_module] || 'Movimentação'}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.transaction_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {tx.payment_method && ` • ${tx.payment_method.name}`}
              </p>
            </div>
          </div>
          <span className={`text-sm font-semibold ${tx.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
            {tx.type === 'IN' ? '+' : '-'}{formatCurrency(tx.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
