import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, Plus, User, MapPin, DollarSign, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, Users, Phone, Calendar, 
  MoreVertical, Eye, Edit, Trash2, Loader2, ChevronRight, RefreshCw, Calculator
} from 'lucide-react';
import { NewCustomerModal } from '@/components/customers/NewCustomerModal';
import { CustomerProfileDrawer } from '@/components/customers/CustomerProfileDrawer';
import { EditCustomerModal } from '@/components/customers/EditCustomerModal';
import { ConsumptionAlertsPanel } from '@/components/customers/ConsumptionAlertsPanel';
import { BaseFrequencyPanel } from '@/components/customers/BaseFrequencyPanel';
import { RevenueProjectionPanel } from '@/components/customers/RevenueProjectionPanel';
import { ConsumptionOverviewPanel } from '@/components/customers/ConsumptionOverviewPanel';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCustomers, useDeleteCustomer, CustomerFromDB } from '@/hooks/useCustomers';
import { useCustomerTags, useAllCustomerTagAssignments } from '@/hooks/useCustomerTags';
import { useRecalculateConsumption } from '@/hooks/useRecalculateConsumption';

// Local Customer type for UI
interface CustomerTag {
  id: string;
  name: string;
  color: string;
}

interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  tags: CustomerTag[];
  totalOrders: number;
  totalRevenue: number;
  lastOrderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to convert DB customer to UI format
function mapCustomerFromDB(c: CustomerFromDB, customerTags: CustomerTag[]): Customer {
  return {
    id: c.id,
    name: c.name,
    cpf: c.cpf || '',
    phone: c.phone || '',
    email: c.email || undefined,
    address: {
      street: c.street || '',
      number: c.number || '',
      complement: c.complement || undefined,
      neighborhood: c.neighborhood?.name || '',
      city: '',
      state: '',
      zipCode: '',
    },
    tags: customerTags,
    totalOrders: c.total_orders || 0,
    totalRevenue: c.total_spent || 0,
    lastOrderDate: c.last_order_at ? new Date(c.last_order_at) : undefined,
    createdAt: new Date(c.created_at),
    updatedAt: new Date(c.updated_at),
    // Pass through extra DB fields
    neighborhood_id: c.neighborhood_id,
    neighborhood: c.neighborhood,
    top_product: c.top_product,
    top_payment_method: c.top_payment_method,
  } as Customer & { neighborhood_id?: string; neighborhood?: any; top_product?: any; top_payment_method?: any };
}

type EngagementStatus = 'active' | 'at_risk' | 'lost';

interface NeighborhoodData {
  name: string;
  customers: number;
  orders: number;
  revenue: number;
  avgTicket: number;
  active: number;
  atRisk: number;
  lost: number;
}

interface StreetData {
  name: string;
  neighborhood: string;
  customers: number;
  orders: number;
  revenue: number;
}

function getEngagementStatus(lastOrderDate?: Date): EngagementStatus {
  if (!lastOrderDate) return 'lost';
  const days = differenceInDays(new Date(), lastOrderDate);
  if (days <= 29) return 'active';
  if (days <= 60) return 'at_risk';
  return 'lost';
}

function getDaysSinceLastOrder(lastOrderDate?: Date): number {
  if (!lastOrderDate) return 999;
  return differenceInDays(new Date(), lastOrderDate);
}

const engagementConfig: Record<EngagementStatus, { label: string; className: string; icon: React.ReactNode }> = {
  active: { 
    label: 'Ativo', 
    className: 'bg-success-bg text-success border-success/30',
    icon: <CheckCircle className="h-4 w-4" />
  },
  at_risk: { 
    label: 'Em Risco', 
    className: 'bg-warning-bg text-warning border-warning/30',
    icon: <AlertTriangle className="h-4 w-4" />
  },
  lost: { 
    label: 'Perdido', 
    className: 'bg-destructive-bg text-destructive border-destructive/30',
    icon: <XCircle className="h-4 w-4" />
  },
};

