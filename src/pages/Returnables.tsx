import { useState } from 'react';
import { 
  Package, 
  Plus, 
  ArrowRightLeft, 
  Droplets, 
  AlertTriangle, 
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  Trash2,
  Gift,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useContainerPoolsWithBalance, 
  useContainerMovements,
  useMonthlyBonuses 
} from '@/hooks/useContainerData';
import { NewContainerPoolModal } from '@/components/containers/NewContainerPoolModal';
import { ContainerMovementModal } from '@/components/containers/ContainerMovementModal';
import { MonthlyBonusModal } from '@/components/containers/MonthlyBonusModal';
import type { ContainerPoolWithBalance, MovementType } from '@/types/containers';

const movementTypeLabels: Record<MovementType, { label: string; icon: React.ReactNode; color: string }> = {
  'FILL': { label: 'Envase', icon: <Droplets className="h-4 w-4" />, color: 'text-blue-500' },
  'SALE_TO_FIELD': { label: 'Saída p/ Campo', icon: <ArrowRightLeft className="h-4 w-4" />, color: 'text-orange-500' },
  'RETURN': { label: 'Retorno', icon: <RotateCcw className="h-4 w-4" />, color: 'text-green-500' },
  'BREAKAGE': { label: 'Quebra', icon: <Trash2 className="h-4 w-4" />, color: 'text-destructive' },
  'PURCHASE': { label: 'Compra', icon: <ShoppingCart className="h-4 w-4" />, color: 'text-primary' },
  'ADJUSTMENT': { label: 'Ajuste', icon: <ArrowRightLeft className="h-4 w-4" />, color: 'text-muted-foreground' },
};

