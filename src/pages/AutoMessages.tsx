import { useEffect, useMemo, useState, useCallback } from 'react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import {
  CalendarIcon, Droplets, Flame, Send, MessageCircle, CheckCircle2, XCircle, Clock,
  RefreshCw, Search, Target, Repeat, ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

type Origin = 'crm' | 'reativacao';
type OriginFilter = 'all' | Origin;

type UnifiedMessage = {
  id: string;
  origin: Origin;
  customer_name: string | null;
  phone: string | null;
  trigger_name: string;
  message: string;
  attempt: number | null;
  status: 'sent' | 'failed';
  sent_at: string;
};

type Cycle = {
  id: string;
  customer_id: string;
  product_type: 'water' | 'gas';
  status: 'waiting' | 'sent' | 'completed' | 'exhausted' | 'paused';
  attempt_count: number;
  avg_days_at_cycle: number | null;
  next_due_at: string;
  last_sent_at: string | null;
  responded_at: string | null;
  customer?: { name: string; phone: string | null };
};

type PresetKey = 'today' | 'yesterday' | '3d' | '7d' | '15d' | '30d' | 'month' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '3d', label: '3 dias' },
  { key: '7d', label: '7 dias' },
  { key: '15d', label: '15 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'month', label: 'Este mês' },
];

function rangeFromPreset(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case '3d': return { from: startOfDay(subDays(now, 2)), to: endOfDay(now) };
    case '7d': return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '15d': return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
    case '30d': return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'month': return { from: startOfMonth(now), to: endOfMonth(now) };
    default: return { from: startOfDay(now), to: endOfDay(now) };
  }
}

const statusLabel: Record<Cycle['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  waiting: { label: 'Aguardando envio', variant: 'outline' },
  sent: { label: 'Mensagem enviada', variant: 'default' },
  completed: { label: 'Convertido', variant: 'secondary' },
  exhausted: { label: 'Esgotado (sem resposta)', variant: 'destructive' },
  paused: { label: 'Pausado', variant: 'outline' },
};

function fmt(d?: string | null) {
  if (!d) return '—';
  return format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR });
}

function OriginBadge({ o }: { o: Origin }) {
  return o === 'crm'
    ? <Badge variant="secondary" className="gap-1"><Target className="h-3 w-3" /> Funil CRM</Badge>
    : <Badge variant="outline" className="gap-1"><Repeat className="h-3 w-3" /> Reativação</Badge>;
}

