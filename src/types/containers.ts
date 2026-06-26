// Container/Returnable types

export type ContainerType = string; // 'galao_20l', 'botijao_13kg', 'botijao_45kg', etc.
export type ContainerState = 'full' | 'empty' | 'in_field';
export type MovementType = 'FILL' | 'SALE_TO_FIELD' | 'RETURN' | 'BREAKAGE' | 'PURCHASE' | 'ADJUSTMENT';
export type BonusStatus = 'predicted' | 'confirmed';

export interface ContainerPool {
  id: string;
  type: ContainerType;
  name: string;
  total_physical_qty: number;
  unit_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContainerBalance {
  id: string;
  pool_id: string;
  qty_full: number;
  qty_empty: number;
  qty_in_field: number;
  updated_at: string;
  // Joined
  pool?: ContainerPool;
}

export interface ContainerMovement {
  id: string;
  pool_id: string;
  movement_type: MovementType;
  qty: number;
  from_state: ContainerState | null;
  to_state: ContainerState | null;
  related_order_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined
  pool?: ContainerPool;
}

export interface MonthlyBonus {
  id: string;
  pool_id: string;
  competence_month: string; // 'YYYY-MM'
  qty_filled: number;
  bonus_percent: number;
  bonus_qty: number;
  bonus_value_brl: number;
  status: BonusStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  pool?: ContainerPool;
}

// Aggregated view for display
export interface ContainerPoolWithBalance extends ContainerPool {
  balance: {
    qty_full: number;
    qty_empty: number;
    qty_in_field: number;
  };
  breakages_this_month: number;
  breakage_percent: number;
  bonus_this_month: MonthlyBonus | null;
}

// Insert types
export type ContainerPoolInsert = Omit<ContainerPool, 'id' | 'created_at' | 'updated_at'>;
export type ContainerMovementInsert = Omit<ContainerMovement, 'id' | 'created_at' | 'pool'>;
export type MonthlyBonusInsert = Omit<MonthlyBonus, 'id' | 'created_at' | 'updated_at' | 'pool'>;
