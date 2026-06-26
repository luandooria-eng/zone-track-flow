import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInsertLedgerEntry, useScoringRules, useLoyaltyLedger } from '@/hooks/useLoyaltyData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function LoyaltyRegisterSale() {
  const { user } = useAuth();
  const insertLedger = useInsertLedgerEntry();
  const { data: rules } = useScoringRules();
  const { data: recentEntries, refetch: refetchLedger } = useLoyaltyLedger();

  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [productId, setProductId] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [showMiniCadastro, setShowMiniCadastro] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  // Load products
  useEffect(() => {
    supabase.from('products').select('id, name, price').eq('is_active', true).order('name').then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  // Search customer by phone
  const searchCustomer = async () => {
    if (!phone.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, points_balance')
      .or(`phone.ilike.%${phone.trim()}%`)
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setCustomer(data);
    } else {
      setCustomer(null);
      setShowMiniCadastro(true);
    }
    setSearching(false);
  };

  // Calculate points based on rules
  const calculatePoints = (): number => {
    if (!productId || !rules) return 0;
    const rule = rules.find((r: any) => r.product_id === productId && r.is_active);
    if (!rule) return 0;

    const value = parseFloat(saleValue) || 0;
    if (rule.min_purchase_value && value < Number(rule.min_purchase_value)) return 0;

    switch (rule.rule_type) {
      case 'fixed':
        return Number(rule.points_value);
      case 'per_value':
        return Math.floor(value / Number(rule.points_value));
      case 'multiplier':
        return Math.floor(value * Number(rule.points_value));
      default:
        return Number(rule.points_value);
    }
  };

  const points = calculatePoints();

  const handleSave = async () => {
    if (!customer || !productId) {
      toast.error('Selecione cliente e produto');
      return;
    }
    if (points <= 0) {
      toast.error('Nenhum ponto será gerado com esses parâmetros');
      return;
    }

    setSaving(true);
    try {
      const product = products.find((p) => p.id === productId);
      await insertLedger.mutateAsync({
        customer_id: customer.id,
        type: 'credit',
        points,
        origin: 'sale',
        description: `Venda: ${product?.name || 'Produto'} — R$ ${saleValue || product?.price}`,
        operator_id: user?.id,
      });
      toast.success(`+${points} pontos para ${customer.name}`);
      // Reset
      setProductId('');
      setSaleValue('');
      refetchLedger();
    } catch {
      toast.error('Erro ao registrar venda');
    }
    setSaving(false);
  };

  // Mini cadastro
  const handleCreateCustomer = async () => {
    if (!newName.trim() || !phone.trim()) return;
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: newName.trim(), phone: phone.trim() } as any)
      .select()
      .single();
    if (error) {
      toast.error('Erro ao criar cliente');
      return;
    }
    setCustomer(data);
    setShowMiniCadastro(false);
    setNewName('');
    toast.success('Cliente criado!');
  };

  // Reverse entry
  const handleReverse = async (entry: any) => {
    try {
      await insertLedger.mutateAsync({
        customer_id: entry.customer_id,
        type: entry.type === 'credit' ? 'debit' : 'credit',
        points: entry.points,
        origin: 'reversal',
        description: `Estorno: ${entry.description || ''}`,
        reference_id: entry.id,
        operator_id: user?.id,
      });
      toast.success('Lançamento estornado');
      refetchLedger();
    } catch {
      toast.error('Erro ao estornar');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Registrar Venda — Fidelidade</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <Card>
          <CardHeader><CardTitle className="text-base">Nova Venda</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Phone search */}
            <div>
              <Label>Telefone do Cliente</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
                />
                <Button size="icon" variant="outline" onClick={searchCustomer} disabled={searching}>
                  <Search className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => setShowMiniCadastro(true)}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {customer && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium text-foreground">{customer.name}</p>
                <p className="text-xs text-muted-foreground">{customer.phone}</p>
                <Badge className="mt-1">{customer.points_balance ?? 0} pontos</Badge>
              </motion.div>
            )}

            {/* Product */}
            <div>
              <Label>Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — R$ {Number(p.price).toFixed(2)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sale value */}
            <div>
              <Label>Valor da Venda (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Points preview */}
            {points > 0 && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-3"
              >
                <span className="text-3xl font-bold text-primary">+{points}</span>
                <p className="text-xs text-muted-foreground">pontos serão creditados</p>
              </motion.div>
            )}

            <Button className="w-full" onClick={handleSave} disabled={saving || !customer || !productId}>
              {saving ? 'Salvando…' : 'Registrar Venda'}
            </Button>
          </CardContent>
        </Card>

        {/* Right: Recent entries */}
        <Card>
          <CardHeader><CardTitle className="text-base">Últimos Lançamentos</CardTitle></CardHeader>
          <CardContent>
            <AnimatePresence>
              {recentEntries?.slice(0, 10).map((entry: any) => (
                <motion.div
                  key={entry.id}
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.customer?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(entry.created_at), 'dd/MM HH:mm')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={entry.type === 'credit' ? 'default' : 'destructive'}>
                      {entry.type === 'credit' ? '+' : '-'}{entry.points}
                    </Badge>
                    {entry.origin !== 'reversal' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleReverse(entry)}>
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {!recentEntries?.length && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento recente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mini Cadastro Dialog */}
      <Dialog open={showMiniCadastro} onOpenChange={setShowMiniCadastro}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" placeholder="Nome completo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMiniCadastro(false)}>Cancelar</Button>
            <Button onClick={handleCreateCustomer} disabled={!newName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
