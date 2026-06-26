import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  GripVertical,
  Trash2,
  Check,
  X,
  Pencil,
  ArrowDown,
  Star,
  LogIn,
  Loader2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMStage } from '@/hooks/useCRMFunnel';
import {
  useCreateStage,
  useUpdateStage,
  useDeleteStage,
  useReorderStages,
} from '@/hooks/useCRMFunnel';

const PRESET_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316',
  '#10b981', '#ef4444', '#06b6d4', '#ec4899',
  '#84cc16', '#6366f1',
];

interface FunnelFlowEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CRMStage[];
}

export function FunnelFlowEditor({ open, onOpenChange, stages }: FunnelFlowEditorProps) {
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const reorderStages = useReorderStages();

  const [editing, setEditing] = useState<string | null>(null); // stage id being edited
  const [editForm, setEditForm] = useState<Partial<CRMStage>>({});
  const [newForm, setNewForm] = useState({ name: '', color: '#6366f1', description: '' });
  const [showNew, setShowNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sorted = [...stages].sort((a, b) => a.order_index - b.order_index);

  const startEdit = (stage: CRMStage) => {
    setEditing(stage.id);
    setEditForm({ ...stage });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editing || !editForm.name?.trim()) return;
    await updateStage.mutateAsync({ id: editing, ...editForm });
    cancelEdit();
  };

  const handleCreate = async () => {
    if (!newForm.name.trim()) return;
    const maxOrder = sorted.length > 0 ? Math.max(...sorted.map((s) => s.order_index)) : 0;
    await createStage.mutateAsync({
      name: newForm.name.trim(),
      color: newForm.color,
      description: newForm.description.trim() || null,
      order_index: maxOrder + 1,
      is_won: false,
      is_lost: false,
      is_entry: false,
    });
    setNewForm({ name: '', color: '#6366f1', description: '' });
    setShowNew(false);
  };

  const handleMoveUp = (stage: CRMStage) => {
    const idx = sorted.findIndex((s) => s.id === stage.id);
    if (idx <= 0) return;
    const prev = sorted[idx - 1];
    reorderStages.mutate([
      { id: stage.id, order_index: prev.order_index },
      { id: prev.id, order_index: stage.order_index },
    ]);
  };

  const handleMoveDown = (stage: CRMStage) => {
    const idx = sorted.findIndex((s) => s.id === stage.id);
    if (idx >= sorted.length - 1) return;
    const next = sorted[idx + 1];
    reorderStages.mutate([
      { id: stage.id, order_index: next.order_index },
      { id: next.id, order_index: stage.order_index },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDown className="h-5 w-5 text-primary" />
            Editor do Funil de Vendas
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure as etapas do funil, ordem, cores e comportamento.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-2 py-2">
            {sorted.map((stage, idx) => (
              <div key={stage.id}>
                {/* Arrow between stages */}
                {idx > 0 && (
                  <div className="flex justify-center my-1">
                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </div>
                )}

                {editing === stage.id ? (
                  /* Edit form inline */
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={editForm.name ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Descrição</Label>
                        <Input
                          value={editForm.description ?? ''}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          className="text-sm"
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    {/* Color picker */}
                    <div className="space-y-1">
                      <Label className="text-xs">Cor</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditForm((f) => ({ ...f, color: c }))}
                            className={cn(
                              'h-6 w-6 rounded-full border-2 transition-transform',
                              editForm.color === c ? 'border-foreground scale-110' : 'border-transparent',
                            )}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`entry-${stage.id}`}
                          checked={editForm.is_entry ?? false}
                          onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_entry: v }))}
                        />
                        <Label htmlFor={`entry-${stage.id}`} className="text-xs flex items-center gap-1">
                          <LogIn className="h-3 w-3" />
                          Entrada automática
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`won-${stage.id}`}
                          checked={editForm.is_won ?? false}
                          onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_won: v, is_lost: v ? false : f.is_lost }))}
                        />
                        <Label htmlFor={`won-${stage.id}`} className="text-xs flex items-center gap-1">
                          <Star className="h-3 w-3 text-green-500" />
                          Ganho
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`lost-${stage.id}`}
                          checked={editForm.is_lost ?? false}
                          onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_lost: v, is_won: v ? false : f.is_won }))}
                        />
                        <Label htmlFor={`lost-${stage.id}`} className="text-xs flex items-center gap-1">
                          <X className="h-3 w-3 text-red-500" />
                          Perdido
                        </Label>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                      <Button size="sm" onClick={saveEdit} disabled={updateStage.isPending}>
                        {updateStage.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Stage row */
                  <div className="border rounded-lg p-3 flex items-center gap-3 bg-background hover:bg-muted/20 transition-colors group">
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMoveUp(stage)}
                        disabled={idx === 0}
                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-20"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(stage)}
                        disabled={idx === sorted.length - 1}
                        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-20"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Color dot */}
                    <div
                      className="h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />

                    {/* Name & description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm">{stage.name}</span>
                        {stage.is_entry && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-blue-500/10 text-blue-700 border-blue-500/20">
                            <LogIn className="h-2.5 w-2.5 mr-0.5" />
                            entrada
                          </Badge>
                        )}
                        {stage.is_won && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-700 border-green-500/20">
                            ganho
                          </Badge>
                        )}
                        {stage.is_lost && (
                          <Badge className="text-[10px] h-4 px-1.5 bg-red-500/10 text-red-700 border-red-500/20">
                            perdido
                          </Badge>
                        )}
                      </div>
                      {stage.description && (
                        <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startEdit(stage)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(stage.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add new stage */}
            {showNew ? (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/30 border-dashed mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da nova etapa *</Label>
                    <Input
                      value={newForm.name}
                      onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Aguardando Pagamento"
                      className="text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={newForm.description}
                      onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Opcional"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cor</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewForm((f) => ({ ...f, color: c }))}
                        className={cn(
                          'h-6 w-6 rounded-full border-2 transition-transform',
                          newForm.color === c ? 'border-foreground scale-110' : 'border-transparent',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleCreate} disabled={createStage.isPending || !newForm.name.trim()}>
                    {createStage.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    Adicionar Etapa
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-2 border-dashed"
                onClick={() => setShowNew(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova etapa
              </Button>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
              <AlertDialogDescription>
                Todos os leads desta etapa serão movidos para a primeira etapa. Os gatilhos da etapa também serão removidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={() => {
                  if (deleteConfirm) deleteStage.mutate(deleteConfirm);
                  setDeleteConfirm(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
