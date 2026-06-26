import { useState } from 'react';
import { mockAuditLogs } from '@/lib/mockData';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  FileText,
  User,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  ArrowRight,
  Clock,
  Download,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AuditAction } from '@/types';

const entityIcons = {
  order: ShoppingCart,
  customer: Users,
  product: Package,
  credit_entry: Wallet,
  stock_move: Package,
  user: User,
};

const entityLabels = {
  order: 'Pedido',
  customer: 'Cliente',
  product: 'Produto',
  credit_entry: 'Crediário',
  stock_move: 'Estoque',
  user: 'Usuário',
};

const actionLabels: Record<AuditAction, { label: string; color: string }> = {
  create: { label: 'Criação', color: 'bg-success-bg text-success' },
  update: { label: 'Atualização', color: 'bg-primary/20 text-primary' },
  delete: { label: 'Exclusão', color: 'bg-destructive-bg text-destructive' },
  status_change: { label: 'Status', color: 'bg-warning-bg text-warning' },
};

export default function Audit() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = mockAuditLogs.filter((log) => {
    const matchesSearch =
      log.description.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.entityId.includes(search);

    const matchesEntity = entityFilter === 'all' || log.entityType === entityFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesEntity && matchesAction;
  });

  const handleExport = () => {
    const csv = [
      ['ID', 'Data/Hora', 'Usuário', 'Entidade', 'Ação', 'Descrição'].join(','),
      ...filteredLogs.map((log) =>
        [
          log.id,
          format(log.createdAt, "dd/MM/yyyy HH:mm", { locale: ptBR }),
          log.userName,
          entityLabels[log.entityType],
          actionLabels[log.action].label,
          `"${log.description}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-muted-foreground">
            Histórico completo de alterações no sistema
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, usuário ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            <SelectItem value="order">Pedidos</SelectItem>
            <SelectItem value="customer">Clientes</SelectItem>
            <SelectItem value="product">Produtos</SelectItem>
            <SelectItem value="credit_entry">Crediário</SelectItem>
            <SelectItem value="stock_move">Estoque</SelectItem>
            <SelectItem value="user">Usuários</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            <SelectItem value="create">Criação</SelectItem>
            <SelectItem value="update">Atualização</SelectItem>
            <SelectItem value="delete">Exclusão</SelectItem>
            <SelectItem value="status_change">Mudança de status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline View */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Alterações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log, index) => {
              const EntityIcon = entityIcons[log.entityType];
              return (
                <TableRow
                  key={log.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {format(log.createdAt, "dd/MM HH:mm", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {log.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-sm">{log.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EntityIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{entityLabels[log.entityType]}</span>
                      <span className="text-xs text-muted-foreground font-mono">#{log.entityId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', actionLabels[log.action].color)}
                    >
                      {actionLabels[log.action].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <p className="text-sm truncate">{log.description}</p>
                  </TableCell>
                  <TableCell>
                    {log.before && log.after && (
                      <div className="flex items-center gap-2 text-xs">
                        <code className="bg-destructive-bg/50 text-destructive px-1.5 py-0.5 rounded">
                          {JSON.stringify(log.before).slice(0, 20)}...
                        </code>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <code className="bg-success-bg/50 text-success px-1.5 py-0.5 rounded">
                          {JSON.stringify(log.after).slice(0, 20)}...
                        </code>
                      </div>
                    )}
                    {!log.before && log.after && (
                      <code className="text-xs bg-success-bg/50 text-success px-1.5 py-0.5 rounded">
                        {JSON.stringify(log.after).slice(0, 30)}...
                      </code>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredLogs.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">
              Nenhum registro encontrado
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
