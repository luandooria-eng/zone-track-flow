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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  MessageCircle,
  ArrowRight,
  Tag,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  LogIn,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMStage, CRMTrigger } from '@/hooks/useCRMFunnel';
import { useCRMTriggers, useUpsertTrigger, useToggleTrigger, useDeleteTrigger } from '@/hooks/useCRMFunnel';

// ─── Types & Helpers ──────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  on_enter: {
    label: 'Ao entrar na etapa',
    icon: <LogIn className="h-4 w-4 text-purple-500" />,
    desc: 'Dispara imediatamente quando o lead chega nesta etapa',
  },
  on_message_received: {
    label: 'Ao receber mensagem',
    icon: <MessageCircle className="h-4 w-4 text-green-500" />,
    desc: 'Dispara quando o lead enviar qualquer mensagem estando nesta etapa',
  },
  time_in_stage: {
    label: 'Após tempo na etapa',
    icon: <Clock className="h-4 w-4 text-orange-500" />,
    desc: 'Dispara depois que o lead está há X horas/dias parado nesta etapa',
  },
  daily_at_time: {
    label: 'Hora fixa diária',
    icon: <Clock className="h-4 w-4 text-blue-500" />,
    desc: 'Dispara todos os dias em um horário fixo para todos os leads nesta etapa',
  },
};

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  whatsapp_message: { label: 'Enviar mensagem WhatsApp', icon: <MessageCircle className="h-4 w-4 text-green-500" /> },
  move_stage: { label: 'Mover para outra etapa', icon: <ArrowRight className="h-4 w-4 text-blue-500" /> },
  add_tag: { label: 'Adicionar tag ao lead', icon: <Tag className="h-4 w-4 text-yellow-500" /> },
};

function delayLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor((minutes ?? 0) / 60).toString().padStart(2, '0');
  const m = ((minutes ?? 0) % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TriggerConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CRMStage[];
}

