import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Search, Check, CheckCheck, User, Phone,
  Send, CheckCircle2, RotateCcw, Wifi, WifiOff, FileText,
  Download, X, Play, Bell, BellOff, ShoppingCart, Kanban, ChevronDown, Loader2,
  Tag as TagIcon, Plus, PhoneIncoming, Video as VideoIcon,
} from 'lucide-react';
import {
  useCustomerTags,
  useCustomerTagAssignments,
  useAddCustomerTag,
  useRemoveCustomerTag,
  useCreateTag,
} from '@/hooks/useCustomerTags';
import { QuickSalePanel } from '@/components/whatsapp/QuickSalePanel';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useWhatsAppConversations, useWhatsAppMessages, useSendWhatsAppMessage,
  useMarkConversationRead, useSetConversationStatus, useWhatsAppConfig,
  type WhatsAppConversation, type WhatsAppMessage,
} from '@/hooks/useWhatsApp';
import {
  useWhatsAppNotificationSound,
  isWhatsAppSoundMuted,
  setWhatsAppSoundMuted,
  primeWhatsAppSound,
} from '@/hooks/useWhatsAppNotificationSound';
import { useCRMStages, useCreateLead, useMoveLead, type CRMStage } from '@/hooks/useCRMFunnel';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type QuickReply = { id: string; shortcut: string; title: string; body: string };

function useQuickReplies() {
  return useQuery({
    queryKey: ['whatsapp-quick-replies-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_quick_replies' as any)
        .select('id, shortcut, title, body')
        .eq('is_active', true)
        .order('sort_order')
        .order('shortcut');
      if (error) throw error;
      return (data ?? []) as unknown as QuickReply[];
    },
    staleTime: 60_000,
  });
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return phone;
}

