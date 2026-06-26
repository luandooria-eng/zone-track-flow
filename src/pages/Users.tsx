import { useState } from 'react';
import { mockUsers } from '@/lib/mockData';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  User,
  Shield,
  ShieldCheck,
  Truck,
  Users as UsersIcon,
  MoreVertical,
  Edit,
  Trash2,
  Key,
  Mail,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';
import { toast } from 'sonner';

const roleConfig: Record<UserRole, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: 'Administrador', icon: ShieldCheck, color: 'bg-primary/20 text-primary border-primary/30' },
  manager: { label: 'Gerente', icon: Shield, color: 'bg-chart-2/20 text-chart-2 border-chart-2/30' },
  operator: { label: 'Operador', icon: UsersIcon, color: 'bg-warning/20 text-warning border-warning/30' },
  delivery: { label: 'Entregador', icon: Truck, color: 'bg-chart-4/20 text-chart-4 border-chart-4/30' },
};

const permissions = [
  { id: 'view_dashboard', name: 'Ver Dashboard', roles: ['admin', 'manager', 'operator'] },
  { id: 'manage_orders', name: 'Gerenciar Pedidos', roles: ['admin', 'manager', 'operator'] },
  { id: 'cancel_orders', name: 'Cancelar Pedidos', roles: ['admin', 'manager'] },
  { id: 'manage_customers', name: 'Gerenciar Clientes', roles: ['admin', 'manager', 'operator'] },
  { id: 'manage_products', name: 'Gerenciar Produtos', roles: ['admin', 'manager'] },
  { id: 'edit_prices', name: 'Editar Preços', roles: ['admin'] },
  { id: 'manage_stock', name: 'Gerenciar Estoque', roles: ['admin', 'manager'] },
  { id: 'manage_credit', name: 'Gerenciar Crediário', roles: ['admin', 'manager'] },
  { id: 'view_reports', name: 'Ver Relatórios', roles: ['admin', 'manager'] },
  { id: 'manage_users', name: 'Gerenciar Usuários', roles: ['admin'] },
  { id: 'view_audit', name: 'Ver Auditoria', roles: ['admin', 'manager'] },
  { id: 'delivery_app', name: 'App de Entrega', roles: ['admin', 'delivery'] },
];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários e Permissões</h1>
          <p className="text-muted-foreground">
            Gerencie acessos e papéis do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setPermissionsOpen(true)}>
            <Key className="h-4 w-4" />
            Permissões
          </Button>
          <Button className="gap-2" onClick={() => setNewUserOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(roleConfig).map(([role, config]) => {
          const count = mockUsers.filter((u) => u.role === role && u.active).length;
          const Icon = config.icon;
          return (
            <div key={role} className="kpi-card">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', config.color.split(' ')[0])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{config.label}s</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user, index) => {
              const RoleIcon = roleConfig[user.role].icon;
              return (
                <TableRow
                  key={user.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs gap-1', roleConfig[user.role].color)}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig[user.role].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        user.active
                          ? 'bg-success-bg text-success border-success/30'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {user.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.lastLogin
                      ? format(user.lastLogin, "dd/MM HH:mm", { locale: ptBR })
                      : 'Nunca'}
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
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Key className="h-4 w-4 mr-2" />
                          Resetar Senha
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Desativar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* New User Modal */}
      <Dialog open={newUserOpen} onOpenChange={setNewUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Adicione um novo usuário ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input placeholder="João da Silva" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="joao@aquagas.com" />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select defaultValue="operator">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([role, config]) => (
                    <SelectItem key={role} value={role}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setNewUserOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => {
                toast.success('Usuário criado com sucesso');
                setNewUserOpen(false);
              }}>
                Criar Usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Matriz de Permissões</DialogTitle>
            <DialogDescription>
              Visualize as permissões de cada papel no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permissão</TableHead>
                  {Object.entries(roleConfig).map(([role, config]) => (
                    <TableHead key={role} className="text-center">
                      {config.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="font-medium">{permission.name}</TableCell>
                    {Object.keys(roleConfig).map((role) => (
                      <TableCell key={role} className="text-center">
                        {permission.roles.includes(role) ? (
                          <span className="text-success">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
