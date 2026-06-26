import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDataStore } from '@/stores/dataStore';
import { toast } from 'sonner';

interface NewNeighborhoodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewNeighborhoodModal({ open, onOpenChange }: NewNeighborhoodModalProps) {
  const { addNeighborhood } = useDataStore();
  const [formData, setFormData] = useState({
    name: '',
    active: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    addNeighborhood({
      name: formData.name,
      active: formData.active,
    });

    toast.success('Bairro cadastrado com sucesso!');
    setFormData({ name: '', active: true });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Bairro</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Bairro *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Centro, Vila Nova..."
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Ativo</Label>
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Cadastrar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