function parseWhatsAppDate(dateStr: string | null) {
  if (!dateStr) return null;
  const raw = dateStr.trim();
  const isoLike = raw.includes('T') ? raw : raw.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  const parsed = new Date(isoLike);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function timeAgo(dateStr: string | null) {
  const d = parseWhatsAppDate(dateStr);
  if (!d) return 'Sem data';
  try {
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 7) {
      return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch { return 'Sem data'; }
}

function fullConversationDate(dateStr: string | null) {
  const d = parseWhatsAppDate(dateStr);
  if (!d) return 'Sem data';
  const now = new Date();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Hoje às ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Ontem às ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString('pt-BR', sameYear
    ? { day: '2-digit', month: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${date} às ${time}`;
}

function Avatar({ src, name, size = 'md' }: { src?: string | null; name?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [err, setErr] = useState(false);
  const sz = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  if (src && !err) {
    return <img src={src} alt={name || ''} onError={() => setErr(true)}
      className={cn(sz, 'rounded-full object-cover shrink-0')} />;
  }
  return (
    <div className={cn(sz, 'rounded-full bg-green-500/15 text-green-500 flex items-center justify-center shrink-0')}>
      <User className={icon} />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="h-3 w-3 text-blue-400" />;
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 opacity-50" />;
  return <Check className="h-3 w-3 opacity-50" />;
}

function MediaContent({ msg }: { msg: WhatsAppMessage }) {
  const [lightbox, setLightbox] = useState(false);
  const isOut = msg.direction === 'outbound';
  const url = msg.media_url;

  if (!url) {
    // Sem mídia anexada: provavelmente é uma ligação que veio sem payload
    const isMidiaPlaceholder = !msg.content || msg.content.trim() === '[mídia]';
    if (isMidiaPlaceholder) {
      return (
        <div className={cn('flex items-center gap-2', isOut ? 'text-white' : '')}>
          <PhoneIncoming className={cn('h-4 w-4 shrink-0', isOut ? 'text-white' : 'text-muted-foreground')} />
          <span className="font-medium">Ligação</span>
        </div>
      );
    }
    return <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>;
  }

  if (msg.type === 'image' || msg.type === 'sticker') return (
    <>
      <img src={url} alt="imagem" onClick={() => setLightbox(true)}
        className="max-w-[260px] rounded-xl cursor-pointer hover:opacity-90 transition-opacity mb-1" />
      {msg.content && msg.content !== '[mídia]' && (
        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white"><X className="h-6 w-6" /></button>
          <img src={url} alt="imagem" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </>
  );

  if (msg.type === 'video') return (
    <video controls src={url} className="max-w-[260px] rounded-xl mb-1" preload="metadata">
      <source src={url} />
    </video>
  );

  if (msg.type === 'audio') return (
    <div className={cn('flex items-center gap-2 py-1', isOut ? 'text-white' : '')}>
      <Play className="h-4 w-4 shrink-0" />
      <audio controls src={url} className="h-8 w-[200px]" />
    </div>
  );

  if (msg.type === 'document') return (
    <a href={url} target="_blank" rel="noreferrer"
      className={cn('flex items-center gap-2 p-2 rounded-lg border', isOut ? 'border-white/30 hover:bg-white/10' : 'border-border hover:bg-muted/50')}>
      <FileText className="h-5 w-5 shrink-0" />
      <span className="text-sm truncate max-w-[180px]">{msg.content || 'Documento'}</span>
      <Download className="h-4 w-4 shrink-0 ml-auto" />
    </a>
  );

  return <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>;
}

function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  return _MessageBubbleImpl(msg);
}

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  let label: string;
  if (d.toDateString() === today.toDateString()) label = 'Hoje';
  else if (d.toDateString() === yesterday.toDateString()) label = 'Ontem';
  else label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return (
    <div className="flex justify-center my-2">
      <span className="text-[11px] px-3 py-1 rounded-full bg-muted text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}

function _MessageBubbleImpl(msg: WhatsAppMessage) {
  const isOut = msg.direction === 'outbound';
  if (msg.type === 'call') {
    const isVideo = /vídeo|video/i.test(msg.content || '');
    const Icon = isVideo ? VideoIcon : PhoneIncoming;
    const label = isVideo ? 'Chamada de vídeo' : 'Ligação de voz';
    return (
      <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
        <div className={cn(
          'max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm flex items-center gap-3',
          isOut ? 'bg-green-500 text-white rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'
        )}>
          <div className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
            isOut ? 'bg-white/20' : 'bg-muted'
          )}>
            <Icon className={cn('h-4 w-4', isOut ? 'text-white' : 'text-muted-foreground')} />
          </div>
          <div className="flex flex-col">
            <span className="font-medium leading-tight">{label}</span>
            <span className={cn('text-xs', isOut ? 'text-white/80' : 'text-muted-foreground')}>
              Retorne as ligações no seu celular.
            </span>
            <span className={cn('text-[10px] mt-1', isOut ? 'text-white/70' : 'text-muted-foreground')}>
              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[72%] rounded-2xl px-3 py-2 text-sm shadow-sm',
        isOut ? 'bg-green-500 text-white rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'
      )}>
        <MediaContent msg={msg} />
        <div className={cn('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-[10px]', isOut ? 'text-white/70' : 'text-muted-foreground')}>
            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOut && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

function ConversationItem({ conv, isSelected, onClick }: {
  conv: WhatsAppConversation; isSelected: boolean; onClick: () => void;
}) {
  const conversationDate = conv.last_message_at || conv.updated_at || conv.created_at;
  return (
    <button onClick={onClick} className={cn(
      'w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors',
      isSelected && 'bg-green-500/10 border-l-[3px] border-l-green-500',
      conv.unread_count > 0 && 'bg-accent/40'
    )}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar src={conv.profile_picture_url} name={conv.contact_name} size="md" />
          {conv.unread_count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
              {conv.unread_count}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-sm truncate min-w-0 flex-1', conv.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium')}>
              {conv.contact_name || formatPhone(conv.phone)}
            </span>
            <span className={cn('text-xs shrink-0 tabular-nums whitespace-nowrap', conv.unread_count > 0 ? 'text-primary font-semibold' : 'text-muted-foreground')}>
              {timeAgo(conversationDate)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={cn('text-xs truncate', conv.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {conv.last_message || 'Nenhuma mensagem'}
            </p>
            {conv.unread_count > 0 && (
              <span className="shrink-0 text-[10px] font-medium text-primary">
                {conv.unread_count === 1 ? '1 nova' : `${conv.unread_count} novas`}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums truncate">
            {fullConversationDate(conversationDate)}
          </p>
          {conv.customer && <p className="text-[10px] text-primary mt-0.5 truncate">{conv.customer.name}</p>}
        </div>
      </div>
    </button>
  );
}

function ContactPanel({ conv, onClose }: { conv: WhatsAppConversation; onClose: () => void }) {
  return (
    <div className="w-[260px] shrink-0 border-l border-border bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">Detalhes</span>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
      </div>
      <ScrollArea className="flex-1">
      <div className="flex flex-col items-center py-6 px-4 gap-3">
        <Avatar src={conv.profile_picture_url} name={conv.contact_name} size="lg" />
        <div className="text-center">
          <p className="font-semibold">{conv.contact_name || 'Contato'}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center mt-1">
            <Phone className="h-3 w-3" />{formatPhone(conv.phone)}
          </p>
        </div>
      </div>
      <div className="px-4 space-y-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Telefone</p>
          <p className="text-sm font-mono">{formatPhone(conv.phone)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
          <Badge variant={conv.status === 'open' ? 'default' : 'secondary'} className="text-xs">
            {conv.status === 'open' ? 'Aberta' : 'Resolvida'}
          </Badge>
        </div>
        {conv.customer && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
            <p className="text-sm text-primary font-medium">{conv.customer.name}</p>
          </div>
        )}
        <ContactTagsSection conv={conv} />
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Primeira mensagem</p>
          <p className="text-xs text-muted-foreground">
            {new Date(conv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      </ScrollArea>
    </div>
  );
}

function ContactTagsSection({ conv }: { conv: WhatsAppConversation }) {
  const customerId = conv.customer_id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: allTags = [] } = useCustomerTags();
  const { data: assignments = [] } = useCustomerTagAssignments(customerId);
  const addTag = useAddCustomerTag();
  const removeTag = useRemoveCustomerTag();
  const createTag = useCreateTag();

  const assignedTagIds = new Set((assignments ?? []).map((a: any) => a.tag_id));
  const term = search.trim().toLowerCase();
  const available = allTags.filter(
    (t) => !assignedTagIds.has(t.id) && (term === '' || t.name.toLowerCase().includes(term)),
  );
  const exactMatch = allTags.find((t) => t.name.toLowerCase() === term);
  const canCreate = term.length > 0 && !exactMatch;

  // Ensure a customer exists for this conversation; create one on the fly if needed.
  async function ensureCustomerId(): Promise<string> {
    if (customerId) return customerId;
    // Try to find an existing customer by phone
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', conv.phone)
      .maybeSingle();
    let cid = existing?.id as string | undefined;
    if (!cid) {
      const { data: created, error: createErr } = await supabase
        .from('customers')
        .insert({
          name: conv.contact_name || `Contato ${conv.phone}`,
          phone: conv.phone,
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      cid = created.id;
    }
    // Link the conversation to this customer
    await supabase
      .from('whatsapp_conversations')
      .update({ customer_id: cid })
      .eq('id', conv.id);
    queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    return cid!;
  }

  async function handleAdd(tagId: string) {
    try {
      const cid = await ensureCustomerId();
      await addTag.mutateAsync({ customerId: cid, tagId });
      setSearch('');
      setOpen(false);
      toast.success('Tag adicionada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao adicionar tag');
    }
  }

  async function handleCreate() {
    if (!term) return;
    try {
      const cid = await ensureCustomerId();
      const created = await createTag.mutateAsync({ name: search.trim(), color: '#3B82F6' });
      await addTag.mutateAsync({ customerId: cid, tagId: (created as any).id });
      setSearch('');
      setOpen(false);
      toast.success('Tag criada e adicionada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar tag');
    }
  }

  async function handleRemove(tagId: string) {
    if (!customerId) return;
    try {
      await removeTag.mutateAsync({ customerId, tagId });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao remover tag');
    }
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
        <TagIcon className="h-3 w-3" /> Tags
      </p>
      <div className="flex flex-wrap gap-1.5">
        {assignments.map((a: any) => {
          const tag = a.tag;
          if (!tag) return null;
          return (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: tag.color || '#3B82F6' }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemove(tag.id)}
                className="hover:bg-white/20 rounded-full"
                aria-label={`Remover ${tag.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Tag
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-2">
            <Input
              autoFocus
              placeholder="Buscar ou criar tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {available.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleAdd(t.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-left"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.color || '#3B82F6' }}
                  />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
              {available.length === 0 && !canCreate && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma tag encontrada</p>
              )}
              {canCreate && (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createTag.isPending || addTag.isPending}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-left text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Criar tag "{search.trim()}"
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/5">
      <div className="text-center px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 mx-auto mb-4">
          <MessageSquare className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="font-semibold mb-1">WhatsApp Inbox</h3>
        <p className="text-sm text-muted-foreground">Selecione uma conversa para ver as mensagens</p>
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/5">
      <div className="text-center px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500/10 mx-auto mb-4">
          <WifiOff className="h-8 w-8 text-yellow-500" />
        </div>
        <h3 className="font-semibold mb-2">Z-API não configurada</h3>
        <p className="text-sm text-muted-foreground mb-4">Configure suas credenciais Z-API para começar.</p>
        <Link to="/integrations"><Button size="sm" variant="outline">Ir para Integrações</Button></Link>
      </div>
    </div>
  );
}

function useConversationLead(conversationId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['conv-lead', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data } = await supabase
        .from('crm_leads')
        .select('id, stage_id, name')
        .eq('whatsapp_conversation_id', conversationId)
        .maybeSingle();
      return data as { id: string; stage_id: string; name: string } | null;
    },
    enabled: !!conversationId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conv-lead-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads', filter: `whatsapp_conversation_id=eq.${conversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['conv-lead', conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  return query;
}

function FunnelButton({ conv }: { conv: WhatsAppConversation }) {
  const [open, setOpen] = useState(false);
  const { data: stages = [] } = useCRMStages();
  const { data: lead, isLoading: leadLoading } = useConversationLead(conv.id);
  const createLead = useCreateLead();
  const moveLead = useMoveLead();

  const isPending = createLead.isPending || moveLead.isPending;
  const currentStage = lead ? stages.find((s) => s.id === lead.stage_id) : null;

  async function handleSelectStage(stage: CRMStage) {
    setOpen(false);
    if (lead) {
      if (lead.stage_id === stage.id) return;
      await moveLead.mutateAsync({ leadId: lead.id, stageId: stage.id });
      toast.success(`Lead movido para "${stage.name}"`);
    } else {
      await createLead.mutateAsync({
        name: conv.contact_name || conv.phone,
        phone: conv.phone,
        email: null,
        address: null,
        neighborhood_id: null,
        stage_id: stage.id,
        estimated_value: null,
        product_interest: null,
        source: 'whatsapp',
        notes: null,
        customer_id: conv.customer_id || null,
        assigned_to: null,
        whatsapp_conversation_id: conv.id,
        lost_reason: null,
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={lead ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'h-7 text-xs gap-1.5',
            lead ? 'bg-purple-600 hover:bg-purple-700 text-white' : '',
          )}
          disabled={isPending || leadLoading}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Kanban className="h-3.5 w-3.5" />
          )}
          {currentStage ? currentStage.name : 'Funil'}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-2 py-1.5">
          {lead ? 'Mover para etapa' : 'Adicionar ao funil'}
        </p>
        {stages.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma etapa criada</p>
        )}
        {stages.map((stage) => (
          <button
            key={stage.id}
            onClick={() => handleSelectStage(stage)}
            className={cn(
              'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted/60 transition-colors',
              lead?.stage_id === stage.id && 'bg-muted/40 font-medium',
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: stage.color || '#6b7280' }}
            />
            {stage.name}
            {lead?.stage_id === stage.id && (
              <Check className="h-3 w-3 ml-auto text-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default function WhatsAppInbox() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [messageText, setMessageText] = useState('');
  const [rightPanel, setRightPanel] = useState<'none' | 'contact' | 'sale'>('none');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: quickReplies = [] } = useQuickReplies();
  const [qrIndex, setQrIndex] = useState(0);

  // Detect "/something" being typed at start of message (or after newline) to suggest replies
  const qrMatch = (() => {
    const m = messageText.match(/(^|\n)(\/[a-z0-9_-]*)$/i);
    return m ? m[2].toLowerCase() : null;
  })();
  const qrSuggestions = qrMatch
    ? quickReplies.filter((q) => q.shortcut.toLowerCase().startsWith(qrMatch)).slice(0, 6)
    : [];

  function applyQuickReply(qr: QuickReply) {
    // Replace the trailing "/xxx" with the body
    const next = messageText.replace(/(^|\n)(\/[a-z0-9_-]*)$/i, (_m, p1) => `${p1}${qr.body}`);
    setMessageText(next);
    setQrIndex(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const { data: conversations = [], isLoading: loadingConvs } = useWhatsAppConversations();
  const { data: messages = [], isLoading: loadingMsgs } = useWhatsAppMessages(selectedId);
  const { data: config } = useWhatsAppConfig();
  const sendMessage = useSendWhatsAppMessage();
  const markRead = useMarkConversationRead();
  const setStatus = useSetConversationStatus();
  const [soundMuted, setSoundMutedState] = useState<boolean>(() => isWhatsAppSoundMuted());
  useWhatsAppNotificationSound();

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;
  const isConfigured = !!(config?.instance_id && config?.token);

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.contact_name?.toLowerCase().includes(q) || c.phone.includes(q) || c.customer?.name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
      return;
    }

    const selectedStillVisible = filtered.some((c) => c.id === selectedId);
    if (!selectedStillVisible) {
      const priorityConv = filtered.find((c) => c.unread_count > 0) ?? filtered[0] ?? null;
      if (priorityConv) setSelectedId(priorityConv.id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    const newestUnread = filtered.find((c) => c.unread_count > 0);
    if (!newestUnread) return;
    if (!selectedId || selectedConv?.status !== 'open') {
      setSelectedId(newestUnread.id);
    }
  }, [filtered, selectedId, selectedConv?.status]);

  function handleSelect(conv: WhatsAppConversation) {
    setSelectedId(conv.id);
    setRightPanel('none');
    if (conv.unread_count > 0) markRead.mutate(conv.id);
  }

  async function handleSend() {
    if (!messageText.trim() || !selectedConv) return;
    const text = messageText.trim();
    setMessageText('');
    try {
      await sendMessage.mutateAsync({ phone: selectedConv.phone, message: text, conversationId: selectedConv.id });
    } catch {
      setMessageText(text);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (qrSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setQrIndex((i) => (i + 1) % qrSuggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setQrIndex((i) => (i - 1 + qrSuggestions.length) % qrSuggestions.length); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        applyQuickReply(qrSuggestions[qrIndex]);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); setMessageText(messageText.replace(/(\/[a-z0-9_-]*)$/i, '')); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* Conversation list */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-border bg-background">
        <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-sm">WhatsApp</span>
              {totalUnread > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] bg-green-500 text-white border-0 rounded-full">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !soundMuted;
                  setWhatsAppSoundMuted(next);
                  setSoundMutedState(next);
                  if (!next) primeWhatsAppSound();
                }}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                  soundMuted
                    ? 'text-muted-foreground hover:bg-muted/50'
                    : 'text-green-500 hover:bg-green-500/10',
                )}
                title={soundMuted ? 'Ativar som de notificação' : 'Silenciar notificações'}
                aria-label={soundMuted ? 'Ativar som' : 'Silenciar som'}
              >
                {soundMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </button>
              <span className={cn('flex items-center gap-1 text-xs', isConfigured ? 'text-green-500' : 'text-muted-foreground')}>
                {isConfigured ? <><Wifi className="h-3 w-3" /> Ativo</> : <><WifiOff className="h-3 w-3" /> Inativo</>}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>

          <div className="flex rounded-md border border-border overflow-hidden">
            {(['open', 'resolved', 'all'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn(
                'flex-1 text-xs py-1 transition-colors',
                statusFilter === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 text-muted-foreground'
              )}>
                {s === 'open' ? 'Abertas' : s === 'resolved' ? 'Resolvidas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingConvs ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sem conversas</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationItem key={conv.id} conv={conv} isSelected={conv.id === selectedId} onClick={() => handleSelect(conv)} />
            ))
          )}
        </ScrollArea>
      </div>

      {/* Message thread */}
      {!isConfigured ? <NotConfigured /> : !selectedConv ? <EmptyThread /> : (
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            {/* Thread header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background">
              <button className="flex items-center gap-3 hover:opacity-80 transition-opacity" onClick={() => setRightPanel(rightPanel === 'contact' ? 'none' : 'contact')}>
                <Avatar src={selectedConv.profile_picture_url} name={selectedConv.contact_name} size="sm" />
                <div className="text-left">
                  <p className="font-medium text-sm leading-tight">{selectedConv.contact_name || formatPhone(selectedConv.phone)}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />{formatPhone(selectedConv.phone)}
                    {selectedConv.customer && <span className="text-primary ml-1.5">• {selectedConv.customer.name}</span>}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2">
                <FunnelButton conv={selectedConv} />
                <Button
                  variant={rightPanel === 'sale' ? 'default' : 'outline'}
                  size="sm"
                  className={cn('h-7 text-xs gap-1.5', rightPanel === 'sale' && 'bg-green-500 hover:bg-green-600 text-white')}
                  onClick={() => setRightPanel(rightPanel === 'sale' ? 'none' : 'sale')}
                  title={selectedConv.customer ? 'Lançar venda para este cliente' : 'Cliente não cadastrado — abre o painel para cadastrar'}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Vender
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                  onClick={() => setStatus.mutate({ id: selectedConv.id, status: selectedConv.status === 'open' ? 'resolved' : 'open' })}>
                  {selectedConv.status === 'open'
                    ? <><CheckCircle2 className="h-3.5 w-3.5" />Resolver</>
                    : <><RotateCcw className="h-3.5 w-3.5" />Reabrir</>}
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              {loadingMsgs ? (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando mensagens...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => {
                    const prev = i > 0 ? messages[i - 1] : null;
                    const showDate = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                    return (
                      <div key={msg.id} className="space-y-3">
                        {showDate && <DateSeparator date={msg.created_at} />}
                        <MessageBubble msg={msg} />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            {selectedConv.status === 'open' ? (
              <div className="px-4 py-3 border-t border-border bg-background">
                <div className="relative flex items-end gap-2">
                  {qrSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden z-10">
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
                        Atalhos · ↑↓ navegar · Tab/Enter usar · Esc cancelar
                      </div>
                      {qrSuggestions.map((qr, i) => (
                        <button
                          key={qr.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); applyQuickReply(qr); }}
                          onMouseEnter={() => setQrIndex(i)}
                          className={cn(
                            'w-full text-left px-3 py-2 flex items-start gap-3 transition-colors',
                            i === qrIndex ? 'bg-accent' : 'hover:bg-muted/50',
                          )}
                        >
                          <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted shrink-0 mt-0.5">{qr.shortcut}</code>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{qr.title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{qr.body}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="flex-1 resize-none rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] max-h-32 leading-relaxed"
                    placeholder="Digite sua mensagem... (Enter para enviar · / para atalhos)"
                    value={messageText}
                    onChange={(e) => { setMessageText(e.target.value); setQrIndex(0); }}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />
                  <Button size="icon" className="h-11 w-11 rounded-xl bg-green-500 hover:bg-green-600 shrink-0"
                    onClick={handleSend} disabled={!messageText.trim() || sendMessage.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                  Enter para enviar · Shift+Enter para nova linha · Digite <code className="font-mono">/</code> para usar atalhos
                </p>
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-border bg-muted/20 text-center text-sm text-muted-foreground">
                Conversa resolvida ·{' '}
                <button className="text-primary underline" onClick={() => setStatus.mutate({ id: selectedConv.id, status: 'open' })}>
                  Reabrir para continuar
                </button>
              </div>
            )}
          </div>

          {/* Right side panels */}
          {rightPanel === 'contact' && (
            <ContactPanel conv={selectedConv} onClose={() => setRightPanel('none')} />
          )}
          {rightPanel === 'sale' && (
            <QuickSalePanel
              conv={selectedConv}
              onClose={() => setRightPanel('none')}
              onSold={async (_orderId, summary) => {
                try {
                  await sendMessage.mutateAsync({
                    phone: selectedConv.phone,
                    message: summary,
                    conversationId: selectedConv.id,
                  });
                } catch {
                  // Silent — toast already shown by the sale flow
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
