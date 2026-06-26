import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfDay, subDays, parseISO } from 'date-fns';
import { 
  GridRow, 
  DailySheet, 
  GridState, 
  UndoAction,
  GridRowStatus 
} from '@/types/dailyGrid';
import { useDataStore } from '@/stores/dataStore';
import { saveGridRowToSupabase, saveBatchToSupabase } from '@/hooks/useDailyGridSave';
import { supabase } from '@/integrations/supabase/client';

interface DailyGridStore extends GridState {
  // Sheet management
  loadSheets: () => void;
  openSheet: (date: string) => Promise<void>;
  createTodaySheet: () => Promise<void>;
  
  // Row management
  addRow: () => void;
  updateCell: (rowIndex: number, columnKey: string, value: unknown) => void;
  deleteRow: (rowIndex: number) => void;
  deleteSelectedRows: () => void;
  
  // Selection
  setSelectedCell: (cell: { row: number; col: number } | null) => void;
  toggleRowSelection: (rowIndex: number) => void;
  selectAllRows: () => void;
  clearSelection: () => void;
  selectRange: (startRow: number, endRow: number) => void;
  
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  
  // Save
  saveDirtyRows: () => Promise<void>;
  saveSelectedRows: () => Promise<void>;
  saveRow: (rowIndex: number) => Promise<void>;
  
  // Validation
  validateRow: (rowIndex: number) => Record<string, string>;
  validateAll: () => boolean;
  getErrorRows: () => { row: GridRow; index: number }[];
  
  // Customer autocomplete helpers
  resolveCustomer: (rowIndex: number, customerId: string, customerData: { name: string; address?: { street?: string; number?: string; neighborhood?: string } }) => void;
  
  // Navigation
  moveSelection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  navigateToRow: (rowIndex: number) => void;
  
  // Batch operations
  batchUpdateCells: (rowIndices: number[], columnKey: string, value: unknown) => void;
  pasteFromClipboard: (data: string, startRow: number, startCol: number) => void;
  copySelectedCells: () => string;
}

const createEmptyRow = (sheetDate: string, userId: string): GridRow => ({
  row_uuid: uuidv4(),
  timestamp_created: new Date(),
  created_by_user: userId,
  source: 'daily_grid',
  sheet_date: sheetDate,
  date: sheetDate,
  customerName: '',
  address: '',
  addressNotes: '',
  houseNumber: '',
  neighborhood: '',
  productName: '',
  unitPrice: 0,
  quantity: 0,
  paymentMethod: '',
  dueDate: '',
  channel: '',
  deliverer: '',
  value: 0,
  status: 'Aceito',
  rowStatus: 'idle',
  isDirty: false,
});

// Generate mock sheets for demo
const generateMockSheets = (): DailySheet[] => {
  const sheets: DailySheet[] = [];
  const today = startOfDay(new Date());
  
  for (let i = 0; i < 7; i++) {
    const date = subDays(today, i);
    sheets.push({
      id: uuidv4(),
      date: format(date, 'yyyy-MM-dd'),
      status: 'open',
      rowCount: i === 0 ? 0 : Math.floor(Math.random() * 50) + 10,
      createdAt: date,
      lockedAt: i > 0 ? date : undefined,
    });
  }
  
  return sheets;
};

// Persist storage key (only used as fallback)
const STORAGE_KEY = 'aquagas-daily-grid-store';

