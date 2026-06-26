import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Package,
  CreditCard,
  Radio,
  Truck,
  MoreVertical,
  MapPin,
  Loader2,
  Pencil,
  Target,
  MessageSquare,
} from 'lucide-react';
import { Tag as TagIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useSalesChannels,
  useCreateSalesChannel,
  useUpdateSalesChannel,
  useDeliveryPeople,
  useCreateDeliveryPerson,
  useUpdateDeliveryPerson,
  useDeleteDeliveryPerson,
  useNeighborhoods,
  useCreateNeighborhood,
  useUpdateNeighborhood,
  useDeleteNeighborhood,
} from '@/hooks/useSupabaseQuery';
import { Checkbox } from '@/components/ui/checkbox';
import { EditProductModal } from '@/components/settings/EditProductModal';
import { SalesGoalsSettings } from '@/components/settings/SalesGoalsSettings';
import { AddressesSettings } from '@/components/settings/AddressesSettings';
import { MessageTemplatesSettings } from '@/components/settings/MessageTemplatesSettings';
import { QuickRepliesSettings } from '@/components/settings/QuickRepliesSettings';
import { CustomerTagsSettings } from '@/components/settings/CustomerTagsSettings';
import { AutoReactivationSettings } from '@/components/settings/AutoReactivationSettings';
import { Home } from 'lucide-react';

