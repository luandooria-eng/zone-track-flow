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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Pencil, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';

type QR = {
  id: string;
  shortcut: string;
  title: string;
  body: string;
  is_active: boolean;
  sort_order: number;
};

const EMPTY = { shortcut: '', title: '', body: '', is_active: true };

export function QuickRepliesSettings() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QR | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['whatsapp-quick-replies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_quick_replies' as any)
        .select('*')
        .order('sort_order')
        .order('shortcut');
      if (error) throw error;
      return (data ?? []) as unknown as QR[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<QR> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from('whatsapp_quick_replies' as any).update(payload).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('whatsapp_quick_replies' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-quick-replies'] });
      setOpen(false); setEditing(null); setForm(EMPTY);
      toast.success('Atalho salvo');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_quick_replies' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-quick-replies'] });
      toast.success('Atalho removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(t: QR) {
    setEditing(t);
    setForm({ shortcut: t.shortcut, title: t.title, body: t.body, is_active: t.is_active });
    setOpen(true);
  }

  function normalizeShortcut(s: string) {
    let v = s.trim().toLowerCase().replace(/\s+/g, '');
    if (!v) return '';
    if (!v.startsWith('/')) v = '/' + v;
    return v.replace(/[^a-z0-9/_-]/g, '');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const shortcut = normalizeShortcut(form.shortcut);
    if (!shortcut || shortcut === '/') return toast.error('Atalho inválido');
    if (!form.title.trim() || !form.body.trim()) return toast.error('Título e mensagem são obrigatórios');
    upsert.mutate({
      ...(editing ? { id: editing.id } : {}),
      shortcut,
      title: form.title.trim(),
      body: form.body,
      is_active: form.is_active,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Atalhos de mensagens rápidas
          </h3>
          <p className="text-sm text-muted-foreground">
            Crie gatilhos manuais (ex.: <code className="text-xs">/obrigado</code>) que expandem automaticamente para uma mensagem completa no chat do WhatsApp.
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo atalho
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-32">Atalho</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead className="w-20 text-center">Ativo</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum atalho cadastrado</TableCell></TableRow>
            ) : items.map((t) => (
              <TableRow key={t.id}>
                <TableCell><code className="text-xs px-2 py-1 rounded-md bg-muted font-mono">{t.shortcut}</code></TableCell>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate">{t.body}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={t.is_active ? 'default' : 'outline'}>{t.is_active ? 'Sim' : 'Não'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remover o atalho "${t.shortcut}"?`)) remove.mutate(t.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar atalho' : 'Novo atalho'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Atalho *</Label>
                <Input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} placeholder="/obrigado" className="font-mono" />
                <p className="text-[11px] text-muted-foreground">Comece com "/". Ex: /obrigado, /pix</p>
              </div>
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Agradecimento" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem *</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} placeholder="Obrigado pelo contato! 🙏" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
