import { useState } from 'react';
import { useLoyaltyVouchers, useValidateVoucher, useReverseVoucher } from '@/hooks/useLoyaltyData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, CheckCircle, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active: { label: 'Ativo', variant: 'default' },
  validated: { label: 'Validado', variant: 'secondary' },
  reversed: { label: 'Estornado', variant: 'destructive' },
};

export default function LoyaltyVouchers() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const { data: vouchers, isLoading } = useLoyaltyVouchers({ search, status: filterStatus });
  const validate = useValidateVoucher();
  const reverse = useReverseVoucher();
  const [confirmVoucher, setConfirmVoucher] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<'validate' | 'reverse'>('validate');

  const handleAction = async () => {
    if (!confirmVoucher || !user) return;
    try {
      if (confirmAction === 'validate') {
        await validate.mutateAsync({ voucher_id: confirmVoucher.id, operator_id: user.id });
        toast.success('Voucher validado!');
      } else {
        await reverse.mutateAsync({
          voucher_id: confirmVoucher.id,
          operator_id: user.id,
          customer_id: confirmVoucher.customer_id || confirmVoucher.customer?.id,
          points: confirmVoucher.points_spent,
        });
        toast.success('Voucher estornado!');
      }
    } catch {
      toast.error('Erro na operação');
    }
    setConfirmVoucher(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Validar Vouchers</h1>
        <p className="text-sm text-muted-foreground">Pesquise e valide ou estorne vouchers emitidos</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar código, telefone ou nome…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['', 'active', 'validated', 'reversed'].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? 'default' : 'outline'}
              onClick={() => setFilterStatus(s)}
            >
              {s ? STATUS_MAP[s]?.label : 'Todos'}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cupom</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Resgate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !vouchers?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum voucher encontrado</TableCell></TableRow>
              ) : vouchers.map((v: any) => {
                const st = STATUS_MAP[v.status] || { label: v.status, variant: 'secondary' as const };
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono font-medium">{v.code}</TableCell>
                    <TableCell>{v.customer?.name || '—'}</TableCell>
                    <TableCell>{v.coupon?.title || '—'}</TableCell>
                    <TableCell>{v.points_spent}</TableCell>
                    <TableCell>{format(new Date(v.redeemed_at || v.created_at), 'dd/MM HH:mm')}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {v.status === 'active' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={() => { setConfirmVoucher(v); setConfirmAction('validate'); }}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {v.status !== 'reversed' && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { setConfirmVoucher(v); setConfirmAction('reverse'); }}>
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmVoucher} onOpenChange={() => setConfirmVoucher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'validate' ? 'Validar Voucher' : 'Estornar Voucher'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'validate'
                ? `Confirma validação do voucher ${confirmVoucher?.code}?`
                : `Confirma estorno do voucher ${confirmVoucher?.code}? Os pontos serão devolvidos ao cliente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
