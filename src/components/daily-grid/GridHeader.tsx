import { useRef, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useColumnWidthStore } from '@/stores/columnWidthStore';
import { GripVertical } from 'lucide-react';

interface GridHeaderProps {
  columns: readonly {
    key: string;
    label: string;
    width: number;
    type: string;
  }[];
}

export function GridHeader({ columns }: GridHeaderProps) {
  const { columnWidths, setColumnWidth } = useColumnWidthStore();
  const [resizing, setResizing] = useState<string | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizing(columnKey);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[columnKey] || columns.find(c => c.key === columnKey)?.width || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      const newWidth = startWidthRef.current + delta;
      setColumnWidth(columnKey, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths, columns, setColumnWidth]);

  return (
    <div className="flex items-center h-11 bg-muted/70 border-b font-medium text-sm select-none">
      {/* Row indicator column */}
      <div className="flex items-center justify-center w-[50px] h-full border-r bg-muted text-muted-foreground">
        #
      </div>
      
      {/* Data columns */}
      {columns.map((column) => {
        const width = columnWidths[column.key] || column.width;
        const isResizing = resizing === column.key;
        
        return (
          <div
            key={column.key}
            className={cn(
              'flex items-center h-full border-r text-foreground relative group',
              'bg-muted/50 hover:bg-muted transition-colors'
            )}
            style={{ width, minWidth: 50 }}
          >
            <span className="truncate px-3 flex-1">{column.label}</span>
            
            {/* Resize handle */}
            <div
              className={cn(
                'absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                isResizing && 'opacity-100'
              )}
              onMouseDown={(e) => handleMouseDown(e, column.key)}
            >
              <div className={cn(
                'h-6 w-1 bg-primary/30 rounded-full',
                isResizing && 'bg-primary'
              )} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
