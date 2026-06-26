import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Tag as TagIcon, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface CustomerTag {
  id: string;
  name: string;
  color: string;
  is_active: boolean | null;
}

const PRESET_COLORS = [
  '#8B5CF6', '#22C55E', '#EF4444', '#3B82F6', '#F59E0B',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

export function CustomerTagsSettings() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['customer-tags-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as CustomerTag[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['customer-tags-all'] });
    qc.invalidateQueries({ queryKey: ['customer-tags'] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error('Informe o nome da tag');
      const { error } = await supabase
        .from('customer_tags')
        .insert({ name, color: newColor });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tag criada');
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao criar tag'),
  });

  const update = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from('customer_tags')
        .update({ name: name.trim(), color })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tag atualizada');
      setEditingId(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao atualizar'),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('customer_tags')
        .update({ is_active: active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? 'Erro ao alterar status'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Remove assignments first (no cascade configured)
      await supabase.from('customer_tag_assignments').delete().eq('tag_id', id);
      const { error } = await supabase.from('customer_tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tag removida');
      qc.invalidateQueries({ queryKey: ['all-customer-tag-assignments'] });
      qc.invalidateQueries({ queryKey: ['customer-tag-assignments'] });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao remover'),
  });

  function startEdit(t: CustomerTag) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
  }

  return (
    <div className="space-y-6">
      {/* Create new */}
      <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-primary" />
          Nova tag
        </h3>
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium">Nome</label>
            <Input
              placeholder='Ex: "VIP", "Atacado", "Inadimplente"'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Cor</label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !newName.trim()}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Tags cadastradas</h3>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhuma tag cadastrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {tags.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-card"
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-3 flex-wrap">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="max-w-xs h-9"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`h-6 w-6 rounded-full border-2 ${
                              editColor === c ? 'border-foreground scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge
                        className="gap-1.5 text-white border-0"
                        style={{ backgroundColor: t.color }}
                      >
                        <TagIcon className="h-3 w-3" />
                        {t.name}
                      </Badge>
                      {!t.is_active && (
                        <span className="text-xs text-muted-foreground">(inativa)</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            update.mutate({ id: t.id, name: editName, color: editColor })
                          }
                          disabled={update.isPending || !editName.trim()}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Switch
                          checked={!!t.is_active}
                          onCheckedChange={(v) => toggle.mutate({ id: t.id, active: v })}
                        />
                        <Button size="icon" variant="ghost" onClick={() => startEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Remover a tag "${t.name}"? Ela será desvinculada de todos os clientes.`)) {
                              remove.mutate(t.id);
                            }
                          }}
                          disabled={remove.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
