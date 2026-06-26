import { useMemo, useState } from 'react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { cn } from '@/lib/utils';
import { Package, Truck, CheckCircle, XCircle } from 'lucide-react';
import { OrderEditDrawer } from './OrderEditDrawer';
import { GridRow } from '@/types/dailyGrid';

const STATUS_CONFIG = [
  { 
    value: 'Aceito', 
    label: 'Aceitos', 
    icon: Package,
    bgColor: 'bg-accent',
    textColor: 'text-accent-foreground',
    borderColor: 'border-accent'
  },
  { 
    value: 'Enviado', 
    label: 'Enviados', 
    icon: Truck,
    bgColor: 'bg-warning-bg',
    textColor: 'text-warning-foreground',
    borderColor: 'border-warning'
  },
  { 
    value: 'Entregue', 
    label: 'Entregues', 
    icon: CheckCircle,
    bgColor: 'bg-success-bg',
    textColor: 'text-success',
    borderColor: 'border-success'
  },
  { 
    value: 'Cancelado', 
    label: 'Cancelados', 
    icon: XCircle,
    bgColor: 'bg-destructive-bg',
    textColor: 'text-destructive',
    borderColor: 'border-destructive'
  },
];

interface StatusPipelineProps {
  variant?: 'default' | 'sidebar';
}

export function StatusPipeline({ variant = 'default' }: StatusPipelineProps) {
  const { rows } = useDailyGridStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const statusCounts = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {};
    
    STATUS_CONFIG.forEach(s => {
      counts[s.value] = { count: 0, total: 0 };
    });

    rows.forEach(row => {
      if (row.status && counts[row.status]) {
        counts[row.status].count += 1;
        counts[row.status].total += row.value || 0;
      }
    });

    return counts;
  }, [rows]);

  const filteredOrders = useMemo(() => {
    if (!selectedStatus) return [];
    
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.status === selectedStatus && (row.customerName || row.productName));
  }, [rows, selectedStatus]);

  const totalOrders = rows.filter(r => r.status && (r.customerName || r.productName)).length;
  const totalValue = rows.reduce((sum, r) => sum + (r.value || 0), 0);

  const handleStatusClick = (statusValue: string) => {
    setSelectedStatus(statusValue);
    setDrawerOpen(true);
  };

  // Sidebar variant - vertical layout
  if (variant === 'sidebar') {
    return (
      <>
        <div className="flex flex-col gap-2 p-2">
          {STATUS_CONFIG.map((status) => {
            const Icon = status.icon;
            const data = statusCounts[status.value];
            const percentage = totalOrders > 0 ? Math.round((data.count / totalOrders) * 100) : 0;
            
            return (
              <button
                key={status.value}
                onClick={() => handleStatusClick(status.value)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-md border transition-all cursor-pointer w-full',
                  'hover:ring-2 hover:ring-offset-1 hover:ring-primary/30',
                  status.bgColor,
                  status.borderColor,
                  'border-opacity-30'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', status.textColor)} />
                  <span className={cn('text-sm font-medium', status.textColor)}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', status.textColor)}>
                    {data.count}
                  </span>
                  <span className={cn('text-xs', status.textColor)}>
                    ({percentage}%)
                  </span>
                </div>
              </button>
            );
          })}
          
          <div className="flex items-center justify-between pt-2 mt-2 border-t text-sm">
            <span className="text-muted-foreground">Total</span>
            <div className="text-right">
              <div className="font-semibold">{totalOrders} pedidos</div>
              <div className="text-xs text-muted-foreground">
                {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>
        </div>

        <OrderEditDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          orders={filteredOrders}
          statusFilter={selectedStatus}
        />
      </>
    );
  }

  // Default variant - horizontal layout
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b overflow-x-auto">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2 shrink-0">
          <span className="font-medium">Pipeline:</span>
        </div>
        
        <div className="flex items-center gap-1">
          {STATUS_CONFIG.map((status, index) => {
            const Icon = status.icon;
            const data = statusCounts[status.value];
            const percentage = totalOrders > 0 ? Math.round((data.count / totalOrders) * 100) : 0;
            
            return (
              <div key={status.value} className="flex items-center">
                <button
                  onClick={() => handleStatusClick(status.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer',
                    'hover:ring-2 hover:ring-offset-1 hover:ring-primary/30',
                    status.bgColor,
                    status.borderColor,
                    'border-opacity-30'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', status.textColor)} />
                  <div className="flex flex-col">
                    <span className={cn('text-xs font-medium leading-none', status.textColor)}>
                      {data.count}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                      {status.label}
                    </span>
                  </div>
                  <span className={cn('text-[10px] font-medium', status.textColor)}>
                    {percentage}%
                  </span>
                </button>
                
                {index < STATUS_CONFIG.length - 1 && (
                  <div className="w-4 h-px bg-border mx-1" />
                )}
              </div>
            );
          })}
        </div>

        <div className="h-6 w-px bg-border mx-2" />
        
        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-foreground">{totalOrders} pedidos</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-semibold text-foreground">
              {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>
      <OrderEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orders={filteredOrders}
        statusFilter={selectedStatus}
      />
    </>
  );
}
