import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Pencil, Star, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { AVAILABLE_VARIABLES, renderTemplate } from '@/lib/messageTemplates';

type Template = {
  id: string;
  name: string;
  description: string | null;
  body: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

const PREVIEW_VARS = {
  cliente: 'João Silva',
  produto: 'Água 20L',
  quantidade: 2,
  total: 30,
  pagamento: 'Pix',
  vencimento: '25/04/2026',
};

const EMPTY_FORM = { name: '', description: '', body: '', is_default: false, is_active: true };

export function MessageTemplatesSettings() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_message_templates' as any)
        .select('*')
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as Template[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Template> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('whatsapp_message_templates' as any)
          .update(payload)
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('whatsapp_message_templates' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success('Template salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_message_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description ?? '',
      body: t.body,
      is_default: t.is_default,
      is_active: t.is_active,
    });
    setOpen(true);
  }

  function insertVar(key: string) {
    setForm((f) => ({ ...f, body: f.body + `{{${key}}}` }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Nome e mensagem são obrigatórios');
      return;
    }
    upsert.mutate({
      ...(editing ? { id: editing.id } : {}),
      name: form.name.trim(),
      description: form.description.trim() || null,
      body: form.body,
      is_default: form.is_default,
      is_active: form.is_active,
    });
  }

  const preview = renderTemplate(form.body, PREVIEW_VARS);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Mensagens automáticas (WhatsApp)
          </h3>
          <p className="text-sm text-muted-foreground">
            Personalize as mensagens enviadas após confirmar uma venda. Use variáveis como{' '}
            <code className="text-xs">{'{{cliente}}'}</code> que serão substituídas automaticamente.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo template
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24 text-center">Padrão</TableHead>
              <TableHead className="w-24 text-center">Ativo</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum template cadastrado
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.description || '-'}</TableCell>
                  <TableCell className="text-center">
                    {t.is_default && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3 fill-current" /> Padrão
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={t.is_active ? 'default' : 'outline'}>
                      {t.is_active ? 'Sim' : 'Não'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover o template "${t.name}"?`)) remove.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar template' : 'Novo template'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Confirmação padrão"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Quando usar este template"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem *</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={8}
                placeholder="✅ Pedido confirmado!&#10;Olá {{cliente}}, seu pedido de {{quantidade}}x {{produto}} foi recebido."
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Variáveis disponíveis (clique para inserir)</Label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVar(v.key)}
                    className="text-xs px-2 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted transition-colors"
                    title={`${v.label} (ex: ${v.example})`}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            {form.body && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
                <div className="rounded-lg border border-border bg-green-500/5 p-3 whitespace-pre-wrap text-sm">
                  {preview}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                />
                <Label className="cursor-pointer">Definir como padrão</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label className="cursor-pointer">Ativo</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
