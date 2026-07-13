import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CRMStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  description: string | null;
  is_won: boolean;
  is_lost: boolean;
  is_entry: boolean;
  created_at: string;
}

export interface CRMLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  neighborhood_id: string | null;
  stage_id: string;
  estimated_value: number | null;
  product_interest: string | null;
  source: string | null;
  notes: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  whatsapp_conversation_id: string | null;
  lost_reason: string | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
  stage?: CRMStage;
  neighborhood?: { id: string; name: string } | null;
}

export interface CRMActivity {
  id: string;
  lead_id: string;
  type: string;
  content: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CRMTrigger {
  id: string;
  name: string;
  stage_id: string;
  trigger_condition: string; // on_enter | time_in_stage
  action_type: string;       // whatsapp_message | move_stage | add_tag
  message_template: string | null;
  target_stage_id: string | null;
  tags: string[];
  filter_tags: string[];
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
  whatsapp_template_id: string | null;
}

export interface CRMRecurrenceRule {
  id: string;
  name: string;
  product_keyword: string | null;
  days_since_last_order: number;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

// ─── Stages ───────────────────────────────────────────────────────────────────

export function useCRMStages() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['crm-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_funnel_stages')
        .select('*')
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as CRMStage[];
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const channel = supabase
      .channel('crm-stages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_funnel_stages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stage: Omit<CRMStage, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('crm_funnel_stages').insert(stage).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-stages'] }); toast.success('Etapa criada!'); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMStage> & { id: string }) => {
      const { error } = await supabase.from('crm_funnel_stages').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-stages'] }); toast.success('Etapa atualizada!'); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Move leads to first stage before deleting
      const { data: firstStage } = await supabase
        .from('crm_funnel_stages')
        .select('id')
        .neq('id', id)
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (firstStage) {
        await supabase.from('crm_leads').update({ stage_id: firstStage.id }).eq('stage_id', id);
      }
      const { error } = await supabase.from('crm_funnel_stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-stages'] });
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      toast.success('Etapa removida.');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; order_index: number }[]) => {
      for (const u of updates) {
        await supabase.from('crm_funnel_stages').update({ order_index: u.order_index }).eq('id', u.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-stages'] }),
    onError: (e) => toast.error(`Erro ao reordenar: ${e.message}`),
  });
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export function useCRMLeads() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['crm-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_leads')
        .select('*, stage:crm_funnel_stages(*)')
        .order('stage_changed_at', { ascending: false });
      if (error) throw error;
      return data as CRMLead[];
    },
    staleTime: 0,
  });

  useEffect(() => {
    const channel = supabase
      .channel('crm-leads-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Omit<CRMLead, 'id' | 'created_at' | 'updated_at' | 'stage_changed_at' | 'stage' | 'neighborhood'>) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .insert(lead)
        .select('*, stage:crm_funnel_stages(*)')
        .single();
      if (error) throw error;
      return data as CRMLead;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-leads'] }); toast.success('Lead criado!'); },
    onError: (e) => toast.error(`Erro ao criar lead: ${e.message}`),
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMLead> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_leads')
        .update(updates)
        .eq('id', id)
        .select('*, stage:crm_funnel_stages(*)')
        .single();
      if (error) throw error;
      return data as CRMLead;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-leads'] }),
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useMoveLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const { error } = await supabase.from('crm_leads').update({ stage_id: stageId }).eq('id', leadId);
      if (error) throw error;

      // Fire on_enter triggers via edge function (non-blocking)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-whatsapp-trigger`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ lead_id: leadId, stage_id: stageId }),
          },
        ).catch(() => null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-activities'] });
    },
    onError: (e) => toast.error(`Erro ao mover lead: ${e.message}`),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-leads'] }); toast.success('Lead removido.'); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

// ─── Activities ───────────────────────────────────────────────────────────────

export function useCRMActivities(leadId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['crm-activities', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('crm_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CRMActivity[];
    },
    enabled: !!leadId,
  });

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`crm-activities-${leadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'crm_activities',
        filter: `lead_id=eq.${leadId}`,
      }, (payload) => {
        queryClient.setQueryData<CRMActivity[]>(['crm-activities', leadId], (old) =>
          old ? [payload.new as CRMActivity, ...old] : [payload.new as CRMActivity],
        );
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leadId, queryClient]);

  return query;
}

export function useAddActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId, type, content, metadata = {},
    }: { leadId: string; type: string; content: string; metadata?: Record<string, unknown> }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from('crm_activities')
        .insert([{ lead_id: leadId, type, content, metadata: metadata as any, created_by: session?.user?.id }])
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { leadId }) => queryClient.invalidateQueries({ queryKey: ['crm-activities', leadId] }),
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

export function useCRMTriggers() {
  return useQuery({
    queryKey: ['crm-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_triggers')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CRMTrigger[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpsertTrigger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (trigger: Partial<CRMTrigger> & { stage_id: string }) => {
      if (trigger.id) {
        const { data, error } = await supabase.from('crm_triggers').update(trigger).eq('id', trigger.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('crm_triggers').insert([trigger as any]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-triggers'] }); toast.success('Gatilho salvo!'); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useToggleTrigger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('crm_triggers').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-triggers'] }),
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useDeleteTrigger() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('crm_triggers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-triggers'] }); toast.success('Gatilho removido.'); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

// ─── Recurrence Rules ─────────────────────────────────────────────────────────

export function useCRMRecurrenceRules() {
  return useQuery({
    queryKey: ['crm-recurrence-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_recurrence_rules')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CRMRecurrenceRule[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpsertRecurrenceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<CRMRecurrenceRule>) => {
      if (rule.id) {
        const { data, error } = await supabase.from('crm_recurrence_rules').update(rule).eq('id', rule.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('crm_recurrence_rules').insert([rule as any]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-recurrence-rules'] }); toast.success('Regra salva!'); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

export function useToggleRecurrenceRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('crm_recurrence_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-recurrence-rules'] }),
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });
}

// ─── Timer processing ─────────────────────────────────────────────────────────

export function useProcessTimers() {
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crm-timer-processor`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: '{}',
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Falha no processamento');
      return result as { ok: boolean; processed: number };
    },
    onSuccess: (result) => {
      if (result.processed > 0) {
        toast.success(`${result.processed} gatilho(s) de tempo disparado(s)!`);
      }
    },
    onError: () => {}, // silent — background operation
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function useCRMStats(leads: CRMLead[], stages: CRMStage[]) {
  const total = leads.length;
  const wonStage = stages.find((s) => s.is_won);
  const lostStage = stages.find((s) => s.is_lost);
  const won = wonStage ? leads.filter((l) => l.stage_id === wonStage.id).length : 0;
  const lost = lostStage ? leads.filter((l) => l.stage_id === lostStage.id).length : 0;
  const active = total - won - lost;
  const pipelineValue = leads
    .filter((l) => !lostStage || l.stage_id !== lostStage.id)
    .reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
  const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;

  return { total, won, lost, active, pipelineValue, conversionRate };
}