// Load orders from Supabase for a specific date
const loadOrdersFromSupabase = async (date: string): Promise<GridRow[]> => {
  try {
    // Parse date and calculate day boundaries in Maceio timezone (UTC-3)
    const targetDate = parseISO(date);
    const startOfDayUTC = new Date(targetDate);
    startOfDayUTC.setUTCHours(3, 0, 0, 0); // 00:00 Maceio = 03:00 UTC
    
    const endOfDayUTC = new Date(targetDate);
    endOfDayUTC.setUTCDate(endOfDayUTC.getUTCDate() + 1);
    endOfDayUTC.setUTCHours(2, 59, 59, 999); // 23:59:59 Maceio = 02:59:59 UTC next day

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(id, name, street, number, neighborhood_id, neighborhoods(name)),
        channel:sales_channels(id, name),
        payment_method:payment_methods(id, name),
        delivery_person:delivery_people(id, name),
        neighborhood:neighborhoods(id, name),
        items:order_items(*, product:products(id, name, price))
      `)
      .gte('created_at', startOfDayUTC.toISOString())
      .lte('created_at', endOfDayUTC.toISOString())
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading orders from Supabase:', error);
      return [];
    }

    // Convert orders to GridRow format
    const gridRows: GridRow[] = (orders || []).map((order: any) => {
      const item = order.items?.[0];
      const statusMap: Record<string, string> = {
        'accepted': 'Aceito',
        'preparing': 'Preparando',
        'sent': 'Enviado',
        'delivered': 'Entregue',
        'cancelled': 'Cancelado',
      };
      
      const quantity = item?.quantity || 0;
      const total = order.total || 0;
      const unitPrice = quantity > 0 ? total / quantity : (item?.unit_price || 0);
      
      return {
        row_uuid: uuidv4(),
        order_id: order.id,
        customer_id: order.customer?.id || undefined,
        product_id: item?.product_id || item?.product?.id || undefined,
        timestamp_created: new Date(order.created_at),
        created_by_user: order.created_by || 'system',
        source: 'supabase',
        sheet_date: date,
        date: date,
        customerName: order.customer?.name || 'S.ID',
        address: order.delivery_address || order.customer?.street || '',
        addressNotes: order.delivery_reference || order.customer?.reference || '',
        houseNumber: order.delivery_number || order.customer?.number || '',
        neighborhood: order.neighborhood?.name || order.customer?.neighborhoods?.name || '',
        productName: item?.product?.name || '',
        unitPrice: unitPrice,
        quantity: quantity,
        paymentMethod: order.payment_method?.name || '',
        dueDate: order.due_date || '',
        channel: order.channel?.name || '',
        deliverer: order.delivery_person?.name || '',
        value: total,
        status: statusMap[order.status] || 'Aceito',
        rowStatus: 'saved' as GridRowStatus,
        isDirty: false,
      };
    });

    return gridRows;
  } catch (e) {
    console.error('Error loading orders:', e);
    return [];
  }
};

// Delete an order from backend (used when user deletes a saved row)
// IMPORTANT: We don't hard-delete orders because other records can reference them (stock movements, payments, etc.).
// Instead we mark as cancelled so it disappears from the grid and stops counting in metrics.
const deleteOrderFromBackend = async (orderId: string) => {
  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'Excluído no Vendas Diárias',
    })
    .eq('id', orderId);

  if (orderError) throw orderError;
};

// Fallback: Load persisted rows from localStorage
const loadPersistedRows = (date: string): GridRow[] | null => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}-${date}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error loading persisted rows:', e);
  }
  return null;
};

// Save rows for a specific date (backup only)
const savePersistedRows = (date: string, rows: GridRow[]) => {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${date}`, JSON.stringify(rows));
  } catch (e) {
    console.error('Error saving persisted rows:', e);
  }
};

// Debounced persistence to avoid losing edits on refresh
let persistTimeout: number | null = null;
const schedulePersistRows = (date: string, rows: GridRow[]) => {
  if (persistTimeout) {
    window.clearTimeout(persistTimeout);
  }

  persistTimeout = window.setTimeout(() => {
    savePersistedRows(date, rows);
    persistTimeout = null;
  }, 400);
};

// Lock set to prevent concurrent saves of the same row (prevents duplicate orders)
const savingLock = new Set<string>();

