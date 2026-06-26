import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export function useLoyaltyReferrals(filters?: { status?: string }) {
  return useQuery({
    queryKey: ['loyalty-referrals', filters],
    queryFn: async () => {
      let q = supabase
        .from('loyalty_referrals')
        .select('*, referrer:customers!loyalty_referrals_referrer_id_fkey(id, name, phone), referred:customers!loyalty_referrals_referred_customer_id_fkey(id, name, phone)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filters?.status && filters.status !== 'all') q = q.eq('status', filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomerReferrals(customerId?: string) {
  return useQuery({
    queryKey: ['loyalty-referrals-customer', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_referrals')
        .select('*, referred:customers!loyalty_referrals_referred_customer_id_fkey(id, name, phone)')
        .eq('referrer_id', customerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { referrer_id: string; referred_phone: string; bonus_referrer: number; bonus_referred: number }) => {
      const code = uuidv4().slice(0, 8).toUpperCase();
      const { error } = await supabase.from('loyalty_referrals').insert({
        referrer_id: params.referrer_id,
        referred_phone: params.referred_phone,
        referral_code: code,
        bonus_referrer: params.bonus_referrer,
        bonus_referred: params.bonus_referred,
        status: 'pending',
      } as any);
      if (error) throw error;
      return code;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-referrals'] });
    },
  });
}

export function useCompleteReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { referral_id: string; referred_customer_id: string; referrer_id: string; bonus_referrer: number; bonus_referred: number }) => {
      // Update referral status
      const { error } = await supabase
        .from('loyalty_referrals')
        .update({
          status: 'completed',
          referred_customer_id: params.referred_customer_id,
          completed_at: new Date().toISOString(),
        } as any)
        .eq('id', params.referral_id);
      if (error) throw error;

      // Credit bonus to referrer
      if (params.bonus_referrer > 0) {
        await supabase.from('loyalty_ledger').insert({
          customer_id: params.referrer_id,
          type: 'credit',
          points: params.bonus_referrer,
          origin: 'referral',
          description: 'Bônus por indicação',
          reference_id: params.referral_id,
        } as any);
        // Update balance
        const { data: cust } = await supabase.from('customers').select('points_balance').eq('id', params.referrer_id).single();
        await supabase.from('customers').update({ points_balance: ((cust as any)?.points_balance || 0) + params.bonus_referrer } as any).eq('id', params.referrer_id);
      }

      // Credit bonus to referred
      if (params.bonus_referred > 0) {
        await supabase.from('loyalty_ledger').insert({
          customer_id: params.referred_customer_id,
          type: 'credit',
          points: params.bonus_referred,
          origin: 'referral',
          description: 'Bônus de boas-vindas (indicação)',
          reference_id: params.referral_id,
        } as any);
        const { data: cust2 } = await supabase.from('customers').select('points_balance').eq('id', params.referred_customer_id).single();
        await supabase.from('customers').update({ points_balance: ((cust2 as any)?.points_balance || 0) + params.bonus_referred } as any).eq('id', params.referred_customer_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-referrals'] });
      qc.invalidateQueries({ queryKey: ['loyalty-ledger'] });
      qc.invalidateQueries({ queryKey: ['loyalty-dashboard'] });
    },
  });
}
