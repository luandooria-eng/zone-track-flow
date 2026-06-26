import { useState, useEffect } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShoppingCart,
  Truck,
  User,
} from 'lucide-react';
import { CreditEntry, CreditEntryStatus } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRegisterPayment, usePaymentMethods } from '@/hooks/useCreditData';

interface CreditEntryDetailDrawerProps {
  entry: CreditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<CreditEntryStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning-bg text-warning border-warning/30' },
  paid: { label: 'Pago', className: 'bg-success-bg text-success border-success/30' },
  partial: { label: 'Parcial', className: 'bg-primary/20 text-primary border-primary/30' },
  overdue: { label: 'Vencido', className: 'bg-destructive-bg text-destructive border-destructive/30' },
  renegotiated: { label: 'Renegociado', className: 'bg-muted text-muted-foreground border-muted-foreground/30' },
};

export function CreditEntryDetailDrawer({ entry, open, onOpenChange }: CreditEntryDetailDrawerProps) {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const registerPaymentMutation = useRegisterPayment();
  const { data: paymentMethods = [] } = usePaymentMethods();

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (!open) {
      setPaymentAmount('');
      setPaymentMethod('');
      setShowPaymentForm(false);
    }
  }, [open]);

  if (!entry) return null;

  const daysOverdue = entry.status === 'overdue' 
    ? Math.abs(differenceInDays(entry.dueDate, new Date()))
    : 0;
  
  const balance = entry.amount;
  const totalPaid = entry.paidAmount || 0;
  const pendingAmount = entry.originalAmount - totalPaid;

  const handleRegisterPayment = () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));

    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido maior que zero');
      return;
    }

    if (amount > pendingAmount) {
      toast.error(`O valor não pode ser maior que o pendente (R$ ${pendingAmount.toFixed(2)})`);
      return;
    }

    if (!paymentMethod) {
      toast.error('Selecione a forma de pagamento');
      return;
    }

    registerPaymentMutation.mutate({
      creditEntryId: entry.id,
      customerId: entry.customerId,
      paymentAmount: amount,
      paymentMethodId: paymentMethod,
      currentPaidAmount: totalPaid,
      totalAmount: entry.originalAmount,
    }, {
      onSuccess: () => {
        setShowPaymentForm(false);
        setPaymentAmount('');
        setPaymentMethod('');
        // Close drawer if fully paid
        if (totalPaid + amount >= entry.originalAmount) {
          onOpenChange(false);
        }
      },
    });
  };

  const handlePayFullAmount = () => {
    setPaymentAmount(pendingAmount.toFixed(2).replace('.', ','));
    setShowPaymentForm(true);
  };

  const handleRenegotiate = () => {
    toast.success('Título marcado para renegociação');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <SheetTitle>Título #{entry.id}</SheetTitle>
            <Badge variant="outline" className={cn('text-xs', statusConfig[entry.status].className)}>
              {statusConfig[entry.status].label}
            </Badge>
          </div>
          <SheetDescription>
            Detalhes do título e pedido vinculado
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Title Summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <User className="h-5 w-5 text-primary" />
              {entry.customerName}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Valor Original</span>
                <p className="font-semibold">R$ {entry.originalAmount.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Saldo em Aberto</span>
                <p className="font-semibold text-destructive">R$ {balance.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Vencimento</span>
                <p className="font-medium">{format(entry.dueDate, "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              {entry.status === 'overdue' && (
                <div>
                  <span className="text-muted-foreground">Dias em Atraso</span>
                  <p className="font-semibold text-destructive">{daysOverdue} dias</p>
                </div>
              )}
              {totalPaid > 0 && (
                <div>
                  <span className="text-muted-foreground">Valor Pago</span>
                  <p className="font-semibold text-success">R$ {totalPaid.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Details */}
          {entry.order && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Pedido #{entry.order.id}
                </h4>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Data do Pedido</span>
                      <p className="font-medium">{format(entry.order.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Canal</span>
                      <p className="font-medium">{entry.order.channelName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Entregador</span>
                      <p className="font-medium">{entry.order.deliveryPersonName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground">Forma de Pgto</span>
                      <p className="font-medium">{entry.order.paymentMethodName}</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Endereço de Entrega</span>
                    <p className="font-medium">
                      {entry.order.deliveryAddress.street}, {entry.order.deliveryAddress.number}
                      {entry.order.deliveryAddress.complement && ` - ${entry.order.deliveryAddress.complement}`}
                    </p>
                    <p className="text-muted-foreground">
                      {entry.order.deliveryAddress.neighborhood} - {entry.order.deliveryAddress.city}/{entry.order.deliveryAddress.state}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Itens do Pedido</span>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Produto</th>
                          <th className="text-center p-2 font-medium">Qtd</th>
                          <th className="text-right p-2 font-medium">Preço</th>
                          <th className="text-right p-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.order.items.map((item) => (
                          <tr key={item.id} className="border-t">
                            <td className="p-2">{item.productName}</td>
                            <td className="p-2 text-center">{item.quantity}</td>
                            <td className="p-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">R$ {item.totalPrice.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30">
                        <tr className="border-t">
                          <td colSpan={3} className="p-2 text-right font-semibold">Total do Pedido</td>
                          <td className="p-2 text-right font-bold">R$ {entry.order.totalAmount.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {entry.order.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground">Observações</span>
                      <p className="font-medium">{entry.order.notes}</p>
                    </div>
                  </div>
                )}

                {/* Order Status */}
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className={cn(
                    "h-4 w-4",
                    entry.order.status === 'delivered' ? 'text-success' : 
                    entry.order.status === 'canceled' ? 'text-destructive' : 'text-warning'
                  )} />
                  <span className="text-muted-foreground">Status do Pedido:</span>
                  <Badge variant="outline" className={cn(
                    entry.order.status === 'delivered' && 'bg-success-bg text-success',
                    entry.order.status === 'canceled' && 'bg-destructive-bg text-destructive',
                  )}>
                    {entry.order.status === 'delivered' ? 'Entregue' : 
                     entry.order.status === 'canceled' ? 'Cancelado' : 
                     entry.order.status === 'sent' ? 'Enviado' : 'Aceito'}
                  </Badge>
                </div>
              </div>
            </>
          )}

          {/* Payment History */}
          {entry.payments && entry.payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Histórico de Pagamentos
                </h4>
                <div className="space-y-2">
                  {entry.payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg border bg-success-bg/30 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <div>
                          <p className="font-medium">R$ {payment.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {payment.paymentMethodName} • {format(payment.paidAt, "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{payment.createdBy}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Payment Form */}
          {entry.status !== 'paid' && (
            <>
              <Separator />
              {showPaymentForm ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Registrar Pagamento</h4>
                    <span className="text-sm text-muted-foreground">
                      Pendente: R$ {pendingAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Valor</label>
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Forma de Pagamento</label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.filter(m => !m.is_credit).map((method) => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleRegisterPayment} 
                      className="flex-1"
                      disabled={registerPaymentMutation.isPending}
                    >
                      {registerPaymentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirmar Pagamento
                    </Button>
                    <Button variant="outline" onClick={() => setShowPaymentForm(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setShowPaymentForm(true)} className="w-full gap-2">
                    <DollarSign className="h-4 w-4" />
                    Registrar Pagamento
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRenegotiate} className="flex-1 gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Renegociar
                    </Button>
                    <Button variant="outline" onClick={handlePayFullAmount} className="flex-1 gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Dar Baixa Total
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
