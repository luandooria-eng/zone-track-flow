import { format } from 'date-fns';
import { History, Undo2, Redo2, Clock, ArrowLeft } from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UndoHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UndoHistoryPanel({ open, onOpenChange }: UndoHistoryPanelProps) {
  const { undoStack, redoStack, undo, redo } = useDailyGridStore();

  const getActionLabel = (type: string): string => {
    switch (type) {
      case 'cell_edit':
        return 'Edição de célula';
      case 'row_delete':
        return 'Exclusão de linha';
      case 'row_add':
        return 'Adição de linha';
      case 'batch_edit':
        return 'Edição em lote';
      case 'paste':
        return 'Colar dados';
      default:
        return type;
    }
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      customerName: 'Cliente',
      productName: 'Produto',
      quantity: 'Quantidade',
      paymentMethod: 'Forma de Pagamento',
      channel: 'Canal',
      deliverer: 'Entregador',
      value: 'Valor',
      address: 'Endereço',
      neighborhood: 'Bairro',
      status: 'Status',
    };
    return labels[key] || key;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '(vazio)';
    if (typeof value === 'number') return value.toString();
    return String(value);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={undoStack.length === 0}
            >
              <Undo2 className="mr-1 h-4 w-4" />
              Desfazer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={redoStack.length === 0}
            >
              <Redo2 className="mr-1 h-4 w-4" />
              Refazer
            </Button>
          </div>

          {/* Undo stack */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Ações para Desfazer ({undoStack.length})
            </h3>
            <ScrollArea className="h-[250px]">
              <div className="space-y-2 pr-4">
                {undoStack.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma ação para desfazer
                  </p>
                ) : (
                  [...undoStack].reverse().map((action, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-3 rounded-lg border bg-card',
                        idx === 0 && 'border-primary/50 bg-primary/5'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {getActionLabel(action.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(action.timestamp, 'HH:mm:ss')}
                        </span>
                      </div>
                      {action.columnKey && (
                        <div className="text-sm mt-2">
                          <span className="text-muted-foreground">
                            Linha {action.rowIndex + 1} •{' '}
                          </span>
                          <span className="font-medium">
                            {getFieldLabel(action.columnKey)}
                          </span>
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-destructive line-through">
                              {formatValue(action.previousValue)}
                            </span>
                            <span>→</span>
                            <span className="text-success">
                              {formatValue(action.newValue)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Redo stack */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Redo2 className="h-4 w-4" />
              Ações para Refazer ({redoStack.length})
            </h3>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2 pr-4">
                {redoStack.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma ação para refazer
                  </p>
                ) : (
                  [...redoStack].reverse().map((action, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {getActionLabel(action.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(action.timestamp, 'HH:mm:ss')}
                        </span>
                      </div>
                      {action.columnKey && (
                        <div className="text-xs text-muted-foreground">
                          Linha {action.rowIndex + 1} • {getFieldLabel(action.columnKey)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
