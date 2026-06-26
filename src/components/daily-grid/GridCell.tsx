import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { GridRow } from '@/types/dailyGrid';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { useGridData } from '@/contexts/GridDataContext';
import { cn } from '@/lib/utils';
import { CustomerAutocomplete } from './CustomerAutocomplete';
import { ProductSelect } from './ProductSelect';
import { PaymentMethodSelect } from './PaymentMethodSelect';
import { ChannelSelect } from './ChannelSelect';
import { DelivererSelect } from './DelivererSelect';
import { StatusSelect } from './StatusSelect';
import { NeighborhoodSelect } from './NeighborhoodSelect';
import { DueDateInput } from './DueDateInput';
import { CurrencyInput } from './CurrencyInput';
import { AddressAutocomplete } from './AddressAutocomplete';
import { QuantitySelect } from './QuantitySelect';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GridCellProps {
  row: GridRow;
  rowIndex: number;
  columnKey: string;
  columnType: string;
  width: number;
  isSelected: boolean;
  onClick: () => void;
  isLocked: boolean;
  error?: string;
}

// Custom comparison to prevent unnecessary re-renders
const arePropsEqual = (prevProps: GridCellProps, nextProps: GridCellProps) => {
  // Always re-render if selection changed
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isLocked !== nextProps.isLocked) return false;
  if (prevProps.error !== nextProps.error) return false;
  if (prevProps.width !== nextProps.width) return false;
  
  // Only re-render if the specific cell value changed
  const prevValue = prevProps.row[prevProps.columnKey as keyof GridRow];
  const nextValue = nextProps.row[nextProps.columnKey as keyof GridRow];
  if (prevValue !== nextValue) return false;
  
  // For payment method column, also check if it affects dueDate visibility
  if (prevProps.columnKey === 'dueDate') {
    if (prevProps.row.paymentMethod !== nextProps.row.paymentMethod) return false;
  }
  
  // For value calculation, check relevant fields
  if (prevProps.columnKey === 'value') {
    if (prevProps.row.quantity !== nextProps.row.quantity) return false;
    if (prevProps.row.productName !== nextProps.row.productName) return false;
    if (prevProps.row.unitPrice !== nextProps.row.unitPrice) return false;
  }
  
  return true;
};

