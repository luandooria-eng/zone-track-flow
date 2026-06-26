import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Levels ──
export function useLoyaltyLevels() {
  return useQuery({
    queryKey: ['loyalty-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (level: {
      id?: string;
      name: string;
      min_points: number;
      icon: string;
      color: string;
      benefits?: string;
      sort_order: number;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from('loyalty_levels').upsert(level as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-levels'] }),
  });
}

export function useCustomerLevel(pointsBalance: number) {
  const { data: levels } = useLoyaltyLevels();
  if (!levels?.length) return { current: null, next: null, progress: 0 };

  const sorted = [...levels].filter((l: any) => l.is_active).sort((a: any, b: any) => b.min_points - a.min_points);
  const current = sorted.find((l: any) => pointsBalance >= l.min_points) || sorted[sorted.length - 1];
  const currentIdx = sorted.indexOf(current);
  const next = currentIdx > 0 ? sorted[currentIdx - 1] : null;

  const progress = next
    ? Math.min(100, ((pointsBalance - (current as any).min_points) / ((next as any).min_points - (current as any).min_points)) * 100)
    : 100;

  return { current, next, progress };
}

// ── Badges ──
export function useLoyaltyBadges() {
  return useQuery({
    queryKey: ['loyalty-badges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_badges')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (badge: {
      id?: string;
      name: string;
      description?: string;
      icon: string;
      condition_type: string;
      condition_value: number;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from('loyalty_badges').upsert(badge as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-badges'] }),
  });
}

export function useCustomerBadges(customerId?: string) {
  return useQuery({
    queryKey: ['loyalty-badge-awards', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_badge_awards')
        .select('*, badge:loyalty_badges(*)')
        .eq('customer_id', customerId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useAwardBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { customer_id: string; badge_id: string }) => {
      const { error } = await supabase.from('loyalty_badge_awards').insert(params as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-badge-awards'] }),
  });
}

// ── Missions ──
export function useLoyaltyMissions() {
  return useQuery({
    queryKey: ['loyalty-missions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_missions')
        .select('*, reward_badge:loyalty_badges(id, name, icon)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mission: {
      id?: string;
      title: string;
      description?: string;
      mission_type: string;
      target_value: number;
      reward_points: number;
      reward_badge_id?: string | null;
      starts_at: string;
      ends_at: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from('loyalty_missions').upsert(mission as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-missions'] }),
  });
}

export function useCustomerMissions(customerId?: string) {
  return useQuery({
    queryKey: ['loyalty-mission-progress', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_mission_progress')
        .select('*, mission:loyalty_missions(*)')
        .eq('customer_id', customerId!);
      if (error) throw error;
      return data;
    },
  });
}

// ── Campaigns ──
export function useLoyaltyCampaigns() {
  return useQuery({
    queryKey: ['loyalty-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: {
      id?: string;
      name: string;
      description?: string;
      campaign_type: string;
      multiplier: number;
      bonus_points: number;
      target_segment: string;
      target_min_orders: number;
      target_min_spent: number;
      target_product_ids: string[];
      starts_at: string;
      ends_at: string;
      is_active: boolean;
    }) => {
      const { error } = await supabase.from('loyalty_campaigns').upsert(campaign as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-campaigns'] }),
  });
}
