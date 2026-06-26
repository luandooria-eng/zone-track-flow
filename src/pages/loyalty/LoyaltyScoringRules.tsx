import { useState, useEffect } from 'react';
import { useScoringRules, useUpsertScoringRule } from '@/hooks/useLoyaltyData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';

const RULE_TYPES: Record<string, string> = {
  fixed: 'Pontos fixos',
  per_value: 'Por valor (R$/ponto)',
  multiplier: 'Multiplicador',
};

export default function LoyaltyScoringRules() {
  const { data: rules, isLoading } = useScoringRules();
  const upsert = useUpsertScoringRule();
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form
  const [productId, setProductId] = useState('');
  const [ruleType, setRuleType] = useState('fixed');
  const [pointsValue, setPointsValue] = useState('');
  const [minValue, setMinValue] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  const openNew = () => {
    setEditing(null);
    setProductId('');
    setRuleType('fixed');
    setPointsValue('');
    setMinValue('');
    setIsActive(true);
    setOpen(true);
  };

  const openEdit = (rule: any) => {
    setEditing(rule);
    setProductId(rule.product_id || '');
    setRuleType(rule.rule_type);
    setPointsValue(String(rule.points_value));
    setMinValue(String(rule.min_purchase_value || ''));
    setIsActive(rule.is_active);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!productId || !pointsValue) {
      toast.error('Preencha produto e valor');
      return;
    }
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      product_id: productId || null,
      rule_type: ruleType,
      points_value: parseFloat(pointsValue),
      min_purchase_value: parseFloat(minValue) || 0,
      is_active: isActive,
    });
    toast.success(editing ? 'Regra atualizada' : 'Regra criada');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Regras de Pontuação</h1>
          <p className="text-sm text-muted-foreground">Configure quantos pontos cada produto gera</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Regra</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Mín. Compra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !rules?.length ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma regra configurada</TableCell></TableRow>
              ) : rules.map((rule: any) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.product?.name || '—'}</TableCell>
                  <TableCell>{RULE_TYPES[rule.rule_type] || rule.rule_type}</TableCell>
                  <TableCell>{rule.points_value}</TableCell>
                  <TableCell>R$ {Number(rule.min_purchase_value || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                      {rule.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(rule)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Regra' : 'Nova Regra'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Regra</Label>
              <Select value={ruleType} onValueChange={setRuleType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Pontos Fixos</SelectItem>
                  <SelectItem value="per_value">Por Valor (R$/ponto)</SelectItem>
                  <SelectItem value="multiplier">Multiplicador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <Input type="number" value={pointsValue} onChange={(e) => setPointsValue(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Valor Mínimo de Compra (R$)</Label>
              <Input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