export function TriggerConfigModal({ open, onOpenChange, stages }: TriggerConfigModalProps) {
  const { data: triggers = [], isLoading } = useCRMTriggers();
  const upsertTrigger = useUpsertTrigger();
  const toggleTrigger = useToggleTrigger();
  const deleteTrigger = useDeleteTrigger();

  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ stageId: string; trigger: Partial<CRMTrigger> } | null>(null);

  const triggersByStage = (stageId: string) =>
    triggers.filter((t) => t.stage_id === stageId);

  const startNew = (stageId: string) => {
    setEditing({
      stageId,
      trigger: {
        stage_id: stageId,
        trigger_condition: 'on_enter',
        action_type: 'whatsapp_message',
        name: '',
        message_template: '',
        delay_minutes: 0,
        is_active: true,
        tags: [],
        filter_tags: [],
        target_stage_id: null,
      },
    });
    setExpandedStage(stageId);
  };

  const startEdit = (t: CRMTrigger) => {
    setEditing({ stageId: t.stage_id, trigger: { ...t } });
    setExpandedStage(t.stage_id);
  };

  const handleSave = async () => {
    if (!editing?.trigger?.name?.trim()) return;
    await upsertTrigger.mutateAsync(editing.trigger as Partial<CRMTrigger> & { stage_id: string });
    setEditing(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Gatilhos de Automação do Funil
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure ações automáticas quando um lead entra em cada etapa ou fica parado por um determinado tempo.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {stages.map((stage) => {
                const st = triggersByStage(stage.id);
                const isExpanded = expandedStage === stage.id;
                const activeCount = st.filter((t) => t.is_active).length;

                return (
                  <div key={stage.id} className="border rounded-xl overflow-hidden">
                    {/* Stage header */}
                    <button
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left"
                      onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                    >
                      <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="font-semibold text-sm flex-1">{stage.name}</span>
                      <div className="flex items-center gap-2">
                        {st.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {st.length} gatilho{st.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {activeCount > 0 && (
                          <Badge className="text-xs bg-green-500/10 text-green-700 border-green-500/20">
                            <Zap className="h-2.5 w-2.5 mr-0.5" />
                            {activeCount} ativo{activeCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-3 space-y-2">
                        {/* Existing triggers */}
                        {st.map((trigger) => (
                          <TriggerRow
                            key={trigger.id}
                            trigger={trigger}
                            stages={stages}
                            onEdit={() => startEdit(trigger)}
                            onToggle={(v) => toggleTrigger.mutate({ id: trigger.id, is_active: v })}
                            onDelete={() => deleteTrigger.mutate(trigger.id)}
                          />
                        ))}

                        {/* Inline editor */}
                        {editing?.stageId === stage.id && (
                          <TriggerEditor
                            trigger={editing.trigger}
                            stages={stages}
                            onChange={(t) => setEditing({ stageId: stage.id, trigger: t })}
                            onSave={handleSave}
                            onCancel={() => setEditing(null)}
                            isSaving={upsertTrigger.isPending}
                          />
                        )}

                        {editing?.stageId !== stage.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-dashed"
                            onClick={() => startNew(stage.id)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Adicionar gatilho
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t text-xs text-muted-foreground">
          Variáveis disponíveis nas mensagens:{' '}
          <code className="bg-muted px-1 rounded">{'{{name}}'}</code> — nome do lead
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── TriggerRow ───────────────────────────────────────────────────────────────

function TriggerRow({
  trigger, stages, onEdit, onToggle, onDelete,
}: {
  trigger: CRMTrigger;
  stages: CRMStage[];
  onEdit: () => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const condition = CONDITION_LABELS[trigger.trigger_condition ?? 'on_enter'];
  const action = ACTION_LABELS[trigger.action_type ?? 'whatsapp_message'];
  const targetStage = trigger.target_stage_id
    ? stages.find((s) => s.id === trigger.target_stage_id)
    : null;

  return (
    <div className={cn('border rounded-lg p-3 bg-background', !trigger.is_active && 'opacity-60')}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Name */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-medium text-sm">{trigger.name}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 gap-0.5">
              {condition?.icon}
              {condition?.label}
            </Badge>
            {trigger.trigger_condition === 'time_in_stage' && trigger.delay_minutes > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                {delayLabel(trigger.delay_minutes)}
              </Badge>
            )}
            {trigger.trigger_condition === 'daily_at_time' && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-blue-500/10 text-blue-700 border-blue-500/20">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                {minutesToTime(trigger.delay_minutes)} diário
              </Badge>
            )}
          </div>

          {/* Action preview */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {action?.icon}
            <span className="font-medium">{action?.label}</span>
            {trigger.action_type === 'move_stage' && targetStage && (
              <span>→ <span className="font-semibold" style={{ color: targetStage.color }}>{targetStage.name}</span></span>
            )}
            {trigger.action_type === 'move_stage' && trigger.filter_tags?.length > 0 && (
              <span className="ml-1 inline-flex items-center gap-1">
                <Tag className="h-2.5 w-2.5 text-yellow-500" />
                <span className="text-[10px]">só com: {trigger.filter_tags.join(', ')}</span>
              </span>
            )}
            {trigger.action_type === 'add_tag' && trigger.tags?.length > 0 && (
              <span>: {trigger.tags.join(', ')}</span>
            )}
            {trigger.action_type === 'whatsapp_message' && trigger.message_template && (
              <span className="truncate max-w-[200px]">
                "{trigger.message_template.slice(0, 60)}{trigger.message_template.length > 60 ? '...' : ''}"
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEdit}>
            Editar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive/60 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Switch checked={trigger.is_active} onCheckedChange={onToggle} className="scale-75" />
        </div>
      </div>
    </div>
  );
}

// ─── TriggerEditor ────────────────────────────────────────────────────────────

function TriggerEditor({
  trigger, stages, onChange, onSave, onCancel, isSaving,
}: {
  trigger: Partial<CRMTrigger>;
  stages: CRMStage[];
  onChange: (t: Partial<CRMTrigger>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const set = (key: keyof CRMTrigger, value: unknown) => onChange({ ...trigger, [key]: value });

  const condition = trigger.trigger_condition ?? 'on_enter';
  const actionType = trigger.action_type ?? 'whatsapp_message';

  const [tagsInput, setTagsInput] = useState((trigger.tags ?? []).join(', '));
  const [filterTagsInput, setFilterTagsInput] = useState((trigger.filter_tags ?? []).join(', '));

  const handleTagsChange = (v: string) => {
    setTagsInput(v);
    const parsed = v.split(',').map((t) => t.trim()).filter(Boolean);
    set('tags', parsed);
  };

  const handleFilterTagsChange = (v: string) => {
    setFilterTagsInput(v);
    const parsed = v.split(',').map((t) => t.trim()).filter(Boolean);
    set('filter_tags', parsed);
  };

  const canSave = trigger.name?.trim() &&
    (actionType !== 'whatsapp_message' || trigger.message_template?.trim()) &&
    (actionType !== 'move_stage' || trigger.target_stage_id) &&
    (actionType !== 'add_tag' || (trigger.tags && trigger.tags.length > 0));

  return (
    <div className="border-2 border-primary/20 rounded-xl p-4 bg-background space-y-4">
      <div className="text-sm font-semibold text-primary">
        {trigger.id ? 'Editar gatilho' : 'Novo gatilho'}
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">Nome do gatilho *</Label>
        <Input
          value={trigger.name ?? ''}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Ex: Lembrete após 2 dias sem resposta"
          autoFocus
          className="text-sm"
        />
      </div>

      {/* Condition */}
      <div className="space-y-1.5">
        <Label className="text-xs">Quando disparar?</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(CONDITION_LABELS).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => {
                set('trigger_condition', key);
                if (key === 'on_enter') set('delay_minutes', 0);
              }}
              className={cn(
                'flex items-start gap-2 p-3 rounded-lg border text-left transition-all',
                condition === key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-foreground/20',
              )}
            >
              {meta.icon}
              <div>
                <p className="text-xs font-medium">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{meta.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Time picker (only for daily_at_time) */}
      {condition === 'daily_at_time' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Em qual horário? (horário de Brasília)</Label>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={minutesToTime(trigger.delay_minutes ?? 540)}
              onChange={(e) => set('delay_minutes', timeToMinutes(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">
              Todos os leads nesta etapa receberão a mensagem neste horário todos os dias
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { label: '08:00', value: 480 },
              { label: '09:00', value: 540 },
              { label: '10:00', value: 600 },
              { label: '12:00', value: 720 },
              { label: '14:00', value: 840 },
              { label: '18:00', value: 1080 },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => set('delay_minutes', value)}
                className={cn(
                  'py-1 px-3 rounded-lg border text-xs font-medium transition-all',
                  trigger.delay_minutes === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-foreground/20',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Delay (only for time_in_stage) */}
      {condition === 'time_in_stage' && (
        <div className="space-y-1.5">
          <Label className="text-xs">Após quanto tempo?</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '30 min', value: 30 },
              { label: '1 hora', value: 60 },
              { label: '2 horas', value: 120 },
              { label: '4 horas', value: 240 },
              { label: '1 dia', value: 1440 },
              { label: '2 dias', value: 2880 },
              { label: '3 dias', value: 4320 },
              { label: '5 dias', value: 7200 },
              { label: '7 dias', value: 10080 },
            ].map(({ label, value }) => (
              <button
                key={value}
                onClick={() => set('delay_minutes', value)}
                className={cn(
                  'py-1.5 px-2 rounded-lg border text-xs font-medium transition-all',
                  trigger.delay_minutes === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-foreground/20',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={trigger.delay_minutes ?? 0}
              onChange={(e) => set('delay_minutes', Number(e.target.value))}
              className="w-24 text-sm"
            />
            <span className="text-xs text-muted-foreground">minutos (personalizado)</span>
          </div>
        </div>
      )}

      <Separator />

      {/* Action type */}
      <div className="space-y-1.5">
        <Label className="text-xs">O que fazer?</Label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACTION_LABELS).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => set('action_type', key)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-center transition-all',
                actionType === key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-foreground/20',
              )}
            >
              {meta.icon}
              <span className="text-[10px] font-medium leading-tight">{meta.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action details */}
      {actionType === 'whatsapp_message' && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <MessageCircle className="h-3.5 w-3.5 text-green-500" />
            Mensagem *
          </Label>
          <Textarea
            value={trigger.message_template ?? ''}
            onChange={(e) => set('message_template', e.target.value)}
            placeholder={`Olá {{name}}! 👋 Estamos aqui para ajudar...`}
            rows={5}
            className="text-sm resize-none"
          />
        </div>
      )}

      {actionType === 'move_stage' && (
        <>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
            Mover para qual etapa? *
          </Label>
          <Select
            value={trigger.target_stage_id ?? ''}
            onValueChange={(v) => set('target_stage_id', v)}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="Selecione a etapa destino..." />
            </SelectTrigger>
            <SelectContent>
              {stages
                .filter((s) => s.id !== trigger.stage_id)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-yellow-500" />
            Mover apenas leads com estas tags (opcional)
          </Label>
          <Input
            value={filterTagsInput}
            onChange={(e) => handleFilterTagsChange(e.target.value)}
            placeholder="Ex: agua mineral 2d, gás 13kg"
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Separe por vírgula. Se vazio, move todos os leads da etapa. Se preenchido, move
            apenas leads que possuem pelo menos uma destas tags (no lead ou no cliente).
          </p>
        </div>
        </>
      )}

      {actionType === 'add_tag' && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-yellow-500" />
            Tags (separadas por vírgula) *
          </Label>
          <Input
            value={tagsInput}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="água, recorrente, vip"
            className="text-sm"
          />
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={onSave} disabled={isSaving || !canSave}>
          {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Salvar gatilho
        </Button>
      </div>
    </div>
  );
}
