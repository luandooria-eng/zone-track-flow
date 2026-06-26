import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, X, Loader2, Check, MessageSquare, Pencil, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLinkSelector } from './CustomerLinkSelector';
import { renderTemplate } from '@/lib/messageTemplates';
import { CustomerInsightsCard } from './CustomerInsightsCard';
import type { WhatsAppConversation } from '@/hooks/useWhatsApp';
import { useCustomerPhones } from '@/hooks/useCustomerPhones';
import { EditCustomerModal } from '@/components/customers/EditCustomerModal';

interface Props {
  conv: WhatsAppConversation;
  onClose: () => void;
  onSold?: (orderId: string, summary: string) => void;
}

export function QuickSalePanel({ conv, onClose, onSold }: Props) {
  const customer = conv.customer;
  const [productId, setProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [delivererId, setDelivererId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>('');
  const [requestedByLabel, setRequestedByLabel] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [unitPriceOverride, setUnitPriceOverride] = useState<string>('');
  const [changeCustomerOpen, setChangeCustomerOpen] = useState(false);

  // Load contacts of the linked customer (for "Pedido feito por")
  const { data: customerPhones = [] } = useCustomerPhones(customer?.id);

  // Load customer address for display when launching the sale
  const { data: customerAddress } = useQuery({
    queryKey: ['quicksale-customer-address', customer?.id],
    enabled: !!customer?.id,
    queryFn: async () => {
      const { data: c } = await supabase
        .from('customers')
        .select('street, number, complement, reference, neighborhood:neighborhoods(name)')
        .eq('id', customer!.id)
        .maybeSingle();
      if (c && (c.street || c.number || (c as any).neighborhood?.name)) {
        return {
          street: c.street as string | null,
          number: c.number as string | null,
          complement: c.complement as string | null,
          reference: c.reference as string | null,
          neighborhood: (c as any).neighborhood?.name as string | null,
        };
      }
      // Fallback to normalized customer_addresses
      const { data: ca } = await supabase
        .from('customer_addresses')
        .select('address:addresses(street_name, house_number, complement, reference_point, neighborhood:neighborhoods(name))')
        .eq('customer_id', customer!.id)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      const a: any = ca?.address;
      if (!a) return null;
      return {
        street: a.street_name ?? null,
        number: a.house_number ?? null,
        complement: a.complement ?? null,
        reference: a.reference_point ?? null,
        neighborhood: a.neighborhood?.name ?? null,
      };
    },
  });

  // Auto-select the contact whose phone matches the conversation
  const conversationPhone = conv.phone ?? '';
  const matchedContact = useMemo(() => {
    if (!conversationPhone || customerPhones.length === 0) return null;
    const digits = conversationPhone.replace(/\D/g, '');
    return customerPhones.find((p) => {
      const pDigits = p.phone_number.replace(/\D/g, '');
      return pDigits === digits || pDigits.endsWith(digits) || digits.endsWith(pDigits);
    }) ?? null;
  }, [conversationPhone, customerPhones]);

  // Auto-pick label once data loads
  if (!requestedByLabel && matchedContact) {
    setTimeout(() => setRequestedByLabel(matchedContact.label || 'Titular'), 0);
  }

  // Load active products
  const { data: products = [] } = useQuery({
    queryKey: ['quicksale-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load active deliverers
  const { data: deliverers = [] } = useQuery({
    queryKey: ['quicksale-deliverers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_people')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load payment methods
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['quicksale-paymentmethods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve WhatsApp channel id (auto-tag every quick sale)
  const { data: whatsappChannelId } = useQuery({
    queryKey: ['quicksale-whatsapp-channel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_channels')
        .select('id')
        .ilike('name', 'whatsapp')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  // Load active message templates
  const { data: templates = [] } = useQuery({
    queryKey: ['quicksale-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_message_templates' as any)
        .select('id, name, body, is_default')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; body: string; is_default: boolean }[];
    },
  });

  // Auto-select default template once templates load
  if (!templateId && templates.length > 0) {
    const def = templates.find((t) => t.is_default) ?? templates[0];
    if (def) setTimeout(() => setTemplateId(def.id), 0);
  }

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );
  const effectiveUnitPrice = useMemo(() => {
    const parsed = Number(String(unitPriceOverride).replace(',', '.'));
    if (unitPriceOverride !== '' && !Number.isNaN(parsed) && parsed >= 0) return parsed;
    return Number(selectedProduct?.price ?? 0);
  }, [unitPriceOverride, selectedProduct]);
  const total = useMemo(
    () => effectiveUnitPrice * Math.max(quantity, 1),
    [effectiveUnitPrice, quantity],
  );

  const canSubmit = !!customer && !!productId && !!paymentMethodId && quantity > 0 && !submitting;

  async function handleSubmit() {
    if (!customer || !selectedProduct) return;
    setSubmitting(true);

    try {
      const unitPrice = effectiveUnitPrice;
      const lineTotal = unitPrice * quantity;

      // Fetch the customer's registered address so the order — and therefore the
      // Vendas Diária grid — comes pre-filled with street / number / neighborhood / reference.
      const { data: customerData } = await supabase
        .from('customers')
        .select('street, number, reference, neighborhood_id')
        .eq('id', customer.id)
        .maybeSingle();

      // Create order — status "accepted" so it shows up immediately on Vendas Diária.
      // Channel is auto-set to "WhatsApp" since this sale originates from the inbox.
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: customer.id,
          payment_method_id: paymentMethodId,
          delivery_person_id: delivererId || null,
          channel_id: whatsappChannelId ?? null,
          delivery_address: customerData?.street ?? null,
          delivery_number: customerData?.number ?? null,
          delivery_reference: customerData?.reference ?? null,
          neighborhood_id: customerData?.neighborhood_id ?? null,
          status: 'accepted',
          subtotal: lineTotal,
          total: lineTotal,
          notes: `Venda rápida via WhatsApp em ${new Date().toLocaleString('pt-BR')}`,
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      // Create order item (triggers stock deduction)
      const { error: itemError } = await supabase.from('order_items').insert({
        order_id: order.id,
        product_id: selectedProduct.id,
        quantity,
        unit_price: unitPrice,
        total_price: lineTotal,
      });

      if (itemError) throw itemError;

      // Save "requested_by_label" if provided (best-effort, don't fail the sale)
      if (requestedByLabel.trim()) {
        await supabase
          .from('orders')
          .update({ requested_by_label: requestedByLabel.trim() })
          .eq('id', order.id);
      }

      const paymentName = paymentMethods.find((p) => p.id === paymentMethodId)?.name ?? '';
      const selectedTemplate = templates.find((t) => t.id === templateId) ?? templates.find((t) => t.is_default) ?? templates[0];

      const summary = selectedTemplate
        ? renderTemplate(selectedTemplate.body, {
            cliente: customer.name,
            produto: selectedProduct.name,
            quantidade: quantity,
            total: lineTotal,
            pagamento: paymentName,
            vencimento: '',
          })
        : `✅ Pedido confirmado!\n\n📦 ${quantity}x ${selectedProduct.name}\n💰 Total: R$ ${lineTotal.toFixed(2).replace('.', ',')}\n\nObrigado pela preferência!`;

      toast.success(`Venda lançada · Pedido #${order.order_number}`);
      onSold?.(order.id, summary);

      // Reset form
      setProductId('');
      setQuantity(1);
      setDelivererId('');
      setPaymentMethodId('');
      setUnitPriceOverride('');
      // keep requestedByLabel — same person likely keeps ordering in the same convo
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao lançar venda';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-[300px] shrink-0 border-l border-border bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold">Venda rápida</span>
        </div>
        <button onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Customer card */}
          {customer ? (
            <>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</p>
                <div className="flex items-start justify-between gap-2 mt-0.5">
                  <p className="text-sm font-semibold">{customer.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditCustomerOpen(true)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                      aria-label="Editar cadastro do cliente"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCustomerOpen((v) => !v)}
                      className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                      aria-label="Trocar cliente vinculado"
                    >
                      Trocar
                    </button>
                  </div>
                </div>
                {matchedContact && matchedContact.label && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    💬 contato: <span className="font-medium text-foreground">{matchedContact.label}</span>
                  </p>
                )}
                <Badge variant="secondary" className="mt-1.5 text-[10px]">
                  <Check className="h-2.5 w-2.5 mr-1" />
                  Cadastrado
                </Badge>
                {customerAddress ? (
                  <div className="mt-2 pt-2 border-t border-border/60 flex items-start gap-1.5 text-[11px] text-foreground">
                    <MapPin className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                    <div className="leading-snug">
                      <div>
                        {customerAddress.street || 'Sem rua'}
                        {customerAddress.number ? `, ${customerAddress.number}` : ''}
                        {customerAddress.complement ? ` — ${customerAddress.complement}` : ''}
                      </div>
                      {customerAddress.neighborhood && (
                        <div className="text-muted-foreground">{customerAddress.neighborhood}</div>
                      )}
                      {customerAddress.reference && (
                        <div className="text-muted-foreground italic">Ref: {customerAddress.reference}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    Endereço não cadastrado
                  </div>
                )}
              </div>
              {changeCustomerOpen && (
                <CustomerLinkSelector
                  conversationId={conv.id}
                  defaultName={conv.contact_name ?? customer?.name ?? null}
                  defaultPhone={conv.phone ?? null}
                  onLinked={() => setChangeCustomerOpen(false)}
                />
              )}
              <CustomerInsightsCard customerId={customer.id} />
            </>
          ) : (
            <CustomerLinkSelector
              conversationId={conv.id}
              defaultName={conv.contact_name ?? customer?.name ?? null}
              defaultPhone={conv.phone ?? null}
              onLinked={() => {
                /* conversation list will refresh; panel will receive updated conv via parent */
              }}
            />
          )}

          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-xs">Produto</Label>
            <Select value={productId} onValueChange={setProductId} disabled={!customer}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">
                    {p.name} — R$ {Number(p.price ?? 0).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label className="text-xs">Quantidade</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className="h-9 text-sm"
              disabled={!customer}
            />
          </div>

          {/* Unit price (editable) */}
          {selectedProduct && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Valor unitário <span className="text-muted-foreground">(R$)</span>
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={unitPriceOverride}
                placeholder={Number(selectedProduct.price ?? 0).toFixed(2)}
                onChange={(e) => setUnitPriceOverride(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Padrão: R$ {Number(selectedProduct.price ?? 0).toFixed(2).replace('.', ',')}. Deixe em branco para usar o valor padrão.
              </p>
            </div>
          )}

          {/* Deliverer */}
          <div className="space-y-1.5">
            <Label className="text-xs">Entregador <span className="text-muted-foreground">(opcional)</span></Label>
            <Select value={delivererId || '__none__'} onValueChange={(v) => setDelivererId(v === '__none__' ? '' : v)} disabled={!customer}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Em aberto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-sm">
                  <span className="text-muted-foreground italic">Em aberto (definir depois)</span>
                </SelectItem>
                {deliverers.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-sm">
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={!customer}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione o pagamento" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-sm">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Message template */}
          {templates.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Mensagem ao cliente
              </Label>
              <Select value={templateId} onValueChange={setTemplateId} disabled={!customer}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-sm">
                      {t.name} {t.is_default && '⭐'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Pedido feito por (família/conta com vários contatos) */}
          {customer && (
            <div className="space-y-1.5">
              <Label className="text-xs">Pedido feito por <span className="text-muted-foreground">(opcional)</span></Label>
              {customerPhones.length > 0 ? (
                <Select value={requestedByLabel} onValueChange={setRequestedByLabel}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Quem solicitou?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Titular" className="text-sm">Titular ({customer.name})</SelectItem>
                    {customerPhones.map((p) => (
                      <SelectItem key={p.id} value={p.label || 'Contato'} className="text-sm">
                        {p.label || 'Contato'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={requestedByLabel}
                  onChange={(e) => setRequestedByLabel(e.target.value)}
                  placeholder="Ex: Esposa, Filho, Trabalho..."
                  className="h-9 text-sm"
                  maxLength={60}
                />
              )}
            </div>
          )}

          {/* Total preview */}
          {selectedProduct && (
            <div className="rounded-lg border border-border bg-green-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total da venda</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-500 mt-1">
                R$ {total.toFixed(2).replace('.', ',')}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border bg-background">
        <Button
          className="w-full bg-green-500 hover:bg-green-600 text-white gap-2"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Lançando...
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" /> Lançar venda
            </>
          )}
        </Button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          A venda aparecerá automaticamente em Vendas Diária.
        </p>
      </div>

      {customer && (
        <EditCustomerModal
          customer={customer as any}
          open={editCustomerOpen}
          onOpenChange={setEditCustomerOpen}
        />
      )}
    </div>
  );
}
