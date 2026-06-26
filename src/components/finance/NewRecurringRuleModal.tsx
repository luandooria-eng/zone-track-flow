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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVendors, useExpenseCategories, useCreateRecurringRule } from '@/hooks/useFinanceData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewRecurringRuleModal({ open, onOpenChange }: Props) {
  const { data: vendors } = useVendors();
  const { data: categories } = useExpenseCategories();
  const createRule = useCreateRecurringRule();

  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'payroll',
    name: '',
    amount_default: '',
    day_of_month: '5',
    category_id: '',
    vendor_id: '',
  });

  const filteredCategories = (categories || []).filter(c => 
    formData.type === 'payroll' ? c.type === 'payroll' : c.type === 'expense'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createRule.mutate({
      type: formData.type,
      name: formData.name,
      amount_default: parseFloat(formData.amount_default),
      day_of_month: parseInt(formData.day_of_month),
      category_id: formData.category_id || null,
      vendor_id: formData.vendor_id || null,
      is_active: true,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          type: 'expense',
          name: '',
          amount_default: '',
          day_of_month: '5',
          category_id: '',
          vendor_id: '',
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Recorrência</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: 'expense' | 'payroll') => 
                setFormData(prev => ({ ...prev, type: value, category_id: '' }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa Fixa</SelectItem>
                <SelectItem value="payroll">Salário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              placeholder={formData.type === 'payroll' ? 'Nome do funcionário' : 'Nome da despesa'}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Padrão (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.amount_default}
                onChange={(e) => setFormData(prev => ({ ...prev, amount_default: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Dia do Vencimento *</Label>
              <Input
                type="number"
                min="1"
                max="31"
                placeholder="5"
                value={formData.day_of_month}
                onChange={(e) => setFormData(prev => ({ ...prev, day_of_month: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select 
              value={formData.category_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.type === 'expense' && (
            <div className="space-y-2">
              <Label>Fornecedor (opcional)</Label>
              <Select 
                value={formData.vendor_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, vendor_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {(vendors || []).map(vendor => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createRule.isPending}>
              {createRule.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
