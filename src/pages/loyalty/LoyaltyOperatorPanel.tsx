import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, subDays, startOfDay } from 'date-fns';
import { Users2, Link2, Copy, Send, TrendingUp, UserPlus, Search, MessageSquare, BarChart3 } from 'lucide-react';

export default function LoyaltyOperatorPanel() {
  const { user } = useAuth();
  const [searchPhone, setSearchPhone] = useState('');
  const [dateRange, setDateRange] = useState(30);

  const since = startOfDay(subDays(new Date(), dateRange)).toISOString();

  // Metrics: new customers created in period
  const { data: newCustomers, isLoading: loadingCustomers } = useQuery({
    queryKey: ['operator-new-customers', since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, created_at, points_balance')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Metrics: link sends
  const { data: linkSends, isLoading: loadingLinks } = useQuery({
    queryKey: ['operator-link-sends', since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_link_sends' as any)
        .select('*, customer:customers(id, name, phone)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Metrics: customers with portal sessions (loyalty_client_tokens)
  const { data: activeSessions } = useQuery({
    queryKey: ['operator-active-sessions'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('loyalty_client_tokens')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Customer with points
  const { data: customersWithPoints } = useQuery({
    queryKey: ['operator-customers-with-points'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .gt('points_balance', 0);
      if (error) throw error;
      return count || 0;
    },
  });

  // Total customers
  const { data: totalCustomers } = useQuery({
    queryKey: ['operator-total-customers'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Quick lookup
  const handleLookup = async () => {
    if (!searchPhone.trim()) return;
    const digits = searchPhone.replace(/\D/g, '');
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, points_balance')
      .or(`phone.ilike.%${digits}%`)
      .limit(5);
    if (!data?.length) { toast.error('Nenhum cliente encontrado'); return; }
    toast.success(`Encontrado: ${data[0].name} — ${data[0].points_balance ?? 0} pts`);
  };

  const copyPortalLink = (customerId: string) => {
    const url = `${window.location.origin}/c/login`;
    navigator.clipboard.writeText(url);
    toast.success('Link do portal copiado!');

    // Track send
    if (user?.id) {
      supabase.from('portal_link_sends' as any).insert({
        customer_id: customerId,
        operator_id: user.id,
        send_method: 'copy',
      }).then(() => {});
    }
  };

  const sendWhatsAppLink = (phone: string, customerId: string) => {
    const url = `${window.location.origin}/c/login`;
    const msg = `Acesse seu Clube de Pontos: ${url}`;
    window.open(`https://wa.me/${phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);

    if (user?.id) {
      supabase.from('portal_link_sends' as any).insert({
        customer_id: customerId,
        operator_id: user.id,
        send_method: 'whatsapp',
      }).then(() => {});
    }
  };

  const conversionRate = totalCustomers && customersWithPoints ? ((customersWithPoints / totalCustomers) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Painel Operacional</h1>
        <p className="text-muted-foreground text-sm">Métricas de cadastro e engajamento do programa de fidelidade</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCustomers ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Total clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{customersWithPoints ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Com pontos ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeSessions ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Sessões portal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick lookup + send link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Buscar cliente e enviar link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Buscar por telefone..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
            <Button onClick={handleLookup}>Buscar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map((d) => (
          <Button key={d} variant={dateRange === d ? 'default' : 'outline'} size="sm" onClick={() => setDateRange(d)}>
            {d}d
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* New customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Novos cadastros ({newCustomers?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCustomers ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !newCustomers?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cadastro no período</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {newCustomers.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.phone} · {format(new Date(c.created_at), 'dd/MM HH:mm')}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline">{c.points_balance ?? 0} pts</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyPortalLink(c.id)} title="Copiar link">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {c.phone && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendWhatsAppLink(c.phone, c.id)} title="Enviar via WhatsApp">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link sends history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" /> Histórico de envios ({linkSends?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLinks ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !linkSends?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum envio no período</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {linkSends.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{(s.customer as any)?.name || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.created_at), 'dd/MM HH:mm')} · {(s.customer as any)?.phone}
                      </p>
                    </div>
                    <Badge variant={s.send_method === 'whatsapp' ? 'default' : 'outline'}>
                      {s.send_method === 'whatsapp' ? 'WhatsApp' : s.send_method === 'sms' ? 'SMS' : 'Copiado'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
