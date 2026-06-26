import React, { useState, useEffect } from 'react';
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
import { Plus, Trash2, Loader2 } from 'lucide-react';
import {
  useCustomers,
  useProducts,
  useNeighborhoods,
  useSalesChannels,
  usePaymentMethods,
  useDeliveryPeople,
  useCreateOrder,
} from '@/hooks/useSupabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import type { OrderInsert } from '@/types/database';

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOrderModal({ open, onOpenChange }: NewOrderModalProps) {
  const { user } = useAuth();
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const { data: channels = [] } = useSalesChannels();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: deliveryPeople = [] } = useDeliveryPeople();
  const createOrder = useCreateOrder();

  const [customerId, setCustomerId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [deliveryPersonId, setDeliveryPersonId] = useState('');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { product_id: '', quantity: 1, unit_price: 0, total_price: 0 },
  ]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const selectedNeighborhood = neighborhoods.find(n => n.id === neighborhoodId);
  const deliveryFee = selectedNeighborhood?.delivery_fee || 0;
  const total = subtotal + deliveryFee;

  // Auto-fill address when customer is selected
  useEffect(() => {
    if (customerId) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setNeighborhoodId(customer.neighborhood_id || '');
        setDeliveryAddress(customer.street || '');
        setDeliveryNumber(customer.number || '');
      }
    }
  }, [customerId, customers]);

  // Check if payment method is credit
  const selectedPaymentMethod = paymentMethods.find(p => p.id === paymentMethodId);
  const isCredit = selectedPaymentMethod?.is_credit || false;

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    const item = newItems[index];

    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      item.product_id = value as string;
      item.unit_price = product?.price || 0;
      item.total_price = item.quantity * item.unit_price;
    } else if (field === 'quantity') {
      item.quantity = Number(value) || 1;
      item.total_price = item.quantity * item.unit_price;
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) return;

    const order: OrderInsert = {
      customer_id: customerId || null,
      channel_id: channelId || null,
      payment_method_id: paymentMethodId || null,
      delivery_person_id: deliveryPersonId || null,
      neighborhood_id: neighborhoodId || null,
      status: 'accepted',
      delivery_address: deliveryAddress || null,
      delivery_number: deliveryNumber || null,
      delivery_complement: null,
      delivery_reference: null,
      subtotal,
      delivery_fee: deliveryFee,
      discount: 0,
      total,
      notes: notes || null,
      due_date: isCredit && dueDate ? dueDate : null,
      paid_at: null,
      delivered_at: null,
      cancelled_at: null,
      cancel_reason: null,
      created_by: user?.id || null,
    };

    const orderItems = validItems.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    await createOrder.mutateAsync({ order, items: orderItems });
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setCustomerId('');
    setChannelId('');
    setPaymentMethodId('');
    setDeliveryPersonId('');
    setNeighborhoodId('');
    setDeliveryAddress('');
    setDeliveryNumber('');
    setNotes('');
    setDueDate('');
    setItems([{ product_id: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  };

  const activeProducts = products.filter(p => p.is_active);
  const activeChannels = channels.filter(c => c.is_active);
  const activePaymentMethods = paymentMethods.filter(p => p.is_active);
  const activeDeliveryPeople = deliveryPeople.filter(d => d.is_active);
  const activeNeighborhoods = neighborhoods.filter(n => n.is_active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer & Channel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers.filter(c => c.is_active).map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Canal de Venda</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  {activeChannels.map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeNeighborhoods.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Rua..."
              />
            </div>

            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={deliveryNumber}
                onChange={(e) => setDeliveryNumber(e.target.value)}
                placeholder="123"
              />
            </div>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Produtos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <Select
                  value={item.product_id}
                  onValueChange={(v) => updateItem(index, 'product_id', v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProducts.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - R$ {product.price.toFixed(2)}
                        {product.current_stock <= product.min_stock && (
                          <span className="text-destructive ml-2">(Estoque baixo)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  className="w-20"
                />

                <span className="w-24 text-right font-medium">
                  R$ {item.total_price.toFixed(2)}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Payment & Delivery */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activePaymentMethods.map(method => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entregador</Label>
              <Select value={deliveryPersonId} onValueChange={setDeliveryPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {activeDeliveryPeople.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date for credit */}
          {isCredit && (
            <div className="space-y-2">
              <Label>Data de Vencimento (Crediário)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required={isCredit}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações do pedido..."
              rows={2}
            />
          </div>

          {/* Totals */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Taxa de Entrega</span>
              <span>R$ {deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createOrder.isPending || items.every(i => !i.product_id)}
            >
              {createOrder.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Criar Pedido'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
