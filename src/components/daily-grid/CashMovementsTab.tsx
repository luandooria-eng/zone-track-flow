import { useState, useMemo } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useCreateFinanceTransaction } from '@/hooks/useCreateFinanceTransaction';
import { useExpenseCategories } from '@/hooks/useFinanceData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CashMovementsTabProps {
  selectedDate: string;
}

export function CashMovementsTab({ selectedDate }: CashMovementsTabProps) {
  const [type, setType] = useState<'IN' | 'OUT'>('OUT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');

  const createTransaction = useCreateFinanceTransaction();
  const { data: categories } = useExpenseCategories();
  
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch today's cash movements
  const { data: todayMovements, isLoading } = useQuery({
    queryKey: ['daily-cash-movements', selectedDate],
    queryFn: async () => {
      const startOfDay = `${selectedDate}T00:00:00`;
      const endOfDay = `${selectedDate}T23:59:59`;
      
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
  });

  const todayTotals = useMemo(() => {
    if (!todayMovements) return { income: 0, expenses: 0, balance: 0 };
    
    const income = todayMovements
      .filter(m => m.type === 'IN')
      .reduce((sum, m) => sum + Number(m.amount), 0);
    
    const expenses = todayMovements
      .filter(m => m.type === 'OUT')
      .reduce((sum, m) => sum + Number(m.amount), 0);
    
    return { income, expenses, balance: income - expenses };
  }, [todayMovements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      return;
    }

    // Build description with category if expense
    let fullDescription = description;
    if (type === 'OUT' && categoryId) {
      const category = categories?.find(c => c.id === categoryId);
      if (category) {
        fullDescription = category.name + (description ? `: ${description}` : '');
      }
    }

    await createTransaction.mutateAsync({
      type,
      amount: parseFloat(amount),
      transaction_date: new Date(selectedDate).toISOString(),
      payment_method_id: paymentMethodId || null,
      description: fullDescription || null,
      source_module: type === 'IN' ? 'wallet' : 'expense',
    });

    // Reset form
    setAmount('');
    setDescription('');
    setPaymentMethodId('');
    setCategoryId('');
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Summary Cards */}
      <div className="p-4 border-b bg-card">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-success/10 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-sm font-bold text-success">{formatCurrency(todayTotals.income)}</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="text-sm font-bold text-destructive">{formatCurrency(todayTotals.expenses)}</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${todayTotals.balance >= 0 ? 'bg-primary/10' : 'bg-warning/10'}`}>
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-sm font-bold ${todayTotals.balance >= 0 ? 'text-primary' : 'text-warning-foreground'}`}>
              {formatCurrency(todayTotals.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Entry Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3 border-b">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === 'IN' ? 'default' : 'outline'}
            size="sm"
            className={`flex-1 ${type === 'IN' ? 'bg-success hover:bg-success/90' : ''}`}
            onClick={() => setType('IN')}
          >
            <ArrowDownCircle className="h-4 w-4 mr-1" />
            Entrada
          </Button>
          <Button
            type="button"
            variant={type === 'OUT' ? 'default' : 'outline'}
            size="sm"
            className={`flex-1 ${type === 'OUT' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            onClick={() => setType('OUT')}
          >
            <ArrowUpCircle className="h-4 w-4 mr-1" />
            Saída
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Forma de Pagamento</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods?.map(pm => (
                  <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {type === 'OUT' && (
          <div className="space-y-1">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione categoria..." />
              </SelectTrigger>
              <SelectContent>
                {categories?.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Textarea
            placeholder="Descrição do lançamento..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={createTransaction.isPending || !amount}
        >
          {createTransaction.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Lançar
        </Button>
      </form>

      {/* Recent Movements */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 bg-muted/20 sticky top-0">
          <span className="text-sm font-medium">Lançamentos do Dia</span>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : todayMovements?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum lançamento hoje
          </div>
        ) : (
          <div className="divide-y">
            {todayMovements?.map(movement => (
              <div key={movement.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    movement.type === 'IN' ? 'bg-success/20' : 'bg-destructive/20'
                  }`}>
                    {movement.type === 'IN' ? (
                      <ArrowDownCircle className="h-4 w-4 text-success" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium line-clamp-1">
                      {movement.description || (movement.type === 'IN' ? 'Entrada' : 'Saída')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {movement.payment_method?.name || 'Sem forma de pagamento'}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant="secondary"
                  className={movement.type === 'IN' ? 'text-success' : 'text-destructive'}
                >
                  {movement.type === 'IN' ? '+' : '-'}{formatCurrency(Number(movement.amount))}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