export default function Returnables() {
  const [isNewPoolOpen, setIsNewPoolOpen] = useState(false);
  const [movementModal, setMovementModal] = useState<{ 
    open: boolean; 
    type: MovementType | null; 
    pool: ContainerPoolWithBalance | null;
  }>({ open: false, type: null, pool: null });
  const [bonusModal, setBonusModal] = useState<{
    open: boolean;
    pool: ContainerPoolWithBalance | null;
  }>({ open: false, pool: null });
  
  const { data: pools, isLoading: poolsLoading } = useContainerPoolsWithBalance();
  const { data: movements, isLoading: movementsLoading } = useContainerMovements();
  const { data: bonuses } = useMonthlyBonuses();
  
  // Calculate totals
  const totals = pools?.reduce((acc, pool) => ({
    pool: acc.pool + pool.total_physical_qty,
    full: acc.full + pool.balance.qty_full,
    empty: acc.empty + pool.balance.qty_empty,
    inField: acc.inField + pool.balance.qty_in_field,
    breakages: acc.breakages + pool.breakages_this_month,
    breakageValue: acc.breakageValue + (pool.breakages_this_month * pool.unit_value),
  }), { pool: 0, full: 0, empty: 0, inField: 0, breakages: 0, breakageValue: 0 });
  
  const currentMonthBonuses = bonuses?.filter(b => b.competence_month === format(new Date(), 'yyyy-MM'));
  const totalBonusValue = currentMonthBonuses?.reduce((sum, b) => sum + Number(b.bonus_value_brl), 0) || 0;
  
  const openMovementModal = (type: MovementType, pool: ContainerPoolWithBalance) => {
    setMovementModal({ open: true, type, pool });
  };
  
  if (poolsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vasilhames Retornáveis</h1>
          <p className="text-muted-foreground">
            Controle de galões e botijões • Cheios, Vazios e Em Campo
          </p>
        </div>
        <Button onClick={() => setIsNewPoolOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pool
        </Button>
      </div>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pool Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.pool || 0}</div>
            <p className="text-xs text-muted-foreground">unidades físicas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cheios</CardTitle>
            <Droplets className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totals?.full || 0}</div>
            <Progress 
              value={totals?.pool ? (totals.full / totals.pool) * 100 : 0} 
              className="mt-2 h-1.5" 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vazios</CardTitle>
            <Package className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{totals?.empty || 0}</div>
            <Progress 
              value={totals?.pool ? (totals.empty / totals.pool) * 100 : 0} 
              className="mt-2 h-1.5 [&>div]:bg-gray-400" 
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Campo</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totals?.inField || 0}</div>
            <Progress 
              value={totals?.pool ? (totals.inField / totals.pool) * 100 : 0} 
              className="mt-2 h-1.5 [&>div]:bg-orange-400" 
            />
          </CardContent>
        </Card>
        
        <Card className="border-destructive/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quebras (Mês)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totals?.breakages || 0}</div>
            <p className="text-xs text-muted-foreground">
              R$ {(totals?.breakageValue || 0).toFixed(2)} em perdas
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Bonus Card */}
      {totalBonusValue > 0 && (
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                Bonificação do Mês
              </CardTitle>
              <CardDescription>Crédito estimado por envase</CardDescription>
            </div>
            <Gift className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              R$ {totalBonusValue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Tabs */}
      <Tabs defaultValue="pools" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pools">Pools de Vasilhames</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="bonuses">Bonificações</TabsTrigger>
        </TabsList>
        
        {/* Pools Tab */}
        <TabsContent value="pools" className="space-y-4">
          {(!pools || pools.length === 0) ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">Nenhum pool cadastrado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie um pool para controlar seus vasilhames retornáveis.
                </p>
                <Button onClick={() => setIsNewPoolOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Pool
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pools.map((pool) => (
                <Card key={pool.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pool.name}</CardTitle>
                      <Badge variant="outline">{pool.type}</Badge>
                    </div>
                    <CardDescription>
                      Pool total: {pool.total_physical_qty} unidades • 
                      R$ {pool.unit_value.toFixed(2)}/un
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Balance bars */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Droplets className="h-3 w-3 text-blue-500" /> Cheios
                        </span>
                        <span className="font-medium">{pool.balance.qty_full}</span>
                      </div>
                      <Progress 
                        value={(pool.balance.qty_full / pool.total_physical_qty) * 100} 
                        className="h-2"
                      />
                      
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-gray-400" /> Vazios
                        </span>
                        <span className="font-medium">{pool.balance.qty_empty}</span>
                      </div>
                      <Progress 
                        value={(pool.balance.qty_empty / pool.total_physical_qty) * 100} 
                        className="h-2 [&>div]:bg-gray-400"
                      />
                      
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <ArrowRightLeft className="h-3 w-3 text-orange-500" /> Em Campo
                        </span>
                        <span className="font-medium">{pool.balance.qty_in_field}</span>
                      </div>
                      <Progress 
                        value={(pool.balance.qty_in_field / pool.total_physical_qty) * 100} 
                        className="h-2 [&>div]:bg-orange-400"
                      />
                    </div>
                    
                    {/* Breakage warning */}
                    {pool.breakages_this_month > 0 && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-2 py-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{pool.breakages_this_month} quebras este mês ({pool.breakage_percent.toFixed(1)}%)</span>
                      </div>
                    )}
                    
                    {/* Bonus info */}
                    {pool.bonus_this_month && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 rounded-md px-2 py-1">
                        <Gift className="h-4 w-4" />
                        <span>
                          Bonificação: R$ {Number(pool.bonus_this_month.bonus_value_brl).toFixed(2)}
                        </span>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openMovementModal('FILL', pool)}
                      >
                        <Droplets className="mr-1 h-3 w-3" />
                        Envase
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openMovementModal('RETURN', pool)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Retorno
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openMovementModal('BREAKAGE', pool)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Quebra
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openMovementModal('PURCHASE', pool)}
                      >
                        <ShoppingCart className="mr-1 h-3 w-3" />
                        Compra
                      </Button>
                    </div>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="w-full"
                      onClick={() => setBonusModal({ open: true, pool })}
                    >
                      <Gift className="mr-1 h-3 w-3" />
                      Registrar Bonificação
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Movimentações
              </CardTitle>
              <CardDescription>Últimas 50 movimentações de vasilhames</CardDescription>
            </CardHeader>
            <CardContent>
              {movementsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : movements && movements.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mov) => {
                      const typeInfo = movementTypeLabels[mov.movement_type as MovementType];
                      return (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm">
                            {format(new Date(mov.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">{mov.pool?.name || '-'}</TableCell>
                          <TableCell>
                            <div className={`flex items-center gap-1 ${typeInfo?.color}`}>
                              {typeInfo?.icon}
                              <span>{typeInfo?.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{mov.qty}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {mov.notes || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma movimentação registrada.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Bonuses Tab */}
        <TabsContent value="bonuses">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Bonificações Mensais
              </CardTitle>
              <CardDescription>Histórico de bonificações por envase</CardDescription>
            </CardHeader>
            <CardContent>
              {bonuses && bonuses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead>Pool</TableHead>
                      <TableHead className="text-right">Envasados</TableHead>
                      <TableHead className="text-right">% Bonus</TableHead>
                      <TableHead className="text-right">Qtd Bonus</TableHead>
                      <TableHead className="text-right">Valor R$</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bonuses.map((bonus) => (
                      <TableRow key={bonus.id}>
                        <TableCell className="font-medium">{bonus.competence_month}</TableCell>
                        <TableCell>{bonus.pool?.name || '-'}</TableCell>
                        <TableCell className="text-right">{bonus.qty_filled}</TableCell>
                        <TableCell className="text-right">{Number(bonus.bonus_percent).toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{bonus.bonus_qty}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          R$ {Number(bonus.bonus_value_brl).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={bonus.status === 'confirmed' ? 'default' : 'secondary'}>
                            {bonus.status === 'confirmed' ? 'Confirmado' : 'Previsto'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma bonificação registrada.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Modals */}
      <NewContainerPoolModal open={isNewPoolOpen} onOpenChange={setIsNewPoolOpen} />
      <ContainerMovementModal 
        open={movementModal.open} 
        onOpenChange={(open) => setMovementModal(prev => ({ ...prev, open }))}
        movementType={movementModal.type}
        pool={movementModal.pool}
      />
      <MonthlyBonusModal
        open={bonusModal.open}
        onOpenChange={(open) => setBonusModal(prev => ({ ...prev, open }))}
        pool={bonusModal.pool}
      />
    </div>
  );
}
