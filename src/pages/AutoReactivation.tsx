import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Droplets, Flame, Send, MessageCircle, CheckCircle2, XCircle, Clock, RefreshCw, Search } from 'lucide-react';

type Cycle = {
  id: string;
  customer_id: string;
  product_type: 'water' | 'gas';
  status: 'waiting' | 'sent' | 'completed' | 'exhausted' | 'paused';
  attempt_count: number;
  avg_days_at_cycle: number | null;
  cycle_anchor_at: string;
  next_due_at: string;
  last_sent_at: string | null;
  responded_at: string | null;
  converted_at: string | null;
  customer?: { name: string; phone: string | null };
};

type LogRow = {
  id: string;
  customer_id: string | null;
  product_type: 'water' | 'gas';
  attempt_number: number;
  phone: string;
  message_content: string;
  status: 'sent' | 'failed';
  error_message: string | null;
  sent_at: string;
  cycle_id: string | null;
  customer?: { name: string; phone: string | null };
};

const statusLabel: Record<Cycle['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  waiting: { label: 'Aguardando envio', variant: 'outline' },
  sent: { label: 'Mensagem enviada', variant: 'default' },
  completed: { label: 'Convertido', variant: 'secondary' },
  exhausted: { label: 'Esgotado (sem resposta)', variant: 'destructive' },
  paused: { label: 'Pausado', variant: 'outline' },
};

function ProductIcon({ t }: { t: 'water' | 'gas' }) {
  return t === 'water'
    ? <Droplets className="h-4 w-4 text-blue-500" />
    : <Flame className="h-4 w-4 text-orange-500" />;
}

function fmt(d?: string | null) {
  if (!d) return '—';
  return format(new Date(d), "dd/MM/yy HH:mm", { locale: ptBR });
}

export default function AutoReactivation() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [cyclesRes, logsRes] = await Promise.all([
      supabase
        .from('auto_reactivation_cycles')
        .select('*, customer:customers(name, phone)')
        .order('next_due_at', { ascending: true })
        .limit(500),
      supabase
        .from('auto_reactivation_log')
        .select('*, customer:customers(name, phone)')
        .gte('sent_at', todayStart.toISOString())
        .order('sent_at', { ascending: false })
        .limit(500),
    ]);

    if (cyclesRes.data) setCycles(cyclesRes.data as any);
    if (logsRes.data) setLogs(logsRes.data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredCycles = useMemo(() => {
    return cycles.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (productFilter !== 'all' && c.product_type !== productFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (c.customer?.name || '').toLowerCase();
        const phone = (c.customer?.phone || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [cycles, statusFilter, productFilter, search]);

  const kpis = useMemo(() => {
    const sentToday = logs.filter(l => l.status === 'sent').length;
    const failedToday = logs.filter(l => l.status === 'failed').length;
    const waiting = cycles.filter(c => c.status === 'waiting').length;
    const awaitingResponse = cycles.filter(c => c.status === 'sent' && !c.responded_at).length;
    const converted = cycles.filter(c => c.status === 'completed').length;
    const exhausted = cycles.filter(c => c.status === 'exhausted').length;
    return { sentToday, failedToday, waiting, awaitingResponse, converted, exhausted };
  }, [logs, cycles]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reativação Automática</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe em qual fase cada cliente está e quem recebeu mensagem hoje.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi icon={<Send className="h-4 w-4" />} label="Enviadas hoje" value={kpis.sentToday} />
        <Kpi icon={<XCircle className="h-4 w-4 text-destructive" />} label="Falhas hoje" value={kpis.failedToday} />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Aguardando envio" value={kpis.waiting} />
        <Kpi icon={<MessageCircle className="h-4 w-4" />} label="Aguardando resposta" value={kpis.awaitingResponse} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Converteram" value={kpis.converted} />
        <Kpi icon={<XCircle className="h-4 w-4" />} label="Esgotados" value={kpis.exhausted} />
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Enviadas hoje ({logs.length})</TabsTrigger>
          <TabsTrigger value="cycles">Fluxo por cliente ({cycles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mensagens enviadas hoje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Tentativa</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma mensagem enviada hoje.</TableCell></TableRow>
                    ) : logs.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.customer?.name || '—'}</TableCell>
                        <TableCell><div className="flex items-center gap-1"><ProductIcon t={l.product_type} /> {l.product_type === 'water' ? 'Água' : 'Gás'}</div></TableCell>
                        <TableCell>#{l.attempt_number}</TableCell>
                        <TableCell className="font-mono text-xs">{l.phone}</TableCell>
                        <TableCell>
                          {l.status === 'sent'
                            ? <Badge variant="default">Enviada</Badge>
                            : <Badge variant="destructive" title={l.error_message || ''}>Falha</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmt(l.sent_at)}</TableCell>
                        <TableCell className="max-w-md truncate text-xs" title={l.message_content}>{l.message_content}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="waiting">Aguardando envio</SelectItem>
                <SelectItem value="sent">Enviada (sem resposta)</SelectItem>
                <SelectItem value="completed">Converteu</SelectItem>
                <SelectItem value="exhausted">Esgotado</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Água + Gás</SelectItem>
                <SelectItem value="water">Água</SelectItem>
                <SelectItem value="gas">Gás</SelectItem>
              </SelectContent>
            </Select>
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
                    {filteredCycles.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente no fluxo com esses filtros.</TableCell></TableRow>
                    ) : filteredCycles.map(c => {
                      const s = statusLabel[c.status];
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.customer?.name || '—'}</div>
                            <div className="text-xs text-muted-foreground font-mono">{c.customer?.phone || ''}</div>
                          </TableCell>
                          <TableCell><div className="flex items-center gap-1"><ProductIcon t={c.product_type} /> {c.product_type === 'water' ? 'Água' : 'Gás'}</div></TableCell>
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
      </Tabs>
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