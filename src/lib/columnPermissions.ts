// Column Permissions System for Daily Grid
// Defines which columns can be edited based on user role

export type UserRole = 'admin' | 'supervisor' | 'operator' | 'viewer';

export interface ColumnPermission {
  canView: boolean;
  canEdit: boolean;
}

export interface RolePermissions {
  role: UserRole;
  columns: Record<string, ColumnPermission>;
  canAddRows: boolean;
  canDeleteRows: boolean;
  canSave: boolean;
  canExport: boolean;
}

// Default column permissions by role
export const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    role: 'admin',
    columns: {
      customerName: { canView: true, canEdit: true },
      address: { canView: true, canEdit: true },
      neighborhood: { canView: true, canEdit: true },
      productName: { canView: true, canEdit: true },
      quantity: { canView: true, canEdit: true },
      paymentMethod: { canView: true, canEdit: true },
      channel: { canView: true, canEdit: true },
      deliverer: { canView: true, canEdit: true },
      value: { canView: true, canEdit: true },
      status: { canView: true, canEdit: true },
    },
    canAddRows: true,
    canDeleteRows: true,
    canSave: true,
    canExport: true,
  },
  supervisor: {
    role: 'supervisor',
    columns: {
      customerName: { canView: true, canEdit: true },
      address: { canView: true, canEdit: true },
      neighborhood: { canView: true, canEdit: true },
      productName: { canView: true, canEdit: true },
      quantity: { canView: true, canEdit: true },
      paymentMethod: { canView: true, canEdit: true },
      channel: { canView: true, canEdit: true },
      deliverer: { canView: true, canEdit: true },
      value: { canView: true, canEdit: true }, // Supervisor pode editar valor
      status: { canView: true, canEdit: true },
    },
    canAddRows: true,
    canDeleteRows: true,
    canSave: true,
    canExport: true,
  },
  operator: {
    role: 'operator',
    columns: {
      customerName: { canView: true, canEdit: true },
      address: { canView: true, canEdit: false }, // Auto-preenchido
      neighborhood: { canView: true, canEdit: false }, // Auto-preenchido
      productName: { canView: true, canEdit: true },
      quantity: { canView: true, canEdit: true },
      paymentMethod: { canView: true, canEdit: true },
      channel: { canView: true, canEdit: true },
      deliverer: { canView: true, canEdit: true },
      value: { canView: true, canEdit: false }, // Operador NÃO pode alterar valor
      status: { canView: true, canEdit: true },
    },
    canAddRows: true,
    canDeleteRows: false,
    canSave: true,
    canExport: false,
  },
  viewer: {
    role: 'viewer',
    columns: {
      customerName: { canView: true, canEdit: false },
      address: { canView: true, canEdit: false },
      neighborhood: { canView: true, canEdit: false },
      productName: { canView: true, canEdit: false },
      quantity: { canView: true, canEdit: false },
      paymentMethod: { canView: true, canEdit: false },
      channel: { canView: true, canEdit: false },
      deliverer: { canView: true, canEdit: false },
      value: { canView: true, canEdit: false },
      status: { canView: true, canEdit: false },
    },
    canAddRows: false,
    canDeleteRows: false,
    canSave: false,
    canExport: true,
  },
};

// Helper to get permissions for a specific column and role
export const getColumnPermission = (
  role: UserRole,
  columnKey: string
): ColumnPermission => {
  const permissions = rolePermissions[role];
  return permissions?.columns[columnKey] ?? { canView: false, canEdit: false };
};

// Helper to check if user can edit a specific column
export const canEditColumn = (role: UserRole, columnKey: string): boolean => {
  return getColumnPermission(role, columnKey).canEdit;
};

// Helper to check if user can view a specific column
export const canViewColumn = (role: UserRole, columnKey: string): boolean => {
  return getColumnPermission(role, columnKey).canView;
};

// Helper to get all editable columns for a role
export const getEditableColumns = (role: UserRole): string[] => {
  const permissions = rolePermissions[role];
  return Object.entries(permissions.columns)
    .filter(([_, perm]) => perm.canEdit)
    .map(([key]) => key);
};

// Hook to use permissions in components
import { create } from 'zustand';

interface PermissionsStore {
  currentRole: UserRole;
  setRole: (role: UserRole) => void;
  canEdit: (columnKey: string) => boolean;
  canView: (columnKey: string) => boolean;
  getPermissions: () => RolePermissions;
}

export const usePermissionsStore = create<PermissionsStore>((set, get) => ({
  currentRole: 'admin', // Default to admin for now (would come from auth)
  
  setRole: (role: UserRole) => set({ currentRole: role }),
  
  canEdit: (columnKey: string) => {
    const { currentRole } = get();
    return canEditColumn(currentRole, columnKey);
  },
  
  canView: (columnKey: string) => {
    const { currentRole } = get();
    return canViewColumn(currentRole, columnKey);
  },
  
  getPermissions: () => {
    const { currentRole } = get();
    return rolePermissions[currentRole];
  },
}));
