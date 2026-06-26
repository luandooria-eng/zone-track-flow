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
import { Textarea } from '@/components/ui/textarea';
import { useCreateVendor } from '@/hooks/useFinanceData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewVendorModal({ open, onOpenChange }: Props) {
  const createVendor = useCreateVendor();

  const [formData, setFormData] = useState({
    name: '',
    document: '',
    phone: '',
    default_terms: '30',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createVendor.mutate({
      name: formData.name,
      document: formData.document || null,
      phone: formData.phone || null,
      default_terms: parseInt(formData.default_terms) || 30,
      notes: formData.notes || null,
      is_active: true,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          name: '',
          document: '',
          phone: '',
          default_terms: '30',
          notes: '',
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Fornecedor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              placeholder="Nome do fornecedor"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ/CPF</Label>
              <Input
                placeholder="00.000.000/0000-00"
                value={formData.document}
                onChange={(e) => setFormData(prev => ({ ...prev, document: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prazo Padrão (dias)</Label>
            <Input
              type="number"
              min="0"
              placeholder="30"
              value={formData.default_terms}
              onChange={(e) => setFormData(prev => ({ ...prev, default_terms: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações sobre o fornecedor..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createVendor.isPending}>
              {createVendor.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
