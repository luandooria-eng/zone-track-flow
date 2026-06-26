import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  MessageCircle,
  Clock,
  User,
  Package,
  Send,
  Plus,
  Loader2,
  Zap,
  Droplets,
  Flame,
} from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCRMRecurrenceRules, useUpsertRecurrenceRule, useToggleRecurrenceRule } from '@/hooks/useCRMFunnel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerDue {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  last_order_at: string;
  days_since: number;
  last_product: string | null;
  total_orders: number;
  avg_interval_days: number | null;
}

interface RecurrenceRule {
  id: string;
  name: string;
  product_keyword: string | null;
  days_since_last_order: number;
  message_template: string;
  is_active: boolean;
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useCustomersDue(minDays: number) {
  return useQuery({
    queryKey: ['crm-customers-due', minDays],
    queryFn: async () => {
      // RPC 'crm_customers_due_for_reorder' não existe — usar fallback direto
      const data: any = null;
      const error: any = new Error('RPC not available');

      if (error || !data) {
        // Fallback: raw query
        const { data: orders, error: ordErr } = await supabase
          .from('orders')
          .select(`
            customer_id,
            created_at,
            status,
            items:order_items(product:products(name))
          `)
          .in('status', ['delivered'])
          .order('created_at', { ascending: false });

        if (ordErr) throw ordErr;

        // Group by customer, get last order and typical product
        const byCustomer = new Map<string, {
          lastAt: string;
          products: string[];
          orderDates: string[];
        }>();

        for (const o of orders ?? []) {
          if (!o.customer_id) continue;
          const existing = byCustomer.get(o.customer_id);
          const prods = (o.items as any[]).map((i: any) => i.product?.name).filter(Boolean);
          if (!existing) {
            byCustomer.set(o.customer_id, { lastAt: o.created_at, products: prods, orderDates: [o.created_at] });
          } else {
            existing.products.push(...prods);
            existing.orderDates.push(o.created_at);
          }
        }

        // Get customer info
        const customerIds = [...byCustomer.keys()];
        if (customerIds.length === 0) return [];

        const { data: customers } = await supabase
          .from('customers')
          .select('id, name, phone')
          .in('id', customerIds);

        const now = Date.now();
        const results: CustomerDue[] = [];

        for (const c of customers ?? []) {
          const info = byCustomer.get(c.id);
          if (!info) continue;
          const daysSince = Math.floor((now - new Date(info.lastAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince < minDays) continue;

          // Compute avg interval
          let avgInterval: number | null = null;
          if (info.orderDates.length >= 2) {
            const sorted = [...info.orderDates].sort();
            let totalDiff = 0;
            for (let i = 1; i < sorted.length; i++) {
              totalDiff += differenceInDays(new Date(sorted[i]), new Date(sorted[i - 1]));
            }
            avgInterval = Math.round(totalDiff / (sorted.length - 1));
          }

          // Most common product
          const prodCount = new Map<string, number>();
          for (const p of info.products) {
            prodCount.set(p, (prodCount.get(p) || 0) + 1);
          }
          const topProd = [...prodCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

          results.push({
            customer_id: c.id,
            customer_name: c.name,
            phone: c.phone,
            last_order_at: info.lastAt,
            days_since: daysSince,
            last_product: topProd,
            total_orders: info.orderDates.length,
            avg_interval_days: avgInterval,
          });
        }

        return results.sort((a, b) => b.days_since - a.days_since);
      }

      return data as CustomerDue[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RecurrencePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecurrencePanel({ open, onOpenChange }: RecurrencePanelProps) {
  const [minDays, setMinDays] = useState(5);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editRule, setEditRule] = useState<Partial<RecurrenceRule> | null>(null);

  const { data: customersDue = [], isLoading, refetch } = useCustomersDue(minDays);
  const { data: rules = [] } = useCRMRecurrenceRules();
  const upsertRule = useUpsertRecurrenceRule();
  const toggleRule = useToggleRecurrenceRule();

  const waterCustomers = customersDue.filter(
    (c) => c.last_product?.toLowerCase().includes('água') || c.last_product?.toLowerCase().includes('agua'),
  );
  const gasCustomers = customersDue.filter(
    (c) => c.last_product?.toLowerCase().includes('gás') || c.last_product?.toLowerCase().includes('gas'),
  );
  const otherCustomers = customersDue.filter(
    (c) => !waterCustomers.includes(c) && !gasCustomers.includes(c),
  );

  const sendReminder = async (customer: CustomerDue, rule?: RecurrenceRule) => {
    if (!customer.phone) {
      toast.error('Este cliente não tem telefone cadastrado');
      return;
    }
    setSendingId(customer.customer_id);
    try {
      const template =
        rule?.message_template ??
        'Oi {{name}}! 👋 Sentimos sua falta! Já faz {{days}} dias desde sua última compra. Pode confirmar um pedido? 😊';

      const message = template
        .replace(/\{\{name\}\}/g, customer.customer_name)
        .replace(/\{\{days\}\}/g, String(customer.days_since));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone: customer.phone, message }),
        },
      );
      if (!res.ok) throw new Error('Falha ao enviar');
      toast.success(`Lembrete enviado para ${customer.customer_name}!`);
    } catch {
      toast.error('Erro ao enviar lembrete');
    } finally {
      setSendingId(null);
    }
  };

  const sendBulk = async (list: CustomerDue[]) => {
    const withPhone = list.filter((c) => c.phone);
    if (withPhone.length === 0) { toast.error('Nenhum cliente com telefone cadastrado'); return; }
    toast.info(`Enviando para ${withPhone.length} clientes...`);
    for (const c of withPhone) {
      await sendReminder(c);
      await new Promise((r) => setTimeout(r, 500));
    }
    toast.success('Envio em massa concluído!');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0" side="right">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            Recorrência de Clientes
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Clientes que ainda não recompraram conforme seu padrão de consumo
          </p>
        </SheetHeader>

        <Tabs defaultValue="due" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 w-auto">
            <TabsTrigger value="due">
              Clientes em Atraso
              {customersDue.length > 0 && (
                <Badge className="ml-1.5 bg-red-500 text-white text-[10px]">{customersDue.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules">Regras de Recorrência</TabsTrigger>
          </TabsList>

          {/* ── TAB: Due Customers ── */}
          <TabsContent value="due" className="flex-1 overflow-hidden flex flex-col">
            {/* Controls */}
            <div className="px-6 py-3 flex items-center gap-3 border-b">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Sem comprar há mais de</Label>
                <Input
                  type="number"
                  min={1}
                  value={minDays}
                  onChange={(e) => setMinDays(Number(e.target.value))}
                  className="w-16 text-sm h-8"
                />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => refetch()}>
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              </Button>
            </div>

            <ScrollArea className="flex-1 px-6 py-3">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : customersDue.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhum cliente em atraso com esse filtro
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Water */}
                  {waterCustomers.length > 0 && (
                    <CustomerGroup
                      title="Água"
                      icon={<Droplets className="h-4 w-4 text-blue-500" />}
                      customers={waterCustomers}
                      sendingId={sendingId}
                      onSend={sendReminder}
                      onBulk={() => sendBulk(waterCustomers)}
                      rules={rules}
                    />
                  )}

                  {/* Gas */}
                  {gasCustomers.length > 0 && (
                    <CustomerGroup
                      title="Gás"
                      icon={<Flame className="h-4 w-4 text-orange-500" />}
                      customers={gasCustomers}
                      sendingId={sendingId}
                      onSend={sendReminder}
                      onBulk={() => sendBulk(gasCustomers)}
                      rules={rules}
                    />
                  )}

                  {/* Other */}
                  {otherCustomers.length > 0 && (
                    <CustomerGroup
                      title="Outros"
                      icon={<Package className="h-4 w-4 text-muted-foreground" />}
                      customers={otherCustomers}
                      sendingId={sendingId}
                      onSend={sendReminder}
                      onBulk={() => sendBulk(otherCustomers)}
                      rules={rules}
                    />
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ── TAB: Rules ── */}
          <TabsContent value="rules" className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 px-6 py-3">
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rule.name}</span>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-2.5 w-2.5 mr-1" />
                          {rule.days_since_last_order}d
                        </Badge>
                        {rule.product_keyword && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {rule.product_keyword}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditRule(rule)}
                        >
                          Editar
                        </Button>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(v) => toggleRule.mutate({ id: rule.id, is_active: v })}
                          className="scale-75"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{rule.message_template}</p>
                  </div>
                ))}

                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setEditRule({
                    name: '',
                    product_keyword: '',
                    days_since_last_order: 7,
                    message_template: 'Oi {{name}}! Já faz {{days}} dias desde sua última compra. Posso te ajudar? 😊',
                    is_active: true,
                  })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova regra de recorrência
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Edit Rule Dialog */}
        {editRule !== null && (
          <RuleEditDialog
            rule={editRule}
            open
            onOpenChange={(o) => !o && setEditRule(null)}
            onSave={async (r) => {
              await upsertRule.mutateAsync(r);
              setEditRule(null);
            }}
            isSaving={upsertRule.isPending}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── CustomerGroup ────────────────────────────────────────────────────────────

function CustomerGroup({
  title, icon, customers, sendingId, onSend, onBulk, rules,
}: {
  title: string;
  icon: React.ReactNode;
  customers: CustomerDue[];
  sendingId: string | null;
  onSend: (c: CustomerDue, rule?: RecurrenceRule) => void;
  onBulk: () => void;
  rules: RecurrenceRule[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs">{customers.length}</Badge>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onBulk}>
          <Zap className="h-3 w-3" />
          Enviar para todos
        </Button>
      </div>

      <div className="space-y-2">
        {customers.map((c) => {
          // Find best matching rule
          const matchRule = rules
            .filter((r) => r.is_active)
            .find((r) =>
              !r.product_keyword ||
              c.last_product?.toLowerCase().includes(r.product_keyword.toLowerCase()),
            );

          return (
            <div key={c.customer_id} className="border rounded-lg p-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{c.customer_name}</span>
                  <Badge
                    className={cn(
                      'text-[10px] h-4 px-1.5',
                      c.days_since >= 14
                        ? 'bg-red-500/10 text-red-700 border-red-500/20'
                        : 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
                    )}
                  >
                    {c.days_since}d sem comprar
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.last_product && (
                    <span className="text-xs text-muted-foreground">{c.last_product}</span>
                  )}
                  {c.avg_interval_days && (
                    <span className="text-xs text-muted-foreground">
                      • média {c.avg_interval_days}d entre pedidos
                    </span>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 flex-shrink-0 text-green-600 border-green-600/30 hover:bg-green-50"
                disabled={!c.phone || sendingId === c.customer_id}
                onClick={() => onSend(c, matchRule)}
                title={c.phone ? 'Enviar lembrete WhatsApp' : 'Sem telefone'}
              >
                {sendingId === c.customer_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RuleEditDialog ───────────────────────────────────────────────────────────

function RuleEditDialog({
  rule, open, onOpenChange, onSave, isSaving,
}: {
  rule: Partial<RecurrenceRule>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (r: Partial<RecurrenceRule>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({ ...rule });
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar Regra' : 'Nova Regra de Recorrência'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Reposição de Água" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Produto (palavra-chave)</Label>
              <Input
                value={form.product_keyword ?? ''}
                onChange={(e) => set('product_keyword', e.target.value || null)}
                placeholder="água, gás (ou vazio = todos)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dias sem comprar</Label>
              <Input
                type="number"
                min={1}
                value={form.days_since_last_order ?? 7}
                onChange={(e) => set('days_since_last_order', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem WhatsApp</Label>
            <Textarea
              value={form.message_template ?? ''}
              onChange={(e) => set('message_template', e.target.value)}
              rows={4}
              className="resize-none text-sm"
              placeholder="Use {{name}} e {{days}}"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code className="bg-muted px-1 rounded">{'{{name}}'}</code> — nome do cliente, {' '}
              <code className="bg-muted px-1 rounded">{'{{days}}'}</code> — dias sem comprar
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => onSave(form)}
            disabled={isSaving || !form.name?.trim() || !form.message_template?.trim()}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
