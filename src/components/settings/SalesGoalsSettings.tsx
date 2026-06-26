import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Target, Plus, Trash2, Package, Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSalesGoals, useCreateSalesGoal, useUpdateSalesGoal, useDeleteSalesGoal } from '@/hooks/useSalesGoals';
import { useProducts } from '@/hooks/useSupabaseQuery';
import { getDaysInMonth } from 'date-fns';

export function SalesGoalsSettings() {
  const { data: goals, isLoading } = useSalesGoals();
  const { data: products = [] } = useProducts();
  const createGoal = useCreateSalesGoal();
  const updateGoal = useUpdateSalesGoal();
  const deleteGoal = useDeleteSalesGoal();

  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newGoalForm, setNewGoalForm] = useState({
    type: 'monthly' as 'daily' | 'monthly', // Default to monthly
    metric: 'products_sold' as 'products_sold' | 'orders_count',
    product_id: '',
    target_value: '',
    name: '',
  });

  // Calculate daily target preview
  const daysInCurrentMonth = getDaysInMonth(new Date());
  const dailyTargetPreview = useMemo(() => {
    const target = parseInt(newGoalForm.target_value) || 0;
    if (newGoalForm.type === 'monthly' && target > 0) {
      return Math.ceil(target / daysInCurrentMonth);
    }
    return null;
  }, [newGoalForm.target_value, newGoalForm.type, daysInCurrentMonth]);

  const handleCreateGoal = async () => {
    if (!newGoalForm.target_value) return;

    await createGoal.mutateAsync({
      type: newGoalForm.type,
      metric: newGoalForm.metric,
      target_value: parseInt(newGoalForm.target_value) || 0,
      product_id: newGoalForm.metric === 'products_sold' && newGoalForm.product_id ? newGoalForm.product_id : null,
      name: newGoalForm.name || null,
    });

    setNewGoalOpen(false);
    setNewGoalForm({
      type: 'monthly',
      metric: 'products_sold',
      product_id: '',
      target_value: '',
      name: '',
    });
  };

  // Calculate daily target for display in table
  const getDailyTarget = (goal: any) => {
    if (goal.type === 'monthly') {
      return Math.ceil(goal.target_value / daysInCurrentMonth);
    }
    return goal.target_value;
  };

  const handleUpdateGoal = async (id: string) => {
    if (!editValue) return;
    await updateGoal.mutateAsync({
      id,
      target_value: parseInt(editValue) || 0,
    });
    setEditingId(null);
    setEditValue('');
  };

  const handleDeleteGoal = async (id: string) => {
    await deleteGoal.mutateAsync(id);
  };

  const startEditing = (id: string, currentValue: number) => {
    setEditingId(id);
    setEditValue(currentValue.toString());
  };

  const getTypeLabel = (type: string) => type === 'daily' ? 'Diária' : 'Mensal';
  const getMetricLabel = (metric: string) => metric === 'products_sold' ? 'Produtos' : 'Pedidos';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Metas de Vendas
            </CardTitle>
            <CardDescription>
              Defina metas mensais e o sistema calcula automaticamente a meta diária 
              dividindo pelo número de dias do mês
            </CardDescription>
          </div>
          <Button onClick={() => setNewGoalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Meta Mensal</TableHead>
              <TableHead className="text-right">Meta Diária</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma meta cadastrada. Clique em "Nova Meta" para começar.
                </TableCell>
              </TableRow>
            )}
            {goals?.map((goal) => (
              <TableRow key={goal.id}>
                <TableCell className="font-medium">
                  {goal.name || (goal.product?.name ? goal.product.name : getMetricLabel(goal.metric))}
                </TableCell>
                <TableCell>
                  <Badge variant={goal.type === 'daily' ? 'default' : 'secondary'}>
                    {getTypeLabel(goal.type)}
                  </Badge>
                </TableCell>
                <TableCell>{getMetricLabel(goal.metric)}</TableCell>
                <TableCell>
                  {goal.product ? (
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {goal.product.name}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Todos</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === goal.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 text-right"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateGoal(goal.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button size="sm" onClick={() => handleUpdateGoal(goal.id)}>
                        OK
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="font-semibold cursor-pointer hover:underline"
                      onClick={() => startEditing(goal.id, goal.target_value)}
                    >
                      {goal.type === 'monthly' ? goal.target_value.toLocaleString() : '-'}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold text-primary">
                    {getDailyTarget(goal).toLocaleString()}
                  </span>
                  {goal.type === 'monthly' && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({daysInCurrentMonth}d)
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* New Goal Dialog */}
      <Dialog open={newGoalOpen} onOpenChange={setNewGoalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome (opcional)</Label>
              <Input
                placeholder="Ex: Meta Água 20L"
                value={newGoalForm.name}
                onChange={(e) => setNewGoalForm({ ...newGoalForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={newGoalForm.metric}
                onValueChange={(v: 'products_sold' | 'orders_count') => setNewGoalForm({ ...newGoalForm, metric: v, product_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products_sold">Produtos Vendidos</SelectItem>
                  <SelectItem value="orders_count">Número de Pedidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newGoalForm.metric === 'products_sold' && (
              <div className="space-y-2">
                <Label>Produto (opcional - deixe vazio para todos)</Label>
                <Select
                  value={newGoalForm.product_id || 'all'}
                  onValueChange={(v) => setNewGoalForm({ ...newGoalForm, product_id: v === 'all' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {products.filter(p => p.id && p.is_active).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Meta Mensal *</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 4000"
                value={newGoalForm.target_value}
                onChange={(e) => setNewGoalForm({ ...newGoalForm, target_value: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Informe a meta total do mês. A meta diária será calculada automaticamente.
              </p>
            </div>

            {dailyTargetPreview && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Meta diária calculada: <span className="text-primary">{dailyTargetPreview.toLocaleString()}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {parseInt(newGoalForm.target_value).toLocaleString()} ÷ {daysInCurrentMonth} dias = {dailyTargetPreview.toLocaleString()} por dia
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGoalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateGoal} disabled={createGoal.isPending || !newGoalForm.target_value}>
              {createGoal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
