import { useMemo, useState } from 'react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { MessageSquare, Reply, Clock, Target, Trophy, VolumeX, Sparkles } from 'lucide-react';
import { useCRMTriggerMetrics } from '@/hooks/useCRMTriggerMetrics';

type PresetKey = 'today' | 'yesterday' | '3d' | '7d' | '15d' | '30d' | '90d' | 'month' | 'custom';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '3d', label: '3 dias' },
  { key: '7d', label: '7 dias' },
  { key: '15d', label: '15 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'month', label: 'Este mês' },
];

function rangeFromPreset(key: PresetKey): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case '3d':
      return { from: startOfDay(subDays(now, 2)), to: endOfDay(now) };
    case '7d':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case '15d':
      return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
    case '30d':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case '90d':
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) };
    case 'month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
  }
}

function formatMinutes(min: number | null): string {
  if (min == null) return '—';
  if (min < 60) return `${min.toFixed(0)} min`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export default function CRMMetrics() {
  const [preset, setPreset] = useState<PresetKey>('30d');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const activeRange = useMemo(() => {
    if (preset === 'custom' && customRange?.from) {
      return {
        from: startOfDay(customRange.from),
        to: endOfDay(customRange.to ?? customRange.from),
      };
    }
    return rangeFromPreset(preset === 'custom' ? '30d' : preset);
  }, [preset, customRange]);

  const startISO = activeRange.from.toISOString();
  const endISO = activeRange.to.toISOString();

  const { data, isLoading } = useCRMTriggerMetrics(startISO, endISO);

  const totals = data?.totals ?? { total_sent: 0, total_responded: 0, avg_response_minutes: null };
  const responseRate =
    totals.total_sent > 0 ? (totals.total_responded / totals.total_sent) * 100 : 0;

  const dailyChart = (data?.daily ?? []).map((d) => ({
    day: format(
      (() => {
        const [y, m, dd] = d.day.split('-').map(Number);
        return new Date(y, (m ?? 1) - 1, dd ?? 1);
      })(),
      'dd/MM',
      { locale: ptBR }
    ),
    Enviadas: d.sent,
    Respondidas: d.responded,
  }));

  const topEngaged = data?.topEngaged ?? [];
  const silent = data?.silent ?? [];
  const reactivated = data?.reactivated ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Métricas do CRM</h1>
          <p className="text-sm text-muted-foreground">
            Disparos automáticos por gatilho e respostas dos clientes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={preset === r.key ? 'default' : 'outline'}
              onClick={() => setPreset(r.key)}
            >
              {r.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={preset === 'custom' ? 'default' : 'outline'}
                className={cn('gap-2')}
              >
                <CalendarIcon className="h-4 w-4" />
                {preset === 'custom' && customRange?.from
                  ? `${format(customRange.from, 'dd/MM', { locale: ptBR })}${
                      customRange.to ? ' - ' + format(customRange.to, 'dd/MM', { locale: ptBR }) : ''
                    }`
                  : 'Personalizado'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(r) => {
                  setCustomRange(r);
                  if (r?.from) setPreset('custom');
                }}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Mensagens enviadas</p>
              <p className="text-2xl font-semibold mt-1">{totals.total_sent}</p>
            </div>
            <MessageSquare className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Respondidas</p>
              <p className="text-2xl font-semibold mt-1">{totals.total_responded}</p>
            </div>
            <Reply className="h-5 w-5 text-success" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Taxa de resposta</p>
              <p className="text-2xl font-semibold mt-1">{responseRate.toFixed(1)}%</p>
            </div>
            <Target className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Tempo médio</p>
              <p className="text-2xl font-semibold mt-1">{formatMinutes(totals.avg_response_minutes)}</p>
            </div>
            <Clock className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disparos por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Carregando…
            </div>
          ) : dailyChart.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Nenhum disparo no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="Enviadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Respondidas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de gatilhos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gatilho</TableHead>
                <TableHead className="text-right">Enviadas</TableHead>
                <TableHead className="text-right">Respondidas</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.byTrigger ?? []).map((t) => {
                const rate = t.sent > 0 ? (t.responded / t.sent) * 100 : 0;
                return (
                  <TableRow key={(t.trigger_id ?? t.trigger_name) + ''}>
                    <TableCell className="font-medium">{t.trigger_name}</TableCell>
                    <TableCell className="text-right">{t.sent}</TableCell>
                    <TableCell className="text-right">{t.responded}</TableCell>
                    <TableCell className="text-right">{rate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{formatMinutes(t.avg_response_minutes)}</TableCell>
                  </TableRow>
                );
              })}
              {(data?.byTrigger ?? []).length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum gatilho disparado no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top engaged customers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            Top clientes engajados
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Quem mais responde aos disparos no período
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Recebidas</TableHead>
                <TableHead className="text-right">Respondidas</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topEngaged.map((c) => (
                <TableRow key={c.lead_id}>
                  <TableCell className="font-medium">{c.lead_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lead_phone ?? '—'}</TableCell>
                  <TableCell className="text-right">{c.sent}</TableCell>
                  <TableCell className="text-right text-success font-medium">{c.responded}</TableCell>
                  <TableCell className="text-right">{formatMinutes(c.avg_response_minutes)}</TableCell>
                </TableRow>
              ))}
              {topEngaged.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum cliente respondeu no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Silent customers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <VolumeX className="h-4 w-4 text-destructive" />
            Clientes silenciosos
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Receberam 3 ou mais disparos sem responder — candidatos a remover do funil ou trocar de abordagem
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Disparos sem resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {silent.map((c) => (
                <TableRow key={c.lead_id}>
                  <TableCell className="font-medium">{c.lead_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lead_phone ?? '—'}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">{c.sent}</TableCell>
                </TableRow>
              ))}
              {silent.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Nenhum cliente silencioso no período. 🎉
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reactivated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-success" />
            Reativações
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Leads marcados como "Perdido" que voltaram a responder após um disparo
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead className="text-right">Última resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reactivated.map((c) => (
                <TableRow key={c.lead_id}>
                  <TableCell className="font-medium">{c.lead_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.lead_phone ?? '—'}</TableCell>
                  <TableCell className="text-right">{c.responded}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {c.last_response_at
                      ? format(new Date(c.last_response_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {reactivated.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhuma reativação no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}