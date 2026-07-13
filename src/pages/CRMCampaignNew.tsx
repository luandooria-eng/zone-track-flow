import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Upload, ArrowLeft, Calendar, Users, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WhatsAppTemplateSelect } from '@/components/whatsapp/WhatsAppTemplateSelect';

type Source = 'lead' | 'customer' | 'csv';
type Recipient = {
  source: Source;
  lead_id?: string;
  customer_id?: string;
  name: string;
  phone: string;
  variables?: Record<string, string>;
};

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '');
}

export default function CRMCampaignNew() {
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [rateLimit, setRateLimit] = useState(25);
  const [winStart, setWinStart] = useState('09:00');
  const [winEnd, setWinEnd] = useState('19:00');
  const [attribDays, setAttribDays] = useState(30);

  // Step 2 — audience
  const [leads, setLeads] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Step 3 — templates
  const [templates, setTemplates] = useState<{ label: string; body: string; whatsapp_template_id: string | null }[]>([
    { label: 'A', body: 'Olá {{primeiro_nome}}, tudo bem? Temos uma oferta especial para você!', whatsapp_template_id: null },
  ]);

  useEffect(() => {
    (async () => {
      const [leadsRes, custRes] = await Promise.all([
        supabase
          .from('crm_leads')
          .select('id, name, phone, stage_id, stage:crm_funnel_stages(name)')
          .is('customer_id', null)
          .not('phone', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase
          .from('customers')
          .select('id, name, phone, last_order_at')
          .not('phone', 'is', null)
          .neq('name', 'Consumidor Avulso')
          .order('name')
          .limit(1000),
      ]);
      setLeads(leadsRes.data || []);
      setCustomers(custRes.data || []);
    })();
  }, []);

  const filteredLeads = useMemo(
    () => leads.filter((l) =>
      !leadSearch || l.name?.toLowerCase().includes(leadSearch.toLowerCase()) || l.phone?.includes(leadSearch)
    ),
    [leads, leadSearch]
  );
  const filteredCustomers = useMemo(
    () => customers.filter((c) =>
      !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)
    ),
    [customers, customerSearch]
  );

  // Dedup count
  const recipientsResolved = useMemo<Recipient[]>(() => {
    const map = new Map<string, Recipient>();
    leads
      .filter((l) => selectedLeadIds.has(l.id))
      .forEach((l) => {
        const norm = normalizePhone(l.phone);
        if (norm.length < 10) return;
        if (!map.has(norm)) map.set(norm, { source: 'lead', lead_id: l.id, name: l.name || 'Lead', phone: l.phone });
      });
    customers
      .filter((c) => selectedCustomerIds.has(c.id))
      .forEach((c) => {
        const norm = normalizePhone(c.phone);
        if (norm.length < 10) return;
        if (!map.has(norm))
          map.set(norm, { source: 'customer', customer_id: c.id, name: c.name, phone: c.phone });
      });
    csvRecipients.forEach((r) => {
      const norm = normalizePhone(r.phone);
      if (norm.length < 10) return;
      if (!map.has(norm)) map.set(norm, r);
    });
    return Array.from(map.values());
  }, [selectedLeadIds, selectedCustomerIds, csvRecipients, leads, customers]);

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;
      const header = lines[0].split(/[,;]/).map((h) => h.trim().toLowerCase());
      const nameIdx = header.findIndex((h) => h === 'nome' || h === 'name');
      const phoneIdx = header.findIndex((h) => h === 'telefone' || h === 'phone' || h === 'celular');
      if (phoneIdx === -1) {
        toast.error('CSV precisa ter coluna "telefone" ou "phone"');
        return;
      }
      const out: Recipient[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/).map((c) => c.trim());
        const phone = cols[phoneIdx];
        if (!phone || normalizePhone(phone).length < 10) continue;
        const variables: Record<string, string> = {};
        header.forEach((h, idx) => {
          if (idx !== nameIdx && idx !== phoneIdx) variables[h] = cols[idx] || '';
        });
        out.push({
          source: 'csv',
          name: nameIdx >= 0 ? cols[nameIdx] || 'Cliente' : 'Cliente',
          phone,
          variables,
        });
      }
      setCsvRecipients(out);
      toast.success(`${out.length} contatos importados do CSV`);
    };
    reader.readAsText(file);
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Informe o nome da campanha');
    if (recipientsResolved.length === 0) return toast.error('Selecione ao menos 1 destinatário');
    if (templates.length === 0 || templates.some((t) => !t.body.trim()))
      return toast.error('Preencha as variantes de mensagem');

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      // 1) create campaign
      const { data: campaign, error: cErr } = await supabase
        .from('crm_campaigns')
        .insert({
          name,
          status: 'scheduled',
          scheduled_at: new Date(scheduledAt).toISOString(),
          rate_limit_per_min: rateLimit,
          send_window_start: winStart,
          send_window_end: winEnd,
          attribution_days: attribDays,
          audience_summary: {
            leads_count: selectedLeadIds.size,
            customers_count: selectedCustomerIds.size,
            csv_count: csvRecipients.length,
            total_dedup: recipientsResolved.length,
          },
          created_by: user.user?.id,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // 2) create templates
      const { data: createdTemplates, error: tErr } = await supabase
        .from('crm_campaign_templates')
        .insert(
          templates.map((t) => ({
            campaign_id: campaign.id, label: t.label, body: t.body, weight: 1,
            whatsapp_template_id: t.whatsapp_template_id,
          }))
        )
        .select();
      if (tErr) throw tErr;

      // 3) create recipients (round-robin template assignment)
      const recipientRows = recipientsResolved.map((r, idx) => ({
        campaign_id: campaign.id,
        source: r.source,
        lead_id: r.lead_id || null,
        customer_id: r.customer_id || null,
        name: r.name,
        phone: r.phone,
        phone_normalized: normalizePhone(r.phone),
        template_id: createdTemplates[idx % createdTemplates.length].id,
        variables: r.variables || {},
      }));

      // chunk inserts (1000)
      for (let i = 0; i < recipientRows.length; i += 500) {
        const { error: rErr } = await supabase
          .from('crm_campaign_recipients')
          .insert(recipientRows.slice(i, i + 500));
        if (rErr) throw rErr;
      }

      toast.success('Campanha agendada!');
      nav(`/crm/campanhas/${campaign.id}`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro: ' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav('/crm/campanhas')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold">Nova campanha</h1>
      </div>

      {/* Step 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" /> 1. Nome e agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nome da campanha</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Reativação maio" />
          </div>
          <div>
            <Label>Data e hora de início</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <Label>Rate limit (mensagens / minuto)</Label>
            <Input
              type="number"
              min={1}
              max={60}
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value) || 25)}
            />
          </div>
          <div>
            <Label>Janela de envio — início</Label>
            <Input type="time" value={winStart} onChange={(e) => setWinStart(e.target.value)} />
          </div>
          <div>
            <Label>Janela de envio — fim</Label>
            <Input type="time" value={winEnd} onChange={(e) => setWinEnd(e.target.value)} />
          </div>
          <div>
            <Label>Janela de atribuição de conversão (dias)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={attribDays}
              onChange={(e) => setAttribDays(parseInt(e.target.value) || 30)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> 2. Audiência
            <Badge variant="secondary" className="ml-2">
              {recipientsResolved.length} destinatários (dedup)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="leads">
            <TabsList>
              <TabsTrigger value="leads">Leads ({selectedLeadIds.size})</TabsTrigger>
              <TabsTrigger value="customers">Clientes ({selectedCustomerIds.size})</TabsTrigger>
              <TabsTrigger value="csv">CSV ({csvRecipients.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="space-y-3 pt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar lead..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedLeadIds(new Set(filteredLeads.map((l) => l.id)))}
                >
                  Selecionar todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedLeadIds(new Set())}>
                  Limpar
                </Button>
              </div>
              <ScrollArea className="h-72 border rounded-md">
                <div className="divide-y">
                  {filteredLeads.map((l) => (
                    <label
                      key={l.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedLeadIds.has(l.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedLeadIds);
                          if (v) next.add(l.id);
                          else next.delete(l.id);
                          setSelectedLeadIds(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{l.name || 'Sem nome'}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.phone} {l.stage?.name && `· ${l.stage.name}`}
                        </div>
                      </div>
                    </label>
                  ))}
                  {filteredLeads.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum lead sem cliente vinculado encontrado.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="customers" className="space-y-3 pt-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar cliente..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCustomerIds(new Set(filteredCustomers.map((c) => c.id)))}
                >
                  Selecionar todos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedCustomerIds(new Set())}>
                  Limpar
                </Button>
              </div>
              <ScrollArea className="h-72 border rounded-md">
                <div className="divide-y">
                  {filteredCustomers.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedCustomerIds.has(c.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedCustomerIds);
                          if (v) next.add(c.id);
                          else next.delete(c.id);
                          setSelectedCustomerIds(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.phone}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="csv" className="space-y-3 pt-3">
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  CSV com cabeçalho. Colunas obrigatórias: <code>telefone</code> (ou <code>phone</code>).
                  Opcional: <code>nome</code> e variáveis livres (viram <code>{`{{variavel}}`}</code>).
                </p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button asChild variant="outline" size="sm">
                    <span>Selecionar arquivo CSV</span>
                  </Button>
                </label>
              </div>
              {csvRecipients.length > 0 && (
                <ScrollArea className="h-48 border rounded-md">
                  <div className="divide-y">
                    {csvRecipients.slice(0, 100).map((r, i) => (
                      <div key={i} className="px-3 py-2 text-sm flex justify-between">
                        <span>{r.name}</span>
                        <span className="text-muted-foreground">{r.phone}</span>
                      </div>
                    ))}
                    {csvRecipients.length > 100 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        + {csvRecipients.length - 100} contatos...
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Step 3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-primary" /> 3. Mensagens (A/B test)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Variáveis: <code>{`{{nome}}`}</code>, <code>{`{{primeiro_nome}}`}</code> + qualquer coluna do CSV.
          </p>
          {templates.map((t, idx) => (
            <div key={idx} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variante {t.label}</Label>
                {templates.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTemplates(templates.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Textarea
                rows={4}
                value={t.body}
                onChange={(e) => {
                  const next = [...templates];
                  next[idx] = { ...t, body: e.target.value };
                  setTemplates(next);
                }}
              />
              <Label className="text-xs">Template Meta (fallback fora da janela de 24h)</Label>
              <WhatsAppTemplateSelect
                value={t.whatsapp_template_id}
                onChange={(v) => {
                  const next = [...templates];
                  next[idx] = { ...t, whatsapp_template_id: v };
                  setTemplates(next);
                }}
              />
            </div>
          ))}
          {templates.length < 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setTemplates([
                  ...templates,
                  { label: String.fromCharCode(65 + templates.length), body: '', whatsapp_template_id: null },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar variante
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Step 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" /> 4. Revisar e agendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Destinatários</div>
              <div className="font-semibold text-lg">{recipientsResolved.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Variantes</div>
              <div className="font-semibold text-lg">{templates.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Rate limit</div>
              <div className="font-semibold text-lg">{rateLimit}/min</div>
            </div>
            <div>
              <div className="text-muted-foreground">Duração estimada</div>
              <div className="font-semibold text-lg">
                ~{Math.ceil(recipientsResolved.length / rateLimit)} min
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? 'Salvando...' : 'Agendar campanha'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
