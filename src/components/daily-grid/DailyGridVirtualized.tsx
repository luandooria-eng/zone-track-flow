import { useCallback, useRef, useEffect, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { useColumnWidthStore } from '@/stores/columnWidthStore';
import { GridRow } from '@/types/dailyGrid';
import { GridRowComponent } from './GridRow';
import { GridHeader } from './GridHeader';

const ROW_HEIGHT = 44;

export const GRID_COLUMNS = [
  { key: 'customerName', label: 'Cliente', width: 180, type: 'autocomplete' },
  { key: 'address', label: 'Endereço', width: 250, type: 'text' },
  { key: 'addressNotes', label: 'Obs. Endereço', width: 150, type: 'text' },
  { key: 'houseNumber', label: 'Nº', width: 70, type: 'text' },
  { key: 'neighborhood', label: 'Bairro', width: 150, type: 'select' },
  { key: 'productName', label: 'Produto', width: 180, type: 'select' },
  { key: 'unitPrice', label: 'Preço Unit.', width: 100, type: 'currency' },
  { key: 'quantity', label: 'Qtd', width: 70, type: 'number' },
  { key: 'paymentMethod', label: 'Pagamento', width: 120, type: 'select' },
  { key: 'dueDate', label: 'Vencimento', width: 120, type: 'date' },
  { key: 'channel', label: 'Canal', width: 100, type: 'select' },
  { key: 'deliverer', label: 'Entregador', width: 120, type: 'select' },
  { key: 'value', label: 'Total', width: 100, type: 'currency' },
  { key: 'status', label: 'Status', width: 100, type: 'select' },
] as const;

export function DailyGridVirtualized() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 30 });
  const { columnWidths } = useColumnWidthStore();
  
  const {
    rows,
    selectedCell,
    setSelectedCell,
    moveSelection,
    currentSheet,
    deleteRow,
  } = useDailyGridStore();

  const isLocked = currentSheet?.status === 'locked';

  // Navigation hotkeys
  useHotkeys('up', () => moveSelection('up'), { enableOnFormTags: true });
  useHotkeys('down', () => moveSelection('down'), { enableOnFormTags: true });
  useHotkeys('left', () => moveSelection('left'), { enableOnFormTags: true });
  useHotkeys('right', () => moveSelection('right'), { enableOnFormTags: true });
  
  // Delete row with Backspace
  useHotkeys('backspace', (e) => {
    if (isLocked || !selectedCell) return;
    const row = rows[selectedCell.row];
    if (row && (row.customerName || row.productName || row.quantity > 0)) {
      e.preventDefault();
      deleteRow(selectedCell.row);
    }
  }, { enableOnFormTags: false });
  useHotkeys('tab', (e) => {
    e.preventDefault();
    moveSelection('right');
  }, { enableOnFormTags: true });
  useHotkeys('shift+tab', (e) => {
    e.preventDefault();
    moveSelection('left');
  }, { enableOnFormTags: true });
  useHotkeys('enter', (e) => {
    e.preventDefault();
    moveSelection('down');
  }, { enableOnFormTags: true });

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!isLocked) {
      setSelectedCell({ row, col });
    }
  }, [setSelectedCell, isLocked]);

  // Synchronized scroll between header and body
  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const scrollLeft = e.currentTarget.scrollLeft;
    const containerHeight = e.currentTarget.clientHeight;
    
    // Sync header horizontal scroll
    if (headerRef.current) {
      headerRef.current.scrollLeft = scrollLeft;
    }
    
    // Update visible range for virtualization
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
    const end = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);
    setVisibleRange({ start, end });
  }, [rows.length]);

  useEffect(() => {
    // Initialize visible range based on container
    if (containerRef.current) {
      const containerHeight = containerRef.current.clientHeight || 600;
      setVisibleRange({ start: 0, end: Math.ceil(containerHeight / ROW_HEIGHT) + 5 });
    }
  }, []);

  // Calculate total width using stored widths - columns expand the grid, not compress others
  const totalWidth = GRID_COLUMNS.reduce((sum, col) => 
    sum + (columnWidths[col.key] || col.width), 0
  ) + 50; // 50 for row number column
  const totalHeight = rows.length * ROW_HEIGHT;

  const visibleRows = rows.slice(visibleRange.start, visibleRange.end);

  // Create columns with dynamic widths
  const columnsWithWidths = GRID_COLUMNS.map(col => ({
    ...col,
    width: columnWidths[col.key] || col.width,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden" ref={containerRef}>
      {/* Sticky Header - scrolls horizontally with body */}
      <div 
        ref={headerRef}
        className="flex-none overflow-hidden bg-muted/50 border-b"
      >
        <div style={{ width: totalWidth, minWidth: totalWidth }}>
          <GridHeader columns={columnsWithWidths} />
        </div>
      </div>

      {/* Virtualized Body */}
      <div 
        ref={bodyRef}
        className="flex-1 overflow-auto scrollbar-thick"
        onScroll={handleBodyScroll}
      >
        <div style={{ height: totalHeight, width: totalWidth, minWidth: totalWidth, position: 'relative' }}>
          {visibleRows.map((row, idx) => {
            const actualIndex = visibleRange.start + idx;
            return (
              <div
                key={row.row_uuid}
                style={{
                  position: 'absolute',
                  top: actualIndex * ROW_HEIGHT,
                  left: 0,
                  width: totalWidth,
                  height: ROW_HEIGHT,
                }}
              >
                <GridRowComponent
                  row={row}
                  rowIndex={actualIndex}
                  columns={columnsWithWidths}
                  isSelected={selectedCell?.row === actualIndex}
                  selectedCol={selectedCell?.row === actualIndex ? selectedCell.col : null}
                  onCellClick={(col) => handleCellClick(actualIndex, col)}
                  isLocked={isLocked}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
