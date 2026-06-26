import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateContainerMovement } from '@/hooks/useContainerData';
import type { ContainerPoolWithBalance, MovementType, ContainerState } from '@/types/containers';
import { Droplets, RotateCcw, Trash2, ShoppingCart } from 'lucide-react';

interface ContainerMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: MovementType | null;
  pool: ContainerPoolWithBalance | null;
}

const movementConfig: Record<MovementType, {
  title: string;
  description: string;
  icon: React.ReactNode;
  showFromState?: boolean;
  showToState?: boolean;
}> = {
  'FILL': {
    title: 'Registrar Envase',
    description: 'Transformar vasilhames vazios em cheios.',
    icon: <Droplets className="h-5 w-5 text-blue-500" />,
  },
  'RETURN': {
    title: 'Registrar Retorno',
    description: 'Vasilhames que voltaram do cliente (Em Campo → Vazio).',
    icon: <RotateCcw className="h-5 w-5 text-green-500" />,
  },
  'BREAKAGE': {
    title: 'Registrar Quebra',
    description: 'Reduz o pool total. Selecione o estado do vasilhame quebrado.',
    icon: <Trash2 className="h-5 w-5 text-destructive" />,
    showFromState: true,
  },
  'PURCHASE': {
    title: 'Registrar Compra',
    description: 'Adiciona novos vasilhames ao pool (entram como vazios).',
    icon: <ShoppingCart className="h-5 w-5 text-primary" />,
  },
  'SALE_TO_FIELD': {
    title: 'Saída para Campo',
    description: 'Vasilhames cheios que saíram para entrega.',
    icon: <Droplets className="h-5 w-5 text-orange-500" />,
  },
  'ADJUSTMENT': {
    title: 'Ajuste Manual',
    description: 'Correção de saldo.',
    icon: <Droplets className="h-5 w-5 text-muted-foreground" />,
    showToState: true,
  },
};

export function ContainerMovementModal({ 
  open, 
  onOpenChange, 
  movementType, 
  pool 
}: ContainerMovementModalProps) {
  const [qty, setQty] = useState<number>(0);
  const [fromState, setFromState] = useState<ContainerState>('empty');
  const [toState, setToState] = useState<ContainerState>('empty');
  const [notes, setNotes] = useState('');
  
  const createMovement = useCreateContainerMovement();
  
  useEffect(() => {
    if (open) {
      setQty(0);
      setFromState('empty');
      setToState('empty');
      setNotes('');
    }
  }, [open]);
  
  if (!movementType || !pool) return null;
  
  const config = movementConfig[movementType];
  
  // Calculate max allowed based on movement type
  const getMaxQty = () => {
    switch (movementType) {
      case 'FILL':
        return pool.balance.qty_empty;
      case 'RETURN':
        return pool.balance.qty_in_field;
      case 'SALE_TO_FIELD':
        return pool.balance.qty_full;
      case 'BREAKAGE':
        if (fromState === 'full') return pool.balance.qty_full;
        if (fromState === 'empty') return pool.balance.qty_empty;
        if (fromState === 'in_field') return pool.balance.qty_in_field;
        return 0;
      default:
        return 9999;
    }
  };
  
  const maxQty = getMaxQty();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (qty <= 0 || qty > maxQty) return;
    
    createMovement.mutate({
      pool_id: pool.id,
      movement_type: movementType,
      qty,
      from_state: config.showFromState ? fromState : null,
      to_state: config.showToState ? toState : null,
      notes: notes || null,
      related_order_id: null,
      created_by: null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pool info */}
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-sm font-medium">{pool.name}</p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
              <span>Cheios: {pool.balance.qty_full}</span>
              <span>Vazios: {pool.balance.qty_empty}</span>
              <span>Em Campo: {pool.balance.qty_in_field}</span>
            </div>
          </div>
          
          {/* From State (for breakage) */}
          {config.showFromState && (
            <div className="space-y-2">
              <Label>Estado do vasilhame *</Label>
              <Select value={fromState} onValueChange={(v) => setFromState(v as ContainerState)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Cheio ({pool.balance.qty_full} disp.)</SelectItem>
                  <SelectItem value="empty">Vazio ({pool.balance.qty_empty} disp.)</SelectItem>
                  <SelectItem value="in_field">Em Campo ({pool.balance.qty_in_field} disp.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* To State (for adjustment) */}
          {config.showToState && (
            <div className="space-y-2">
              <Label>Ajustar para estado *</Label>
              <Select value={toState} onValueChange={(v) => setToState(v as ContainerState)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Cheio</SelectItem>
                  <SelectItem value="empty">Vazio</SelectItem>
                  <SelectItem value="in_field">Em Campo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="qty">Quantidade *</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={maxQty}
              value={qty || ''}
              onChange={(e) => setQty(parseInt(e.target.value) || 0)}
              placeholder="0"
            />
            {movementType !== 'PURCHASE' && movementType !== 'ADJUSTMENT' && (
              <p className="text-xs text-muted-foreground">
                Máximo disponível: {maxQty}
              </p>
            )}
          </div>
          
          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motivo, responsável, etc."
              rows={2}
            />
          </div>
          
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createMovement.isPending || qty <= 0 || qty > maxQty}
            >
              {createMovement.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
