import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

// ── Scoring Rules ──
export function useScoringRules() {
  return useQuery({
    queryKey: ['loyalty-scoring-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_scoring_rules')
        .select('*, product:products(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertScoringRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: {
      id?: string;
      product_id: string | null;
      rule_type: string;
      points_value: number;
      min_purchase_value: number;
      is_active: boolean;
    }) => {
      const { error } = await supabase
        .from('loyalty_scoring_rules')
        .upsert(rule as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-scoring-rules'] }),
  });
}

// ── Ledger ──
export function useLoyaltyLedger(customerId?: string) {
  return useQuery({
    queryKey: ['loyalty-ledger', customerId],
    queryFn: async () => {
      let q = supabase
        .from('loyalty_ledger')
        .select('*, customer:customers(id, name, phone)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (customerId) q = q.eq('customer_id', customerId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useInsertLedgerEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      customer_id: string;
      type: string;
      points: number;
      origin: string;
      description?: string;
      reference_id?: string;
      operator_id?: string;
    }) => {
      const { error } = await supabase.from('loyalty_ledger').insert(entry as any);
      if (error) throw error;

      // Update customer points_balance
      const delta = entry.type === 'credit' ? entry.points : -entry.points;
      const { error: err2 } = await supabase.rpc('update_points_balance' as any, {
        p_customer_id: entry.customer_id,
        p_delta: delta,
      });
      // fallback if RPC doesn't exist: manual update
      if (err2) {
        const { data: cust } = await supabase
          .from('customers')
          .select('points_balance')
          .eq('id', entry.customer_id)
          .single();
        await supabase
          .from('customers')
          .update({ points_balance: ((cust as any)?.points_balance || 0) + delta } as any)
          .eq('id', entry.customer_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-ledger'] });
      qc.invalidateQueries({ queryKey: ['loyalty-dashboard'] });
    },
  });
}

// ── Coupons ──
export function useLoyaltyCoupons() {
  return useQuery({
    queryKey: ['loyalty-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coupon: {
      id?: string;
      title: string;
      description?: string;
      image_url?: string;
      points_cost: number;
      coupon_type: string;
      stock?: number;
      expires_at?: string;
      is_active: boolean;
      whatsapp_phone?: string;
      whatsapp_message?: string;
    }) => {
      const { error } = await supabase.from('loyalty_coupons').upsert(coupon as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-coupons'] }),
  });
}

// ── Vouchers ──
export function useLoyaltyVouchers(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['loyalty-vouchers', filters],
    queryFn: async () => {
      let q = supabase
        .from('loyalty_vouchers')
        .select('*, coupon:loyalty_coupons(id, title), customer:customers(id, name, phone)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.search) {
        q = q.or(`code.ilike.%${filters.search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useRedeemCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { customer_id: string; coupon_id: string; points_cost: number }) => {
      const code = uuidv4().slice(0, 8).toUpperCase();

      // Insert voucher
      const { error } = await supabase.from('loyalty_vouchers').insert({
        code,
        coupon_id: params.coupon_id,
        customer_id: params.customer_id,
        points_spent: params.points_cost,
        status: 'active',
        redeemed_at: new Date().toISOString(),
      } as any);
      if (error) throw error;

      // Debit points in ledger
      await supabase.from('loyalty_ledger').insert({
        customer_id: params.customer_id,
        type: 'debit',
        points: params.points_cost,
        origin: 'redemption',
        description: `Resgate de cupom`,
        reference_id: params.coupon_id,
      } as any);

      // Update balance
      const { data: cust } = await supabase
        .from('customers')
        .select('points_balance')
        .eq('id', params.customer_id)
        .single();
      await supabase
        .from('customers')
        .update({ points_balance: Math.max(0, ((cust as any)?.points_balance || 0) - params.points_cost) } as any)
        .eq('id', params.customer_id);

      // Decrement coupon stock
      const { data: cpn } = await supabase
        .from('loyalty_coupons')
        .select('stock')
        .eq('id', params.coupon_id)
        .single();
      if (cpn && (cpn as any).stock !== null) {
        await supabase
          .from('loyalty_coupons')
          .update({ stock: Math.max(0, ((cpn as any).stock || 0) - 1) } as any)
          .eq('id', params.coupon_id);
      }

      return { code };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-vouchers'] });
      qc.invalidateQueries({ queryKey: ['loyalty-coupons'] });
      qc.invalidateQueries({ queryKey: ['loyalty-ledger'] });
      qc.invalidateQueries({ queryKey: ['loyalty-dashboard'] });
    },
  });
}

export function useValidateVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { voucher_id: string; operator_id: string }) => {
      const { error } = await supabase
        .from('loyalty_vouchers')
        .update({
          status: 'validated',
          validated_at: new Date().toISOString(),
          validated_by: params.operator_id,
        } as any)
        .eq('id', params.voucher_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-vouchers'] });
      qc.invalidateQueries({ queryKey: ['loyalty-dashboard'] });
    },
  });
}

export function useReverseVoucher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { voucher_id: string; operator_id: string; customer_id: string; points: number }) => {
      const { error } = await supabase
        .from('loyalty_vouchers')
        .update({
          status: 'reversed',
          reversed_at: new Date().toISOString(),
          reversed_by: params.operator_id,
        } as any)
        .eq('id', params.voucher_id);
      if (error) throw error;

      // Credit points back
      await supabase.from('loyalty_ledger').insert({
        customer_id: params.customer_id,
        type: 'credit',
        points: params.points,
        origin: 'reversal',
        description: 'Estorno de voucher',
        reference_id: params.voucher_id,
        operator_id: params.operator_id,
      } as any);

      const { data: cust } = await supabase
        .from('customers')
        .select('points_balance')
        .eq('id', params.customer_id)
        .single();
      await supabase
        .from('customers')
        .update({ points_balance: ((cust as any)?.points_balance || 0) + params.points } as any)
        .eq('id', params.customer_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-vouchers'] });
      qc.invalidateQueries({ queryKey: ['loyalty-ledger'] });
      qc.invalidateQueries({ queryKey: ['loyalty-dashboard'] });
    },
  });
}

// ── Dashboard Stats ──
export function useLoyaltyDashboard() {
  return useQuery({
    queryKey: ['loyalty-dashboard'],
    queryFn: async () => {
      const [
        { count: participantsCount },
        { data: ledgerStats },
        { data: vouchersActive },
        { data: vouchersValidated },
      ] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).gt('points_balance', 0),
        supabase.from('loyalty_ledger').select('type, points').eq('type', 'credit'),
        supabase.from('loyalty_vouchers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('loyalty_vouchers').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
      ]);

      const totalPointsCredited = (ledgerStats || []).reduce((s, e) => s + (e as any).points, 0);

      return {
        participants: participantsCount || 0,
        totalPointsCredited,
        vouchersActive: (vouchersActive as any)?.length ?? 0,
        vouchersValidated: (vouchersValidated as any)?.length ?? 0,
      };
    },
  });
}

// ── Client Token ──
export function useClientByToken(token?: string) {
  return useQuery({
    queryKey: ['loyalty-client-token', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_client_tokens')
        .select('*, customer:customers(id, name, phone, points_balance)')
        .eq('token', token!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ── Generate client token ──
export function useGenerateClientToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customerId: string) => {
      const token = uuidv4().slice(0, 12);
      // Upsert: one token per customer
      const { error } = await supabase
        .from('loyalty_client_tokens')
        .upsert({ customer_id: customerId, token } as any, { onConflict: 'customer_id' });
      if (error) throw error;
      return token;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-client-token'] }),
  });
}
