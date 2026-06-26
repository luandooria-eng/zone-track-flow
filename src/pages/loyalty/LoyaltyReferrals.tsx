import { useState } from 'react';
import { useLoyaltyReferrals, useCompleteReferral } from '@/hooks/useLoyaltyReferrals';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, CheckCircle2, Users2 } from 'lucide-react';

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  completed: { label: 'Concluída', variant: 'default' },
  expired: { label: 'Expirada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'secondary' },
};

export default function LoyaltyReferrals() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data: referrals, isLoading } = useLoyaltyReferrals({ status: statusFilter });
  const completeReferral = useCompleteReferral();

  const [completeDialog, setCompleteDialog] = useState<any>(null);
  const [referredPhone, setReferredPhone] = useState('');
  const [referredCustomer, setReferredCustomer] = useState<any>(null);

  const searchReferred = async () => {
    if (!referredPhone.trim()) return;
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, points_balance')
      .or(`phone.ilike.%${referredPhone.trim()}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      setReferredCustomer(data);
    } else {
      toast.error('Cliente indicado não encontrado');
    }
  };

  const handleComplete = async () => {
    if (!completeDialog || !referredCustomer) return;
    try {
      await completeReferral.mutateAsync({
        referral_id: completeDialog.id,
        referred_customer_id: referredCustomer.id,
        referrer_id: completeDialog.referrer_id,
        bonus_referrer: completeDialog.bonus_referrer,
        bonus_referred: completeDialog.bonus_referred,
      });
      toast.success('Indicação concluída — bônus creditados!');
      setCompleteDialog(null);
      setReferredCustomer(null);
      setReferredPhone('');
    } catch {
      toast.error('Erro ao completar indicação');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users2 className="h-6 w-6 text-primary" /> Indicações
        </h1>
        <p className="text-sm text-muted-foreground">Sistema de indicação — bônus após primeira compra do indicado</p>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Todos os status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="expired">Expirada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Indicador</TableHead>
                <TableHead>Tel. Indicado</TableHead>
                <TableHead>Indicado</TableHead>
                <TableHead>Bônus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !referrals?.length ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma indicação registrada</TableCell></TableRow>
              ) : referrals.map((r: any) => {
                const st = statusMap[r.status] || statusMap.pending;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.referral_code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{r.referrer?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{r.referrer?.phone}</p>
                    </TableCell>
                    <TableCell className="text-sm">{r.referred_phone}</TableCell>
                    <TableCell className="text-sm">{r.referred?.name || '—'}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-primary font-medium">+{r.bonus_referrer}</span> / <span className="text-primary font-medium">+{r.bonus_referred}</span>
                    </TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => { setCompleteDialog(r); setReferredPhone(r.referred_phone); }}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Validar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Complete referral dialog */}
      <Dialog open={!!completeDialog} onOpenChange={() => { setCompleteDialog(null); setReferredCustomer(null); setReferredPhone(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Validar Indicação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Indicador: <span className="font-medium text-foreground">{completeDialog?.referrer?.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Bônus: <span className="text-primary font-medium">+{completeDialog?.bonus_referrer} pts</span> indicador / <span className="text-primary font-medium">+{completeDialog?.bonus_referred} pts</span> indicado
            </p>
            <div>
              <Label>Buscar cliente indicado por telefone</Label>
              <div className="flex gap-2 mt-1">
                <Input value={referredPhone} onChange={(e) => setReferredPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchReferred()} />
                <Button size="icon" variant="outline" onClick={searchReferred}><Search className="h-4 w-4" /></Button>
              </div>
              {referredCustomer && (
                <p className="text-sm mt-2 font-medium text-foreground">{referredCustomer.name} — {referredCustomer.points_balance ?? 0} pts</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialog(null)}>Cancelar</Button>
            <Button onClick={handleComplete} disabled={!referredCustomer || completeReferral.isPending}>Confirmar e Creditar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
