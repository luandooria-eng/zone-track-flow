import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { CRMStage } from '@/hooks/useCRMFunnel';
import { useCreateLead } from '@/hooks/useCRMFunnel';

const SOURCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'ligacao', label: 'Ligação' },
  { value: 'portal', label: 'Portal' },
  { value: 'site', label: 'Site' },
  { value: 'outro', label: 'Outro' },
];

const PRODUCTS = [
  'Gás P13',
  'Gás P45',
  'Gás P20',
  'Água 20L',
  'Água 10L',
  'Gás + Água',
  'Outro',
];

interface NewLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: CRMStage[];
  defaultStageId?: string;
}

export function NewLeadModal({ open, onOpenChange, stages, defaultStageId }: NewLeadModalProps) {
  const firstStage = stages.find((s) => !s.is_won && !s.is_lost);
  const createLead = useCreateLead();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    stage_id: defaultStageId ?? firstStage?.id ?? '',
    estimated_value: '',
    product_interest: '',
    source: 'whatsapp',
    notes: '',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.stage_id) return;

    await createLead.mutateAsync({
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      neighborhood_id: null,
      stage_id: form.stage_id,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      product_interest: form.product_interest || null,
      source: form.source,
      notes: form.notes.trim() || null,
      customer_id: null,
      assigned_to: null,
      whatsapp_conversation_id: null,
      lost_reason: null,
    });

    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      stage_id: defaultStageId ?? firstStage?.id ?? '',
      estimated_value: '',
      product_interest: '',
      source: 'whatsapp',
      notes: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-name">Nome *</Label>
              <Input
                id="lead-name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Nome do lead"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Telefone / WhatsApp</Label>
              <Input
                id="lead-phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="(82) 99999-9999"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-email">E-mail</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Estágio inicial</Label>
              <Select value={form.stage_id} onValueChange={(v) => set('stage_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {stages.filter((s) => !s.is_won && !s.is_lost).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={(v) => set('source', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Interesse</Label>
              <Select value={form.product_interest} onValueChange={(v) => set('product_interest', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Produto..." />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lead-value">Valor estimado (R$)</Label>
              <Input
                id="lead-value"
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_value}
                onChange={(e) => set('estimated_value', e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-address">Endereço</Label>
              <Input
                id="lead-address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Rua, bairro..."
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="lead-notes">Observações</Label>
              <Textarea
                id="lead-notes"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Anotações sobre o lead..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createLead.isPending || !form.name.trim()}>
              {createLead.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
