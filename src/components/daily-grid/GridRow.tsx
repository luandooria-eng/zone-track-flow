import { memo, useCallback } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { GridRow as GridRowType } from '@/types/dailyGrid';
import { GridCell } from './GridCell';
import { cn } from '@/lib/utils';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GridRowComponentProps {
  row: GridRowType;
  rowIndex: number;
  columns: readonly {
    key: string;
    label: string;
    width: number;
    type: string;
  }[];
  isSelected: boolean;
  selectedCol: number | null;
  onCellClick: (col: number) => void;
  isLocked: boolean;
}

// Custom comparison to prevent unnecessary re-renders
const arePropsEqual = (prevProps: GridRowComponentProps, nextProps: GridRowComponentProps) => {
  // Always re-render if selection state changed
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.selectedCol !== nextProps.selectedCol) return false;
  if (prevProps.isLocked !== nextProps.isLocked) return false;
  
  // Check if row data changed - compare by reference first (fast path)
  if (prevProps.row === nextProps.row) return true;
  
  // If reference changed, check key fields
  const prev = prevProps.row;
  const next = nextProps.row;
  
  if (prev.rowStatus !== next.rowStatus) return false;
  if (prev.isDirty !== next.isDirty) return false;
  if (prev.customerName !== next.customerName) return false;
  if (prev.productName !== next.productName) return false;
  if (prev.quantity !== next.quantity) return false;
  if (prev.value !== next.value) return false;
  if (prev.status !== next.status) return false;
  if (prev.paymentMethod !== next.paymentMethod) return false;
  if (prev.channel !== next.channel) return false;
  if (prev.deliverer !== next.deliverer) return false;
  if (prev.address !== next.address) return false;
  if (prev.neighborhood !== next.neighborhood) return false;
  if (prev.dueDate !== next.dueDate) return false;
  if (prev.houseNumber !== next.houseNumber) return false;
  if (prev.addressNotes !== next.addressNotes) return false;
  
  // Check errors object
  const prevErrors = prev.errors;
  const nextErrors = next.errors;
  if (prevErrors !== nextErrors) {
    if (!prevErrors || !nextErrors) return false;
    const prevKeys = Object.keys(prevErrors);
    const nextKeys = Object.keys(nextErrors);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prevErrors[key] !== nextErrors[key]) return false;
    }
  }
  
  // Check warnings object
  const prevWarnings = prev.warnings;
  const nextWarnings = next.warnings;
  if (prevWarnings !== nextWarnings) {
    if (!prevWarnings || !nextWarnings) return false;
    const prevKeys = Object.keys(prevWarnings);
    const nextKeys = Object.keys(nextWarnings);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
      if (prevWarnings[key] !== nextWarnings[key]) return false;
    }
  }
  
  return true;
};

export const GridRowComponent = memo(({
  row,
  rowIndex,
  columns,
  isSelected,
  selectedCol,
  onCellClick,
  isLocked,
}: GridRowComponentProps) => {
  const deleteRow = useDailyGridStore(state => state.deleteRow);

  const getRowStatusColor = () => {
    switch (row.rowStatus) {
      case 'dirty':
        return 'border-l-4 border-l-warning';
      case 'saving':
        return 'border-l-4 border-l-primary animate-pulse';
      case 'saved':
        return 'border-l-4 border-l-success';
      case 'error':
        return 'border-l-4 border-l-destructive';
      case 'warning':
        return 'border-l-4 border-l-destructive bg-red-50 dark:bg-red-950/20';
      default:
        return 'border-l-4 border-l-transparent';
    }
  };

  const hasData = row.customerName || row.productName || row.quantity > 0;
  const hasWarning = row.rowStatus === 'warning' && row.warnings;
  const warningMessage = hasWarning ? Object.values(row.warnings!)[0] : null;

  const handleDeleteRow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      deleteRow(rowIndex);
    }
  }, [isLocked, deleteRow, rowIndex]);

  return (
    <div
      className={cn(
        'flex items-center h-[44px] border-b transition-colors group',
        isSelected ? 'bg-accent/30' : 'bg-card hover:bg-accent/10',
        getRowStatusColor()
      )}
    >
      {/* Row number indicator with delete button and warning icon */}
      <div className="flex items-center justify-center w-[50px] h-full border-r bg-muted/30 text-muted-foreground text-sm relative">
        {hasWarning ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs">{rowIndex + 1}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm font-medium text-destructive">Cadastro pendente</p>
              <p className="text-xs text-muted-foreground">{warningMessage}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <span className={cn(hasData && !isLocked && 'group-hover:opacity-0 transition-opacity')}>
              {rowIndex + 1}
            </span>
            {hasData && !isLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDeleteRow}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Excluir linha</p>
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Data cells */}
      {columns.map((column, colIndex) => (
        <GridCell
          key={column.key}
          row={row}
          rowIndex={rowIndex}
          columnKey={column.key}
          columnType={column.type}
          width={column.width}
          isSelected={isSelected && selectedCol === colIndex}
          onClick={() => onCellClick(colIndex)}
          isLocked={isLocked}
          error={row.errors?.[column.key]}
        />
      ))}
    </div>
  );
}, arePropsEqual);

GridRowComponent.displayName = 'GridRowComponent';
