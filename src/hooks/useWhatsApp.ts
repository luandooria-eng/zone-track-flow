import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface WhatsAppConversation {
  id: string;
  customer_id: string | null;
  phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  assigned_to: string | null;
  profile_picture_url: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; name: string } | null;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  message_id: string | null;
  direction: 'inbound' | 'outbound';
  content: string;
  type: string;
  media_url: string | null;
  status: string;
  sent_by: string | null;
  created_at: string;
}

export type WhatsAppProvider = 'zapi' | 'meta_cloud';

export interface WhatsAppConfig {
  id: string;
  provider: WhatsAppProvider;
  instance_id: string;
  token: string;
  phone: string | null;
  status: string;
  webhook_token: string;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  meta_access_token: string | null;
  meta_app_secret: string | null;
  meta_verify_token: string | null;
  meta_api_version: string;
}

export function useWhatsAppConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*, customer:customers(id, name)')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as WhatsAppConversation[];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const refetchSorted = () =>
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });

    const channel = supabase
      .channel('whatsapp-conversations-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations' },
        () => {
          // New conversation — refetch to include customer join
          refetchSorted();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations' },
        (payload) => {
          const updated = payload.new as WhatsAppConversation;
          queryClient.setQueryData<WhatsAppConversation[]>(
            ['whatsapp-conversations'],
            (old) => {
              if (!old) return old;
              const idx = old.findIndex((c) => c.id === updated.id);
              if (idx < 0) return old;
              const merged = { ...old[idx], ...updated, customer: old[idx].customer };
              const next = old.slice();
              next.splice(idx, 1);
              // Re-sort by last_message_at desc, nulls last
              const insertAt = next.findIndex(
                (c) =>
                  !c.last_message_at ||
                  (merged.last_message_at && c.last_message_at < merged.last_message_at),
              );
              if (insertAt < 0) next.push(merged);
              else next.splice(insertAt, 0, merged);
              return next;
            },
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          // Fallback: if a message arrives but the conversation update didn't propagate yet,
          // bump unread + last_message immediately for instant UI feedback.
          const msg = payload.new as WhatsAppMessage;
          if (msg.direction !== 'inbound') return;
          queryClient.setQueryData<WhatsAppConversation[]>(
            ['whatsapp-conversations'],
            (old) => {
              if (!old) return old;
              const idx = old.findIndex((c) => c.id === msg.conversation_id);
              if (idx < 0) return old;
              const current = old[idx];
              // Avoid double-counting if the UPDATE event already arrived (last_message matches)
              if (current.last_message === msg.content && current.last_message_at && msg.created_at <= current.last_message_at) {
                return old;
              }
              const merged: WhatsAppConversation = {
                ...current,
                last_message: msg.content,
                last_message_at: msg.created_at,
                unread_count: (current.unread_count || 0) + 1,
              };
              const next = old.slice();
              next.splice(idx, 1);
              return [merged, ...next];
            },
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useWhatsAppMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!conversationId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Realtime cobre INSERT/UPDATE; polling causava re-render constante e travava a digitação
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`whatsapp-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as WhatsAppMessage;
        queryClient.setQueryData<WhatsAppMessage[]>(
          ['whatsapp-messages', conversationId],
          (old) => {
            if (!old) return [newMsg];
            // Dedupe: skip if message already present (optimistic insert or same id)
            if (old.some((m) => m.id === newMsg.id || (newMsg.message_id && m.message_id === newMsg.message_id))) {
              return old;
            }
            // Replace optimistic temp row matching same content+direction if present
            const idx = old.findIndex(
              (m) => m.id.startsWith('temp-') && m.direction === newMsg.direction && m.content === newMsg.content,
            );
            if (idx >= 0) {
              const next = old.slice();
              next[idx] = newMsg;
              return next;
            }
            return [...old, newMsg];
          },
        );
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as WhatsAppMessage;
        queryClient.setQueryData<WhatsAppMessage[]>(
          ['whatsapp-messages', conversationId],
          (old) => old?.map((m) => (m.id === updated.id ? updated : m)) ?? [],
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendWhatsAppMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      phone,
      message,
      conversationId,
    }: { phone: string; message: string; conversationId: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ phone, message, conversation_id: conversationId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao enviar mensagem');
      return result;
    },
    // Optimistic update: message appears instantly, before the network round-trip
    onMutate: async ({ message, conversationId }) => {
      await queryClient.cancelQueries({ queryKey: ['whatsapp-messages', conversationId] });
      const previous = queryClient.getQueryData<WhatsAppMessage[]>(['whatsapp-messages', conversationId]);
      const tempId = `temp-${Date.now()}`;
      const optimistic: WhatsAppMessage = {
        id: tempId,
        conversation_id: conversationId,
        message_id: null,
        direction: 'outbound',
        content: message,
        type: 'text',
        media_url: null,
        status: 'sending',
        sent_by: null,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<WhatsAppMessage[]>(
        ['whatsapp-messages', conversationId],
        (old) => (old ? [...old, optimistic] : [optimistic]),
      );
      return { previous, tempId };
    },
    onError: (error, { conversationId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['whatsapp-messages', conversationId], context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar mensagem');
    },
    // No invalidate on success: realtime INSERT handler will replace the temp row
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
    },
  });
}

export function useSetConversationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'resolved' }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conversa atualizada!');
    },
  });
}

export function useWhatsAppConfig() {
  return useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000099')
        .maybeSingle();
      if (error) throw error;
      return data as WhatsAppConfig | null;
    },
  });
}

/** Non-secret WhatsApp status, readable by any authenticated operator (secrets stay admin-only). */
export interface WhatsAppConfigStatus {
  id: string;
  provider: WhatsAppProvider;
  status: string;
  phone: string | null;
  meta_api_version: string;
  zapi_configured: boolean;
  meta_configured: boolean;
}

export function useWhatsAppConfigStatus() {
  return useQuery({
    queryKey: ['whatsapp-config-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_config_public' as never)
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000099')
        .maybeSingle();
      if (error) throw error;
      return data as WhatsAppConfigStatus | null;
    },
  });
}

export function useSaveWhatsAppConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ instance_id, token }: { instance_id: string; token: string }) => {
      const { error } = await supabase
        .from('whatsapp_config')
        .upsert({
          id: '00000000-0000-0000-0000-000000000099',
          instance_id,
          token,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config-status'] });
      toast.success('Configurações Z-API salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Z-API config save error:', error);
      toast.error('Erro ao salvar configurações Z-API');
    },
  });
}

export interface MetaCloudConfigInput {
  meta_phone_number_id: string;
  meta_waba_id: string;
  meta_access_token: string;
  meta_app_secret: string;
  meta_verify_token: string;
}

export function useSaveMetaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MetaCloudConfigInput) => {
      const { error } = await supabase
        .from('whatsapp_config')
        .upsert({
          id: '00000000-0000-0000-0000-000000000099',
          ...input,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config-status'] });
      toast.success('Configurações da Meta Cloud API salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Meta config save error:', error);
      toast.error('Erro ao salvar configurações da Meta Cloud API');
    },
  });
}

export function useSetWhatsAppProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: WhatsAppProvider) => {
      const { error } = await supabase
        .from('whatsapp_config')
        .upsert({
          id: '00000000-0000-0000-0000-000000000099',
          provider,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config-status'] });
      toast.success('Provedor de WhatsApp atualizado!');
    },
    onError: (error) => {
      console.error('Provider switch error:', error);
      toast.error('Erro ao trocar o provedor');
    },
  });
}