export default function AutoMessages() {
  const [preset, setPreset] = useState<PresetKey>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);

  const activeRange = useMemo(() => {
    if (preset === 'custom' && customRange?.from) {
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to ?? customRange.from) };
    }
    return rangeFromPreset(preset === 'custom' ? 'today' : preset);
  }, [preset, customRange]);

  const load = async () => {
    setLoading(true);
    const fromISO = activeRange.from.toISOString();
    const toISO = activeRange.to.toISOString();

    const [crmRes, reactRes, cyclesRes] = await Promise.all([
      supabase
        .from('crm_activities')
        .select('id, lead_id, content, metadata, created_at, lead:crm_leads(name, phone)')
        .eq('type', 'trigger_fired')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('auto_reactivation_log')
        .select('id, product_type, attempt_number, phone, message_content, status, sent_at, customer:customers(name, phone)')
        .gte('sent_at', fromISO)
        .lte('sent_at', toISO)
        .order('sent_at', { ascending: false })
        .limit(1000),
      supabase
        .from('auto_reactivation_cycles')
        .select('*, customer:customers(name, phone)')
        .order('next_due_at', { ascending: true })
        .limit(500),
    ]);

    const crmMsgs: UnifiedMessage[] = (crmRes.data ?? []).map((r: any) => ({
      id: 'crm-' + r.id,
      origin: 'crm',
      customer_name: r.lead?.name ?? null,
      phone: r.metadata?.phone ?? r.lead?.phone ?? null,
      trigger_name: r.metadata?.trigger_name ?? 'Gatilho CRM',
      message: r.metadata?.message_sent ?? r.content ?? '',
      attempt: null,
      status: 'sent',
      sent_at: r.created_at,
    }));
    const reactMsgs: UnifiedMessage[] = (reactRes.data ?? []).map((r: any) => ({
      id: 'r-' + r.id,
      origin: 'reativacao',
      customer_name: r.customer?.name ?? null,
      phone: r.phone ?? r.customer?.phone ?? null,
      trigger_name: `Reativação ${r.product_type === 'water' ? 'Água' : 'Gás'} #${r.attempt_number}`,
      message: r.message_content ?? '',
      attempt: r.attempt_number,
      status: r.status === 'failed' ? 'failed' : 'sent',
      sent_at: r.sent_at,
    }));

    const all = [...crmMsgs, ...reactMsgs].sort((a, b) => b.sent_at.localeCompare(a.sent_at));
    setMessages(all);
    if (cyclesRes.data) setCycles(cyclesRes.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [preset, customRange]);

  const filtered = useMemo(() => {
    return messages.filter(m => {
      if (originFilter !== 'all' && m.origin !== originFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const n = (m.customer_name || '').toLowerCase();
        const p = (m.phone || '').toLowerCase();
        if (!n.includes(q) && !p.includes(q)) return false;
      }
      return true;
    });
  }, [messages, originFilter, search]);

  const kpis = useMemo(() => {
    const crm = messages.filter(m => m.origin === 'crm');
    const react = messages.filter(m => m.origin === 'reativacao');
    const failed = react.filter(m => m.status === 'failed').length;
    return {
      total: messages.length,
      crm: crm.length,
      react: react.length,
      failed,
      uniqueCustomers: new Set(messages.map(m => m.phone).filter(Boolean)).size,
    };
  }, [messages]);

  const dailyChart = useMemo(() => {
    const map = new Map<string, { day: string; crm: number; reativacao: number }>();
    messages.forEach(m => {
      const d = format(new Date(m.sent_at), 'dd/MM');
      if (!map.has(d)) map.set(d, { day: d, crm: 0, reativacao: 0 });
      const row = map.get(d)!;
      if (m.origin === 'crm') row.crm += 1; else row.reativacao += 1;
    });
    return Array.from(map.values()).reverse();
  }, [messages]);

  const cyclesKpi = useMemo(() => ({
    waiting: cycles.filter(c => c.status === 'waiting').length,
    awaitingResponse: cycles.filter(c => c.status === 'sent' && !c.responded_at).length,
    converted: cycles.filter(c => c.status === 'completed').length,
    exhausted: cycles.filter(c => c.status === 'exhausted').length,
  }), [cycles]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mensagens Automáticas</h1>
          <p className="text-sm text-muted-foreground">
            Visão unificada de disparos do <strong>Funil CRM</strong> e da <strong>Reativação Automática</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(r => (
            <Button key={r.key} size="sm" variant={preset === r.key ? 'default' : 'outline'} onClick={() => setPreset(r.key)}>
              {r.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={preset === 'custom' ? 'default' : 'outline'} className={cn('gap-2')}>
                <CalendarIcon className="h-4 w-4" />
                {preset === 'custom' && customRange?.from
                  ? `${format(customRange.from, 'dd/MM', { locale: ptBR })}${customRange.to ? ' - ' + format(customRange.to, 'dd/MM', { locale: ptBR }) : ''}`
                  : 'Personalizado'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="range" selected={customRange} onSelect={(r) => { setCustomRange(r); if (r?.from) setPreset('custom'); }} numberOfMonths={2} locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Send className="h-4 w-4 text-primary" />} label="Total enviadas" value={kpis.total} />
        <Kpi icon={<Target className="h-4 w-4 text-primary" />} label="Funil CRM" value={kpis.crm} />
        <Kpi icon={<Repeat className="h-4 w-4 text-primary" />} label="Reativação" value={kpis.react} />
        <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Clientes únicos" value={kpis.uniqueCustomers} />
        <Kpi icon={<XCircle className="h-4 w-4 text-destructive" />} label="Falhas" value={kpis.failed} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disparos por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">Carregando…</div>
          ) : dailyChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">Nenhum disparo no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="crm" name="Funil CRM" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="reativacao" name="Reativação" stackId="a" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="messages">
        <TabsList>
          <TabsTrigger value="messages">Mensagens no período ({messages.length})</TabsTrigger>
          <TabsTrigger value="cycles">Fluxo Reativação ({cycles.length})</TabsTrigger>
          <TabsTrigger value="cart">Recuperação Carrinho</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={originFilter} onValueChange={(v) => setOriginFilter(v as OriginFilter)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas origens</SelectItem>
                <SelectItem value="crm">Funil CRM</SelectItem>
                <SelectItem value="reativacao">Reativação Auto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Origem</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Gatilho</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma mensagem com esses filtros.</TableCell></TableRow>
                    ) : filtered.slice(0, 500).map(m => (
                      <TableRow key={m.id}>
                        <TableCell><OriginBadge o={m.origin} /></TableCell>
                        <TableCell className="font-medium">{m.customer_name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{m.phone || '—'}</TableCell>
                        <TableCell className="text-xs">{m.trigger_name}</TableCell>
                        <TableCell>
                          {m.status === 'sent'
                            ? <Badge variant="default">Enviada</Badge>
                            : <Badge variant="destructive">Falha</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmt(m.sent_at)}</TableCell>
                        <TableCell className="max-w-md truncate text-xs" title={m.message}>{m.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 500 && (
                <p className="text-xs text-muted-foreground mt-3">Exibindo as 500 mais recentes de {filtered.length}.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={<Clock className="h-4 w-4" />} label="Aguardando envio" value={cyclesKpi.waiting} />
            <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Aguardando resposta" value={cyclesKpi.awaitingResponse} />
            <Kpi icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Converteram" value={cyclesKpi.converted} />
            <Kpi icon={<XCircle className="h-4 w-4" />} label="Esgotados" value={cyclesKpi.exhausted} />
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Freq. média</TableHead>
                      <TableHead>Último envio</TableHead>
                      <TableHead>Próximo envio</TableHead>
                      <TableHead>Respondeu?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente no fluxo.</TableCell></TableRow>
                    ) : cycles.map(c => {
                      const s = statusLabel[c.status];
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.customer?.name || '—'}</div>
                            <div className="text-xs text-muted-foreground font-mono">{c.customer?.phone || ''}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {c.product_type === 'water'
                                ? <Droplets className="h-4 w-4 text-blue-500" />
                                : <Flame className="h-4 w-4 text-orange-500" />}
                              {c.product_type === 'water' ? 'Água' : 'Gás'}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                          <TableCell>{c.attempt_count}/3</TableCell>
                          <TableCell>{c.avg_days_at_cycle ? `${c.avg_days_at_cycle} dias` : '—'}</TableCell>
                          <TableCell className="text-xs">{fmt(c.last_sent_at)}</TableCell>
                          <TableCell className="text-xs">{fmt(c.next_due_at)}</TableCell>
                          <TableCell>
                            {c.responded_at
                              ? <Badge variant="secondary">Sim · {fmt(c.responded_at)}</Badge>
                              : c.status === 'sent' ? <Badge variant="outline">Não</Badge> : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cart" className="mt-4">
          <CartRecoveryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CartRecoveryTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cart_recovery_logs' as any)
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(500);
    setLogs((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const sent = logs.filter(l => l.status === 'sent').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const unique = new Set(logs.map(l => l.phone).filter(Boolean)).size;
    return { total: logs.length, sent, failed, unique };
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<ShoppingCart className="h-4 w-4 text-blue-500" />} label="Total disparos" value={kpis.total} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Enviados" value={kpis.sent} />
        <Kpi icon={<XCircle className="h-4 w-4 text-destructive" />} label="Falhas" value={kpis.failed} />
        <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Clientes únicos" value={kpis.unique} />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cart ID</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Enviado</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum disparo ainda. Configure a integração UoouShop em Integrações.</TableCell></TableRow>
                ) : logs.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.status === 'sent'
                        ? <Badge variant="default">Enviado</Badge>
                        : l.status === 'test'
                        ? <Badge className="bg-yellow-500/20 text-yellow-600 border-0">🧪 Teste</Badge>
                        : <Badge variant="destructive">Falha</Badge>}
                    </TableCell>
                    <TableCell className="font-medium">{l.customer_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{l.phone || '—'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate" title={l.cart_id}>{l.cart_id || '—'}</TableCell>
                    <TableCell>
                      {l.cart_link
                        ? <a href={l.cart_link} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">Abrir</a>
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.sent_at ? format(new Date(l.sent_at), 'dd/MM/yy HH:mm') : '—'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs" title={l.message_sent}>{l.message_sent || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}