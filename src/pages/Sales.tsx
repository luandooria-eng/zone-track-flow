import { useState } from 'react';
import { mockOrders } from '@/lib/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Plus,
  ShoppingCart,
  Eye,
  Edit,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OrderStatus } from '@/types';
import { NewSaleModal } from '@/components/sales/NewSaleModal';

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  accepted: { label: 'Aceito', className: 'status-accepted' },
  sent: { label: 'Enviado', className: 'status-sent' },
  delivered: { label: 'Entregue', className: 'status-delivered' },
  canceled: { label: 'Cancelado', className: 'status-canceled' },
};

export default function Sales() {
  const [search, setSearch] = useState('');
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);

  const filteredOrders = mockOrders.filter(
    (order) =>
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.id.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-muted-foreground">
            Histórico de pedidos e vendas
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsNewSaleOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova Venda
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou pedido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Entregador</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order, index) => (
              <TableRow
                key={order.id}
                className="animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TableCell className="font-mono text-sm">
                  #{order.id}
                </TableCell>
                <TableCell className="font-medium">
                  {order.customerName}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {order.channelName}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                </TableCell>
                <TableCell className="text-sm">
                  {order.paymentMethodName}
                </TableCell>
                <TableCell className="text-sm">
                  {order.deliveryPersonName}
                </TableCell>
                <TableCell className="font-semibold">
                  R$ {order.totalAmount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <span className={cn('status-badge', statusConfig[order.status].className)}>
                    {statusConfig[order.status].label}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(order.createdAt, "dd/MM HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredOrders.length === 0 && (
          <div className="py-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Nenhum pedido encontrado
            </p>
          </div>
        )}
      </div>

      <NewSaleModal open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen} />
    </div>
  );
}
