import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Send, Reply, Target, AlertTriangle, Pause, Play, X } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useCRMCampaign, useCampaignMetrics, useCampaignRecipients } from '@/hooks/useCRMCampaigns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  sending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  paused: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export default function CRMCampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useCRMCampaign(id);
  const { data: metrics } = useCampaignMetrics(id);
  const { data: recipients = [] } = useCampaignRecipients(id);
  const [filter, setFilter] = useState<'all' | 'sent' | 'responded' | 'converted' | 'pending' | 'failed'>('all');

  if (!data) return <div className="text-muted-foreground">Carregando...</div>;
  const { campaign, templates } = data;

  async function updateStatus(status: string) {
    const { error } = await supabase.from('crm_campaigns').update({ status }).eq('id', id!);
    if (error) toast.error(error.message);
    else {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['crm-campaign', id] });
    }
  }

  const totals = metrics?.totals || { total: 0, sent: 0, pending: 0, failed: 0, responded: 0, converted: 0 };
  const respRate = totals.sent > 0 ? (totals.responded / totals.sent) * 100 : 0;
  const convRate = totals.sent > 0 ? (totals.converted / totals.sent) * 100 : 0;

  const dailyChart = (metrics?.daily || []).map((d: any) => ({
    day: format(new Date(d.day), 'dd/MM', { locale: ptBR }),
    Enviadas: d.sent,
    Respondidas: d.responded,
    Convertidas: d.converted,
  }));

  const filtered = recipients.filter((r: any) => {
    if (filter === 'all') return true;
    if (filter === 'converted') return !!r.converted_at;
    if (filter === 'responded') return !!r.responded_at;
    if (filter === 'sent') return r.status === 'sent';
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'failed') return r.status === 'failed';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/crm/campanhas')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {campaign.name}
              <Badge className={STATUS_COLORS[campaign.status]}>{campaign.status}</Badge>
            </h1>
            {campaign.scheduled_at && (
              <p className="text-sm text-muted-foreground">
                Agendada para {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'sending' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('paused')}>
              <Pause className="h-4 w-4 mr-1" /> Pausar
            </Button>
          )}
          {campaign.status === 'paused' && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('sending')}>
              <Play className="h-4 w-4 mr-1" /> Retomar
            </Button>
          )}
          {(campaign.status === 'scheduled' || campaign.status === 'paused') && (
            <Button variant="outline" size="sm" onClick={() => updateStatus('cancelled')}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Send className="h-3 w-3" /> Enviadas
            </div>
            <div className="text-2xl font-bold">{totals.sent}</div>
            <div className="text-xs text-muted-foreground">de {totals.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Reply className="h-3 w-3" /> Respostas
            </div>
            <div className="text-2xl font-bold">{totals.responded}</div>
            <div className="text-xs text-muted-foreground">{respRate.toFixed(1)}% taxa</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" /> Convertidas
            </div>
            <div className="text-2xl font-bold text-primary">{totals.converted}</div>
            <div className="text-xs text-muted-foreground">{convRate.toFixed(1)}% conv.</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Falhas / Pend.
            </div>
            <div className="text-2xl font-bold">{totals.failed} / {totals.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      {dailyChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução diária</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Enviadas" fill="hsl(var(--muted-foreground))" />
                <Bar dataKey="Respondidas" fill="hsl(var(--primary))" />
                <Bar dataKey="Convertidas" fill="hsl(142 76% 36%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* A/B comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A/B test — comparativo de variantes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="text-right">Enviadas</TableHead>
                <TableHead className="text-right">Respostas</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
                <TableHead className="text-right">Taxa conv.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t: any) => {
                const m = (metrics?.byTemplate || []).find((x: any) => x.template_id === t.id) || {
                  sent: 0, responded: 0, converted: 0,
                };
                const tConv = m.sent > 0 ? ((m.converted / m.sent) * 100).toFixed(1) : '0';
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-semibold">{t.label}</TableCell>
                    <TableCell className="max-w-md truncate text-sm text-muted-foreground">{t.body}</TableCell>
                    <TableCell className="text-right">{m.sent}</TableCell>
                    <TableCell className="text-right">{m.responded}</TableCell>
                    <TableCell className="text-right">{m.converted}</TableCell>
                    <TableCell className="text-right font-semibold">{tConv}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Destinatários ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="sent">Enviados</TabsTrigger>
              <TabsTrigger value="responded">Responderam</TabsTrigger>
              <TabsTrigger value="converted">Converteram</TabsTrigger>
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="failed">Falhas</TabsTrigger>
            </TabsList>
            <TabsContent value={filter} className="pt-3">
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Variante</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Respondeu</TableHead>
                      <TableHead>Converteu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 500).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                        <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                        <TableCell>{r.template?.label || '—'}</TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.responded_at ? format(new Date(r.responded_at), 'dd/MM HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.converted_at
                            ? <Badge className="bg-emerald-500/15 text-emerald-700">{format(new Date(r.converted_at), 'dd/MM')}</Badge>
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