function getTagStyle(color: string) {
  // Convert hex color to rgba for background and text
  return {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}50`,
  };
}

export default function Customers() {
  const { data: customersFromDB = [], isLoading } = useCustomers();
  const { data: allAvailableTags = [] } = useCustomerTags();
  const { data: allTagAssignments = [] } = useAllCustomerTagAssignments();
  const deleteCustomerMutation = useDeleteCustomer();
  const { recalculateAll, isRecalculating, progress } = useRecalculateConsumption();
  
  // Map DB customers to UI format with their tags
  const customers = useMemo(() => {
    return customersFromDB.map((c) => {
      // Get tags for this customer
      const customerTagAssignments = allTagAssignments.filter(
        (a: any) => a.customer_id === c.id && a.tag?.is_active
      );
      const customerTags: CustomerTag[] = customerTagAssignments
        .map((a: any) => a.tag)
        .filter(Boolean);
      
      return mapCustomerFromDB(c, customerTags);
    });
  }, [customersFromDB, allTagAssignments]);
  
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedEngagement, setSelectedEngagement] = useState<EngagementStatus | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);

  const handleRecalculateConsumption = async () => {
    try {
      const result = await recalculateAll();
      if (result.success) {
        const withData = result.results?.length || 0;
        toast.success(
          `Consumo recalculado! ${result.processed} clientes processados, ${withData} com histórico de pedidos.`
        );
      }
    } catch (error) {
      toast.error('Erro ao recalcular consumo');
    }
  };

  // Calculate engagement stats
  const engagementStats = useMemo(() => {
    const stats = { active: 0, at_risk: 0, lost: 0 };
    customers.forEach(customer => {
      const status = getEngagementStatus(customer.lastOrderDate);
      stats[status]++;
    });
    return stats;
  }, [customers]);

  // Calculate neighborhood data
  const neighborhoodData = useMemo((): NeighborhoodData[] => {
    const neighborhoods = new Map<string, NeighborhoodData>();
    
    customers.forEach(customer => {
      const name = customer.address.neighborhood;
      if (!name) return;
      
      const existing = neighborhoods.get(name) || {
        name,
        customers: 0,
        orders: 0,
        revenue: 0,
        avgTicket: 0,
        active: 0,
        atRisk: 0,
        lost: 0,
      };
      
      existing.customers++;
      existing.orders += customer.totalOrders || 0;
      existing.revenue += customer.totalRevenue || 0;
      
      const status = getEngagementStatus(customer.lastOrderDate);
      if (status === 'active') existing.active++;
      else if (status === 'at_risk') existing.atRisk++;
      else existing.lost++;
      
      neighborhoods.set(name, existing);
    });
    
    return Array.from(neighborhoods.values())
      .map(n => ({ ...n, avgTicket: n.orders > 0 ? n.revenue / n.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [customers]);

  // Calculate street data for selected neighborhood
  const streetData = useMemo((): StreetData[] => {
    if (!selectedNeighborhood) return [];
    
    const streets = new Map<string, StreetData>();
    
    customers
      .filter(c => c.address.neighborhood === selectedNeighborhood)
      .forEach(customer => {
        const name = customer.address.street;
        const existing = streets.get(name) || {
          name,
          neighborhood: selectedNeighborhood,
          customers: 0,
          orders: 0,
          revenue: 0,
        };
        
        existing.customers++;
        existing.orders += customer.totalOrders || 0;
        existing.revenue += customer.totalRevenue || 0;
        
        streets.set(name, existing);
      });
    
    return Array.from(streets.values()).sort((a, b) => b.revenue - a.revenue);
  }, [customers, selectedNeighborhood]);

  const filteredCustomers = customers.filter((customer) => {
    const norm = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const q = norm(search);
    const matchesSearch =
      norm(customer.name).includes(q) ||
      (customer.cpf || '').includes(search) ||
      (customer.phone || '').includes(search);

    const matchesTag = !selectedTag || customer.tags.some(t => t.id === selectedTag);
    
    const matchesEngagement = !selectedEngagement || 
      getEngagementStatus(customer.lastOrderDate) === selectedEngagement;

    return matchesSearch && matchesTag && matchesEngagement;
  });

  const openProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setProfileOpen(true);
  };

  const openEdit = (customer: Customer, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedCustomer(customer);
    setEditCustomerOpen(true);
  };

  const openProfileById = (customerId: string, customerName: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setSelectedCustomer(customer);
      setProfileOpen(true);
    }
  };

  const handleDeleteCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomerMutation.mutate(id, {
      onSuccess: () => toast.success('Cliente excluído com sucesso!'),
      onError: () => toast.error('Erro ao excluir cliente'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie sua base de clientes e analise engajamento
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleRecalculateConsumption}
            disabled={isRecalculating}
          >
            {isRecalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress}%
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Recalcular Consumo
              </>
            )}
          </Button>
          <Button className="gap-2" onClick={() => setNewCustomerOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Engagement KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="kpi-card">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customers.length}</p>
              <p className="text-sm text-muted-foreground">Total de Clientes</p>
            </div>
          </div>
        </div>
        <div 
          className={cn(
            "kpi-card cursor-pointer transition-all hover:ring-2 hover:ring-success/50",
            selectedEngagement === 'active' && "ring-2 ring-success"
          )}
          onClick={() => setSelectedEngagement(selectedEngagement === 'active' ? null : 'active')}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{engagementStats.active}</p>
              <p className="text-sm text-muted-foreground">Ativos (0-29 dias)</p>
            </div>
          </div>
        </div>
        <div 
          className={cn(
            "kpi-card cursor-pointer transition-all hover:ring-2 hover:ring-warning/50",
            selectedEngagement === 'at_risk' && "ring-2 ring-warning"
          )}
          onClick={() => setSelectedEngagement(selectedEngagement === 'at_risk' ? null : 'at_risk')}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">{engagementStats.at_risk}</p>
              <p className="text-sm text-muted-foreground">Em Risco (30-60 dias)</p>
            </div>
          </div>
        </div>
        <div 
          className={cn(
            "kpi-card cursor-pointer transition-all hover:ring-2 hover:ring-destructive/50",
            selectedEngagement === 'lost' && "ring-2 ring-destructive"
          )}
          onClick={() => setSelectedEngagement(selectedEngagement === 'lost' ? null : 'lost')}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-bg">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{engagementStats.lost}</p>
              <p className="text-sm text-muted-foreground">Perdidos (60+ dias)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Base Frequency and Revenue Projection Panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BaseFrequencyPanel />
        <RevenueProjectionPanel />
      </div>

      {/* Consumption Overview Panel */}
      <ConsumptionOverviewPanel onCustomerClick={openProfileById} />

      {/* Consumption Alerts Panel */}
      <ConsumptionAlertsPanel onCustomerClick={openProfileById} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Lista de Clientes</TabsTrigger>
          <TabsTrigger value="location">Por Localização</TabsTrigger>
        </TabsList>

        {/* Customer List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {allAvailableTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedTag === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTag(null)}
                >
                  Todas Tags
                </Button>
                {allAvailableTags.map((tag) => (
                  <Button
                    key={tag.id}
                    variant={selectedTag === tag.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTag(tag.id)}
                    style={{ 
                      backgroundColor: selectedTag === tag.id ? tag.color : undefined,
                      borderColor: tag.color,
                      color: selectedTag === tag.id ? '#fff' : tag.color,
                    }}
                  >
                    {tag.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Engagement Filter Display */}
          {selectedEngagement && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filtrando por:</span>
              <Badge variant="outline" className={cn(engagementConfig[selectedEngagement].className)}>
                {engagementConfig[selectedEngagement].icon}
                <span className="ml-1">{engagementConfig[selectedEngagement].label}</span>
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEngagement(null)}>
                Limpar
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            {filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhum cliente cadastrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Clique em "Novo Cliente" para começar a cadastrar.
                </p>
                <Button onClick={() => setNewCustomerOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Cliente
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Cliente</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Engajamento</TableHead>
                    <TableHead>Última Compra</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer, index) => {
                    const engagementStatus = getEngagementStatus(customer.lastOrderDate);
                    const daysSince = getDaysSinceLastOrder(customer.lastOrderDate);
                    
                    return (
                      <TableRow
                        key={customer.id}
                        className="animate-fade-up cursor-pointer hover:bg-muted/30"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => openProfile(customer)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                              {customer.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium">{customer.name}</p>
                              {customer.email && (
                                <p className="text-xs text-muted-foreground">
                                  {customer.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {customer.cpf || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {customer.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {customer.address.neighborhood || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', engagementConfig[engagementStatus].className)}>
                            {engagementConfig[engagementStatus].icon}
                            <span className="ml-1">{engagementConfig[engagementStatus].label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {customer.lastOrderDate ? (
                              <div>
                                <p>{format(customer.lastOrderDate, "dd/MM/yyyy", { locale: ptBR })}</p>
                                <p className="text-xs text-muted-foreground">{daysSince} dias atrás</p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Sem compras</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {customer.tags.length > 0 ? customer.tags.map((tag) => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-xs"
                                style={getTagStyle(tag.color)}
                              >
                                {tag.name}
                              </Badge>
                            )) : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openProfile(customer)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Perfil
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => openEdit(customer, e)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={(e) => handleDeleteCustomer(customer.id, e)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Neighborhoods Ranking */}
            <div className="rounded-xl border bg-card shadow-card p-6">
              <h3 className="text-lg font-semibold mb-4">Ranking de Bairros</h3>
              {neighborhoodData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Cadastre clientes com bairro para visualizar o ranking.
                </p>
              ) : (
                <div className="space-y-3">
                  {neighborhoodData.map((neighborhood, index) => (
                    <div
                      key={neighborhood.name}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
                        selectedNeighborhood === neighborhood.name
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "bg-muted/30 hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedNeighborhood(
                        selectedNeighborhood === neighborhood.name ? null : neighborhood.name
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{neighborhood.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {neighborhood.customers} clientes • {neighborhood.orders} pedidos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">R$ {neighborhood.revenue.toFixed(2)}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px] bg-success-bg text-success">
                            {neighborhood.active}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-warning-bg text-warning">
                            {neighborhood.atRisk}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-destructive-bg text-destructive">
                            {neighborhood.lost}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Street Drilldown */}
            <div className="rounded-xl border bg-card shadow-card p-6">
              <h3 className="text-lg font-semibold mb-4">
                {selectedNeighborhood ? `Ruas em ${selectedNeighborhood}` : 'Selecione um Bairro'}
              </h3>
              {!selectedNeighborhood ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mb-4" />
                  <p>Clique em um bairro para ver as ruas</p>
                </div>
              ) : streetData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma rua encontrada neste bairro.
                </p>
              ) : (
                <div className="space-y-2">
                  {streetData.map((street) => (
                    <div
                      key={street.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div>
                        <p className="font-medium">{street.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {street.customers} clientes • {street.orders} pedidos
                        </p>
                      </div>
                      <p className="font-semibold">R$ {street.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Customers in selected neighborhood */}
              {selectedNeighborhood && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3">Clientes em {selectedNeighborhood}</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {customers
                      .filter((c) => c.address.neighborhood === selectedNeighborhood)
                      .map((customer) => (
                        <div
                          key={customer.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 cursor-pointer"
                          onClick={() => openProfile(customer)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              {customer.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">{customer.address.street}</p>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', engagementConfig[getEngagementStatus(customer.lastOrderDate)].className)}
                          >
                            {engagementConfig[getEngagementStatus(customer.lastOrderDate)].label}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NewCustomerModal open={newCustomerOpen} onOpenChange={setNewCustomerOpen} />
      
      <EditCustomerModal 
        customer={selectedCustomer} 
        open={editCustomerOpen} 
        onOpenChange={setEditCustomerOpen} 
      />
      
      <CustomerProfileDrawer
        customer={selectedCustomer}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onEdit={(customer) => {
          setSelectedCustomer(customer as any);
          setEditCustomerOpen(true);
        }}
      />
    </div>
  );
}