export default function Settings() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: paymentMethods = [], isLoading: paymentsLoading } = usePaymentMethods();
  const { data: salesChannels = [], isLoading: channelsLoading } = useSalesChannels();
  const { data: deliveryPeople = [], isLoading: deliveryLoading } = useDeliveryPeople();
  const { data: neighborhoods = [], isLoading: neighborhoodsLoading } = useNeighborhoods();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createPayment = useCreatePaymentMethod();
  const updatePayment = useUpdatePaymentMethod();
  const createChannel = useCreateSalesChannel();
  const updateChannel = useUpdateSalesChannel();
  const createDelivery = useCreateDeliveryPerson();
  const updateDelivery = useUpdateDeliveryPerson();
  const deleteDelivery = useDeleteDeliveryPerson();
  const createNeighborhood = useCreateNeighborhood();
  const updateNeighborhood = useUpdateNeighborhood();
  const deleteNeighborhood = useDeleteNeighborhood();

  const [activeTab, setActiveTab] = useState('products');
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [editProductOpen, setEditProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [editChannelOpen, setEditChannelOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const [newDeliveryOpen, setNewDeliveryOpen] = useState(false);
  const [newNeighborhoodOpen, setNewNeighborhoodOpen] = useState(false);

  // Forms
  const [productForm, setProductForm] = useState({ name: '', sku: '', price: '', cost: '', min_stock: '10' });
  const [paymentForm, setPaymentForm] = useState({ name: '', is_credit: false });
  const [channelForm, setChannelForm] = useState({ name: '', order_fee: '0', delivery_fee: '0' });
  const [editChannelForm, setEditChannelForm] = useState({ name: '', order_fee: '0', delivery_fee: '0' });
  const [deliveryForm, setDeliveryForm] = useState({ name: '', phone: '', vehicle_type: '' });
  const [neighborhoodForm, setNeighborhoodForm] = useState({ name: '', delivery_fee: '0' });

  // Product handlers
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct.mutateAsync({
      name: productForm.name,
      sku: productForm.sku || null,
      price: parseFloat(productForm.price) || 0,
      cost: parseFloat(productForm.cost) || 0,
      min_stock: parseInt(productForm.min_stock) || 10,
      current_stock: 0,
      reserved_stock: 0,
      unit: 'un',
      image_url: null,
      is_active: true,
    });
    setNewProductOpen(false);
    setProductForm({ name: '', sku: '', price: '', cost: '', min_stock: '10' });
  };

  // Payment handlers
  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPayment.mutateAsync({
      name: paymentForm.name,
      icon: null,
      requires_change: false,
      is_credit: paymentForm.is_credit,
      is_active: true,
    });
    setNewPaymentOpen(false);
    setPaymentForm({ name: '', is_credit: false });
  };

  // Channel handlers
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    await createChannel.mutateAsync({
      name: channelForm.name,
      icon: null,
      is_active: true,
      order_fee: parseFloat(channelForm.order_fee) || 0,
      delivery_fee: parseFloat(channelForm.delivery_fee) || 0,
    } as any);
    setNewChannelOpen(false);
    setChannelForm({ name: '', order_fee: '0', delivery_fee: '0' });
  };

  // Delivery handlers
  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDelivery.mutateAsync({
      name: deliveryForm.name,
      phone: deliveryForm.phone || null,
      vehicle_type: deliveryForm.vehicle_type || null,
      is_active: true,
    });
    setNewDeliveryOpen(false);
    setDeliveryForm({ name: '', phone: '', vehicle_type: '' });
  };

  // Neighborhood handlers
  const handleCreateNeighborhood = async (e: React.FormEvent) => {
    e.preventDefault();
    await createNeighborhood.mutateAsync({
      name: neighborhoodForm.name,
      delivery_fee: parseFloat(neighborhoodForm.delivery_fee) || 0,
      is_active: true,
    });
    setNewNeighborhoodOpen(false);
    setNeighborhoodForm({ name: '', delivery_fee: '0' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie produtos, pagamentos, canais, entregadores e bairros
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-6xl grid-cols-9">
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-2">
            <Radio className="h-4 w-4" />
            Canais
          </TabsTrigger>
          <TabsTrigger value="delivery" className="gap-2">
            <Truck className="h-4 w-4" />
            Entregadores
          </TabsTrigger>
          <TabsTrigger value="neighborhoods" className="gap-2">
            <MapPin className="h-4 w-4" />
            Bairros
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <Home className="h-4 w-4" />
            Endereços
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <Target className="h-4 w-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="customer-tags" className="gap-2">
            <TagIcon className="h-4 w-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="auto-reactivation" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Reativação
          </TabsTrigger>
        </TabsList>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          <SalesGoalsSettings />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <MessageTemplatesSettings />
          <div className="border-t pt-6">
            <QuickRepliesSettings />
          </div>
        </TabsContent>

        {/* Customer Tags Tab */}
        <TabsContent value="customer-tags" className="space-y-4">
          <CustomerTagsSettings />
        </TabsContent>

        {/* Auto Reactivation Tab */}
        <TabsContent value="auto-reactivation" className="space-y-4">
          <AutoReactivationSettings />
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setNewProductOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Bonificação</TableHead>
                  <TableHead>Estoque Mín.</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : products.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</TableCell></TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku || '-'}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                      <TableCell>{product.cost ? `R$ ${product.cost.toFixed(2)}` : '-'}</TableCell>
                      <TableCell>{(product as any).bonus_percent ? `${(product as any).bonus_percent}%` : '-'}</TableCell>
                      <TableCell>{product.min_stock}</TableCell>
                      <TableCell>
                        <Switch
                          checked={product.is_active}
                          onCheckedChange={(checked) => updateProduct.mutate({ id: product.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedProduct(product); setEditProductOpen(true); }}>
                              <Pencil className="h-4 w-4 mr-2" />Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteProduct.mutate(product.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setNewPaymentOpen(true)}>
              <Plus className="h-4 w-4" />Nova Forma
            </Button>
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Crediário</TableHead>
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsLoading ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : paymentMethods.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhuma forma cadastrada</TableCell></TableRow>
                ) : (
                  paymentMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">{method.name}</TableCell>
                      <TableCell>{method.is_credit ? 'Sim' : 'Não'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={method.is_active}
                          onCheckedChange={(checked) => updatePayment.mutate({ id: method.id, is_active: checked })}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Sales Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setNewChannelOpen(true)}>
              <Plus className="h-4 w-4" />Novo Canal
            </Button>
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Taxa App</TableHead>
                  <TableHead>Taxa Entrega</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelsLoading ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                 ) : salesChannels.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum canal cadastrado</TableCell></TableRow>
                ) : (
                  salesChannels.map((channel) => (
                    <TableRow key={channel.id}>
                      <TableCell className="font-medium">{channel.name}</TableCell>
                       <TableCell>R$ {((channel as any).order_fee || 0).toFixed(2)}</TableCell>
                       <TableCell>R$ {((channel as any).delivery_fee || 0).toFixed(2)}</TableCell>
                       <TableCell>
                        <Switch
                          checked={channel.is_active}
                          onCheckedChange={(checked) => updateChannel.mutate({ id: channel.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedChannel(channel);
                            setEditChannelForm({
                              name: channel.name,
                              order_fee: String((channel as any).order_fee || 0),
                              delivery_fee: String((channel as any).delivery_fee || 0),
                            });
                            setEditChannelOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Delivery People Tab */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setNewDeliveryOpen(true)}>
              <Plus className="h-4 w-4" />Novo Entregador
            </Button>
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : deliveryPeople.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum entregador cadastrado</TableCell></TableRow>
                ) : (
                  deliveryPeople.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell>{person.phone || '-'}</TableCell>
                      <TableCell>{person.vehicle_type || '-'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={person.is_active}
                          onCheckedChange={(checked) => updateDelivery.mutate({ id: person.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteDelivery.mutate(person.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Neighborhoods Tab */}
        <TabsContent value="neighborhoods" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setNewNeighborhoodOpen(true)}>
              <Plus className="h-4 w-4" />Novo Bairro
            </Button>
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Taxa de Entrega</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {neighborhoodsLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : neighborhoods.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum bairro cadastrado</TableCell></TableRow>
                ) : (
                  neighborhoods.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.name}</TableCell>
                      <TableCell>R$ {n.delivery_fee.toFixed(2)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={n.is_active}
                          onCheckedChange={(checked) => updateNeighborhood.mutate({ id: n.id, is_active: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteNeighborhood.mutate(n.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses" className="space-y-4">
          <AddressesSettings />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Produto</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nome *</Label>
                <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Preço *</Label>
                <Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Custo</Label>
                <Input type="number" step="0.01" value={productForm.cost} onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Estoque Mínimo</Label>
                <Input type="number" value={productForm.min_stock} onChange={(e) => setProductForm({ ...productForm, min_stock: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setNewProductOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Cadastrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newPaymentOpen} onOpenChange={setNewPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Forma de Pagamento</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={paymentForm.name} onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })} required />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="is_credit" checked={paymentForm.is_credit} onCheckedChange={(checked) => setPaymentForm({ ...paymentForm, is_credit: !!checked })} />
              <Label htmlFor="is_credit">É crediário (requer data de vencimento)</Label>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setNewPaymentOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createPayment.isPending}>
                {createPayment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Cadastrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Canal de Venda</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateChannel} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={channelForm.name} onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Taxa do App (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={channelForm.order_fee} 
                onChange={(e) => setChannelForm({ ...channelForm, order_fee: e.target.value })} 
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Taxa fixa do aplicativo por pedido (ex: R$ 0,50)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Taxa de Entrega (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={channelForm.delivery_fee} 
                onChange={(e) => setChannelForm({ ...channelForm, delivery_fee: e.target.value })} 
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Taxa fixa de entrega por pedido (ex: R$ 2,00)
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setNewChannelOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createChannel.isPending}>
                {createChannel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Cadastrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editChannelOpen} onOpenChange={setEditChannelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Canal de Venda</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!selectedChannel) return;
            updateChannel.mutate({
              id: selectedChannel.id,
              name: editChannelForm.name,
              order_fee: parseFloat(editChannelForm.order_fee) || 0,
              delivery_fee: parseFloat(editChannelForm.delivery_fee) || 0,
            } as any);
            setEditChannelOpen(false);
            toast.success('Canal atualizado!');
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={editChannelForm.name} onChange={(e) => setEditChannelForm({ ...editChannelForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Taxa do App (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={editChannelForm.order_fee} 
                onChange={(e) => setEditChannelForm({ ...editChannelForm, order_fee: e.target.value })} 
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">Taxa fixa do aplicativo por pedido</p>
            </div>
            <div className="space-y-2">
              <Label>Taxa de Entrega (R$)</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={editChannelForm.delivery_fee} 
                onChange={(e) => setEditChannelForm({ ...editChannelForm, delivery_fee: e.target.value })} 
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">Taxa fixa de entrega por pedido</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditChannelOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateChannel.isPending}>
                {updateChannel.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newDeliveryOpen} onOpenChange={setNewDeliveryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Entregador</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateDelivery} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={deliveryForm.name} onChange={(e) => setDeliveryForm({ ...deliveryForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={deliveryForm.phone} onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Veículo</Label>
              <Input value={deliveryForm.vehicle_type} onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicle_type: e.target.value })} placeholder="Moto, Carro..." />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setNewDeliveryOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createDelivery.isPending}>
                {createDelivery.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Cadastrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newNeighborhoodOpen} onOpenChange={setNewNeighborhoodOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Bairro</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateNeighborhood} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={neighborhoodForm.name} onChange={(e) => setNeighborhoodForm({ ...neighborhoodForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Taxa de Entrega (R$)</Label>
              <Input type="number" step="0.01" value={neighborhoodForm.delivery_fee} onChange={(e) => setNeighborhoodForm({ ...neighborhoodForm, delivery_fee: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setNewNeighborhoodOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createNeighborhood.isPending}>
                {createNeighborhood.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Cadastrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <EditProductModal 
        open={editProductOpen} 
        onOpenChange={setEditProductOpen} 
        product={selectedProduct} 
      />
    </div>
  );
}
