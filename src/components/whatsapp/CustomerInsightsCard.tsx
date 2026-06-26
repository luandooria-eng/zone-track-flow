import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  CalendarClock,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Droplet,
  Flame,
  CreditCard,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isWaterProduct, isGasProduct } from '@/lib/productClassification';

interface Props {
  customerId: string;
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classifyEngagement(daysSinceLast: number | null): {
  label: string;
  color: string;
  bg: string;
} {
  if (daysSinceLast === null) {
    return { label: 'Sem compras', color: 'text-muted-foreground', bg: 'bg-muted' };
  }
  if (daysSinceLast <= 29) {
    return { label: 'Ativo', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-500/10' };
  }
  if (daysSinceLast <= 60) {
    return { label: 'Em risco', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10' };
  }
  return { label: 'Perdido', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-500/10' };
}

export function CustomerInsightsCard({ customerId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Realtime: refresh insights when orders/items/customer for this customer change
  useEffect(() => {
    if (!customerId) return;
    const channel = supabase
      .channel(`whatsapp-insights-${customerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-customer-insights', customerId] });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customers', filter: `id=eq.${customerId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-customer-insights', customerId] });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-customer-insights', customerId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-customer-insights', customerId],
    queryFn: async () => {
      // Customer base stats
      const { data: customer } = await supabase
        .from('customers')
        .select('id, name, credit_balance')
        .eq('id', customerId)
        .maybeSingle();

      // Last 6 months of orders (excluding cancelled) for frequency + live stats
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: orders } = await supabase
        .from('orders')
        .select(
          'id, total, created_at, status, order_items(quantity, products:product_id(name))',
        )
        .eq('customer_id', customerId)
        .neq('status', 'cancelled')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(200);

      // Live aggregate from ALL non-cancelled orders (not limited to 6 months)
      const { data: allOrders } = await supabase
        .from('orders')
        .select('total, created_at')
        .eq('customer_id', customerId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      const liveTotalOrders = allOrders?.length ?? 0;
      const liveTotalSpent = (allOrders ?? []).reduce(
        (acc, o: any) => acc + Number(o.total ?? 0),
        0,
      );
      const liveLastOrderAt = allOrders?.[0]?.created_at ?? null;

      // Top payment method — exclude pending/placeholder states ("Em Aberto", "Fazer pix")
      // so the "preferred" reflects the real settled payment, not a temporary status.
      const { data: payAggAll } = await supabase
        .from('customer_payment_agg')
        .select('count_total, payment_methods:payment_method_id(name)')
        .eq('customer_id', customerId)
        .order('count_total', { ascending: false });

      const isPendingPayment = (name?: string | null) => {
        const n = (name ?? '').toLowerCase().trim();
        return n.includes('em aberto') || (n.includes('pix') && n.includes('fazer'));
      };
      const payAgg = (payAggAll ?? []).filter(
        (p: any) => p.count_total > 0 && !isPendingPayment(p.payment_methods?.name),
      );

      // Open consumption alerts
      const { count: alertCount } = await supabase
        .from('customer_alerts')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'open');

      // Compute water/gas dates and frequencies
      const waterDates: Date[] = [];
      const gasDates: Date[] = [];
      let lastWater: { name: string; date: string } | null = null;
      let lastGas: { name: string; date: string } | null = null;

      (orders ?? []).forEach((o: any) => {
        const dt = new Date(o.created_at);
        let hasWater = false;
        let hasGas = false;
        let waterName = '';
        let gasName = '';
        (o.order_items ?? []).forEach((it: any) => {
          const name = it.products?.name ?? '';
          if (isWaterProduct(name)) {
            hasWater = true;
            waterName = name;
          }
          if (isGasProduct(name)) {
            hasGas = true;
            gasName = name;
          }
        });
        if (hasWater) {
          waterDates.push(dt);
          if (!lastWater) lastWater = { name: waterName, date: o.created_at };
        }
        if (hasGas) {
          gasDates.push(dt);
          if (!lastGas) lastGas = { name: gasName, date: o.created_at };
        }
      });

      function avgFrequency(dates: Date[]): number | null {
        if (dates.length < 2) return null;
        const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
        let total = 0;
        for (let i = 1; i < sorted.length; i++) {
          total += (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        }
        return Math.round(total / (sorted.length - 1));
      }

      return {
        customer: customer
          ? {
              ...customer,
              total_orders: liveTotalOrders,
              total_spent: liveTotalSpent,
              last_order_at: liveLastOrderAt,
            }
          : customer,
        waterFreq: avgFrequency(waterDates),
        gasFreq: avgFrequency(gasDates),
        waterCount: waterDates.length,
        gasCount: gasDates.length,
        lastWater: lastWater as null | { name: string; date: string },
        lastGas: lastGas as null | { name: string; date: string },
        topPayment: payAgg?.[0]?.payment_methods?.name ?? null,
        alertCount: alertCount ?? 0,
      };
    },
    staleTime: 10 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const c = data?.customer as
    | { total_orders?: number; total_spent?: number; last_order_at?: string | null; credit_balance?: number }
    | undefined;
  const totalOrders = c?.total_orders ?? 0;
  const totalSpent = Number(c?.total_spent ?? 0);
  const ticket = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const dSinceLast = daysSince(c?.last_order_at);
  const engagement = classifyEngagement(dSinceLast);
  const isNew = totalOrders === 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          {isNew ? (
            <Badge variant="outline" className="gap-1 text-[10px] py-0 px-1.5">
              <UserPlus className="h-2.5 w-2.5" /> Cliente novo
            </Badge>
          ) : (
            <>
              <Badge
                variant="outline"
                className={cn('gap-1 text-[10px] py-0 px-1.5 border-0', engagement.bg, engagement.color)}
              >
                {engagement.label}
              </Badge>
              <span className="text-[11px] text-muted-foreground truncate">
                {dSinceLast !== null ? `${dSinceLast}d desde última` : ''}
              </span>
            </>
          )}
          {(data?.alertCount ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0">
              <AlertTriangle className="h-2.5 w-2.5" /> {data?.alertCount}
            </Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50">
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground py-2">Carregando insights…</p>
          ) : isNew ? (
            <p className="text-[11px] text-muted-foreground py-2">
              Nenhum pedido registrado ainda. Esta será a primeira compra deste cliente.
            </p>
          ) : (
            <>
              {/* Last order + totals */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <CalendarClock className="h-3 w-3" /> Último pedido
                  </div>
                  <p className="text-xs font-semibold mt-0.5">{formatDateBR(c?.last_order_at)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <ShoppingBag className="h-3 w-3" /> Total pedidos
                  </div>
                  <p className="text-xs font-semibold mt-0.5">{totalOrders}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <Wallet className="h-3 w-3" /> Já comprou
                  </div>
                  <p className="text-xs font-semibold mt-0.5">{formatBRL(totalSpent)}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <TrendingUp className="h-3 w-3" /> Ticket médio
                  </div>
                  <p className="text-xs font-semibold mt-0.5">{formatBRL(ticket)}</p>
                </div>
              </div>

              {/* Recurrence — water & gas */}
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Recorrência
                </p>
                <div className="rounded-md border border-border/60 p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Droplet className="h-3 w-3 text-blue-500" />
                      <span className="font-medium">Água</span>
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {data?.waterFreq
                        ? `a cada ${data.waterFreq}d`
                        : data?.waterCount === 1
                          ? '1 pedido'
                          : 'sem histórico'}
                    </span>
                  </div>
                  {data?.lastWater && (
                    <p className="text-[10px] text-muted-foreground pl-4.5">
                      Última: {data.lastWater.name} · {formatDateBR(data.lastWater.date)}
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-border/60 p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="font-medium">Gás</span>
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {data?.gasFreq
                        ? `a cada ${data.gasFreq}d`
                        : data?.gasCount === 1
                          ? '1 pedido'
                          : 'sem histórico'}
                    </span>
                  </div>
                  {data?.lastGas && (
                    <p className="text-[10px] text-muted-foreground pl-4.5">
                      Última: {data.lastGas.name} · {formatDateBR(data.lastGas.date)}
                    </p>
                  )}
                </div>
              </div>

              {/* Payment + credit */}
              <div className="flex items-center justify-between gap-2 text-xs pt-1">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  Prefere
                </span>
                <span className="font-medium">{data?.topPayment ?? '—'}</span>
              </div>
              {Number(c?.credit_balance ?? 0) > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Crédito em aberto</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    {formatBRL(Number(c?.credit_balance))}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}