export const useDailyGridStore = create<DailyGridStore>((set, get) => ({
  sheets: [],
  currentSheet: null,
  rows: [],
  selectedCell: null,
  selectedRows: new Set(),
  undoStack: [],
  redoStack: [],
  isSaving: false,
  dirtyRowCount: 0,

  loadSheets: () => {
    const sheets = generateMockSheets();
    set({ sheets });
  },

  openSheet: async (date: string) => {
    let { sheets } = get();
    
    // Load sheets if not loaded yet
    if (sheets.length === 0) {
      sheets = generateMockSheets();
      set({ sheets });
    }
    
    let sheet = sheets.find(s => s.date === date);
    
    // Create the sheet if it doesn't exist
    if (!sheet) {
      const today = format(new Date(), 'yyyy-MM-dd');
      sheet = {
        id: uuidv4(),
        date: date,
        status: 'open',
        rowCount: 0,
        createdAt: new Date(),
      };
      set({ sheets: [sheet, ...sheets] });
    }
    
    // Load orders from database (source of truth)
    const supabaseRows = await loadOrdersFromSupabase(date);

    // Also load local backup (to avoid losing unsaved edits after refresh)
    const persistedRows = loadPersistedRows(date) || [];
    const persistedWithData = persistedRows.filter(r => r.customerName || r.productName || r.quantity > 0);

    let rows: GridRow[] = [];

    if (supabaseRows.length > 0) {
      // Start with database rows - create a Set of order_ids for fast lookup
      const supabaseOrderIds = new Set(supabaseRows.map(r => r.order_id).filter(Boolean));
      rows = supabaseRows;

      // Merge local rows that are not yet in the database or that contain newer unsaved edits
      const orderIdToIndex = new Map<string, number>();
      rows.forEach((r, idx) => {
        if (r.order_id) orderIdToIndex.set(r.order_id, idx);
      });

      for (const localRow of persistedWithData) {
        if (localRow.order_id && orderIdToIndex.has(localRow.order_id)) {
          // If it refers to an existing order, only override when local has unsaved changes
          if (localRow.isDirty || localRow.rowStatus === 'dirty' || localRow.rowStatus === 'error' || localRow.rowStatus === 'saving') {
            const idx = orderIdToIndex.get(localRow.order_id)!;
            rows[idx] = localRow;
          }
          // Skip if local row has order_id that exists in supabase but no local changes
        } else if (!localRow.order_id) {
          // Only add rows that have NO order_id (truly new local rows not yet saved)
          rows.push(localRow);
        }
        // Skip local rows with order_id that's not in supabaseOrderIds (stale/deleted orders)
      }

      console.log(`[DailyGrid] Loaded ${supabaseRows.length} orders from database for ${date} (+${rows.length - supabaseRows.length} local pendentes)`);
    } else if (persistedWithData.length > 0) {
      // Only use localStorage rows that don't have an order_id (truly new) or are dirty
      rows = persistedWithData.filter(r => !r.order_id || r.isDirty);
      console.log(`[DailyGrid] Loaded ${rows.length} rows from localStorage for ${date}`);
    } else {
      rows = [];
      console.log(`[DailyGrid] No orders found for ${date}`);
    }
    
    // Ensure we have at least 210 rows for the grid
    while (rows.length < 210) {
      rows.push(createEmptyRow(date, 'admin'));
    }
    
    set({ 
      currentSheet: sheet, 
      rows,
      selectedCell: null,
      selectedRows: new Set(),
      undoStack: [],
      redoStack: [],
      dirtyRowCount: rows.filter(r => r.isDirty).length,
    });
  },

  createTodaySheet: async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { sheets } = get();
    
    const existingSheet = sheets.find(s => s.date === today);
    if (existingSheet) {
      await get().openSheet(today);
      return;
    }
    
    const newSheet: DailySheet = {
      id: uuidv4(),
      date: today,
      status: 'open',
      rowCount: 0,
      createdAt: new Date(),
    };
    
    set({ sheets: [newSheet, ...sheets] });
    await get().openSheet(today);
  },

  addRow: () => {
    const { currentSheet, rows } = get();
    if (!currentSheet) return;

    const newRow = createEmptyRow(currentSheet.date, 'admin');
    const updatedRows = [...rows, newRow];

    set({ rows: updatedRows });
    schedulePersistRows(currentSheet.date, updatedRows);
  },

  updateCell: (rowIndex: number, columnKey: string, value: unknown) => {
    const { rows, currentSheet, undoStack } = get();
    if (!currentSheet) return;

    const row = rows[rowIndex];
    if (!row) return;

    const previousValue = row[columnKey as keyof GridRow];

    // Add to undo stack
    const undoAction: UndoAction = {
      type: 'cell_edit',
      rowIndex,
      columnKey,
      previousValue,
      newValue: value,
      timestamp: new Date(),
    };

    // Clear error for this field if it exists
    let updatedErrors = row.errors ? { ...row.errors } : undefined;
    if (updatedErrors && updatedErrors[columnKey]) {
      delete updatedErrors[columnKey];
      // If no more errors, set to undefined
      if (Object.keys(updatedErrors).length === 0) {
        updatedErrors = undefined;
      }
    }

    const updatedRows = [...rows];
    updatedRows[rowIndex] = {
      ...row,
      [columnKey]: value,
      isDirty: true,
      rowStatus: updatedErrors && Object.keys(updatedErrors).length > 0 ? 'error' : 'dirty' as GridRowStatus,
      errors: updatedErrors,
    };

    const dirtyRowCount = updatedRows.filter(r => r.isDirty).length;

    set({
      rows: updatedRows,
      undoStack: [...undoStack.slice(-9), undoAction],
      redoStack: [],
      dirtyRowCount,
    });

    // Backup in localStorage so refresh doesn't wipe unsaved edits
    schedulePersistRows(currentSheet.date, updatedRows);
  },

  deleteRow: (rowIndex: number) => {
    const { rows, currentSheet } = get();
    if (!currentSheet) return;

    const rowToDelete = rows[rowIndex];
    if (!rowToDelete) return;

    const orderId = rowToDelete.order_id;

    // Instead of removing the row, replace it with an empty row
    // This keeps the grid structure intact and provides a blank row for new orders
    const emptyRow = createEmptyRow(currentSheet.date, 'admin');
    const updatedRows = [...rows];
    updatedRows[rowIndex] = emptyRow;

    const dirtyRowCount = updatedRows.filter(r => r.isDirty).length;
    set({ rows: updatedRows, dirtyRowCount, selectedCell: null });

    // Persist immediately so a refresh right after deleting doesn't restore the old data
    savePersistedRows(currentSheet.date, updatedRows);
    schedulePersistRows(currentSheet.date, updatedRows);

    // If it was already saved in the backend, cancel it there too (so it won't come back after refresh)
    if (orderId) {
      (async () => {
        try {
          await deleteOrderFromBackend(orderId);
          const { toast } = await import('sonner');
          toast.success('Pedido excluído com sucesso!');
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Erro desconhecido';
          console.error('[DailyGrid] Falha ao excluir pedido:', message);
          const { toast } = await import('sonner');
          toast.error(`Erro ao excluir pedido: ${message}`);
          // Re-open sheet to resync UI with backend (restores the row if cancel failed)
          await get().openSheet(currentSheet.date);
        }
      })();
    }
  },

  setSelectedCell: (cell) => {
    set({ selectedCell: cell });
  },

  toggleRowSelection: (rowIndex: number) => {
    const { selectedRows } = get();
    const newSelection = new Set(selectedRows);
    
    if (newSelection.has(rowIndex)) {
      newSelection.delete(rowIndex);
    } else {
      newSelection.add(rowIndex);
    }
    
    set({ selectedRows: newSelection });
  },

  selectAllRows: () => {
    const { rows } = get();
    set({ selectedRows: new Set(rows.map((_, i) => i)) });
  },

  clearSelection: () => {
    set({ selectedRows: new Set(), selectedCell: null });
  },

  undo: () => {
    const { undoStack, redoStack, rows } = get();
    if (undoStack.length === 0) return;
    
    const action = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    if (action.type === 'cell_edit' && action.columnKey) {
      const updatedRows = [...rows];
      updatedRows[action.rowIndex] = {
        ...updatedRows[action.rowIndex],
        [action.columnKey]: action.previousValue,
      };
      
      set({
        rows: updatedRows,
        undoStack: newUndoStack,
        redoStack: [...redoStack, action],
      });
    }
  },

  redo: () => {
    const { redoStack, undoStack, rows } = get();
    if (redoStack.length === 0) return;
    
    const action = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    
    if (action.type === 'cell_edit' && action.columnKey) {
      const updatedRows = [...rows];
      updatedRows[action.rowIndex] = {
        ...updatedRows[action.rowIndex],
        [action.columnKey]: action.newValue,
      };
      
      set({
        rows: updatedRows,
        redoStack: newRedoStack,
        undoStack: [...undoStack, action],
      });
    }
  },

  saveDirtyRows: async () => {
    const { rows, currentSheet } = get();
    if (!currentSheet) return;
    
    // Save all dirty rows that have minimum required data (customerName, productName, quantity)
    // Includes rows with Crediário even if customer is not registered - they'll be flagged as warnings
    const dirtyRows = rows.filter(r => r.isDirty && r.customerName && r.productName && r.quantity > 0);
    if (dirtyRows.length === 0) return;
    
    set({ isSaving: true });
    
    // Update rows to saving status
    const updatedRows = rows.map(row => 
      row.isDirty ? { ...row, rowStatus: 'saving' as GridRowStatus } : row
    );
    set({ rows: updatedRows });
    
    // Save to Supabase
    const { results } = await saveBatchToSupabase(dirtyRows);
    
    // Update rows with results
    const savedRows = updatedRows.map(row => {
      if (row.rowStatus !== 'saving') return row;
      
      const resultIndex = dirtyRows.findIndex(r => r.row_uuid === row.row_uuid);
      const result = results[resultIndex];
      
      if (result?.success) {
        // Check if there's a warning (e.g., Crediário without registered customer)
        const hasWarning = Boolean(result.warning);
        return { 
          ...row, 
          rowStatus: (hasWarning ? 'warning' : 'saved') as GridRowStatus, 
          isDirty: false, 
          order_id: result.orderId || row.order_id,
          warnings: hasWarning ? { customer: result.warning! } : undefined,
        };
      } else {
        return { 
          ...row, 
          rowStatus: 'error' as GridRowStatus,
          errors: { save: result?.error || 'Erro ao salvar' }
        };
      }
    });
    
    // Persist to localStorage as backup
    savePersistedRows(currentSheet.date, savedRows);
    
    set({ 
      rows: savedRows, 
      isSaving: false, 
      lastSaveTime: new Date(),
      dirtyRowCount: savedRows.filter(r => r.isDirty).length,
    });
  },

  saveSelectedRows: async () => {
    const { rows, selectedRows, currentSheet } = get();
    if (!currentSheet || selectedRows.size === 0) return;
    
    set({ isSaving: true });
    
    const selectedDirtyRows = rows.filter((row, idx) => 
      selectedRows.has(idx) && row.isDirty && row.customerName && row.productName && row.quantity > 0
    );
    
    const updatedRows = rows.map((row, idx) => 
      selectedRows.has(idx) && row.isDirty 
        ? { ...row, rowStatus: 'saving' as GridRowStatus } 
        : row
    );
    set({ rows: updatedRows });
    
    // Save to Supabase
    const { results } = await saveBatchToSupabase(selectedDirtyRows);
    
    const savedRows = updatedRows.map(row => {
      if (row.rowStatus !== 'saving') return row;
      
      const resultIndex = selectedDirtyRows.findIndex(r => r.row_uuid === row.row_uuid);
      const result = results[resultIndex];
      
      if (result?.success) {
        const hasWarning = Boolean(result.warning);
        return { 
          ...row, 
          rowStatus: (hasWarning ? 'warning' : 'saved') as GridRowStatus, 
          isDirty: false, 
          order_id: result.orderId || row.order_id,
          warnings: hasWarning ? { customer: result.warning! } : undefined,
        };
      } else {
        return { 
          ...row, 
          rowStatus: 'error' as GridRowStatus,
          errors: { save: result?.error || 'Erro ao salvar' }
        };
      }
    });
    
    // Persist to localStorage as backup
    savePersistedRows(currentSheet.date, savedRows);
    
    const dirtyRowCount = savedRows.filter(r => r.isDirty).length;
    
    set({ 
      rows: savedRows, 
      isSaving: false, 
      lastSaveTime: new Date(),
      dirtyRowCount,
      selectedRows: new Set(),
    });
  },

  saveRow: async (rowIndex: number) => {
    const { rows, currentSheet } = get();
    if (!currentSheet) return;

    const row = rows[rowIndex];
    if (!row || !row.customerName || !row.productName || row.quantity <= 0) return;

    // Prevent duplicate saves using lock Set (survives rowStatus overwrites from updateCell)
    if (savingLock.has(row.row_uuid)) return;
    savingLock.add(row.row_uuid);

    // Update row to saving status
    const rowToSave = { ...row, rowStatus: 'saving' as GridRowStatus };
    const updatedRows = [...rows];
    updatedRows[rowIndex] = rowToSave;
    set({ rows: updatedRows });

    try {
      // Save to Supabase - pass the updated row with current state
      const result = await saveGridRowToSupabase(rowToSave);

      // Get fresh state in case rows changed during async operation
      const currentRows = get().rows;
      const savedRows = [...currentRows];
      
      // Find the row by row_uuid to handle potential index shifts
      const currentRowIndex = savedRows.findIndex(r => r.row_uuid === row.row_uuid);
      if (currentRowIndex === -1) {
        console.warn('[DailyGrid] Row not found after save, may have been deleted');
        return;
      }
      
      if (result.success) {
        const hasWarning = Boolean(result.warning);
        savedRows[currentRowIndex] = { 
          ...savedRows[currentRowIndex], 
          rowStatus: (hasWarning ? 'warning' : 'saved') as GridRowStatus, 
          isDirty: false, 
          order_id: result.orderId || savedRows[currentRowIndex].order_id,
          warnings: hasWarning ? { customer: result.warning! } : undefined,
        };
      } else {
        savedRows[currentRowIndex] = { 
          ...savedRows[currentRowIndex], 
          rowStatus: 'error' as GridRowStatus,
          errors: { save: result.error || 'Erro ao salvar' }
        };
      }
      
      // Persist to localStorage as backup
      savePersistedRows(currentSheet.date, savedRows);
      
      const dirtyRowCount = savedRows.filter(r => r.isDirty).length;
      
      set({ 
        rows: savedRows, 
        lastSaveTime: new Date(),
        dirtyRowCount,
      });

    } finally {
      savingLock.delete(row.row_uuid);
    }
  },

  validateRow: (rowIndex: number) => {
    const { rows } = get();
    const row = rows[rowIndex];
    const errors: Record<string, string> = {};
    
    if (!row.customerName) errors.customerName = 'Cliente obrigatório';
    if (!row.productName) errors.productName = 'Produto obrigatório';
    if (row.quantity <= 0) errors.quantity = 'Quantidade deve ser maior que 0';
    
    // Validação especial: Crediário requer data de vencimento
    // Nota: Não bloqueia se não tiver customer_id - apenas sinaliza como warning na UI
    if (row.paymentMethod === 'Crediário' && !row.dueDate) {
      errors.dueDate = 'Data de vencimento obrigatória para Crediário';
    }
    
    if (row.value <= 0) errors.value = 'Valor deve ser maior que 0';
    
    // Campos opcionais: paymentMethod, channel, deliverer
    // Estes não são obrigatórios para salvar o pedido
    
    return errors;
  },

  validateAll: () => {
    const { rows } = get();
    let isValid = true;
    
    const updatedRows = rows.map((row, idx) => {
      if (!row.isDirty) return row;
      
      const errors = get().validateRow(idx);
      if (Object.keys(errors).length > 0) {
        isValid = false;
        return { ...row, errors, rowStatus: 'error' as GridRowStatus };
      }
      return { ...row, errors: undefined };
    });
    
    set({ rows: updatedRows });
    return isValid;
  },

  resolveCustomer: (rowIndex: number, customerId: string, customerData: { name: string; address?: { street?: string; number?: string; neighborhood?: string } }) => {
    const { rows } = get();
    const row = rows[rowIndex];
    
    // Clear customer-related errors
    let updatedErrors = row.errors ? { ...row.errors } : undefined;
    if (updatedErrors) {
      delete updatedErrors.customerName;
      if (Object.keys(updatedErrors).length === 0) {
        updatedErrors = undefined;
      }
    }
    
    const updatedRows = [...rows];
    updatedRows[rowIndex] = {
      ...updatedRows[rowIndex],
      customer_id: customerId,
      customerName: customerData.name,
      address: customerData.address?.street || '',
      houseNumber: customerData.address?.number || '',
      neighborhood: customerData.address?.neighborhood || '',
      isDirty: true,
      rowStatus: updatedErrors ? 'error' : 'dirty',
      errors: updatedErrors,
    };
    
    const dirtyRowCount = updatedRows.filter(r => r.isDirty).length;
    set({ rows: updatedRows, dirtyRowCount });
  },

moveSelection: (direction) => {
    const { selectedCell, rows } = get();
    if (!selectedCell) {
      set({ selectedCell: { row: 0, col: 0 } });
      return;
    }
    
    const maxRow = rows.length - 1;
    const maxCol = 11; // Number of visible columns (12 columns, 0-indexed)
    
    let newRow = selectedCell.row;
    let newCol = selectedCell.col;
    
    switch (direction) {
      case 'up':
        newRow = Math.max(0, newRow - 1);
        break;
      case 'down':
        newRow = Math.min(maxRow, newRow + 1);
        break;
      case 'left':
        newCol = Math.max(0, newCol - 1);
        break;
      case 'right':
        newCol = Math.min(maxCol, newCol + 1);
        break;
    }
    
    set({ selectedCell: { row: newRow, col: newCol } });
  },

  navigateToRow: (rowIndex: number) => {
    const { rows } = get();
    if (rowIndex >= 0 && rowIndex < rows.length) {
      set({ selectedCell: { row: rowIndex, col: 0 } });
    }
  },

  deleteSelectedRows: () => {
    const { rows, selectedRows, currentSheet } = get();
    if (!currentSheet || currentSheet.status === 'locked') return;

    const indicesToDelete = Array.from(selectedRows).sort((a, b) => b - a);
    const rowsToDelete = indicesToDelete
      .map(idx => rows[idx])
      .filter(Boolean);

    // Optimistic UI remove
    let updatedRows = [...rows];
    indicesToDelete.forEach(idx => {
      updatedRows = updatedRows.filter((_, i) => i !== idx);
    });

    const dirtyRowCount = updatedRows.filter(r => r.isDirty).length;
    set({
      rows: updatedRows,
      dirtyRowCount,
      selectedRows: new Set(),
      selectedCell: null,
    });

    schedulePersistRows(currentSheet.date, updatedRows);

    // Delete saved orders from backend as well
    const orderIds = rowsToDelete
      .map(r => r.order_id)
      .filter((id): id is string => Boolean(id));

    if (orderIds.length > 0) {
      (async () => {
        try {
          for (const id of orderIds) {
            await deleteOrderFromBackend(id);
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Erro desconhecido';
          console.error('[DailyGrid] Falha ao excluir pedidos selecionados:', message);
          await get().openSheet(currentSheet.date);
        }
      })();
    }
  },

  selectRange: (startRow: number, endRow: number) => {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const newSelection = new Set<number>();
    
    for (let i = minRow; i <= maxRow; i++) {
      newSelection.add(i);
    }
    
    set({ selectedRows: newSelection });
  },

  getErrorRows: () => {
    const { rows } = get();
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.errors && Object.keys(row.errors).length > 0);
  },

  batchUpdateCells: (rowIndices: number[], columnKey: string, value: unknown) => {
    const { rows, currentSheet, undoStack } = get();
    if (!currentSheet || currentSheet.status === 'locked') return;
    
    const updatedRows = [...rows];
    const actions: UndoAction[] = [];
    
    rowIndices.forEach(rowIndex => {
      const row = rows[rowIndex];
      if (!row) return;
      
      const previousValue = row[columnKey as keyof GridRow];
      
      actions.push({
        type: 'cell_edit',
        rowIndex,
        columnKey,
        previousValue,
        newValue: value,
        timestamp: new Date(),
      });
      
      updatedRows[rowIndex] = {
        ...row,
        [columnKey]: value,
        isDirty: true,
        rowStatus: 'dirty' as GridRowStatus,
      };
    });
    
    const dirtyRowCount = updatedRows.filter(r => r.isDirty).length;
    
    set({ 
      rows: updatedRows, 
      undoStack: [...undoStack.slice(-9 + actions.length), ...actions],
      redoStack: [],
      dirtyRowCount,
    });
  },

  pasteFromClipboard: (data: string, startRow: number, startCol: number) => {
    const { rows, currentSheet, undoStack } = get();
    if (!currentSheet || currentSheet.status === 'locked') return;
    
    const columnKeys = [
      'customerName', 'address', 'neighborhood', 'productName', 
      'quantity', 'paymentMethod', 'channel', 'deliverer', 'value', 'status'
    ];
    
    const lines = data.split('\n').filter(line => line.trim());
    const updatedRows = [...rows];
    const actions: UndoAction[] = [];
    
    lines.forEach((line, lineIndex) => {
      const rowIndex = startRow + lineIndex;
      if (rowIndex >= rows.length) return;
      
      const cells = line.split('\t');
      
      cells.forEach((cellValue, cellIndex) => {
        const colIndex = startCol + cellIndex;
        if (colIndex >= columnKeys.length) return;
        
        const columnKey = columnKeys[colIndex];
        const row = updatedRows[rowIndex];
        const previousValue = row[columnKey as keyof GridRow];
        
        let parsedValue: unknown = cellValue.trim();
        
        // Parse numeric values
        if (columnKey === 'quantity') {
          parsedValue = parseInt(cellValue) || 0;
        } else if (columnKey === 'value') {
          parsedValue = parseFloat(cellValue.replace(',', '.').replace(/[^\d.]/g, '')) || 0;
        }
        
        actions.push({
          type: 'cell_edit',
          rowIndex,
          columnKey,
          previousValue,
          newValue: parsedValue,
          timestamp: new Date(),
        });
        
        updatedRows[rowIndex] = {
          ...row,
          [columnKey]: parsedValue,
          isDirty: true,
          rowStatus: 'dirty' as GridRowStatus,
        };
      });
    });
    
    const dirtyRowCount = updatedRows.filter(r => r.isDirty).length;
    
    set({ 
      rows: updatedRows, 
      undoStack: [...undoStack.slice(-9), ...actions.slice(0, 10)],
      redoStack: [],
      dirtyRowCount,
    });
  },

  copySelectedCells: () => {
    const { rows, selectedRows, selectedCell } = get();
    
    if (selectedRows.size > 0) {
      const sortedIndices = Array.from(selectedRows).sort((a, b) => a - b);
      const columnKeys = [
        'customerName', 'address', 'neighborhood', 'productName', 
        'quantity', 'paymentMethod', 'channel', 'deliverer', 'value', 'status'
      ];
      
      const lines = sortedIndices.map(idx => {
        const row = rows[idx];
        return columnKeys.map(key => String(row[key as keyof GridRow] || '')).join('\t');
      });
      
      return lines.join('\n');
    }
    
    if (selectedCell) {
      const row = rows[selectedCell.row];
      const columnKeys = [
        'customerName', 'address', 'neighborhood', 'productName', 
        'quantity', 'paymentMethod', 'channel', 'deliverer', 'value', 'status'
      ];
      const columnKey = columnKeys[selectedCell.col];
      return String(row[columnKey as keyof GridRow] || '');
    }
    
    return '';
  },
}));