export const GridCell = memo(({
  row,
  rowIndex,
  columnKey,
  columnType,
  width,
  isSelected,
  onClick,
  isLocked,
  error,
}: GridCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateCell, resolveCustomer, saveRow } = useDailyGridStore();
  const { products = [], customers = [] } = useGridData();

  const value = row[columnKey as keyof GridRow];

  // Check if dueDate column should be shown/required
  const isCrediary = row.paymentMethod === 'Crediário';
  const isDueDateColumn = columnKey === 'dueDate';

  useEffect(() => {
    if (isSelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSelected]);

  const handleDoubleClick = useCallback(() => {
    if (!isLocked) {
      setIsEditing(true);
    }
  }, [isLocked]);

  const handleChange = useCallback((newValue: unknown) => {
    updateCell(rowIndex, columnKey, newValue);
  }, [updateCell, rowIndex, columnKey]);

  // Handle status change - auto-save the row
  const handleStatusChange = useCallback(async (newValue: unknown) => {
    // First update the cell
    updateCell(rowIndex, columnKey, newValue);
    
    // Wait a tick for state to propagate, then save
    // This prevents saving stale data and avoids duplicate order creation
    setTimeout(async () => {
      const currentRow = useDailyGridStore.getState().rows[rowIndex];
      // Only auto-save if row has an order_id (already saved to database)
      // New rows should be saved via Enter key or explicit save button
      if (currentRow && currentRow.order_id) {
        try {
          await saveRow(rowIndex);
          toast.success(`Pedido ${newValue === 'Entregue' ? 'entregue' : newValue === 'Enviado' ? 'enviado' : newValue === 'Cancelado' ? 'cancelado' : 'atualizado'} com sucesso!`);
        } catch (err) {
          toast.error('Erro ao salvar pedido');
        }
      }
    }, 0);
  }, [updateCell, rowIndex, columnKey, saveRow]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Auto-save row on Enter key
  const handleEnterSave = useCallback(async () => {
    const currentRow = useDailyGridStore.getState().rows[rowIndex];
    if (currentRow && currentRow.customerName && currentRow.productName && currentRow.quantity > 0 && currentRow.isDirty) {
      // Prevent double-save if already saving
      if (currentRow.rowStatus === 'saving') return;
      try {
        await saveRow(rowIndex);
        toast.success('Pedido salvo com sucesso!');
      } catch (err) {
        toast.error('Erro ao salvar pedido');
      }
    }
  }, [rowIndex, saveRow]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
    if (e.key === 'F2' && !isEditing) {
      setIsEditing(true);
    }
    // Auto-save on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditing(false);
      await handleEnterSave();
    }
  }, [isEditing, handleEnterSave]);

  const renderContent = () => {
    // Special handling for autocomplete/select fields
    if (columnType === 'autocomplete' && columnKey === 'customerName') {
      return (
        <CustomerAutocomplete
          value={String(value || '')}
          onChange={(name, customerId) => {
            if (customerId) {
              const customer = customers.find(c => c.id === customerId);
              if (customer) {
                resolveCustomer(rowIndex, customerId, {
                  name: customer.name,
                  address: {
                    street: customer.street || undefined,
                    number: customer.number || undefined,
                    neighborhood: customer.neighborhood?.name || undefined,
                  },
                });
              }
            } else {
              handleChange(name);
            }
          }}
          disabled={isLocked}
          isEditing={isEditing || isSelected}
        />
      );
    }

    // Due date input - only enabled when payment is Crediário
    if (columnKey === 'dueDate') {
      return (
        <DueDateInput
          value={String(value || '')}
          onChange={handleChange}
          disabled={isLocked || !isCrediary}
        />
      );
    }

    // Address autocomplete with intelligent suggestions
    if (columnKey === 'address') {
      return (
        <AddressAutocomplete
          value={String(value || '')}
          onChange={(address, data) => {
            handleChange(address);
            // Auto-fill neighborhood if provided
            if (data?.neighborhood) {
              updateCell(rowIndex, 'neighborhood', data.neighborhood);
            }
            // Auto-fill customer if provided (always overwrite — endereço cadastrado = cliente conhecido)
            if (data?.customerName) {
              if (data.customerId) {
                const customer = customers.find(c => c.id === data.customerId);
                if (customer) {
                  resolveCustomer(rowIndex, data.customerId, {
                    name: customer.name,
                    address: {
                      street: customer.street || undefined,
                      number: customer.number || undefined,
                      neighborhood: customer.neighborhood?.name || undefined,
                    },
                  });
                } else {
                  updateCell(rowIndex, 'customerName', data.customerName);
                }
              } else {
                updateCell(rowIndex, 'customerName', data.customerName);
              }
            }
          }}
          disabled={isLocked}
          isEditing={isEditing || isSelected}
        />
      );
    }

    // Neighborhood select
    if (columnKey === 'neighborhood') {
      return (
        <NeighborhoodSelect
          value={String(value || '')}
          onChange={handleChange}
          disabled={isLocked}
        />
      );
    }

    if (columnType === 'select') {
      switch (columnKey) {
        case 'productName':
          return (
            <ProductSelect
              value={String(value || '')}
              onChange={(productName, price, productId) => {
                handleChange(productName);
                // Store product_id for saving
                if (productId) {
                  updateCell(rowIndex, 'product_id', productId);
                }
                // Auto-fill quantity to 1 if not set
                const currentQty = row.quantity || 0;
                if (currentQty === 0) {
                  updateCell(rowIndex, 'quantity', 1);
                }
                // Set unit price from product
                if (price !== undefined && price !== null) {
                  updateCell(rowIndex, 'unitPrice', Number(price));
                  const qty = currentQty === 0 ? 1 : currentQty;
                  updateCell(rowIndex, 'value', Number(price) * qty);
                }
              }}
              disabled={isLocked}
              paymentMethod={row.paymentMethod}
              salesChannel={row.channel}
            />
          );
        case 'paymentMethod':
          return (
            <PaymentMethodSelect
              value={String(value || '')}
              onChange={(newPaymentMethod, price) => {
                updateCell(rowIndex, 'paymentMethod', newPaymentMethod);
                if (price !== undefined && row.quantity > 0) {
                  updateCell(rowIndex, 'unitPrice', price);
                  updateCell(rowIndex, 'value', price * row.quantity);
                }
              }}
              disabled={isLocked}
              productName={row.productName}
            />
          );
        case 'channel':
          return (
            <ChannelSelect
              value={String(value || '')}
              onChange={(newChannel, price) => {
                updateCell(rowIndex, 'channel', newChannel);
                if (price !== undefined && row.quantity > 0) {
                  updateCell(rowIndex, 'unitPrice', price);
                  updateCell(rowIndex, 'value', price * row.quantity);
                }
              }}
              disabled={isLocked}
              productName={row.productName}
            />
          );
        case 'deliverer':
          return (
            <DelivererSelect
              value={String(value || '')}
              onChange={handleChange}
              disabled={isLocked}
            />
          );
        case 'status':
          return (
            <StatusSelect
              value={String(value || '')}
              onChange={handleStatusChange}
              disabled={isLocked}
            />
          );
      }
    }

    if (columnType === 'currency') {
      // Special handling for unitPrice - recalculate total when changed
      if (columnKey === 'unitPrice') {
        return (
          <CurrencyInput
            value={Number(value) || 0}
            onChange={(newUnitPrice) => {
              handleChange(newUnitPrice);
              // Recalculate total value
              const qty = row.quantity || 0;
              if (qty > 0) {
                updateCell(rowIndex, 'value', Number(newUnitPrice) * qty);
              }
            }}
            disabled={isLocked}
            isEditing={isEditing || isSelected}
          />
        );
      }
      
      // For value (total) column - still editable but read-only style
      return (
        <CurrencyInput
          value={Number(value) || 0}
          onChange={handleChange}
          disabled={isLocked}
          isEditing={isEditing}
        />
      );
    }

    if (columnType === 'number' && columnKey === 'quantity') {
      return (
        <QuantitySelect
          value={Number(value) || 0}
          onChange={(newQty) => {
            handleChange(newQty);
            // Use unitPrice to recalculate total
            const unitPrice = row.unitPrice || 0;
            if (unitPrice > 0) {
              updateCell(rowIndex, 'value', unitPrice * newQty);
            }
          }}
          disabled={isLocked}
        />
      );
    }

    if (columnType === 'number') {
      if (isEditing) {
        return (
          <input
            ref={inputRef}
            type="number"
            className="w-full h-full bg-transparent border-none outline-none text-sm px-1"
            value={String(value || '')}
            onChange={(e) => handleChange(Number(e.target.value))}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isLocked}
            min={0}
          />
        );
      }
      return <span className="text-sm truncate">{String(value) || ''}</span>;
    }

    // Default text input
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          className="w-full h-full bg-transparent border-none outline-none text-sm px-1"
          value={String(value || '')}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isLocked}
        />
      );
    }

    const displayValue = value instanceof Date ? value.toLocaleDateString() : String(value || '');
    return <span className="text-sm truncate">{displayValue}</span>;
  };

  // Visual indicator for required dueDate when Crediário is selected
  const showDueDateRequired = isDueDateColumn && isCrediary && !value;

  return (
    <div
      className={cn(
        'flex items-center px-2 h-full border-r transition-all duration-100',
        isSelected && 'ring-2 ring-inset ring-primary bg-primary/5',
        error && 'bg-destructive/10',
        showDueDateRequired && 'bg-warning/20 ring-1 ring-warning',
        isDueDateColumn && !isCrediary && 'opacity-50 bg-muted/30',
        !isLocked && 'cursor-cell'
      )}
      style={{ width, minWidth: 50 }}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex-1 min-w-0">
        {renderContent()}
      </div>
      
      {(error || showDueDateRequired) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle className={cn(
              'h-4 w-4 flex-shrink-0 ml-1',
              showDueDateRequired ? 'text-warning' : 'text-destructive'
            )} />
          </TooltipTrigger>
          <TooltipContent>
            <p>{error || 'Data de vencimento obrigatória para Crediário'}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}, arePropsEqual);

GridCell.displayName = 'GridCell';
