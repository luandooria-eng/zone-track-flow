import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Search } from 'lucide-react';
import { mockCustomers, mockProducts, mockSalesChannels, mockPaymentMethods, mockDeliveryPeople } from '@/lib/mockData';
import { toast } from 'sonner';

const orderItemSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto'),
  quantity: z.number().min(1, 'Quantidade mínima é 1'),
  unitPrice: z.number().min(0),
});

const formSchema = z.object({
  channelId: z.string().min(1, 'Selecione um canal'),
  customerId: z.string().min(1, 'Selecione um cliente'),
  deliveryPersonId: z.string().min(1, 'Selecione um entregador'),
  paymentMethodId: z.string().min(1, 'Selecione forma de pagamento'),
  notes: z.string().optional(),
});

interface NewSaleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewSaleModal({ open, onOpenChange }: NewSaleModalProps) {
  const [items, setItems] = useState<
    { productId: string; productName: string; quantity: number; unitPrice: number }[]
  >([]);
  const [customerSearch, setCustomerSearch] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      channelId: '',
      customerId: '',
      deliveryPersonId: '',
      paymentMethodId: '',
      notes: '',
    },
  });

  const filteredCustomers = mockCustomers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.cpf.includes(customerSearch) ||
      c.phone.includes(customerSearch)
  );

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, productId: string) => {
    const product = mockProducts.find((p) => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        productId: product.id,
        productName: product.name,
        quantity: newItems[index].quantity || 1,
        unitPrice: product.price,
      };
      setItems(newItems);
    }
  };

  const updateQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, quantity);
    setItems(newItems);
  };

  const total = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (items.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    console.log('New order:', { ...values, items, total });
    toast.success('Venda criada com sucesso!');
    onOpenChange(false);
    form.reset();
    setItems([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Venda</DialogTitle>
          <DialogDescription>
            Preencha os dados para registrar uma nova venda.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Channel */}
            <FormField
              control={form.control}
              name="channelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canal de Venda</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o canal" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mockSalesChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer */}
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, CPF ou telefone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {customerSearch && (
                    <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => {
                            field.onChange(customer.id);
                            setCustomerSearch(customer.name);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-muted text-sm flex justify-between"
                        >
                          <span>{customer.name}</span>
                          <span className="text-muted-foreground">{customer.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Produtos</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                  Nenhum produto adicionado
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30"
                    >
                      <Select
                        value={item.productId}
                        onValueChange={(value) => updateItem(index, value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - R$ {product.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <span className="w-24 text-right font-medium">
                        R$ {(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mockPaymentMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Delivery Person */}
            <FormField
              control={form.control}
              name="deliveryPersonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entregador</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {mockDeliveryPeople.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre a entrega..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Total and Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">R$ {total.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Confirmar Venda</Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
