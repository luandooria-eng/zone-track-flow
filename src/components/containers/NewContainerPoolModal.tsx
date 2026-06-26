import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateContainerPool } from '@/hooks/useContainerData';

interface NewContainerPoolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewContainerPoolModal({ open, onOpenChange }: NewContainerPoolModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'galao_20l',
    total_physical_qty: 0,
    unit_value: 0,
  });
  
  const createPool = useCreateContainerPool();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.total_physical_qty <= 0) return;
    
    createPool.mutate({
      name: formData.name,
      type: formData.type,
      total_physical_qty: formData.total_physical_qty,
      unit_value: formData.unit_value,
      is_active: true,
    }, {
      onSuccess: () => {
        setFormData({ name: '', type: 'galao_20l', total_physical_qty: 0, unit_value: 0 });
        onOpenChange(false);
      }
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Pool de Vasilhames</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Pool *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Galões de Água 20L"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Vasilhame *</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="galao_20l">Galão 20L</SelectItem>
                <SelectItem value="galao_10l">Galão 10L</SelectItem>
                <SelectItem value="botijao_13kg">Botijão 13kg</SelectItem>
                <SelectItem value="botijao_45kg">Botijão 45kg</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="total_qty">Quantidade Física Total (Pool) *</Label>
            <Input
              id="total_qty"
              type="number"
              min={1}
              value={formData.total_physical_qty || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, total_physical_qty: parseInt(e.target.value) || 0 }))}
              placeholder="1000"
            />
            <p className="text-xs text-muted-foreground">
              Inicialmente todos serão registrados como "vazios".
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="unit_value">Valor Unitário (R$)</Label>
            <Input
              id="unit_value"
              type="number"
              step="0.01"
              min={0}
              value={formData.unit_value || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, unit_value: parseFloat(e.target.value) || 0 }))}
              placeholder="45.00"
            />
            <p className="text-xs text-muted-foreground">
              Usado para calcular o custo de quebras.
            </p>
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createPool.isPending}>
              {createPool.isPending ? 'Criando...' : 'Criar Pool'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
