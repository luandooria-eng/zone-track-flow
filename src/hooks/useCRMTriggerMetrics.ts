import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CRMTriggerMetrics {
  totals: { total_sent: number; total_responded: number; avg_response_minutes: number | null };
  daily: { day: string; sent: number; responded: number }[];
  byTrigger: {
    trigger_id: string | null;
    trigger_name: string;
    sent: number;
    responded: number;
    avg_response_minutes: number | null;
  }[];
  topEngaged: {
    lead_id: string;
    lead_name: string | null;
    lead_phone: string | null;
    sent: number;
    responded: number;
    avg_response_minutes: number | null;
  }[];
  silent: {
    lead_id: string;
    lead_name: string | null;
    lead_phone: string | null;
    sent: number;
  }[];
  reactivated: {
    lead_id: string;
    lead_name: string | null;
    lead_phone: string | null;
    responded: number;
    last_response_at: string | null;
  }[];
}

export function useCRMTriggerMetrics(startISO?: string, endISO?: string) {
  return useQuery({
    queryKey: ['crm-trigger-metrics', startISO ?? null, endISO ?? null],
    queryFn: async (): Promise<CRMTriggerMetrics> => {
      const { data, error } = await supabase.rpc('get_crm_trigger_metrics', {
        p_start: startISO,
        p_end: endISO,
      } as never);
      if (error) throw error;
      return (data as unknown as CRMTriggerMetrics) ?? {
        totals: { total_sent: 0, total_responded: 0, avg_response_minutes: null },
        daily: [],
        byTrigger: [],
        topEngaged: [],
        silent: [],
        reactivated: [],
      };
    },
    staleTime: 60_000,
  });
}