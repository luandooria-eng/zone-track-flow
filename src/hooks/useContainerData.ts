import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { 
  ContainerPool, 
  ContainerBalance, 
  ContainerMovement, 
  MonthlyBonus,
  ContainerPoolWithBalance,
  ContainerPoolInsert,
  ContainerMovementInsert,
  MonthlyBonusInsert,
  MovementType
} from '@/types/containers';

// Fetch all container pools
export function useContainerPools() {
  return useQuery({
    queryKey: ['container-pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('container_pools')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ContainerPool[];
    }
  });
}

// Fetch container balances
export function useContainerBalances() {
  return useQuery({
    queryKey: ['container-balances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('container_balances')
        .select('*, pool:container_pools(*)');
      
      if (error) throw error;
      return data as ContainerBalance[];
    }
  });
}

// Fetch container movements with optional filters
export function useContainerMovements(poolId?: string, limit = 50) {
  return useQuery({
    queryKey: ['container-movements', poolId, limit],
    queryFn: async () => {
      let query = supabase
        .from('container_movements')
        .select('*, pool:container_pools(*)')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (poolId) {
        query = query.eq('pool_id', poolId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ContainerMovement[];
    }
  });
}

// Fetch monthly bonuses
export function useMonthlyBonuses(year?: number) {
  return useQuery({
    queryKey: ['monthly-bonuses', year],
    queryFn: async () => {
      let query = supabase
        .from('monthly_bonuses')
        .select('*, pool:container_pools(*)')
        .order('competence_month', { ascending: false });
      
      if (year) {
        query = query.like('competence_month', `${year}-%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MonthlyBonus[];
    }
  });
}

// Combined hook for pools with balances and KPIs
export function useContainerPoolsWithBalance() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  return useQuery({
    queryKey: ['container-pools-with-balance', currentMonth],
    queryFn: async () => {
      // Fetch pools
      const { data: pools, error: poolsError } = await supabase
        .from('container_pools')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (poolsError) throw poolsError;
      
      // Fetch balances
      const { data: balances, error: balancesError } = await supabase
        .from('container_balances')
        .select('*');
      
      if (balancesError) throw balancesError;
      
      // Fetch breakages this month
      const startOfMonth = `${currentMonth}-01T00:00:00`;
      const { data: breakages, error: breakagesError } = await supabase
        .from('container_movements')
        .select('pool_id, qty')
        .eq('movement_type', 'BREAKAGE')
        .gte('created_at', startOfMonth);
      
      if (breakagesError) throw breakagesError;
      
      // Fetch bonuses this month
      const { data: bonuses, error: bonusesError } = await supabase
        .from('monthly_bonuses')
        .select('*')
        .eq('competence_month', currentMonth);
      
      if (bonusesError) throw bonusesError;
      
      // Aggregate breakages by pool
      const breakagesByPool: Record<string, number> = {};
      breakages?.forEach(b => {
        breakagesByPool[b.pool_id] = (breakagesByPool[b.pool_id] || 0) + b.qty;
      });
      
      // Build result
      const result: ContainerPoolWithBalance[] = (pools || []).map(pool => {
        const balance = balances?.find(b => b.pool_id === pool.id);
        const poolBreakages = breakagesByPool[pool.id] || 0;
        const bonus = bonuses?.find(b => b.pool_id === pool.id) || null;
        
        // Calculate breakage percentage based on total movements this month
        const breakagePercent = pool.total_physical_qty > 0 
          ? (poolBreakages / pool.total_physical_qty) * 100 
          : 0;
        
        return {
          ...pool,
          balance: {
            qty_full: balance?.qty_full || 0,
            qty_empty: balance?.qty_empty || 0,
            qty_in_field: balance?.qty_in_field || 0,
          },
          breakages_this_month: poolBreakages,
          breakage_percent: breakagePercent,
          bonus_this_month: bonus as MonthlyBonus | null,
        };
      });
      
      return result;
    }
  });
}

// Create container pool
export function useCreateContainerPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pool: ContainerPoolInsert) => {
      const { data, error } = await supabase
        .from('container_pools')
        .insert(pool)
        .select()
        .single();
      
      if (error) throw error;
      
      // Create initial balance record
      await supabase
        .from('container_balances')
        .insert({
          pool_id: data.id,
          qty_full: 0,
          qty_empty: pool.total_physical_qty,
          qty_in_field: 0,
        });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['container-pools'] });
      queryClient.invalidateQueries({ queryKey: ['container-pools-with-balance'] });
      toast.success('Pool de vasilhames criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar pool: ' + error.message);
    }
  });
}

// Create container movement
export function useCreateContainerMovement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (movement: ContainerMovementInsert) => {
      const { data, error } = await supabase
        .from('container_movements')
        .insert(movement)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['container-pools'] });
      queryClient.invalidateQueries({ queryKey: ['container-balances'] });
      queryClient.invalidateQueries({ queryKey: ['container-movements'] });
      queryClient.invalidateQueries({ queryKey: ['container-pools-with-balance'] });
      
      const messages: Record<MovementType, string> = {
        'FILL': 'Envase registrado com sucesso!',
        'SALE_TO_FIELD': 'Saída para campo registrada!',
        'RETURN': 'Retorno registrado com sucesso!',
        'BREAKAGE': 'Quebra registrada.',
        'PURCHASE': 'Compra de vasilhames registrada!',
        'ADJUSTMENT': 'Ajuste registrado.',
      };
      
      toast.success(messages[variables.movement_type] || 'Movimento registrado!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar movimento: ' + error.message);
    }
  });
}

// Create or update monthly bonus
export function useUpsertMonthlyBonus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bonus: MonthlyBonusInsert) => {
      const { data, error } = await supabase
        .from('monthly_bonuses')
        .upsert(bonus, { 
          onConflict: 'pool_id,competence_month',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-bonuses'] });
      queryClient.invalidateQueries({ queryKey: ['container-pools-with-balance'] });
      toast.success('Bonificação registrada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar bonificação: ' + error.message);
    }
  });
}

// Update container pool
export function useUpdateContainerPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContainerPool> & { id: string }) => {
      const { data, error } = await supabase
        .from('container_pools')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['container-pools'] });
      queryClient.invalidateQueries({ queryKey: ['container-pools-with-balance'] });
      toast.success('Pool atualizado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar pool: ' + error.message);
    }
  });
}

// Calculate KPIs for dashboard
export function useContainerKPIs() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  return useQuery({
    queryKey: ['container-kpis', currentMonth],
    queryFn: async () => {
      // Fetch all pools
      const { data: pools } = await supabase
        .from('container_pools')
        .select('*')
        .eq('is_active', true);
      
      // Fetch all balances
      const { data: balances } = await supabase
        .from('container_balances')
        .select('*');
      
      // Fetch breakages this month
      const startOfMonth = `${currentMonth}-01T00:00:00`;
      const { data: breakages } = await supabase
        .from('container_movements')
        .select('qty, pool_id')
        .eq('movement_type', 'BREAKAGE')
        .gte('created_at', startOfMonth);
      
      // Fetch bonuses this month
      const { data: bonuses } = await supabase
        .from('monthly_bonuses')
        .select('*')
        .eq('competence_month', currentMonth);
      
      // Calculate totals
      const totalPool = pools?.reduce((sum, p) => sum + p.total_physical_qty, 0) || 0;
      const totalFull = balances?.reduce((sum, b) => sum + b.qty_full, 0) || 0;
      const totalEmpty = balances?.reduce((sum, b) => sum + b.qty_empty, 0) || 0;
      const totalInField = balances?.reduce((sum, b) => sum + b.qty_in_field, 0) || 0;
      
      // Breakages
      const totalBreakages = breakages?.reduce((sum, b) => sum + b.qty, 0) || 0;
      const breakageValue = breakages?.reduce((sum, b) => {
        const pool = pools?.find(p => p.id === b.pool_id);
        return sum + (b.qty * (pool?.unit_value || 0));
      }, 0) || 0;
      const breakagePercent = totalPool > 0 ? (totalBreakages / totalPool) * 100 : 0;
      
      // Bonuses
      const totalBonusQty = bonuses?.reduce((sum, b) => sum + b.bonus_qty, 0) || 0;
      const totalBonusValue = bonuses?.reduce((sum, b) => sum + Number(b.bonus_value_brl), 0) || 0;
      const avgBonusPercent = bonuses && bonuses.length > 0
        ? bonuses.reduce((sum, b) => sum + Number(b.bonus_percent), 0) / bonuses.length
        : 0;
      
      return {
        totalPool,
        totalFull,
        totalEmpty,
        totalInField,
        breakages: {
          qty: totalBreakages,
          value: breakageValue,
          percent: breakagePercent,
        },
        bonuses: {
          qty: totalBonusQty,
          value: totalBonusValue,
          avgPercent: avgBonusPercent,
        },
      };
    }
  });
}
