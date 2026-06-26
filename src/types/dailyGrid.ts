// Daily Grid Types - Vendas Diária Module

export type GridRowStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'warning';
export type SheetStatus = 'open' | 'locked';

export interface DailySheet {
  id: string;
  date: string; // YYYY-MM-DD
  status: SheetStatus;
  rowCount: number;
  createdAt: Date;
  lockedAt?: Date;
  lockedBy?: string;
}

export interface GridRow {
  // System columns (hidden)
  row_uuid: string;
  order_id?: string;
  customer_id?: string;
  product_id?: string;
  timestamp_created: Date;
  created_by_user: string;
  source: 'daily_grid' | 'supabase';
  sheet_date: string;
  
  // Visible columns
  date: string;
  customerName: string;
  address: string;
  addressNotes: string; // Observação sobre o endereço
  houseNumber: string;
  neighborhood: string;
  productName: string;
  unitPrice: number; // Preço unitário editável
  quantity: number;
  paymentMethod: string;
  dueDate: string; // Data de vencimento - obrigatório para Crediário
  channel: string;
  deliverer: string;
  value: number; // Total = unitPrice * quantity
  status: string;
  
  // UI state
  rowStatus: GridRowStatus;
  errors?: Record<string, string>;
  warnings?: Record<string, string>; // Warnings don't block save but show visual feedback
  isDirty: boolean;
}

export interface GridColumn {
  key: keyof GridRow;
  label: string;
  width: number;
  editable: boolean;
  type: 'text' | 'number' | 'select' | 'autocomplete' | 'currency' | 'date';
  options?: { value: string; label: string }[];
  required?: boolean;
  validation?: (value: unknown) => string | null;
}

export interface BatchSaveRequest {
  sheet_date: string;
  user_id: string;
  idempotency_key: string;
  rows: BatchSaveRow[];
}

export interface BatchSaveRow {
  row_uuid: string;
  customer_ref: { id?: string; external_key?: string };
  product_ref: { id?: string };
  quantity: number;
  payment_method: string;
  channel: string;
  deliverer: string;
  value: number;
  status: string;
}

export interface BatchSaveResponse {
  results: BatchSaveResult[];
  summary: {
    created: number;
    updated: number;
    failed: number;
  };
}

export interface BatchSaveResult {
  row_uuid: string;
  status: 'created' | 'updated' | 'failed';
  order_id?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface UndoAction {
  type: 'cell_edit' | 'row_delete' | 'row_add';
  rowIndex: number;
  columnKey?: string;
  previousValue?: unknown;
  newValue?: unknown;
  timestamp: Date;
}

export interface GridState {
  sheets: DailySheet[];
  currentSheet: DailySheet | null;
  rows: GridRow[];
  selectedCell: { row: number; col: number } | null;
  selectedRows: Set<number>;
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  isSaving: boolean;
  lastSaveTime?: Date;
  dirtyRowCount: number;
}
