import { useState } from 'react';
import { 
  Search, 
  Trash2, 
  ClipboardPaste, 
  Copy,
  Edit3,
  CheckSquare,
  Square
} from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { BatchEditModal } from './BatchEditModal';

interface GridToolbarProps {
  onOpenBatchEdit?: () => void;
}

export function GridToolbar({ onOpenBatchEdit }: GridToolbarProps) {
  const [search, setSearch] = useState('');
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  
  const {
    selectedRows,
    clearSelection,
    selectAllRows,
    deleteSelectedRows,
    rows,
    dirtyRowCount,
    currentSheet,
    selectedCell,
    pasteFromClipboard,
    copySelectedCells,
  } = useDailyGridStore();

  const isLocked = currentSheet?.status === 'locked';
  const hasSelection = selectedRows.size > 0;

  const handleDeleteSelected = () => {
    if (isLocked) return;
    
    const count = selectedRows.size;
    deleteSelectedRows();
    
    toast({
      title: 'Linhas removidas',
      description: `${count} linhas foram removidas.`,
    });
  };

  const handlePaste = async () => {
    if (isLocked) return;
    
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length > 0) {
        const startRow = selectedCell?.row ?? 0;
        const startCol = selectedCell?.col ?? 0;
        
        pasteFromClipboard(text, startRow, startCol);
        
        toast({
          title: 'Dados colados',
          description: `${lines.length} linha(s) coladas com sucesso.`,
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao colar',
        description: 'Não foi possível acessar o clipboard.',
      });
    }
  };

  const handleCopy = async () => {
    const text = copySelectedCells();
    if (text) {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copiado',
        description: 'Dados copiados para o clipboard.',
      });
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      clearSelection();
    } else {
      selectAllRows();
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
        <div className="flex items-center gap-3">
          {/* Select all checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedRows.size === rows.length && rows.length > 0}
              onCheckedChange={handleToggleSelectAll}
              className="h-4 w-4"
            />
            <span className="text-sm text-muted-foreground">
              {selectedRows.size > 0 
                ? `${selectedRows.size}/${rows.length}` 
                : 'Selecionar'}
            </span>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no grid..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-64"
            />
          </div>

          {/* Selection actions */}
          {hasSelection && !isLocked && (
            <>
              <div className="h-6 w-px bg-border" />
              <Badge variant="secondary" className="gap-1">
                <CheckSquare className="h-3 w-3" />
                {selectedRows.size} selecionadas
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchEditOpen(true)}
              >
                <Edit3 className="mr-1 h-4 w-4" />
                Editar em lote
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteSelected}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Excluir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                Limpar seleção
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Dirty indicator */}
          {dirtyRowCount > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning-foreground border-warning/30">
              {dirtyRowCount} alterações pendentes
            </Badge>
          )}

          {/* Clipboard actions */}
          {!isLocked && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                disabled={selectedRows.size === 0 && !selectedCell}
                title="Copiar (Ctrl+C)"
              >
                <Copy className="mr-1 h-4 w-4" />
                Copiar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePaste}
                title="Colar do clipboard (Ctrl+V)"
              >
                <ClipboardPaste className="mr-1 h-4 w-4" />
                Colar
              </Button>
            </>
          )}
        </div>
      </div>

      <BatchEditModal 
        open={batchEditOpen} 
        onOpenChange={setBatchEditOpen} 
      />
    </>
  );
}
