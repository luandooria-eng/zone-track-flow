import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useGridData } from '@/contexts/GridDataContext';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { GridRow } from '@/types/dailyGrid';
import { cn } from '@/lib/utils';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  User,
  MapPin,
  CreditCard,
  Save,
  Banknote
} from 'lucide-react';

interface OrderEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: { row: GridRow; index: number }[];
  statusFilter: string;
  mode?: 'status' | 'payment';
}

const STATUS_OPTIONS = [
  { value: 'Aceito', label: 'Aceito', icon: Package, color: 'bg-accent text-accent-foreground' },
  { value: 'Enviado', label: 'Enviado', icon: Truck, color: 'bg-warning-bg text-warning-foreground' },
  { value: 'Entregue', label: 'Entregue', icon: CheckCircle, color: 'bg-success-bg text-success' },
  { value: 'Cancelado', label: 'Cancelado', icon: XCircle, color: 'bg-destructive-bg text-destructive' },
];

// Quick payment options for common payment methods
const QUICK_PAYMENT_OPTIONS = [
  { value: 'PIX', icon: Banknote, highlight: true },
  { value: 'Dinheiro', icon: Banknote, highlight: false },
  { value: 'Cartão', icon: CreditCard, highlight: false },
];

export function OrderEditDrawer({ open, onOpenChange, orders, statusFilter, mode = 'status' }: OrderEditDrawerProps) {
  const { paymentMethods, deliveryPeople } = useGridData();
  const { updateCell, saveRow } = useDailyGridStore();
  const [editingOrder, setEditingOrder] = useState<{ row: GridRow; index: number } | null>(null);
  const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) {
      setEditingOrder(null);
      setLocalChanges({});
    }
  }, [open]);

  const handleSelectOrder = (order: { row: GridRow; index: number }) => {
    setEditingOrder(order);
    setLocalChanges({});
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setLocalChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editingOrder) return;

    Object.entries(localChanges).forEach(([key, value]) => {
      updateCell(editingOrder.index, key, value);
    });

    await saveRow(editingOrder.index);
    setLocalChanges({});
    
    // Update the editing order with new values
    setEditingOrder({
      ...editingOrder,
      row: {
        ...editingOrder.row,
        ...localChanges,
      } as GridRow,
    });
  };

  const handleQuickPayment = async (order: { row: GridRow; index: number }, paymentMethod: string) => {
    updateCell(order.index, 'paymentMethod', paymentMethod);
    await saveRow(order.index);
  };

  const getDisplayValue = (field: keyof GridRow) => {
    if (editingOrder && field in localChanges) {
      return localChanges[field];
    }
    return editingOrder?.row[field];
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  const isPaymentMode = mode === 'payment';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            {isPaymentMode ? (
              <>
                <Banknote className="h-5 w-5 text-warning" />
                Receber Pagamentos
              </>
            ) : (
              <>Pedidos - {statusFilter}</>
            )}
            <Badge variant="secondary">{orders.length}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Order list */}
          <div className={cn("border-r", isPaymentMode ? "w-full" : "w-1/2")}>
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {orders.map((order) => (
                  <div
                    key={order.row.row_uuid}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors',
                      editingOrder?.row.row_uuid === order.row.row_uuid && !isPaymentMode
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card border-border'
                    )}
                  >
                    <div 
                      className={cn(!isPaymentMode && 'cursor-pointer')}
                      onClick={() => !isPaymentMode && handleSelectOrder(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {order.row.customerName || 'S.ID'}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-warning-foreground">
                          {(order.row.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          {order.row.address}{order.row.houseNumber ? `, ${order.row.houseNumber}` : ''} - {order.row.neighborhood || 'Sem bairro'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {order.row.productName} x{order.row.quantity}
                          </span>
                          {order.row.order_id && (
                            <Badge variant="secondary" className="text-[10px]">
                              #{order.row.order_id.slice(-6)}
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-warning-bg/50 text-warning-foreground border-warning/30">
                          {order.row.paymentMethod}
                        </Badge>
                      </div>
                    </div>

                    {/* Quick payment buttons for payment mode */}
                    {isPaymentMode && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                        <span className="text-xs text-muted-foreground mr-1">Receber:</span>
                        {QUICK_PAYMENT_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          return (
                            <Button
                              key={option.value}
                              size="sm"
                              variant={option.highlight ? "default" : "outline"}
                              className={cn(
                                "h-7 text-xs",
                                option.highlight && "bg-success hover:bg-success/90 text-success-foreground"
                              )}
                              onClick={() => handleQuickPayment(order, option.value)}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {option.value}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    {isPaymentMode ? 'Nenhum pagamento em aberto' : 'Nenhum pedido encontrado'}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Order edit form - only show in status mode */}
          {!isPaymentMode && (
            <div className="w-1/2 flex flex-col">
              {editingOrder ? (
                <>
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {/* Customer info (read-only) */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Cliente</Label>
                        <div className="p-2 bg-muted/30 rounded-md">
                          <p className="font-medium">{editingOrder.row.customerName || 'S.ID'}</p>
                          <p className="text-sm text-muted-foreground">
                            {editingOrder.row.address} {editingOrder.row.houseNumber}
                          </p>
                          <p className="text-sm text-muted-foreground">{editingOrder.row.neighborhood}</p>
                        </div>
                      </div>

                      {/* Product info (read-only) */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Produto</Label>
                        <div className="p-2 bg-muted/30 rounded-md flex justify-between">
                          <span>{editingOrder.row.productName}</span>
                          <span className="font-medium">x{editingOrder.row.quantity}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {STATUS_OPTIONS.map((status) => {
                            const Icon = status.icon;
                            const isSelected = getDisplayValue('status') === status.value;
                            return (
                              <button
                                key={status.value}
                                onClick={() => handleFieldChange('status', status.value)}
                                className={cn(
                                  'flex items-center gap-2 p-2 rounded-md border transition-all',
                                  isSelected
                                    ? cn(status.color, 'border-current')
                                    : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                )}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="text-sm">{status.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Forma de Pagamento
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {paymentMethods.map((pm) => {
                            const isSelected = getDisplayValue('paymentMethod') === pm.name;
                            return (
                              <button
                                key={pm.id}
                                onClick={() => handleFieldChange('paymentMethod', pm.name)}
                                className={cn(
                                  'p-2 rounded-md border text-sm transition-all',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                )}
                              >
                                {pm.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Deliverer */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          Entregador
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {deliveryPeople.map((dp) => {
                            const isSelected = getDisplayValue('deliverer') === dp.name;
                            return (
                              <button
                                key={dp.id}
                                onClick={() => handleFieldChange('deliverer', dp.name)}
                                className={cn(
                                  'p-2 rounded-md border text-sm transition-all',
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-muted/30 border-transparent hover:bg-muted/50'
                                )}
                              >
                                {dp.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>

                  {/* Save button */}
                  <div className="p-4 border-t">
                    <Button 
                      onClick={handleSave} 
                      className="w-full"
                      disabled={!hasChanges}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Selecione um pedido para editar
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}