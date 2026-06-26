import { useState } from 'react';
import { useLoyaltyCampaigns, useUpsertCampaign } from '@/hooks/useLoyaltyGamification';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Megaphone, Plus, Pencil } from 'lucide-react';

const segmentLabels: Record<string, string> = {
  all: 'Todos',
  new: 'Novos Clientes',
  recurring: 'Recorrentes',
  vip: 'VIP (alto gasto)',
};

export default function LoyaltyCampaigns() {
  const { data: campaigns, isLoading } = useLoyaltyCampaigns();
  const upsertCampaign = useUpsertCampaign();
  const [dialog, setDialog] = useState<any>(null);

  const handleSave = async () => {
    if (!dialog) return;
    try {
      await upsertCampaign.mutateAsync({
        ...dialog,
        target_product_ids: dialog.target_product_ids || [],
      });
      toast.success('Campanha salva!');
      setDialog(null);
    } catch { toast.error('Erro ao salvar campanha'); }
  };

  const newCampaign = () => setDialog({
    name: '', description: '', campaign_type: 'multiplier', multiplier: 2, bonus_points: 0,
    target_segment: 'all', target_min_orders: 0, target_min_spent: 0, target_product_ids: [],
    starts_at: new Date().toISOString().slice(0, 16), ends_at: '', is_active: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" /> Campanhas
        </h1>
        <p className="text-sm text-muted-foreground">Regras temporárias de pontuação e segmentação de clientes</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campanhas</CardTitle>
          <Button size="sm" onClick={newCampaign}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Multiplicador</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !campaigns?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma campanha cadastrada</TableCell></TableRow>
              ) : campaigns.map((c: any) => {
                const now = new Date();
                const active = c.is_active && new Date(c.starts_at) <= now && new Date(c.ends_at) >= now;
                const upcoming = c.is_active && new Date(c.starts_at) > now;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm">{c.campaign_type === 'multiplier' ? 'Multiplicador' : c.campaign_type === 'bonus' ? 'Bônus Fixo' : c.campaign_type}</TableCell>
                    <TableCell className="font-medium text-primary">{c.campaign_type === 'multiplier' ? `${c.multiplier}x` : `+${c.bonus_points} pts`}</TableCell>
                    <TableCell className="text-sm">{segmentLabels[c.target_segment] || c.target_segment}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(c.starts_at), 'dd/MM')} — {format(new Date(c.ends_at), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? 'default' : upcoming ? 'outline' : 'secondary'}>
                        {active ? 'Ativa' : upcoming ? 'Agendada' : 'Encerrada'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setDialog({ ...c, starts_at: c.starts_at.slice(0, 16), ends_at: c.ends_at.slice(0, 16) })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dialog?.id ? 'Editar Campanha' : 'Nova Campanha'}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={dialog.name} onChange={e => setDialog({ ...dialog, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={dialog.description || ''} onChange={e => setDialog({ ...dialog, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={dialog.campaign_type} onValueChange={v => setDialog({ ...dialog, campaign_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="multiplier">Multiplicador de Pontos</SelectItem>
                      <SelectItem value="bonus">Bônus Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {dialog.campaign_type === 'multiplier' ? (
                  <div><Label>Multiplicador</Label><Input type="number" step="0.5" value={dialog.multiplier} onChange={e => setDialog({ ...dialog, multiplier: Number(e.target.value) })} /></div>
                ) : (
                  <div><Label>Bônus (pontos)</Label><Input type="number" value={dialog.bonus_points} onChange={e => setDialog({ ...dialog, bonus_points: Number(e.target.value) })} /></div>
                )}
              </div>
              <div>
                <Label>Segmento</Label>
                <Select value={dialog.target_segment} onValueChange={v => setDialog({ ...dialog, target_segment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Clientes</SelectItem>
                    <SelectItem value="new">Novos Clientes</SelectItem>
                    <SelectItem value="recurring">Recorrentes</SelectItem>
                    <SelectItem value="vip">VIP (alto gasto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Pedidos Mín.</Label><Input type="number" value={dialog.target_min_orders} onChange={e => setDialog({ ...dialog, target_min_orders: Number(e.target.value) })} /></div>
                <div><Label>Gasto Mín. (R$)</Label><Input type="number" value={dialog.target_min_spent} onChange={e => setDialog({ ...dialog, target_min_spent: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Início</Label><Input type="datetime-local" value={dialog.starts_at} onChange={e => setDialog({ ...dialog, starts_at: e.target.value })} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={dialog.ends_at} onChange={e => setDialog({ ...dialog, ends_at: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={dialog.is_active} onCheckedChange={v => setDialog({ ...dialog, is_active: v })} />
                <Label>Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsertCampaign.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
