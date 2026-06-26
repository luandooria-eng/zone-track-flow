import { useState, useMemo } from 'react';
import { useLoyaltyLedger, useInsertLedgerEntry } from '@/hooks/useLoyaltyData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, parseISO, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { Plus, Search, Download } from 'lucide-react';

function exportCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) { toast.error('Nenhum dado para exportar'); return; }
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(';'), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast.success('Exportado!');
}

export default function LoyaltyExtract() {
  const { user } = useAuth();
  const { data: entries, isLoading } = useLoyaltyLedger();
  const insertLedger = useInsertLedgerEntry();

  const [searchPhone, setSearchPhone] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openManual, setOpenManual] = useState(false);

  // Manual entry form
  const [manualPhone, setManualPhone] = useState('');
  const [manualCustomer, setManualCustomer] = useState<any>(null);
  const [manualType, setManualType] = useState('credit');
  const [manualPoints, setManualPoints] = useState('');
  const [manualReason, setManualReason] = useState('');

  const searchManualCustomer = async () => {
    if (!manualPhone.trim()) return;
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone, points_balance')
      .or(`phone.ilike.%${manualPhone}%`)
      .limit(1)
      .maybeSingle();
    if (data) setManualCustomer(data);
    else toast.error('Cliente não encontrado');
  };

  const handleManualSave = async () => {
    if (!manualCustomer || !manualPoints || !manualReason.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    await insertLedger.mutateAsync({
      customer_id: manualCustomer.id,
      type: manualType,
      points: parseInt(manualPoints),
      origin: 'manual',
      description: manualReason.trim(),
      operator_id: user?.id,
    });
    toast.success('Lançamento manual registrado');
    setOpenManual(false);
    setManualPhone(''); setManualCustomer(null); setManualPoints(''); setManualReason('');
  };

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => {
      if (originFilter && originFilter !== 'all' && e.origin !== originFilter) return false;
      if (typeFilter && typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (searchPhone && !e.customer?.phone?.includes(searchPhone) && !e.customer?.name?.toLowerCase().includes(searchPhone.toLowerCase())) return false;
      const d = new Date(e.created_at);
      if (dateFrom && isBefore(d, startOfDay(parseISO(dateFrom)))) return false;
      if (dateTo && isAfter(d, endOfDay(parseISO(dateTo)))) return false;
      return true;
    });
  }, [entries, originFilter, typeFilter, searchPhone, dateFrom, dateTo]);

  const handleExport = () => {
    exportCSV(filtered.map((e: any) => ({
      Data: format(new Date(e.created_at), 'dd/MM/yyyy HH:mm'),
      Cliente: e.customer?.name || '',
      Telefone: e.customer?.phone || '',
      Tipo: e.type,
      Pontos: e.points,
      Origem: e.origin,
      Descricao: e.description || '',
    })), `extrato-pontos-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extrato de Pontos</h1>
          <p className="text-sm text-muted-foreground">Todas as movimentações do programa de fidelidade</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4 mr-2" />CSV</Button>
          <Button onClick={() => setOpenManual(true)}><Plus className="h-4 w-4 mr-2" />Lançamento Manual</Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Telefone ou nome…" className="pl-10" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <Select value={originFilter} onValueChange={setOriginFilter}>
                <SelectTrigger className="w-36 mt-1"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="sale">Venda</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="redemption">Resgate</SelectItem>
                  <SelectItem value="reversal">Estorno</SelectItem>
                  <SelectItem value="referral">Indicação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32 mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-36" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !filtered?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma movimentação</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{e.customer?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{e.customer?.phone || ''}</p>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{e.origin}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={e.type === 'credit' ? 'default' : 'destructive'}>
                      {e.type === 'credit' ? '+' : '-'}{e.points}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.description || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual Entry Dialog */}
      <Dialog open={openManual} onOpenChange={setOpenManual}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lançamento Manual de Pontos</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Telefone do Cliente</Label>
              <div className="flex gap-2 mt-1">
                <Input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchManualCustomer()} />
                <Button size="icon" variant="outline" onClick={searchManualCustomer}><Search className="h-4 w-4" /></Button>
              </div>
              {manualCustomer && <p className="text-sm mt-1 text-foreground font-medium">{manualCustomer.name} — {manualCustomer.points_balance ?? 0} pts</p>}
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={manualType} onValueChange={setManualType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédito (+)</SelectItem>
                  <SelectItem value="debit">Débito (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Pontos</Label><Input type="number" value={manualPoints} onChange={(e) => setManualPoints(e.target.value)} className="mt-1" /></div>
            <div><Label>Motivo (obrigatório)</Label><Textarea value={manualReason} onChange={(e) => setManualReason(e.target.value)} className="mt-1" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenManual(false)}>Cancelar</Button>
            <Button onClick={handleManualSave} disabled={insertLedger.isPending || !manualCustomer || !manualReason.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
