import { useState } from 'react';
import { Edit3, CheckSquare } from 'lucide-react';
import { useDailyGridStore } from '@/stores/dailyGridStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockPaymentMethods, mockSalesChannels, mockDeliveryPeople, mockProducts } from '@/lib/mockData';
import { toast } from '@/hooks/use-toast';

interface BatchEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EditableField = 'quantity' | 'paymentMethod' | 'channel' | 'deliverer' | 'productName' | 'status';

export function BatchEditModal({ open, onOpenChange }: BatchEditModalProps) {
  const { selectedRows, rows, batchUpdateCells } = useDailyGridStore();
  const [selectedField, setSelectedField] = useState<EditableField>('quantity');
  const [value, setValue] = useState<string>('');

  const fields: { value: EditableField; label: string }[] = [
    { value: 'quantity', label: 'Quantidade' },
    { value: 'productName', label: 'Produto' },
    { value: 'paymentMethod', label: 'Forma de Pagamento' },
    { value: 'channel', label: 'Canal de Venda' },
    { value: 'deliverer', label: 'Entregador' },
    { value: 'status', label: 'Status' },
  ];

  const statusOptions = [
    { value: 'Aceito', label: 'Aceito' },
    { value: 'Enviado', label: 'Enviado' },
    { value: 'Entregue', label: 'Entregue' },
    { value: 'Cancelado', label: 'Cancelado' },
  ];

  const handleApply = () => {
    if (!value) {
      toast({
        variant: 'destructive',
        title: 'Valor obrigatório',
        description: 'Selecione ou digite um valor para aplicar.',
      });
      return;
    }

    const rowIndices = Array.from(selectedRows);
    const finalValue = selectedField === 'quantity' ? Number(value) : value;
    
    batchUpdateCells(rowIndices, selectedField, finalValue);
    
    toast({
      title: 'Edição em lote aplicada',
      description: `${rowIndices.length} linhas atualizadas.`,
    });
    
    onOpenChange(false);
    setValue('');
  };

  const renderValueInput = () => {
    switch (selectedField) {
      case 'quantity':
        return (
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Digite a quantidade"
          />
        );
      case 'productName':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o produto" />
            </SelectTrigger>
            <SelectContent>
              {mockProducts.map((product) => (
                <SelectItem key={product.id} value={product.name}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'paymentMethod':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              {mockPaymentMethods.map((method) => (
                <SelectItem key={method.id} value={method.name}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'channel':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o canal" />
            </SelectTrigger>
            <SelectContent>
              {mockSalesChannels.map((channel) => (
                <SelectItem key={channel.id} value={channel.name}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'deliverer':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o entregador" />
            </SelectTrigger>
            <SelectContent>
              {mockDeliveryPeople.map((person) => (
                <SelectItem key={person.id} value={person.name}>
                  {person.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'status':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Digite o valor"
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edição em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="text-sm">
              <strong>{selectedRows.size}</strong> linhas selecionadas
            </span>
          </div>

          <div className="space-y-2">
            <Label>Campo para editar</Label>
            <Select
              value={selectedField}
              onValueChange={(v) => {
                setSelectedField(v as EditableField);
                setValue('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Novo valor</Label>
            {renderValueInput()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={!value}>
            Aplicar a {selectedRows.size} linhas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
