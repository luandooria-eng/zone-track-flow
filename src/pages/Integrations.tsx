import { useState, useEffect } from 'react';
import {
  Webhook,
  Link2,
  Check,
  X,
  Plus,
  Settings,
  RefreshCw,
  ExternalLink,
  Copy,
  Trash2,
  MessageSquare,
  CreditCard,
  Truck,
  Database,
  Mail,
  Smartphone,
  AlertTriangle,
  Eye,
  EyeOff,
  ShoppingCart,
  Save,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useWhatsAppConfig,
  useSaveWhatsAppConfig,
  useSaveMetaConfig,
  useSetWhatsAppProvider,
  WhatsAppProvider,
} from '@/hooks/useWhatsApp';
import { WhatsAppTemplatesPanel } from '@/components/whatsapp/WhatsAppTemplatesPanel';
import { WhatsAppTemplateSelect } from '@/components/whatsapp/WhatsAppTemplateSelect';

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted px-3 py-2 rounded truncate select-all">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success('Copiado!');
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function WhatsAppConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: config, isLoading } = useWhatsAppConfig();
  const saveZApi = useSaveWhatsAppConfig();
  const saveMeta = useSaveMetaConfig();
  const setProvider = useSetWhatsAppProvider();

  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showAppSecret, setShowAppSecret] = useState(false);

  useEffect(() => {
    if (config) {
      setInstanceId(prev => prev || config.instance_id || '');
      setToken(prev => prev || config.token || '');
      setPhoneNumberId(prev => prev || config.meta_phone_number_id || '');
      setWabaId(prev => prev || config.meta_waba_id || '');
      setAccessToken(prev => prev || config.meta_access_token || '');
      setAppSecret(prev => prev || config.meta_app_secret || '');
    }
  }, [config]);

  const webhookUrl = config
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook?token=${config.webhook_token}`
    : '';

  const apiBaseUrl = instanceId && token
    ? `https://api.z-api.io/instances/${instanceId}/token/${token}`
    : '';

  const sendTextUrl = apiBaseUrl ? `${apiBaseUrl}/send-text` : '';

  const metaWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-webhook`;
  const verifyToken = config?.meta_verify_token || '';

  function handleSaveZApi() {
    if (!instanceId.trim() || !token.trim()) {
      toast.error('Preencha Instance ID e Token');
      return;
    }
    saveZApi.mutate({ instance_id: instanceId.trim(), token: token.trim() });
  }

  function handleSaveMeta() {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      toast.error('Preencha Phone Number ID e Access Token');
      return;
    }
    saveMeta.mutate({
      meta_phone_number_id: phoneNumberId.trim(),
      meta_waba_id: wabaId.trim(),
      meta_access_token: accessToken.trim(),
      meta_app_secret: appSecret.trim(),
      meta_verify_token: verifyToken || crypto.randomUUID(),
    });
  }

  if (!open) return null;

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          Configurar WhatsApp
        </DialogTitle>
      </DialogHeader>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Provedor ativo</p>
              <p className="text-xs text-muted-foreground">
                Define qual API envia e recebe as mensagens agora.
              </p>
            </div>
            <Select
              value={config?.provider || 'zapi'}
              onValueChange={(v) => setProvider.mutate(v as WhatsAppProvider)}
            >
              <SelectTrigger className="w-[190px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zapi">Z-API</SelectItem>
                <SelectItem value="meta_cloud">Meta Cloud API (Oficial)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue={config?.provider === 'meta_cloud' ? 'meta' : 'zapi'}>
            <TabsList className="w-full">
              <TabsTrigger value="zapi" className="flex-1">Z-API</TabsTrigger>
              <TabsTrigger value="meta" className="flex-1">Meta Cloud API</TabsTrigger>
            </TabsList>

            <TabsContent value="zapi" className="space-y-4 pt-3">
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Como configurar:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Acesse sua conta Z-API e crie uma instância</li>
                  <li>Copie o Instance ID e o Token de segurança</li>
                  <li>Cole os dados abaixo e salve</li>
                  <li>Na Z-API, configure o Webhook com a URL abaixo</li>
                  <li>Escaneie o QR Code para conectar seu WhatsApp</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label>Instance ID</Label>
                <Input
                  placeholder="Ex: 3D6AB4A2B5C8..."
                  value={instanceId}
                  onChange={(e) => setInstanceId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Token de Segurança</Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Seu token Z-API"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken((v) => !v)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {apiBaseUrl && (
                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">URLs da API da Instância</p>
                  <CopyField
                    label="URL Base da Instância"
                    value={apiBaseUrl}
                    hint="Use para qualquer chamada à Z-API desta instância"
                  />
                  <CopyField
                    label="Endpoint Enviar Mensagem"
                    value={sendTextUrl}
                    hint="POST para enviar mensagens de texto"
                  />
                </div>
              )}

              {webhookUrl && (
                <CopyField
                  label="URL do Webhook (configure na Z-API)"
                  value={webhookUrl}
                  hint="Cole esta URL nas configurações de Webhook da Z-API"
                />
              )}

              <Button className="w-full bg-green-500 hover:bg-green-600" onClick={handleSaveZApi} disabled={saveZApi.isPending}>
                Salvar Z-API
              </Button>
            </TabsContent>

            <TabsContent value="meta" className="space-y-4 pt-3">
              <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Como configurar (Meta for Developers):</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Crie um App tipo "Business" e adicione o produto WhatsApp</li>
                  <li>Copie o Phone Number ID e o WABA ID</li>
                  <li>Gere um token permanente (System User, em Meta Business Suite)</li>
                  <li>Cole os dados abaixo e salve</li>
                  <li>No App, cole a URL do webhook + o token de verificação abaixo</li>
                  <li>Assine os campos "messages" no webhook</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input
                  placeholder="Ex: 109876543210987"
                  value={phoneNumberId}
                  onChange={(e) => setPhoneNumberId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>WhatsApp Business Account ID (WABA)</Label>
                <Input
                  placeholder="Ex: 123456789012345"
                  value={wabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Access Token (permanente)</Label>
                <div className="relative">
                  <Input
                    type={showAccessToken ? 'text' : 'password'}
                    placeholder="Token do System User"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAccessToken((v) => !v)}
                  >
                    {showAccessToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>App Secret</Label>
                <p className="text-xs text-muted-foreground">
                  Usado para validar a assinatura dos webhooks recebidos. Em Configurações do App → Básico.
                </p>
                <div className="relative">
                  <Input
                    type={showAppSecret ? 'text' : 'password'}
                    placeholder="App Secret"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAppSecret((v) => !v)}
                  >
                    {showAppSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-xs font-medium text-foreground">Configuração do Webhook (Meta App Dashboard)</p>
                <CopyField
                  label="URL de Callback"
                  value={metaWebhookUrl}
                  hint="Cole em WhatsApp → Configuração → Webhook"
                />
                <CopyField
                  label="Token de Verificação"
                  value={verifyToken || '(gerado ao salvar)'}
                  hint="Cole no campo 'Verify Token' junto com a URL acima"
                />
              </div>

              <Button className="w-full bg-green-500 hover:bg-green-600" onClick={handleSaveMeta} disabled={saveMeta.isPending}>
                Salvar Meta Cloud API
              </Button>
            </TabsContent>
          </Tabs>

          <Button variant="outline" className="w-full" onClick={onClose}>
            Fechar
          </Button>
        </div>
      )}
    </DialogContent>
  );
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: 'connected' | 'disconnected' | 'error';
  category: 'payment' | 'messaging' | 'delivery' | 'erp' | 'notification';
  lastSync?: Date;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: Date;
  failureCount: number;
}

const integrations: Integration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Receba pedidos e envie notificações via WhatsApp',
    icon: MessageSquare,
    status: 'connected',
    category: 'messaging',
    lastSync: new Date(),
  },
  {
    id: 'pix',
    name: 'Pix',
    description: 'Pagamentos instantâneos via Pix',
    icon: CreditCard,
    status: 'connected',
    category: 'payment',
    lastSync: new Date(),
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Pagamentos com cartão de crédito',
    icon: CreditCard,
    status: 'disconnected',
    category: 'payment',
  },
  {
    id: 'ifood',
    name: 'iFood',
    description: 'Integração com marketplace iFood',
    icon: Truck,
    status: 'disconnected',
    category: 'delivery',
  },
  {
    id: 'rappi',
    name: 'Rappi',
    description: 'Integração com marketplace Rappi',
    icon: Truck,
    status: 'error',
    category: 'delivery',
  },
  {
    id: 'bling',
    name: 'Bling ERP',
    description: 'Sincronização com sistema Bling',
    icon: Database,
    status: 'disconnected',
    category: 'erp',
  },
  {
    id: 'email',
    name: 'Email (SendGrid)',
    description: 'Envio de notificações por email',
    icon: Mail,
    status: 'connected',
    category: 'notification',
    lastSync: new Date(),
  },
  {
    id: 'sms',
    name: 'SMS (Twilio)',
    description: 'Notificações via SMS',
    icon: Smartphone,
    status: 'disconnected',
    category: 'notification',
  },
];

const mockWebhooks: Webhook[] = [
  {
    id: '1',
    name: 'Novo Pedido',
    url: 'https://api.example.com/webhooks/orders',
    events: ['order.created', 'order.updated'],
    active: true,
    lastTriggered: new Date(),
    failureCount: 0,
  },
  {
    id: '2',
    name: 'Pagamento Recebido',
    url: 'https://api.example.com/webhooks/payments',
    events: ['payment.received'],
    active: true,
    lastTriggered: new Date(Date.now() - 3600000),
    failureCount: 2,
  },
  {
    id: '3',
    name: 'Estoque Baixo',
    url: 'https://api.example.com/webhooks/stock',
    events: ['stock.low'],
    active: false,
    failureCount: 0,
  },
];

const webhookEvents = [
  { value: 'order.created', label: 'Pedido Criado' },
  { value: 'order.updated', label: 'Pedido Atualizado' },
  { value: 'order.delivered', label: 'Pedido Entregue' },
  { value: 'order.canceled', label: 'Pedido Cancelado' },
  { value: 'payment.received', label: 'Pagamento Recebido' },
  { value: 'stock.low', label: 'Estoque Baixo' },
  { value: 'customer.created', label: 'Cliente Cadastrado' },
];

// ---- UoouShop Cart Recovery Config Dialog ----
function UoouShopConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [webhookSecret, setWebhookSecret] = useState('');
  const [template, setTemplate] = useState('');
  const [whatsappTemplateId, setWhatsappTemplateId] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uoou-cart-webhook`;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const LS_KEY = 'uooushop_config';
    // Try Supabase first, fall back to localStorage
    supabase
      .from('cart_recovery_config' as any)
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000098')
      .maybeSingle()
      .then(({ data }: any) => {
        const cached = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } })();
        const source = data || cached;
        const generated = crypto.randomUUID();
        if (source) {
          setWebhookSecret(source.webhook_secret || generated);
          setTemplate(source.message_template || '');
          setWhatsappTemplateId(source.whatsapp_template_id || null);
          setActive(source.active ?? true);
          setTestMode(source.test_mode ?? false);
        } else {
          setWebhookSecret(generated);
        }
        setLoading(false);
      });
  }, [open]);

  const LS_KEY = 'uooushop_config';

  async function handleSave() {
    if (!template.trim()) { toast.error('Template de mensagem obrigatório'); return; }
    setSaving(true);
    const payload = {
      webhook_secret: webhookSecret,
      message_template: template,
      whatsapp_template_id: whatsappTemplateId,
      active,
      test_mode: testMode,
      updated_at: new Date().toISOString(),
    };
    // Always save to localStorage so config persists regardless of Supabase permissions
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    // Also try to save to Supabase
    await (supabase as any)
      .from('cart_recovery_config')
      .update({ ...payload })
      .eq('id', '00000000-0000-0000-0000-000000000098');
    setSaving(false);
    toast.success('Configuração salva!');
    onClose();
  }

  if (!open) return null;

  const variables = ['{nome}', '{link}', '{produtos}', '{email}'];

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-blue-500" />
          Recuperação de Carrinho — UoouShop
        </DialogTitle>
      </DialogHeader>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-5 pt-2">

          {/* Webhook URL */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 space-y-3">
            <p className="text-sm font-medium">1. Cole esta URL no campo "URL" do Webhook no UoouShop</p>
            <CopyField label="URL do Webhook" value={webhookUrl} hint="Configure em: Configuração → Webhooks → Criar Webhook → Carrinho" />
          </div>

          {/* Secret */}
          <div className="space-y-2">
            <Label>Segredo do Webhook (Cabeçalho de segurança)</Label>
            <p className="text-xs text-muted-foreground">
              No UoouShop em "Cabeçalhos", adicione: <code className="bg-muted px-1 rounded">x-webhook-secret</code> com o valor abaixo.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={webhookSecret}
                onChange={e => setWebhookSecret(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={() => setShowSecret(v => !v)}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookSecret); toast.success('Copiado!'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Message Template */}
          <div className="space-y-2">
            <Label>Template da Mensagem</Label>
            <p className="text-xs text-muted-foreground">
              Use as variáveis abaixo. Você pode editar este texto a qualquer momento para testar diferentes abordagens e melhorar a taxa de conversão.
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {variables.map(v => (
                <button
                  key={v}
                  type="button"
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors font-mono"
                  onClick={() => setTemplate(t => t + v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <Textarea
              rows={6}
              placeholder="Ex: Olá {nome}! Você deixou produtos no carrinho 👉 {link}"
              value={template}
              onChange={e => setTemplate(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              <strong>{'{nome}'}</strong> = nome do cliente &nbsp;·&nbsp;
              <strong>{'{link}'}</strong> = link do carrinho &nbsp;·&nbsp;
              <strong>{'{produtos}'}</strong> = lista de produtos &nbsp;·&nbsp;
              <strong>{'{email}'}</strong> = e-mail
            </p>
          </div>

          <div className="space-y-2">
            <Label>Template Meta (fallback fora da janela de 24h)</Label>
            <p className="text-xs text-muted-foreground">
              Se o provedor ativo for a Meta Cloud API e o contato não respondeu nas últimas 24h, este template aprovado é usado no lugar do texto livre acima.
            </p>
            <WhatsAppTemplateSelect value={whatsappTemplateId} onChange={setWhatsappTemplateId} />
          </div>

          {/* Test mode toggle */}
          <div className="flex items-center justify-between rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                🧪 Modo Teste
              </p>
              <p className="text-xs text-muted-foreground">
                O webhook recebe e registra os dados normalmente, mas <strong>não envia nenhuma mensagem</strong>. Use para validar que os dados chegam certos antes de ativar de verdade.
              </p>
            </div>
            <Switch checked={testMode} onCheckedChange={setTestMode} />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">Quando desligado, os webhooks chegam mas nenhuma mensagem é enviada.</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}

export default function Integrations() {
  const [webhooks, setWebhooks] = useState(mockWebhooks);
  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isUoouOpen, setIsUoouOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: [] as string[] });

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-success/20 text-success border-0">Conectado</Badge>;
      case 'disconnected':
        return <Badge variant="outline" className="text-muted-foreground">Desconectado</Badge>;
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-0">Erro</Badge>;
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const handleToggleWebhook = (id: string) => {
    setWebhooks((prev) =>
      prev.map((w) => (w.id === id ? { ...w, active: !w.active } : w))
    );
    toast.success('Webhook atualizado!');
  };

  const handleDeleteWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
    toast.success('Webhook removido!');
  };

  const handleAddWebhook = () => {
    if (!newWebhook.name || !newWebhook.url) {
      toast.error('Preencha todos os campos');
      return;
    }
    setWebhooks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        ...newWebhook,
        active: true,
        failureCount: 0,
      },
    ]);
    setNewWebhook({ name: '', url: '', events: [] });
    setIsAddWebhookOpen(false);
    toast.success('Webhook criado!');
  };

  const categories = [
    { key: 'payment', label: 'Pagamentos' },
    { key: 'messaging', label: 'Mensagens' },
    { key: 'delivery', label: 'Entrega' },
    { key: 'erp', label: 'ERP' },
    { key: 'notification', label: 'Notificações' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Conecte serviços externos e gerencie webhooks
        </p>
      </div>

      <Dialog open={isWhatsAppOpen} onOpenChange={setIsWhatsAppOpen}>
        <WhatsAppConfigDialog open={isWhatsAppOpen} onClose={() => setIsWhatsAppOpen(false)} />
      </Dialog>

      <Dialog open={isUoouOpen} onOpenChange={setIsUoouOpen}>
        <UoouShopConfigDialog open={isUoouOpen} onClose={() => setIsUoouOpen(false)} />
      </Dialog>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="mt-4 space-y-6">
          <WhatsAppTemplatesPanel />

          {/* UoouShop — featured */}
          <div>
            <h3 className="font-semibold mb-3">E-commerce</h3>
            <Card className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <ShoppingCart className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium">UoouShop</h4>
                    <Badge className="bg-success/20 text-success border-0">Conectado</Badge>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Recuperação automática de carrinhos abandonados via WhatsApp. Configure o template de mensagem e acompanhe as conversões.
              </p>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsUoouOpen(true)}>
                <Settings className="h-3 w-3" />
                Configurar
              </Button>
            </Card>
          </div>

          {categories.map((category) => {
            const categoryIntegrations = integrations.filter(
              (i) => i.category === category.key
            );
            if (categoryIntegrations.length === 0) return null;

            return (
              <div key={category.key}>
                <h3 className="font-semibold mb-3">{category.label}</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryIntegrations.map((integration, index) => (
                    <Card
                      key={integration.id}
                      className="p-4 animate-fade-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-lg',
                              integration.status === 'connected'
                                ? 'bg-success/10 text-success'
                                : integration.status === 'error'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <integration.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{integration.name}</h4>
                            {getStatusBadge(integration.status)}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {integration.description}
                      </p>
                      {integration.lastSync && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Última sinc: {integration.lastSync.toLocaleString('pt-BR')}
                        </p>
                      )}
                      <div className="flex gap-2">
                        {integration.status === 'connected' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => integration.id === 'whatsapp' && setIsWhatsAppOpen(true)}
                            >
                              <Settings className="h-3 w-3" />
                              Configurar
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1">
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </>
                        ) : integration.status === 'error' ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => integration.id === 'whatsapp' && setIsWhatsAppOpen(true)}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Reconectar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => integration.id === 'whatsapp' && setIsWhatsAppOpen(true)}
                          >
                            <Link2 className="h-3 w-3" />
                            Conectar
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Configure webhooks para receber notificações em tempo real
            </p>
            <Dialog open={isAddWebhookOpen} onOpenChange={setIsAddWebhookOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Webhook</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Ex: Notificação de pedidos"
                      value={newWebhook.name}
                      onChange={(e) =>
                        setNewWebhook({ ...newWebhook, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL do Endpoint</Label>
                    <Input
                      placeholder="https://api.example.com/webhook"
                      value={newWebhook.url}
                      onChange={(e) =>
                        setNewWebhook({ ...newWebhook, url: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Eventos</Label>
                    <Select
                      onValueChange={(v) =>
                        setNewWebhook({
                          ...newWebhook,
                          events: [...newWebhook.events, v],
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione os eventos" />
                      </SelectTrigger>
                      <SelectContent>
                        {webhookEvents.map((event) => (
                          <SelectItem key={event.value} value={event.value}>
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {newWebhook.events.map((event) => (
                        <Badge key={event} variant="secondary" className="gap-1">
                          {webhookEvents.find((e) => e.value === event)?.label}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() =>
                              setNewWebhook({
                                ...newWebhook,
                                events: newWebhook.events.filter((e) => e !== event),
                              })
                            }
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleAddWebhook} className="w-full">
                    Criar Webhook
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {webhooks.map((webhook, index) => (
              <Card
                key={webhook.id}
                className="p-4 animate-fade-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        webhook.active
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Webhook className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{webhook.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {webhook.url}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyUrl(webhook.url)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.active}
                      onCheckedChange={() => handleToggleWebhook(webhook.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteWebhook(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {webhookEvents.find((e) => e.value === event)?.label || event}
                      </Badge>
                    ))}
                  </div>
                  {webhook.failureCount > 0 && (
                    <Badge className="bg-warning/20 text-warning border-0">
                      {webhook.failureCount} falhas
                    </Badge>
                  )}
                </div>
                {webhook.lastTriggered && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Último disparo: {webhook.lastTriggered.toLocaleString('pt-BR')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Chaves de API</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <Label>API Key (Produção)</Label>
                  <Badge className="bg-success/20 text-success border-0">Ativa</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">
                    sk_live_••••••••••••••••••••••••
                  </code>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Regenerar
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <Label>API Key (Teste)</Label>
                  <Badge variant="outline">Teste</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded">
                    sk_test_••••••••••••••••••••••••
                  </code>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Documentação</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Acesse nossa documentação completa da API para integrar seus sistemas.
              </p>
              <Button variant="outline" className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Ver Documentação
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
