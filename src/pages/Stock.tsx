import { useState, useMemo } from 'react';
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
  Package,
  AlertTriangle,
  ArrowUpDown,
  MoreVertical,
  History,
  Download,
  Loader2,
  ArrowUp,
  ArrowDown,
  ShoppingCart,
} from 'lucide-react';
import { NewPurchaseModal } from '@/components/stock/NewPurchaseModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  useProducts,
  useStockMovements,
  useCreateStockMovement,
  exportToCSV,
} from '@/hooks/useSupabaseQuery';
import { useVendors } from '@/hooks/useFinanceData';
import { useProductSalesAverage } from '@/hooks/useProductSalesAverage';
import { toast } from 'sonner';
import type { Product } from '@/types/database';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Stock() {
  const { data: products = [], isLoading } = useProducts();
  const { data: movements = [] } = useStockMovements();
  const { data: vendors = [] } = useVendors();
  const { data: salesAverages = {} } = useProductSalesAverage(30);
  const createMovement = useCreateStockMovement();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('inventory');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [stockEntryOpen, setStockEntryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Stock entry form
  const [entryForm, setEntryForm] = useState({
    type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: '',
    reason: '',
    vendor_id: '',
    purchase_value: '',
    is_paid: false,
    due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  });

  const stockData = useMemo(() => {
    return products.map((product) => {
      // Get real sales average from the last 30 days
      const salesData = salesAverages[product.id];
      const avgSalesPerDay = salesData?.avgPerDay || 0;
      const totalSold30Days = salesData?.totalQty || 0;
      
      // Calculate coverage in days (avoid division by zero)
      const coverageDays = avgSalesPerDay > 0 
        ? Math.floor(product.current_stock / avgSalesPerDay) 
        : product.current_stock > 0 ? 999 : 0; // 999 = no sales, infinite coverage
      
      const stockPercentage = product.min_stock > 0 
        ? (product.current_stock / (product.min_stock * 3)) * 100 
        : 100;
      
      return {
        ...product,
        avgSalesPerDay: Math.round(avgSalesPerDay * 10) / 10, // Round to 1 decimal
        totalSold30Days,
        coverageDays: coverageDays > 999 ? 999 : coverageDays,
        stockPercentage: Math.min(100, stockPercentage),
        status:
          product.current_stock <= product.min_stock
            ? 'critical'
            : coverageDays <= 3 && avgSalesPerDay > 0
            ? 'low'
            : 'normal',
      };
    });
  }, [products, salesAverages]);

  const filteredStock = stockData.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'critical':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Crítico
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Baixo
          </Badge>
        );
      default:
        return (
          <Badge className="bg-success-bg text-success border-success/30">
            Normal
          </Badge>
        );
    }
  };

  const handleStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    // Validate vendor and value for 'in' type
    if (entryForm.type === 'in') {
      if (!entryForm.vendor_id) {
        toast.error('Selecione um fornecedor para entrada de estoque');
        return;
      }
      if (!entryForm.purchase_value || parseFloat(entryForm.purchase_value) <= 0) {
        toast.error('Informe o valor da compra');
        return;
      }
    }

    const quantity = parseInt(entryForm.quantity);
    const adjustedQuantity = entryForm.type === 'out' ? -quantity : quantity;

    await createMovement.mutateAsync({
      product_id: selectedProduct.id,
      quantity: adjustedQuantity,
      type: entryForm.type,
      reason: entryForm.reason || undefined,
      vendor_id: entryForm.type === 'in' ? entryForm.vendor_id : undefined,
      purchase_value: entryForm.type === 'in' ? parseFloat(entryForm.purchase_value) : undefined,
      is_paid: entryForm.type === 'in' ? entryForm.is_paid : undefined,
      due_date: entryForm.type === 'in' && !entryForm.is_paid ? entryForm.due_date : undefined,
    });

    setStockEntryOpen(false);
    setEntryForm({ 
      type: 'in', 
      quantity: '', 
      reason: '', 
      vendor_id: '', 
      purchase_value: '', 
      is_paid: false,
      due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    });
    setSelectedProduct(null);
  };

  const handleExport = () => {
    const exportData = filteredStock.map(item => ({
      SKU: item.sku || '',
      Nome: item.name,
      Preço: item.price,
      Custo: item.cost,
      'Estoque Atual': item.current_stock,
      'Estoque Mínimo': item.min_stock,
      'Cobertura (dias)': item.coverageDays,
      Status: item.status === 'critical' ? 'Crítico' : item.status === 'low' ? 'Baixo' : 'Normal',
    }));
    exportToCSV(exportData, 'estoque');
  };

  const productMovements = movements.filter(m => m.product_id === selectedProduct?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">Controle de saldos e movimentações</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button className="gap-2" onClick={() => setPurchaseOpen(true)}>
            <ShoppingCart className="h-4 w-4" />
            Adicionar Compra
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="kpi-card">
          <p className="text-sm font-medium text-muted-foreground">Total Produtos</p>
          <p className="text-2xl font-bold">{stockData.length}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm font-medium text-muted-foreground">Estoque Crítico</p>
          <p className="text-2xl font-bold text-destructive">
            {stockData.filter((s) => s.status === 'critical').length}
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-sm font-medium text-muted-foreground">Cobertura Baixa</p>
          <p className="text-2xl font-bold text-warning">
            {stockData.filter((s) => s.status === 'low').length}
          </p>
        </div>
        <div className="kpi-card">
          <p className="text-sm font-medium text-muted-foreground">Normal</p>
          <p className="text-2xl font-bold text-success">
            {stockData.filter((s) => s.status === 'normal').length}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="inventory">Inventário</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Mín.</TableHead>
                  <TableHead className="text-right">Média/Dia</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredStock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum produto encontrado</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Cadastre produtos em Configurações e depois registre compras aqui.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStock.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={cn('animate-fade-up', item.status === 'critical' && 'bg-destructive/5')}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.sku && <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">R$ {item.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">{item.current_stock}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{item.min_stock}</TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">
                          {item.avgSalesPerDay > 0 ? item.avgSalesPerDay : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'font-semibold', 
                          item.coverageDays <= 3 && item.avgSalesPerDay > 0 && 'text-warning', 
                          item.coverageDays <= 1 && item.avgSalesPerDay > 0 && 'text-destructive'
                        )}>
                          {item.coverageDays >= 999 ? '∞' : `${item.coverageDays} dias`}
                        </span>
                      </TableCell>
                      <TableCell className="w-32">
                        <Progress
                          value={item.stockPercentage}
                          className={cn('h-2', item.status === 'critical' && '[&>div]:bg-destructive', item.status === 'low' && '[&>div]:bg-warning')}
                        />
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedProduct(item);
                              setHistoryOpen(true);
                            }}>
                              <History className="h-4 w-4 mr-2" />
                              Ver Histórico
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedProduct(item);
                              setStockEntryOpen(true);
                            }}>
                              <ArrowUpDown className="h-4 w-4 mr-2" />
                              Movimentar Estoque
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

        <TabsContent value="movements" className="mt-4">
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Estoque Anterior</TableHead>
                  <TableHead className="text-right">Estoque Atual</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma movimentação registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.slice(0, 50).map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">
                        {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{mov.product?.name}</TableCell>
                      <TableCell>
                        <Badge variant={mov.type === 'in' ? 'default' : mov.type === 'out' ? 'destructive' : 'secondary'}>
                          {mov.type === 'in' ? (
                            <><ArrowUp className="h-3 w-3 mr-1" />Entrada</>
                          ) : mov.type === 'out' ? (
                            <><ArrowDown className="h-3 w-3 mr-1" />Saída</>
                          ) : (
                            'Ajuste'
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn('text-right font-semibold', mov.quantity > 0 ? 'text-success' : 'text-destructive')}>
                        {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{mov.previous_stock}</TableCell>
                      <TableCell className="text-right">{mov.new_stock}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{mov.reason || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Purchase Modal */}
      <NewPurchaseModal open={purchaseOpen} onOpenChange={setPurchaseOpen} />

      {/* Stock Entry Modal */}
      <Dialog open={stockEntryOpen} onOpenChange={setStockEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentar Estoque - {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStockEntry} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Movimentação</Label>
              <Select value={entryForm.type} onValueChange={(v: any) => setEntryForm({ ...entryForm, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="adjustment">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                value={entryForm.quantity}
                onChange={(e) => setEntryForm({ ...entryForm, quantity: e.target.value })}
                placeholder="0"
                required
              />
            </div>
            
            {/* Vendor and purchase fields - only for 'in' type */}
            {entryForm.type === 'in' && (
              <>
                <div className="space-y-2">
                  <Label>Fornecedor *</Label>
                  <Select 
                    value={entryForm.vendor_id} 
                    onValueChange={(v) => setEntryForm({ ...entryForm, vendor_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor da Compra (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entryForm.purchase_value}
                    onChange={(e) => setEntryForm({ ...entryForm, purchase_value: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_paid"
                    checked={entryForm.is_paid}
                    onCheckedChange={(checked) => setEntryForm({ ...entryForm, is_paid: !!checked })}
                  />
                  <Label htmlFor="is_paid" className="cursor-pointer">
                    Pago na compra
                  </Label>
                </div>
                {!entryForm.is_paid && (
                  <div className="space-y-2">
                    <Label>Vencimento</Label>
                    <Input
                      type="date"
                      value={entryForm.due_date}
                      onChange={(e) => setEntryForm({ ...entryForm, due_date: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}
            
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={entryForm.reason}
                onChange={(e) => setEntryForm({ ...entryForm, reason: e.target.value })}
                placeholder="Motivo da movimentação..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setStockEntryOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Sheet */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-[500px]">
          <SheetHeader>
            <SheetTitle>Histórico - {selectedProduct?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {productMovements.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhuma movimentação</p>
            ) : (
              productMovements.map((mov) => (
                <div key={mov.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    mov.quantity > 0 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  )}>
                    {mov.quantity > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {mov.type === 'in' ? 'Entrada' : mov.type === 'out' ? 'Saída' : 'Ajuste'}
                      </span>
                      <span className={cn('font-bold', mov.quantity > 0 ? 'text-success' : 'text-destructive')}>
                        {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {mov.previous_stock} → {mov.new_stock}
                    </p>
                    {mov.reason && <p className="text-sm mt-1">{mov.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(mov.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
