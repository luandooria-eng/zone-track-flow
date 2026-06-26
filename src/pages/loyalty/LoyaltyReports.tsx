import { useState, useMemo } from 'react';
import { useLoyaltyLedger, useLoyaltyVouchers } from '@/hooks/useLoyaltyData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { Download, FileSpreadsheet, BarChart3 } from 'lucide-react';

function exportCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) { toast.error('Nenhum dado para exportar'); return; }
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(';'), ...rows.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast.success('Arquivo exportado!');
}

export default function LoyaltyReports() {
  const { data: ledger } = useLoyaltyLedger();
  const { data: vouchers } = useLoyaltyVouchers();

  const [reportType, setReportType] = useState('ledger');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [originFilter, setOriginFilter] = useState('');

  const filteredLedger = useMemo(() => {
    if (!ledger) return [];
    return ledger.filter((e: any) => {
      const d = new Date(e.created_at);
      if (dateFrom && isBefore(d, startOfDay(parseISO(dateFrom)))) return false;
      if (dateTo && isAfter(d, endOfDay(parseISO(dateTo)))) return false;
      if (originFilter && originFilter !== 'all' && e.origin !== originFilter) return false;
      return true;
    });
  }, [ledger, dateFrom, dateTo, originFilter]);

  const filteredVouchers = useMemo(() => {
    if (!vouchers) return [];
    return vouchers.filter((v: any) => {
      const d = new Date(v.created_at);
      if (dateFrom && isBefore(d, startOfDay(parseISO(dateFrom)))) return false;
      if (dateTo && isAfter(d, endOfDay(parseISO(dateTo)))) return false;
      return true;
    });
  }, [vouchers, dateFrom, dateTo]);

  const handleExport = () => {
    if (reportType === 'ledger') {
      exportCSV(filteredLedger.map((e: any) => ({
        Data: format(new Date(e.created_at), 'dd/MM/yyyy HH:mm'),
        Cliente: e.customer?.name || '',
        Telefone: e.customer?.phone || '',
        Tipo: e.type,
        Pontos: e.points,
        Origem: e.origin,
        Descricao: e.description || '',
      })), `extrato-pontos-${format(new Date(), 'yyyy-MM-dd')}`);
    } else {
      exportCSV(filteredVouchers.map((v: any) => ({
        Data: format(new Date(v.created_at), 'dd/MM/yyyy HH:mm'),
        Codigo: v.code,
        Cliente: v.customer?.name || '',
        Telefone: v.customer?.phone || '',
        Cupom: v.coupon?.title || '',
        Pontos: v.points_spent,
        Status: v.status,
      })), `vouchers-${format(new Date(), 'yyyy-MM-dd')}`);
    }
  };

  // Summary stats
  const totalCredits = filteredLedger.filter((e: any) => e.type === 'credit').reduce((s: number, e: any) => s + e.points, 0);
  const totalDebits = filteredLedger.filter((e: any) => e.type === 'debit').reduce((s: number, e: any) => s + e.points, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Relatórios Fidelidade
          </h1>
          <p className="text-sm text-muted-foreground">Filtre e exporte dados do programa</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Relatório</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-44 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ledger">Extrato de Pontos</SelectItem>
                  <SelectItem value="vouchers">Vouchers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 w-40" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 w-40" />
            </div>
            {reportType === 'ledger' && (
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {reportType === 'ledger' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Lançamentos</p>
              <p className="text-2xl font-bold text-foreground">{filteredLedger.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Créditos</p>
              <p className="text-2xl font-bold text-primary">+{totalCredits.toLocaleString('pt-BR')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">Débitos</p>
              <p className="text-2xl font-bold text-destructive">-{totalDebits.toLocaleString('pt-BR')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {reportType === 'ledger' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredLedger.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum resultado</TableCell></TableRow>
                ) : filteredLedger.slice(0, 100).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{format(new Date(e.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{e.customer?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{e.customer?.phone}</p>
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredVouchers.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum resultado</TableCell></TableRow>
                ) : filteredVouchers.slice(0, 100).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs">{format(new Date(v.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="font-mono text-sm">{v.code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{v.customer?.name || '—'}</p>
                    </TableCell>
                    <TableCell className="text-sm">{v.coupon?.title || '—'}</TableCell>
                    <TableCell className="text-sm">{v.points_spent}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'active' ? 'default' : v.status === 'validated' ? 'secondary' : 'destructive'}>
                        {v.status === 'active' ? 'Ativo' : v.status === 'validated' ? 'Validado' : 'Estornado'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
