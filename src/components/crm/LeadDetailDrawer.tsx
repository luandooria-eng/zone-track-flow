import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Phone,
  Mail,
  MapPin,
  Package,
  DollarSign,
  MessageCircle,
  StickyNote,
  Zap,
  ArrowRight,
  Clock,
  User,
  Send,
  Loader2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { CRMLead, CRMStage, CRMActivity } from '@/hooks/useCRMFunnel';
import {
  useCRMActivities,
  useAddActivity,
  useMoveLead,
  useUpdateLead,
} from '@/hooks/useCRMFunnel';

const activityIcons: Record<string, React.ReactNode> = {
  note: <StickyNote className="h-3.5 w-3.5 text-blue-500" />,
  whatsapp_sent: <MessageCircle className="h-3.5 w-3.5 text-green-500" />,
  stage_change: <ArrowRight className="h-3.5 w-3.5 text-purple-500" />,
  call: <Phone className="h-3.5 w-3.5 text-orange-500" />,
  trigger_fired: <Zap className="h-3.5 w-3.5 text-yellow-500" />,
};

const activityLabels: Record<string, string> = {
  note: 'Nota',
  whatsapp_sent: 'WhatsApp enviado',
  stage_change: 'Mudança de estágio',
  call: 'Ligação',
  trigger_fired: 'Gatilho automático',
};

interface LeadDetailDrawerProps {
  lead: CRMLead | null;
  stages: CRMStage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailDrawer({ lead, stages, open, onOpenChange }: LeadDetailDrawerProps) {
  const [noteText, setNoteText] = useState('');
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [waMessage, setWAMessage] = useState('');

  const { data: activities = [], isLoading: activitiesLoading } = useCRMActivities(lead?.id ?? null);
  const addActivity = useAddActivity();
  const moveLead = useMoveLead();
  const updateLead = useUpdateLead();

  if (!lead) return null;

  const currentStageIdx = stages.findIndex((s) => s.id === lead.stage_id);
  const currentStage = stages[currentStageIdx];

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addActivity.mutateAsync({ leadId: lead.id, type: 'note', content: noteText.trim() });
    setNoteText('');
    toast.success('Nota adicionada!');
  };

  const handleSendWhatsApp = async () => {
    if (!waMessage.trim() || !lead.phone) return;
    setIsSendingWA(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone: lead.phone, message: waMessage }),
        },
      );
      if (!res.ok) throw new Error('Falha ao enviar');
      await addActivity.mutateAsync({
        leadId: lead.id,
        type: 'whatsapp_sent',
        content: waMessage,
        metadata: { phone: lead.phone },
      });
      setWAMessage('');
      toast.success('Mensagem WhatsApp enviada!');
    } catch {
      toast.error('Erro ao enviar mensagem WhatsApp');
    } finally {
      setIsSendingWA(false);
    }
  };

  const handleStageChange = (stageId: string) => {
    moveLead.mutate({ leadId: lead.id, stageId });
    toast.success('Lead movido!');
  };

  const handleLostReason = (reason: string) => {
    updateLead.mutate({ id: lead.id, lost_reason: reason });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col" side="right">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg">{lead.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                {currentStage && (
                  <Badge
                    className="text-white text-xs"
                    style={{ backgroundColor: currentStage.color }}
                  >
                    {currentStage.name}
                  </Badge>
                )}
                {lead.source && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {lead.source}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Contact Info */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contato
              </h4>
              <div className="space-y-1.5">
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>
                  </div>
                )}
                {lead.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.address}</span>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Deal Info */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Negócio
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {lead.estimated_value !== null && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-xs text-muted-foreground">Valor estimado</span>
                    </div>
                    <p className="font-bold text-green-700">
                      R$ {lead.estimated_value.toFixed(2)}
                    </p>
                  </div>
                )}
                {lead.product_interest && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Interesse</span>
                    </div>
                    <p className="font-semibold text-sm">{lead.product_interest}</p>
                  </div>
                )}
              </div>

              {lead.notes && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                  {lead.notes}
                </div>
              )}
            </section>

            <Separator />

            {/* Stage Progression */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mover para estágio
              </h4>
              <div className="flex flex-wrap gap-2">
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    onClick={() => handleStageChange(stage.id)}
                    disabled={stage.id === lead.stage_id || moveLead.isPending}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      stage.id === lead.stage_id
                        ? 'text-white border-transparent'
                        : 'bg-transparent text-muted-foreground hover:text-foreground border-border hover:border-foreground/30',
                    )}
                    style={stage.id === lead.stage_id ? { backgroundColor: stage.color, borderColor: stage.color } : {}}
                  >
                    {stage.name}
                  </button>
                ))}
              </div>
            </section>

            <Separator />

            {/* Send WhatsApp */}
            {lead.phone && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                  Enviar WhatsApp
                </h4>
                <Textarea
                  placeholder="Digite a mensagem..."
                  value={waMessage}
                  onChange={(e) => setWAMessage(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleSendWhatsApp}
                  disabled={!waMessage.trim() || isSendingWA}
                >
                  {isSendingWA ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar mensagem
                </Button>
              </section>
            )}

            {/* Add Note */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 text-blue-500" />
                Adicionar nota
              </h4>
              <Textarea
                placeholder="Escreva uma observação sobre este lead..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleAddNote}
                disabled={!noteText.trim() || addActivity.isPending}
              >
                Salvar nota
              </Button>
            </section>

            <Separator />

            {/* Activity Timeline */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Histórico de atividades
              </h4>

              {activitiesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma atividade ainda
                </p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </section>

            {/* Created At */}
            <div className="text-xs text-muted-foreground text-center pb-4">
              Lead criado{' '}
              {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ActivityItem({ activity }: { activity: CRMActivity }) {
  const icon = activityIcons[activity.type] ?? <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  const label = activityLabels[activity.type] ?? activity.type;

  return (
    <div className="flex gap-2.5">
      <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted border">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(activity.created_at), 'dd/MM HH:mm')}
          </span>
        </div>
        {activity.content && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{activity.content}</p>
        )}
      </div>
    </div>
  );
}
