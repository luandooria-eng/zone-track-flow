import { useMemo, useState } from 'react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { useGridData } from '@/contexts/GridDataContext';
import { cn } from '@/lib/utils';
import { Truck, User } from 'lucide-react';
import { OrderEditDrawer } from './OrderEditDrawer';

interface DelivererGroup {
  name: string;
  orders: { row: ReturnType<typeof useDailyGridStore.getState>['rows'][0]; index: number }[];
  totalValue: number;
}

interface DelivererPipelineProps {
  variant?: 'default' | 'sidebar';
}

export function DelivererPipeline({ variant = 'default' }: DelivererPipelineProps) {
  const { rows } = useDailyGridStore();
  const { deliveryPeople = [] } = useGridData();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeliverer, setSelectedDeliverer] = useState<string>('');

  // Group orders by deliverer when status is "Enviado"
  const delivererGroups = useMemo(() => {
    const groups: Record<string, DelivererGroup> = {};

    rows.forEach((row, index) => {
      // Only include orders that are "Enviado" and have a deliverer
      if (row.status === 'Enviado' && row.deliverer && (row.customerName || row.productName)) {
        const delivererName = row.deliverer;
        
        if (!groups[delivererName]) {
          groups[delivererName] = {
            name: delivererName,
            orders: [],
            totalValue: 0,
          };
        }
        
        groups[delivererName].orders.push({ row, index });
        groups[delivererName].totalValue += row.value || 0;
      }
    });

    // Convert to array and sort by number of orders (descending)
    return Object.values(groups).sort((a, b) => b.orders.length - a.orders.length);
  }, [rows]);

  const selectedOrders = useMemo(() => {
    if (!selectedDeliverer) return [];
    const group = delivererGroups.find(g => g.name === selectedDeliverer);
    return group?.orders || [];
  }, [delivererGroups, selectedDeliverer]);

  const totalSentOrders = delivererGroups.reduce((sum, g) => sum + g.orders.length, 0);
  const totalSentValue = delivererGroups.reduce((sum, g) => sum + g.totalValue, 0);

  // Don't render if there are no sent orders with deliverers
  if (delivererGroups.length === 0) {
    if (variant === 'sidebar') {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Nenhum pedido em rota
        </div>
      );
    }
    return null;
  }

  const handleDelivererClick = (delivererName: string) => {
    setSelectedDeliverer(delivererName);
    setDrawerOpen(true);
  };

  // Generate unique colors for each deliverer based on their name
  const getDelivererColor = (name: string, index: number) => {
    const colors = [
      { bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' },
      { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-700' },
      { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
      { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700' },
      { bg: 'bg-pink-100 dark:bg-pink-950', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-300 dark:border-pink-700' },
      { bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-300 dark:border-teal-700' },
      { bg: 'bg-indigo-100 dark:bg-indigo-950', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-300 dark:border-indigo-700' },
      { bg: 'bg-rose-100 dark:bg-rose-950', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-700' },
    ];
    return colors[index % colors.length];
  };

  // Sidebar variant - vertical layout
  if (variant === 'sidebar') {
    return (
      <>
        <div className="flex flex-col gap-2 p-2">
          {delivererGroups.map((group, index) => {
            const colors = getDelivererColor(group.name, index);
            
            return (
              <button
                key={group.name}
                onClick={() => handleDelivererClick(group.name)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-md border transition-all cursor-pointer w-full',
                  'hover:ring-2 hover:ring-offset-1 hover:ring-primary/30',
                  colors.bg,
                  colors.border
                )}
              >
                <div className="flex items-center gap-2">
                  <User className={cn('h-4 w-4', colors.text)} />
                  <span className={cn('text-sm font-medium', colors.text)}>
                    {group.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', colors.text)}>
                    {group.orders.length}
                  </span>
                  <span className={cn('text-xs', colors.text)}>
                    {group.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </button>
            );
          })}
          
          <div className="flex items-center justify-between pt-2 mt-2 border-t text-sm">
            <span className="text-muted-foreground">Total em rota</span>
            <div className="text-right">
              <div className="font-semibold">{totalSentOrders} pedidos</div>
              <div className="text-xs text-muted-foreground">
                {totalSentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>
        </div>

        <OrderEditDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          orders={selectedOrders}
          statusFilter={`Entregador: ${selectedDeliverer}`}
        />
      </>
    );
  }

  // Default variant - horizontal layout
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50/50 dark:bg-blue-950/30 border-b border-blue-200/30 dark:border-blue-800/30 overflow-x-auto">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2 shrink-0">
          <Truck className="h-3.5 w-3.5" />
          <span className="font-medium">Em Rota:</span>
        </div>

        <div className="flex items-center gap-2">
          {delivererGroups.map((group, index) => {
            const colors = getDelivererColor(group.name, index);
            
            return (
              <button
                key={group.name}
                onClick={() => handleDelivererClick(group.name)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer',
                  'hover:ring-2 hover:ring-offset-1 hover:ring-primary/30',
                  colors.bg,
                  colors.border
                )}
              >
                <User className={cn('h-3.5 w-3.5', colors.text)} />
                <div className="flex flex-col">
                  <span className={cn('text-xs font-medium leading-none', colors.text)}>
                    {group.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                    {group.orders.length} {group.orders.length === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </div>
                <span className={cn('text-xs font-medium ml-1', colors.text)}>
                  {group.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-border mx-2 shrink-0" />

        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Total em rota</span>
            <span className="font-semibold text-foreground">{totalSentOrders} pedidos</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-semibold text-foreground">
              {totalSentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>

      <OrderEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orders={selectedOrders}
        statusFilter={`Entregador: ${selectedDeliverer}`}
      />
    </>
  );
}
