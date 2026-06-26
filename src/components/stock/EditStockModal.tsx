import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDataStore } from '@/stores/dataStore';
import { Product } from '@/types';
import { toast } from 'sonner';

interface EditStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function EditStockModal({ open, onOpenChange, product }: EditStockModalProps) {
  const { updateStock, updateProduct } = useDataStore();
  const [currentStock, setCurrentStock] = useState('');
  const [minStock, setMinStock] = useState('');

  useEffect(() => {
    if (product) {
      setCurrentStock(product.currentStock.toString());
      setMinStock(product.minStock.toString());
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!product) return;

    const stockValue = parseInt(currentStock) || 0;
    const minValue = parseInt(minStock) || 0;

    updateStock(product.id, stockValue);
    updateProduct(product.id, { minStock: minValue });

    toast.success('Estoque atualizado com sucesso!');
    onOpenChange(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Estoque - {product.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentStock">Estoque Atual</Label>
            <Input
              id="currentStock"
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="minStock">Estoque Mínimo</Label>
            <Input
              id="minStock"
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              placeholder="10"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
