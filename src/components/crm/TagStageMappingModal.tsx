import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Tag as TagIcon, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface TagMapping {
  id: string;
  tag_name: string;
  stage_id: string;
  source: 'customer' | 'lead' | 'both';
  is_active: boolean;
  stage?: Stage;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: Stage[];
}

export function TagStageMappingModal({ open, onOpenChange, stages }: Props) {
  const qc = useQueryClient();
  const [tagName, setTagName] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [source, setSource] = useState<'customer' | 'lead' | 'both'>('both');

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['crm-tag-stage-mappings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_tag_stage_mapping')
        .select('*')
        .order('tag_name');
      if (error) throw error;
      return data as TagMapping[];
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!tagName.trim() || !stageId) {
        throw new Error('Preencha a tag e o funil destino');
      }
      const { error } = await (supabase as any)
        .from('crm_tag_stage_mapping')
        .insert({ tag_name: tagName.trim(), stage_id: stageId, source });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mapeamento criado');
      setTagName('');
      setStageId('');
      setSource('both');
      qc.invalidateQueries({ queryKey: ['crm-tag-stage-mappings'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao criar'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('crm_tag_stage_mapping')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Mapeamento removido');
      qc.invalidateQueries({ queryKey: ['crm-tag-stage-mappings'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao remover'),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any)
        .from('crm_tag_stage_mapping')
        .update({ is_active: active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-tag-stage-mappings'] }),
  });

  const stageById = (id: string) => stages.find((s) => s.id === id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-primary" />
            Mapear Tag → Funil
          </DialogTitle>
          <DialogDescription>
            Quando uma tag for aplicada (no cliente ou no lead), o lead será movido automaticamente
            para o funil/etapa configurado abaixo.
          </DialogDescription>
        </DialogHeader>

        {/* New mapping form */}
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <h3 className="text-sm font-semibold">Novo mapeamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="tag-name">Nome da tag</Label>
              <Input
                id="tag-name"
                placeholder='Ex: "agua mineral 2d"'
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Funil / etapa</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={source} onValueChange={(v) => setSource(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Cliente + Lead</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !tagName.trim() || !stageId}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar mapeamento
          </Button>
        </div>

        {/* Existing mappings */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Mapeamentos ativos</h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum mapeamento configurado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {mappings.map((m) => {
                const stage = stageById(m.stage_id);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-card"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="secondary" className="gap-1">
                        <TagIcon className="h-3 w-3" />
                        {m.tag_name}
                      </Badge>
                      <span className="text-muted-foreground text-sm">→</span>
                      {stage ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          {stage.name}
                        </span>
                      ) : (
                        <span className="text-sm text-destructive">Etapa removida</span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {m.source === 'both'
                          ? 'Cliente + Lead'
                          : m.source === 'customer'
                          ? 'Cliente'
                          : 'Lead'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={m.is_active}
                        onCheckedChange={(v) => toggle.mutate({ id: m.id, active: v })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove.mutate(m.id)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}