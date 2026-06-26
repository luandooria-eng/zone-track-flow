import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpsertMonthlyBonus, useContainerMovements } from '@/hooks/useContainerData';
import { format } from 'date-fns';
import type { ContainerPoolWithBalance, BonusStatus } from '@/types/containers';
import { Gift, Calculator } from 'lucide-react';

interface MonthlyBonusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: ContainerPoolWithBalance | null;
}

export function MonthlyBonusModal({ open, onOpenChange, pool }: MonthlyBonusModalProps) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  const [formData, setFormData] = useState({
    competence_month: currentMonth,
    qty_filled: 0,
    bonus_percent: 2, // Default 2%
    bonus_qty: 0,
    bonus_value_brl: 0,
    status: 'predicted' as BonusStatus,
    notes: '',
  });
  
  const upsertBonus = useUpsertMonthlyBonus();
  
  // Fetch FILL movements for this month to auto-calculate qty_filled
  const { data: movements } = useContainerMovements(pool?.id, 1000);
  
  useEffect(() => {
    if (open && pool && movements) {
      const startOfMonth = `${formData.competence_month}-01`;
      const fillMovements = movements.filter(m => 
        m.movement_type === 'FILL' && 
        m.created_at >= startOfMonth
      );
      const totalFilled = fillMovements.reduce((sum, m) => sum + m.qty, 0);
      
      setFormData(prev => ({
        ...prev,
        qty_filled: totalFilled,
        bonus_qty: Math.floor(totalFilled * (prev.bonus_percent / 100)),
        bonus_value_brl: Math.floor(totalFilled * (prev.bonus_percent / 100)) * (pool.unit_value || 0),
      }));
    }
  }, [open, pool, movements, formData.competence_month]);
  
  // Recalculate when percent changes
  useEffect(() => {
    const bonusQty = Math.floor(formData.qty_filled * (formData.bonus_percent / 100));
    const bonusValue = bonusQty * (pool?.unit_value || 0);
    setFormData(prev => ({
      ...prev,
      bonus_qty: bonusQty,
      bonus_value_brl: bonusValue,
    }));
  }, [formData.bonus_percent, formData.qty_filled, pool?.unit_value]);
  
  if (!pool) return null;
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    upsertBonus.mutate({
      pool_id: pool.id,
      competence_month: formData.competence_month,
      qty_filled: formData.qty_filled,
      bonus_percent: formData.bonus_percent,
      bonus_qty: formData.bonus_qty,
      bonus_value_brl: formData.bonus_value_brl,
      status: formData.status,
      notes: formData.notes || null,
      created_by: null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };
  
  // Generate last 12 months for selection
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    monthOptions.push(format(date, 'yyyy-MM'));
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-500" />
            Registrar Bonificação
          </DialogTitle>
          <DialogDescription>
            Bonificação mensal por envase para {pool.name}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Month selection */}
          <div className="space-y-2">
            <Label>Competência (Mês) *</Label>
            <Select 
              value={formData.competence_month} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, competence_month: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(month => (
                  <SelectItem key={month} value={month}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Qty Filled */}
          <div className="space-y-2">
            <Label htmlFor="qty_filled">Quantidade Envasada no Mês</Label>
            <Input
              id="qty_filled"
              type="number"
              min={0}
              value={formData.qty_filled}
              onChange={(e) => setFormData(prev => ({ ...prev, qty_filled: parseInt(e.target.value) || 0 }))}
            />
            <p className="text-xs text-muted-foreground">
              Calculado automaticamente com base nos envases registrados.
            </p>
          </div>
          
          {/* Bonus Percent */}
          <div className="space-y-2">
            <Label htmlFor="bonus_percent">% de Bonificação</Label>
            <Input
              id="bonus_percent"
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={formData.bonus_percent}
              onChange={(e) => setFormData(prev => ({ ...prev, bonus_percent: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          
          {/* Calculated values */}
          <div className="bg-green-50 dark:bg-green-950/30 rounded-md p-4 space-y-2">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Calculator className="h-4 w-4" />
              <span className="font-medium">Cálculo da Bonificação</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Quantidade:</span>
              <span className="font-medium">{formData.bonus_qty} unidades</span>
              <span className="text-muted-foreground">Valor estimado:</span>
              <span className="font-bold text-green-600">R$ {formData.bonus_value_brl.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as BonusStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="predicted">Previsto</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Detalhes adicionais..."
              rows={2}
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={upsertBonus.isPending}>
              {upsertBonus.isPending ? 'Salvando...' : 'Salvar Bonificação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
