import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCRMCampaigns() {
  return useQuery({
    queryKey: ['crm-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCRMCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      const [campaign, templates] = await Promise.all([
        supabase.from('crm_campaigns').select('*').eq('id', id).single(),
        supabase.from('crm_campaign_templates').select('*').eq('campaign_id', id).order('label'),
      ]);
      if (campaign.error) throw campaign.error;
      return { campaign: campaign.data, templates: templates.data || [] };
    },
    enabled: !!id,
  });
}

export function useCampaignMetrics(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-campaign-metrics', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.rpc('get_campaign_metrics', { p_campaign_id: id });
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
    refetchInterval: 15000,
  });
}

export function useCampaignRecipients(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-campaign-recipients', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('crm_campaign_recipients')
        .select('*, template:crm_campaign_templates(label)')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });
}
