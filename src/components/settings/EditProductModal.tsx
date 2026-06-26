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
import { useUpdateProduct, usePaymentMethods, useSalesChannels } from '@/hooks/useSupabaseQuery';
import { useProductPaymentPrices, useUpsertProductPaymentPrice, useDeleteProductPaymentPrice } from '@/hooks/useProductPaymentPrices';
import { useProductChannelPrices, useUpsertProductChannelPrice, useDeleteProductChannelPrice } from '@/hooks/useProductChannelPrices';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number | null;
  min_stock: number | null;
  bonus_percent?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function EditProductModal({ open, onOpenChange, product }: Props) {
  const updateProduct = useUpdateProduct();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: salesChannels = [] } = useSalesChannels();
  const { data: productPrices = [] } = useProductPaymentPrices(product?.id);
  const { data: channelPrices = [] } = useProductChannelPrices(product?.id);
  
  const upsertPaymentPrice = useUpsertProductPaymentPrice();
  const deletePaymentPrice = useDeleteProductPaymentPrice();
  const upsertChannelPrice = useUpsertProductChannelPrice();
  const deleteChannelPrice = useDeleteProductChannelPrice();
  
  const [form, setForm] = useState({
    name: '',
    sku: '',
    price: '',
    cost: '',
    min_stock: '',
    bonus_percent: '',
  });

  const [newPaymentPrice, setNewPaymentPrice] = useState({ payment_method_id: '', price: '' });
  const [newChannelPrice, setNewChannelPrice] = useState({ channel_id: '', price: '' });

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        sku: product.sku || '',
        price: product.price?.toString() || '',
        cost: product.cost?.toString() || '',
        min_stock: product.min_stock?.toString() || '',
        bonus_percent: (product as any).bonus_percent?.toString() || '0',
      });

      // Reset pending price inputs when switching products
      setNewPaymentPrice({ payment_method_id: '', price: '' });
      setNewChannelPrice({ channel_id: '', price: '' });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) return;

    if (!form.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      await updateProduct.mutateAsync({
        id: product.id,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        price: parseFloat(form.price) || 0,
        cost: parseFloat(form.cost) || 0,
        min_stock: parseInt(form.min_stock) || 0,
        bonus_percent: parseFloat(form.bonus_percent) || 0,
      } as any);

      // If user filled a channel/payment price and clicked "Salvar" (without pressing +), persist it too.
      const extraSaves: Promise<unknown>[] = [];

      if (newPaymentPrice.payment_method_id && newPaymentPrice.price) {
        extraSaves.push(
          upsertPaymentPrice.mutateAsync({
            product_id: product.id,
            payment_method_id: newPaymentPrice.payment_method_id,
            price: parseFloat(newPaymentPrice.price),
          })
        );
      }

      if (newChannelPrice.channel_id && newChannelPrice.price) {
        extraSaves.push(
          upsertChannelPrice.mutateAsync({
            product_id: product.id,
            channel_id: newChannelPrice.channel_id,
            price: parseFloat(newChannelPrice.price),
          })
        );
      }

      if (extraSaves.length) {
        await Promise.all(extraSaves);
      }

      onOpenChange(false);
      toast.success('Produto atualizado com sucesso!');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleAddPaymentPrice = async () => {
    if (!product || !newPaymentPrice.payment_method_id || !newPaymentPrice.price) {
      toast.error('Selecione a forma de pagamento e informe o preço');
      return;
    }

    await upsertPaymentPrice.mutateAsync({
      product_id: product.id,
      payment_method_id: newPaymentPrice.payment_method_id,
      price: parseFloat(newPaymentPrice.price),
    });

    setNewPaymentPrice({ payment_method_id: '', price: '' });
    toast.success('Preço por forma de pagamento salvo!');
  };

  const handleRemovePaymentPrice = async (id: string) => {
    await deletePaymentPrice.mutateAsync(id);
    toast.success('Preço removido!');
  };

  const handleAddChannelPrice = async () => {
    if (!product || !newChannelPrice.channel_id || !newChannelPrice.price) {
      toast.error('Selecione o canal de vendas e informe o preço');
      return;
    }

    await upsertChannelPrice.mutateAsync({
      product_id: product.id,
      channel_id: newChannelPrice.channel_id,
      price: parseFloat(newChannelPrice.price),
    });

    setNewChannelPrice({ channel_id: '', price: '' });
    toast.success('Preço por canal de vendas salvo!');
  };

  const handleRemoveChannelPrice = async (id: string) => {
    await deleteChannelPrice.mutateAsync(id);
    toast.success('Preço removido!');
  };

  // Filter out already configured payment methods and channels
  const availablePaymentMethods = paymentMethods.filter(
    pm => !productPrices.some(pp => pp.payment_method_id === pm.id)
  );
  const availableChannels = salesChannels.filter(
    ch => !channelPrices.some(cp => cp.channel_id === ch.id)
  );

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome do produto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="Código SKU"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço Padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Custo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estoque Mínimo</Label>
              <Input
                type="number"
                min="0"
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Bonificação (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.bonus_percent}
                onChange={(e) => setForm({ ...form, bonus_percent: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Ex: 10% = 1 bônus a cada 10 unidades compradas
              </p>
            </div>
          </div>

          {/* Pricing Tabs */}
          <Tabs defaultValue="payment" className="pt-4 border-t">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="payment">Forma de Pagamento</TabsTrigger>
              <TabsTrigger value="channel">Canal de Vendas</TabsTrigger>
            </TabsList>

            {/* Payment Method Prices */}
            <TabsContent value="payment" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Configure preços diferentes para cada forma de pagamento.
              </p>

              {productPrices.length > 0 && (
                <div className="space-y-2">
                  {productPrices.map((pp) => {
                    const pm = paymentMethods.find(m => m.id === pp.payment_method_id);
                    return (
                      <div key={pp.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <span className="flex-1 text-sm font-medium">{pm?.name || 'Desconhecido'}</span>
                        <span className="text-sm text-muted-foreground">R$ {pp.price.toFixed(2)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemovePaymentPrice(pp.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {availablePaymentMethods.length > 0 && (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Forma de Pagamento</Label>
                    <Select 
                      value={newPaymentPrice.payment_method_id} 
                      onValueChange={(v) => setNewPaymentPrice({ ...newPaymentPrice, payment_method_id: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePaymentMethods.map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Preço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-9"
                      value={newPaymentPrice.price}
                      onChange={(e) => setNewPaymentPrice({ ...newPaymentPrice, price: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleAddPaymentPrice}
                    disabled={upsertPaymentPrice.isPending}
                  >
                    {upsertPaymentPrice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Sales Channel Prices */}
            <TabsContent value="channel" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Configure preços diferentes para cada canal de vendas.
              </p>

              {channelPrices.length > 0 && (
                <div className="space-y-2">
                  {channelPrices.map((cp) => {
                    const ch = salesChannels.find(c => c.id === cp.channel_id);
                    return (
                      <div key={cp.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                        <span className="flex-1 text-sm font-medium">{ch?.name || 'Desconhecido'}</span>
                        <span className="text-sm text-muted-foreground">R$ {cp.price.toFixed(2)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveChannelPrice(cp.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {availableChannels.length > 0 && (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Canal de Vendas</Label>
                    <Select 
                      value={newChannelPrice.channel_id} 
                      onValueChange={(v) => setNewChannelPrice({ ...newChannelPrice, channel_id: v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChannels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">Preço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-9"
                      value={newChannelPrice.price}
                      onChange={(e) => setNewChannelPrice({ ...newChannelPrice, price: e.target.value })}
                      placeholder="0,00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={handleAddChannelPrice}
                    disabled={upsertChannelPrice.isPending}
                  >
                    {upsertChannelPrice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateProduct.isPending}>
              {updateProduct.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}