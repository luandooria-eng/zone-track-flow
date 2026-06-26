import { useMemo, useState } from 'react';
import { ClipboardList, Clock, Banknote, QrCode, Truck, Package, Wallet } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { StatusPipeline } from './StatusPipeline';
import { PaymentPipeline } from './PaymentPipeline';
import { DelivererPipeline } from './DelivererPipeline';
import { CashMovementsTab } from './CashMovementsTab';

interface DaySummaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
}

export function DaySummaryDrawer({ open, onOpenChange, selectedDate }: DaySummaryDrawerProps) {
  const { rows } = useDailyGridStore();
  const [activeTab, setActiveTab] = useState('summary');

  // Calculate summary stats
  const stats = useMemo(() => {
    const filledRows = rows.filter(r => r.customerName || r.productName);
    const totalValue = filledRows.reduce((sum, r) => sum + (r.value || 0), 0);
    
    const delivered = filledRows.filter(r => r.status === 'Entregue').length;
    const sent = filledRows.filter(r => r.status === 'Enviado').length;
    const pendingPayments = filledRows.filter(r => {
      const pm = (r.paymentMethod || '').toLowerCase();
      return pm.includes('aberto');
    }).length;
    const pendingPix = filledRows.filter(r => {
      const pm = (r.paymentMethod || '').toLowerCase();
      return pm.includes('fazer pix') || pm.includes('pix pendente') || pm.includes('aguardando pix');
    }).length;

    return {
      totalOrders: filledRows.length,
      totalValue,
      delivered,
      sent,
      pendingPayments,
      pendingPix
    };
  }, [rows]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Resumo do Dia
            </SheetTitle>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b shrink-0">
            <TabsTrigger value="summary" className="flex-1">
              <ClipboardList className="h-4 w-4 mr-2" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="cash" className="flex-1">
              <Wallet className="h-4 w-4 mr-2" />
              Movimentações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="flex-1 overflow-y-auto m-0 data-[state=inactive]:hidden">
            {/* Quick Stats */}
            <div className="p-4 border-b bg-card">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Package className="h-4 w-4" />
                    <span className="text-xs font-medium">Total Pedidos</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Banknote className="h-4 w-4" />
                    <span className="text-xs font-medium">Valor Total</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {stats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Status Pipeline Section */}
            <div className="border-b">
              <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pipeline de Status</span>
              </div>
              <StatusPipeline variant="sidebar" />
            </div>

            {/* Payment Pipeline Section */}
            <div className="border-b">
              <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pagamentos Pendentes</span>
              </div>
              <PaymentPipeline variant="sidebar" />
            </div>

            {/* Deliverer Pipeline Section */}
            <div className="border-b">
              <div className="px-4 py-2 bg-muted/20 flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Pedidos em Rota</span>
              </div>
              <DelivererPipeline variant="sidebar" />
            </div>

            {/* Quick Summary Cards */}
            <div className="p-4 space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Resumo Rápido</h4>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center">
                    <Package className="h-4 w-4 text-success" />
                  </div>
                  <span className="text-sm font-medium">Entregues</span>
                </div>
                <Badge className="bg-success text-success-foreground">{stats.delivered}</Badge>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Em Rota</span>
                </div>
                <Badge variant="default">{stats.sent}</Badge>
              </div>

              {stats.pendingPayments > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-warning-foreground" />
                    </div>
                    <span className="text-sm font-medium">Pagamentos em Aberto</span>
                  </div>
                  <Badge className="bg-warning text-warning-foreground">{stats.pendingPayments}</Badge>
                </div>
              )}

              {stats.pendingPix > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-700">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-sky-200 dark:bg-sky-900 flex items-center justify-center">
                      <QrCode className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    </div>
                    <span className="text-sm font-medium">Aguardando Pix</span>
                  </div>
                  <Badge className="bg-sky-500 text-white">{stats.pendingPix}</Badge>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cash" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
            <CashMovementsTab selectedDate={selectedDate} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
