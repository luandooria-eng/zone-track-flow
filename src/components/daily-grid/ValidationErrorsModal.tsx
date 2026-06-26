import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, RefreshCw, X } from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ValidationErrorsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToRow: (rowIndex: number) => void;
}

export function ValidationErrorsModal({
  open,
  onOpenChange,
  onNavigateToRow,
}: ValidationErrorsModalProps) {
  const { rows, saveDirtyRows, validateAll } = useDailyGridStore();

  const errorRows = useMemo(() => {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.errors && Object.keys(row.errors).length > 0);
  }, [rows]);

  const handleNavigate = (rowIndex: number) => {
    onNavigateToRow(rowIndex);
    onOpenChange(false);
  };

  const handleRevalidate = () => {
    validateAll();
  };

  const handleRetry = async () => {
    await saveDirtyRows();
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
    };
    return labels[key] || key;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Erros de Validação
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {errorRows.length} linha(s) com erros que precisam ser corrigidos antes de salvar.
          </p>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {errorRows.map(({ row, index }) => (
                <div
                  key={row.row_uuid}
                  className={cn(
                    'p-4 rounded-lg border bg-card',
                    'border-destructive/30 bg-destructive/5'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          Linha {index + 1}
                        </Badge>
                        {row.customerName && (
                          <span className="text-sm font-medium">
                            {row.customerName}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {row.errors && Object.entries(row.errors).map(([field, message]) => (
                          <div
                            key={field}
                            className="flex items-center gap-2 text-sm text-destructive"
                          >
                            <X className="h-3 w-3 flex-shrink-0" />
                            <span className="font-medium">{getFieldLabel(field)}:</span>
                            <span>{message}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleNavigate(index)}
                      className="flex-shrink-0"
                    >
                      Ir para linha
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {errorRows.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum erro encontrado.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleRevalidate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Revalidar
          </Button>
          <Button
            onClick={handleRetry}
            disabled={errorRows.length > 0}
          >
            Salvar Corrigidos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
