import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  MapPin,
  MoreVertical,
  User,
  CreditCard,
  Truck,
  Clock,
  ArrowRight,
  X,
  RefreshCw,
  Plus,
  Filter,
  Loader2,
  Calendar,
} from 'lucide-react';
import { useUpdateOrderStatus, useUpdateOrder, useDeliveryPeople } from '@/hooks/useSupabaseQuery';
import { useTodayOrders, getCurrentDateMaceio } from '@/hooks/useTodayOrders';
import { useOrdersRealtime } from '@/hooks/useRealtimeSubscription';
import { NewOrderModal } from '@/components/orders/NewOrderModal';
import type { Order, OrderStatus } from '@/types/database';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const columns: { status: OrderStatus; title: string; color: string; bgColor: string }[] = [
  { status: 'accepted', title: 'Pedido Aceito', color: 'bg-primary', bgColor: 'bg-accent' },
  { status: 'sent', title: 'Enviado', color: 'bg-warning', bgColor: 'bg-warning-bg' },
  { status: 'delivered', title: 'Entregue', color: 'bg-success', bgColor: 'bg-success-bg' },
  { status: 'cancelled', title: 'Cancelado', color: 'bg-destructive', bgColor: 'bg-destructive-bg' },
];

export default function Pipeline() {
  // Use today's orders only (Maceio timezone)
  const { data: orders = [], isLoading, refetch } = useTodayOrders();
  const { data: deliveryPeople = [] } = useDeliveryPeople();
  const updateStatus = useUpdateOrderStatus();
  const updateOrder = useUpdateOrder();
  
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; orderId: string | null }>({
    open: false,
    orderId: null,
  });
  const [reassignDialog, setReassignDialog] = useState<{ open: boolean; order: Order | null }>({
    open: false,
    order: null,
  });
  const [cancelReason, setCancelReason] = useState('');
  const [selectedDeliverer, setSelectedDeliverer] = useState('');
  const [filterDeliverer, setFilterDeliverer] = useState('all');

  // Enable realtime updates
  useOrdersRealtime();

  // Get current date for display
  const todayDisplay = format(parseISO(getCurrentDateMaceio()), "dd 'de' MMMM", { locale: ptBR });

  const filteredOrders = filterDeliverer === 'all' 
    ? orders 
    : orders.filter(o => o.delivery_person_id === filterDeliverer);

  const getOrdersByStatus = (status: OrderStatus) => {
    return filteredOrders.filter((order) => order.status === status);
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    if (newStatus === 'cancelled') {
      setCancelDialog({ open: true, orderId });
    } else {
      updateStatus.mutate({ id: orderId, status: newStatus });
    }
  };

  const confirmCancel = () => {
    if (cancelDialog.orderId) {
      updateStatus.mutate({
        id: cancelDialog.orderId,
        status: 'cancelled',
        cancel_reason: cancelReason,
      });
    }
    setCancelDialog({ open: false, orderId: null });
    setCancelReason('');
  };

  const handleReassign = () => {
    if (reassignDialog.order && selectedDeliverer) {
      updateOrder.mutate({
        id: reassignDialog.order.id,
        delivery_person_id: selectedDeliverer,
      });
    }
    setReassignDialog({ open: false, order: null });
    setSelectedDeliverer('');
  };

  const activeDeliverers = deliveryPeople.filter(d => d.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline de Entregas</h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Hoje, {todayDisplay} • {orders.length} pedidos
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={filterDeliverer} onValueChange={setFilterDeliverer}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Entregador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {activeDeliverers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsNewOrderOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnOrders = getOrdersByStatus(column.status);
          return (
            <div key={column.status} className="space-y-4">
              {/* Column Header */}
              <div className={`${column.bgColor} rounded-lg p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <div className={cn('h-3 w-3 rounded-full', column.color)} />
                  <h3 className="font-semibold">{column.title}</h3>
                </div>
                <Badge variant="secondary">{columnOrders.length}</Badge>
              </div>

              {/* Cards */}
              <div className="space-y-3 min-h-[200px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : columnOrders.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    Nenhum pedido
                  </div>
                ) : (
                  columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                      onReassign={(order) => setReassignDialog({ open: true, order })}
                      isUpdating={updateStatus.isPending}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Order Modal */}
      <NewOrderModal open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen} />

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ open, orderId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Pedido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este pedido? O estoque será devolvido automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="cancel-reason">Motivo do cancelamento</Label>
            <Input
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Cliente desistiu"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground">
              Cancelar Pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign Dialog */}
      <AlertDialog open={reassignDialog.open} onOpenChange={(open) => setReassignDialog({ open, order: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reatribuir Entregador</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o novo entregador para este pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label>Entregador</Label>
            <Select value={selectedDeliverer} onValueChange={setSelectedDeliverer}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o entregador" />
              </SelectTrigger>
              <SelectContent>
                {activeDeliverers.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReassign} disabled={!selectedDeliverer}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onReassign: (order: Order) => void;
  isUpdating: boolean;
}

function OrderCard({ order, onStatusChange, onReassign, isUpdating }: OrderCardProps) {
  const timeAgo = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const statusActions: Record<OrderStatus, { label: string; status: OrderStatus }[]> = {
    accepted: [
      { label: 'Marcar como Enviado', status: 'sent' },
      { label: 'Cancelar', status: 'cancelled' },
    ],
    preparing: [
      { label: 'Marcar como Enviado', status: 'sent' },
      { label: 'Cancelar', status: 'cancelled' },
    ],
    sent: [
      { label: 'Marcar como Entregue', status: 'delivered' },
      { label: 'Cancelar', status: 'cancelled' },
    ],
    delivered: [],
    cancelled: [],
  };

  const actions = statusActions[order.status] || [];

  return (
    <Card className="kanban-card animate-fade-up">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs text-muted-foreground">#{order.order_number}</span>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
          {(actions.length > 0 || order.status === 'accepted' || order.status === 'sent') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isUpdating}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((action) => (
                  <DropdownMenuItem
                    key={action.status}
                    onClick={() => onStatusChange(order.id, action.status)}
                    className={action.status === 'cancelled' ? 'text-destructive' : ''}
                  >
                    {action.status === 'cancelled' ? (
                      <X className="h-4 w-4 mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {action.label}
                  </DropdownMenuItem>
                ))}
                {(order.status === 'accepted' || order.status === 'sent') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onReassign(order)}>
                      <Truck className="h-4 w-4 mr-2" />
                      Reatribuir Entregador
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Customer */}
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm truncate">
            {order.customer?.name || 'Cliente não informado'}
          </span>
        </div>

        {/* Address */}
        {(order.delivery_address || order.neighborhood) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span className="text-sm text-muted-foreground line-clamp-2">
              {order.delivery_address}
              {order.delivery_number && `, ${order.delivery_number}`}
              {order.neighborhood && ` - ${order.neighborhood.name}`}
            </span>
          </div>
        )}

        {/* Items Summary */}
        {order.items && order.items.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {order.items.slice(0, 2).map((item) => (
              <div key={item.id}>
                {item.quantity}x {item.product?.name || 'Produto'}
              </div>
            ))}
            {order.items.length > 2 && (
              <div>+{order.items.length - 2} itens</div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {order.payment_method && (
              <Badge variant="outline" className="text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                {order.payment_method.name}
              </Badge>
            )}
          </div>
          <span className="font-bold text-primary">
            R$ {order.total.toFixed(2)}
          </span>
        </div>

        {/* Delivery Person & Channel */}
        <div className="flex items-center justify-between">
          {order.delivery_person && (
            <div className="flex items-center gap-1.5 bg-muted rounded-full px-2 py-1">
              <Truck className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">{order.delivery_person.name}</span>
            </div>
          )}
          {order.channel && (
            <Badge variant="secondary" className="text-xs">
              {order.channel.name}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
