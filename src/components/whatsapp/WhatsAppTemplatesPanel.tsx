import { useState } from 'react';
import { FileText, Plus, Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useWhatsAppTemplates,
  useSaveWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
} from '@/hooks/useWhatsAppTemplates';

const emptyForm = {
  name: '',
  language: 'pt_BR',
  category: 'UTILITY' as WhatsAppTemplateCategory,
  body_preview: '',
  variablesText: '',
  is_active: true,
};

function TemplateFormDialog({ template, onDone }: { template?: WhatsAppTemplate; onDone: () => void }) {
  const save = useSaveWhatsAppTemplate();
  const [form, setForm] = useState(
    template
      ? {
          name: template.name,
          language: template.language,
          category: template.category,
          body_preview: template.body_preview,
          variablesText: (template.variables || []).join(', '),
          is_active: template.is_active,
        }
      : emptyForm,
  );

  function handleSave() {
    if (!form.name.trim() || !form.body_preview.trim()) return;
    save.mutate(
      {
        id: template?.id,
        name: form.name.trim(),
        language: form.language.trim() || 'pt_BR',
        category: form.category,
        body_preview: form.body_preview,
        variables: form.variablesText.split(',').map((v) => v.trim()).filter(Boolean),
        is_active: form.is_active,
      },
      { onSuccess: onDone },
    );
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{template ? 'Editar Template' : 'Novo Template Meta'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <p className="text-xs text-muted-foreground">
          O nome e o idioma devem ser <strong>exatamente iguais</strong> ao template já aprovado no Meta Business Manager.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nome do template</Label>
            <Input placeholder="Ex: lembrete_recompra" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Input placeholder="pt_BR" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as WhatsAppTemplateCategory }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UTILITY">Utilidade</SelectItem>
              <SelectItem value="MARKETING">Marketing</SelectItem>
              <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Texto do corpo (referência)</Label>
          <p className="text-xs text-muted-foreground">Use {'{{1}}'}, {'{{2}}'}... para as variáveis, na mesma ordem aprovada no Meta.</p>
          <Textarea
            rows={4}
            placeholder="Olá {{1}}! Notamos que seu produto deve estar acabando..."
            value={form.body_preview}
            onChange={(e) => setForm((f) => ({ ...f, body_preview: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Variáveis (rótulos, separados por vírgula)</Label>
          <Input
            placeholder="primeiro_nome, produto"
            value={form.variablesText}
            onChange={(e) => setForm((f) => ({ ...f, variablesText: e.target.value }))}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Ativo</p>
            <p className="text-xs text-muted-foreground">Templates inativos não aparecem nos seletores de fluxo.</p>
          </div>
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
        </div>
        <Button className="w-full" onClick={handleSave} disabled={save.isPending}>
          Salvar Template
        </Button>
      </div>
    </DialogContent>
  );
}

export function WhatsAppTemplatesPanel() {
  const { data: templates = [], isLoading } = useWhatsAppTemplates();
  const del = useDeleteWhatsAppTemplate();
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">Templates Meta (WhatsApp oficial)</h3>
          <p className="text-xs text-muted-foreground">
            Cadastre aqui os templates já aprovados no Meta Business Manager para usar em disparos automáticos
            (fora da janela de 24h de atendimento).
          </p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 shrink-0">
              <Plus className="h-4 w-4" />
              Novo Template
            </Button>
          </DialogTrigger>
          <TemplateFormDialog onDone={() => setOpenNew(false)} />
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : templates.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Nenhum template cadastrado ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge variant="outline" className="text-xs">{t.language}</Badge>
                  <Badge variant="outline" className="text-xs">{t.category}</Badge>
                  {!t.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{t.body_preview}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Dialog open={editing?.id === t.id} onOpenChange={(o) => setEditing(o ? t : null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <TemplateFormDialog template={t} onDone={() => setEditing(null)} />
                </Dialog>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => del.mutate(t.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
