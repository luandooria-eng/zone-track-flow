import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useProducts, useCreateStockMovement } from '@/hooks/useSupabaseQuery';
import { useVendors } from '@/hooks/useFinanceData';
import { format, addDays } from 'date-fns';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { NewVendorModal } from '@/components/finance/NewVendorModal';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPurchaseModal({ open, onOpenChange }: Props) {
  const { data: products = [] } = useProducts();
  const { data: vendors = [] } = useVendors();
  const createMovement = useCreateStockMovement();
  
  const [newVendorOpen, setNewVendorOpen] = useState(false);
  
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    vendor_id: '',
    purchase_value: '',
    is_paid: false,
    due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    reason: '',
    breakage_qty: '',
  });

  const activeProducts = products.filter(p => p.is_active);
  const selectedProduct = activeProducts.find(p => p.id === form.product_id);

  // Find vasilhame product (by SKU containing "vasilhame")
  const vasilhameProduct = products.find(p => 
    p.sku?.toLowerCase().includes('vasilhame') && p.is_active
  );

  // Auto-calculate value when product or quantity changes
  useEffect(() => {
    if (selectedProduct && form.quantity) {
      const quantity = parseInt(form.quantity) || 0;
      const cost = selectedProduct.cost || 0;
      const calculatedValue = (quantity * cost).toFixed(2);
      setForm(prev => ({ ...prev, purchase_value: calculatedValue }));
    }
  }, [form.product_id, form.quantity, selectedProduct]);

  // Calculate bonus based on product bonus_percent
  const calculateBonus = () => {
    if (!selectedProduct || !form.quantity) return { bonusQty: 0, bonusValue: 0 };
    const quantity = parseInt(form.quantity) || 0;
    const bonusPercent = (selectedProduct as any).bonus_percent || 0;
    if (bonusPercent <= 0) return { bonusQty: 0, bonusValue: 0 };
    
    const bonusQty = Math.floor((quantity * bonusPercent) / 100);
    const bonusValue = bonusQty * (selectedProduct.cost || 0);
    return { bonusQty, bonusValue };
  };

  const bonus = calculateBonus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.product_id) {
      toast.error('Selecione um produto');
      return;
    }
    
    if (!form.vendor_id) {
      toast.error('Selecione um fornecedor');
      return;
    }
    
    if (!form.quantity || parseInt(form.quantity) <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }
    
    if (!form.purchase_value || parseFloat(form.purchase_value) <= 0) {
      toast.error('Informe o valor da compra');
      return;
    }

    const breakageQty = form.breakage_qty ? parseInt(form.breakage_qty) : 0;
    
    // Validate breakage against vasilhame stock
    if (breakageQty > 0 && vasilhameProduct) {
      if (breakageQty > (vasilhameProduct.current_stock || 0)) {
        toast.error(`Quantidade de quebra (${breakageQty}) maior que estoque de vasilhames (${vasilhameProduct.current_stock})`);
        return;
      }
    }
    
    if (breakageQty > 0 && !vasilhameProduct) {
      toast.error('Produto "vasilhame" não encontrado. Cadastre um produto com SKU contendo "vasilhame".');
      return;
    }

    try {
      // 1. Register the purchase (stock in)
      await createMovement.mutateAsync({
        product_id: form.product_id,
        quantity: parseInt(form.quantity),
        type: 'in',
        reason: form.reason || 'Compra de estoque',
        vendor_id: form.vendor_id,
        purchase_value: parseFloat(form.purchase_value),
        is_paid: form.is_paid,
        due_date: !form.is_paid ? form.due_date : undefined,
      });

      // 2. If there's breakage, deduct from vasilhame stock
      if (breakageQty > 0 && vasilhameProduct) {
        await createMovement.mutateAsync({
          product_id: vasilhameProduct.id,
          quantity: -breakageQty,
          type: 'out',
          reason: `Quebra na compra - ${selectedProduct?.name || 'Produto'}`,
        });
      }

      onOpenChange(false);
      setForm({
        product_id: '',
        quantity: '',
        vendor_id: '',
        purchase_value: '',
        is_paid: false,
        due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        reason: '',
        breakage_qty: '',
      });
      
      const successMsg = breakageQty > 0 
        ? `Compra registrada! ${breakageQty} vasilhame(s) abatido(s) por quebra.`
        : 'Compra registrada com sucesso! Conta a pagar gerada automaticamente.';
      toast.success(successMsg);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Compra</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Produto *</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => setForm({ ...form, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {activeProducts.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Cadastre produtos em Configurações
                    </div>
                  ) : (
                    activeProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Estoque: {product.current_stock}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedProduct && (
                <p className="text-xs text-muted-foreground">
                  Estoque atual: {selectedProduct.current_stock} | Mínimo: {selectedProduct.min_stock} | 
                  <span className="font-medium"> Custo: R$ {(selectedProduct.cost || 0).toFixed(2)}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Valor Total (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.purchase_value}
                  onChange={(e) => setForm({ ...form, purchase_value: e.target.value })}
                  placeholder="0,00"
                  required
                />
                {selectedProduct && form.quantity && (
                  <p className="text-xs text-muted-foreground">
                    {form.quantity} × R$ {(selectedProduct.cost || 0).toFixed(2)} = R$ {form.purchase_value}
                  </p>
                )}
              </div>
            </div>

            {/* Bonus display */}
            {bonus.bonusQty > 0 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary">Bonificação</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedProduct as any)?.bonus_percent}% de {form.quantity} = {bonus.bonusQty} unidade(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">+{bonus.bonusQty}</p>
                    <p className="text-xs text-muted-foreground">R$ {bonus.bonusValue.toFixed(2)} em bônus</p>
                  </div>
                </div>
              </div>
            )}

            {/* Breakage field - only show for products with SKU containing "água" or similar */}
            {selectedProduct?.sku?.toLowerCase().includes('água') && (
              <div className="space-y-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <Label className="text-destructive">Quebra de Vasilhames</Label>
                <Input
                  type="number"
                  min="0"
                  max={vasilhameProduct?.current_stock || 0}
                  value={form.breakage_qty}
                  onChange={(e) => setForm({ ...form, breakage_qty: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Quantidade de galões quebrados que será abatida do estoque de vasilhames.
                  {vasilhameProduct && (
                    <span className="block mt-1">
                      Estoque atual de vasilhames: <strong>{vasilhameProduct.current_stock}</strong>
                    </span>
                  )}
                  {!vasilhameProduct && (
                    <span className="block mt-1 text-destructive">
                      ⚠️ Produto com SKU "vasilhame" não encontrado
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fornecedor *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setNewVendorOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Novo
                </Button>
              </div>
              <Select
                value={form.vendor_id}
                onValueChange={(v) => setForm({ ...form, vendor_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Cadastre fornecedores primeiro
                    </div>
                  ) : (
                    vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_paid"
                checked={form.is_paid}
                onCheckedChange={(checked) => setForm({ ...form, is_paid: !!checked })}
              />
              <Label htmlFor="is_paid" className="cursor-pointer">
                Pago na compra
              </Label>
            </div>

            {!form.is_paid && (
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Uma conta a pagar será criada automaticamente
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Notas sobre a compra..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registrar Compra
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <NewVendorModal open={newVendorOpen} onOpenChange={setNewVendorOpen} />
    </>
  );
}
