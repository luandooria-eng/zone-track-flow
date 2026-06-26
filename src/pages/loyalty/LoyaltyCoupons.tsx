import { useState } from 'react';
import { useLoyaltyCoupons, useUpsertCoupon } from '@/hooks/useLoyaltyData';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';
import { format } from 'date-fns';

export default function LoyaltyCoupons() {
  const { data: coupons, isLoading } = useLoyaltyCoupons();
  const upsert = useUpsertCoupon();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pointsCost, setPointsCost] = useState('');
  const [couponType, setCouponType] = useState('discount');
  const [stock, setStock] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const openNew = () => {
    setEditing(null);
    setTitle(''); setDescription(''); setPointsCost(''); setCouponType('discount'); setStock(''); setExpiresAt(''); setIsActive(true); setWhatsappPhone(''); setWhatsappMessage('');
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setTitle(c.title); setDescription(c.description || ''); setPointsCost(String(c.points_cost));
    setCouponType(c.coupon_type); setStock(c.stock != null ? String(c.stock) : '');
    setExpiresAt(c.expires_at ? c.expires_at.slice(0, 10) : ''); setIsActive(c.is_active);
    setWhatsappPhone(c.whatsapp_phone || ''); setWhatsappMessage(c.whatsapp_message || '');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!title || !pointsCost) { toast.error('Preencha título e custo'); return; }
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      title,
      description: description || undefined,
      points_cost: parseInt(pointsCost),
      coupon_type: couponType,
      stock: stock ? parseInt(stock) : undefined,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      is_active: isActive,
      whatsapp_phone: whatsappPhone || undefined,
      whatsapp_message: whatsappMessage || undefined,
    });
    toast.success(editing ? 'Cupom atualizado' : 'Cupom criado');
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cupons / Recompensas</h1>
          <p className="text-sm text-muted-foreground">Gerencie o catálogo de cupons resgatáveis</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Cupom</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Custo (pts)</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : !coupons?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cupom cadastrado</TableCell></TableRow>
              ) : coupons.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="capitalize">{c.coupon_type}</TableCell>
                  <TableCell>{c.points_cost}</TableCell>
                  <TableCell>{c.stock ?? '∞'}</TableCell>
                  <TableCell>{c.expires_at ? format(new Date(c.expires_at), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Ativo' : 'Inativo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" /></div>
            <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Custo (pontos)</Label><Input type="number" value={pointsCost} onChange={(e) => setPointsCost(e.target.value)} className="mt-1" /></div>
              <div><Label>Estoque</Label><Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1" placeholder="Ilimitado" /></div>
            </div>
            <div><Label>Validade</Label><Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1" /></div>
            <div className="border-t pt-3 mt-1 space-y-3">
              <p className="text-sm font-medium text-foreground">WhatsApp do Voucher</p>
              <div><Label>Telefone WhatsApp (com DDD)</Label><Input value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="mt-1" placeholder="5511999999999" /></div>
              <div><Label>Mensagem padrão</Label><Textarea value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} className="mt-1" rows={3} placeholder="Olá! Resgatei o cupom *{codigo}*..." /><p className="text-xs text-muted-foreground mt-1">Use <code>{'{codigo}'}</code> para inserir o código do voucher automaticamente</p></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Ativo</Label></div>
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
