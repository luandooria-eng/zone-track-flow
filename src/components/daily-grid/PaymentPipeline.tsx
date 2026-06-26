import { useMemo, useState } from 'react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { cn } from '@/lib/utils';
import { Clock, Banknote, QrCode } from 'lucide-react';
import { OrderEditDrawer } from './OrderEditDrawer';
import { GridRow } from '@/types/dailyGrid';

interface PaymentPipelineProps {
  variant?: 'default' | 'sidebar';
}

export function PaymentPipeline({ variant = 'default' }: PaymentPipelineProps) {
  const { rows } = useDailyGridStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pixDrawerOpen, setPixDrawerOpen] = useState(false);

  // Count orders with "Em Aberto" payment - these need to be collected now
  const pendingPayments = useMemo(() => {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (!row.paymentMethod) return false;
        const pmLower = row.paymentMethod.toLowerCase();
        return pmLower.includes('aberto');
      })
      .filter(({ row }) => row.customerName || row.productName);
  }, [rows]);

  // Count orders with "Fazer Pix" payment - waiting for customer to send Pix
  const pendingPix = useMemo(() => {
    const pixOrders = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (!row.paymentMethod) return false;
        const pmLower = row.paymentMethod.toLowerCase().trim();
        // Match "Fazer pix", "Fazer Pix", "fazer pix", etc.
        return pmLower.includes('fazer pix') || pmLower.includes('pix pendente') || pmLower.includes('aguardando pix');
      });
    
    return pixOrders;
  }, [rows]);

  const totalPendingValue = pendingPayments.reduce((sum, { row }) => sum + (row.value || 0), 0);
  const totalPixValue = pendingPix.reduce((sum, { row }) => sum + (row.value || 0), 0);

  if (pendingPayments.length === 0 && pendingPix.length === 0) {
    if (variant === 'sidebar') {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Nenhum pagamento pendente
        </div>
      );
    }
    return null;
  }

  // Sidebar variant - vertical layout
  if (variant === 'sidebar') {
    return (
      <>
        <div className="flex flex-col gap-2 p-2">
          {/* Pagamentos em Aberto */}
          {pendingPayments.length > 0 && (
            <button
              onClick={() => setDrawerOpen(true)}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md border transition-all cursor-pointer w-full',
                'bg-warning-bg border-warning/30 hover:ring-2 hover:ring-offset-1 hover:ring-warning/30'
              )}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning-foreground" />
                <span className="text-sm font-medium text-warning-foreground">
                  Pagamentos em Aberto
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-warning-foreground">
                  {pendingPayments.length}
                </span>
                <span className="text-xs text-warning-foreground">
                  {totalPendingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </button>
          )}

          {/* Aguardando Pix */}
          {pendingPix.length > 0 && (
            <button
              onClick={() => setPixDrawerOpen(true)}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-md border transition-all cursor-pointer w-full',
                'bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700 hover:ring-2 hover:ring-offset-1 hover:ring-sky-400/30'
              )}
            >
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                  Aguardando Pix
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                  {pendingPix.length}
                </span>
                <span className="text-xs text-sky-600 dark:text-sky-400">
                  {totalPixValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </button>
          )}
        </div>

        <OrderEditDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          orders={pendingPayments}
          statusFilter="Pagamentos em Aberto"
          mode="payment"
        />

        <OrderEditDrawer
          open={pixDrawerOpen}
          onOpenChange={setPixDrawerOpen}
          orders={pendingPix}
          statusFilter="Aguardando Pix"
          mode="payment"
        />
      </>
    );
  }

  // Default variant - horizontal layout
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-1.5 bg-warning-bg/30 border-b border-warning/20">
        {/* Pagamentos em Aberto */}
        {pendingPayments.length > 0 && (
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer',
              'bg-warning-bg border-warning/30 hover:ring-2 hover:ring-offset-1 hover:ring-warning/30'
            )}
          >
            <Clock className="h-3.5 w-3.5 text-warning-foreground" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-warning-foreground leading-none">
                {pendingPayments.length}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Pagamentos em aberto
              </span>
            </div>
            <span className="text-xs font-medium text-warning-foreground ml-2">
              {totalPendingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </button>
        )}

        {/* Aguardando Pix */}
        {pendingPix.length > 0 && (
          <button
            onClick={() => setPixDrawerOpen(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all cursor-pointer',
              'bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700 hover:ring-2 hover:ring-offset-1 hover:ring-sky-400/30'
            )}
          >
            <QrCode className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-sky-600 dark:text-sky-400 leading-none">
                {pendingPix.length}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Aguardando Pix
              </span>
            </div>
            <span className="text-xs font-medium text-sky-600 dark:text-sky-400 ml-2">
              {totalPixValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </button>
        )}

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Banknote className="h-3.5 w-3.5" />
          <span>Clique para receber pagamentos</span>
        </div>
      </div>

      <OrderEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        orders={pendingPayments}
        statusFilter="Pagamentos em Aberto"
        mode="payment"
      />

      <OrderEditDrawer
        open={pixDrawerOpen}
        onOpenChange={setPixDrawerOpen}
        orders={pendingPix}
        statusFilter="Aguardando Pix"
        mode="payment"
      />
    </>
  );
}
