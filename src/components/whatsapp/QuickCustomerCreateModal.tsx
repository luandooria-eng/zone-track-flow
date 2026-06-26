import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  /** Default values pulled from the WhatsApp conversation */
  defaultName?: string | null;
  defaultPhone?: string | null;
  onCreated?: (customerId: string) => void;
}

/**
 * Lightweight customer creation modal triggered from the WhatsApp inbox.
 * Pre-fills name + phone from the active conversation and immediately
 * links the new customer to the conversation so the operator can keep
 * working without leaving the chat.
 */
export function QuickCustomerCreateModal({
  open,
  onOpenChange,
  conversationId,
  defaultName,
  defaultPhone,
  onCreated,
}: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [reference, setReference] = useState('');
  const [neighborhoodId, setNeighborhoodId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset/seed form whenever the modal opens with new defaults
  useEffect(() => {
    if (open) {
      setName((defaultName ?? '').trim());
      setPhone((defaultPhone ?? '').trim());
      setStreet('');
      setNumber('');
      setReference('');
      setNeighborhoodId('');
    }
  }, [open, defaultName, defaultPhone]);

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['quick-customer-neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Informe o nome do cliente');
      return;
    }
    setSubmitting(true);

    try {
      // 1. Create the customer record with the address fields directly on it
      //    (matches what the rest of the app — orders, vendas diárias — already reads)
      const { data: customer, error: insertError } = await supabase
        .from('customers')
        .insert({
          name: trimmedName,
          phone: phone.trim() || null,
          street: street.trim() || null,
          number: number.trim() || null,
          reference: reference.trim() || null,
          neighborhood_id: neighborhoodId || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 2. Persist the phone in customer_phones too (so it shows up in the
      //    customer's "phones" list and is reusable for future matching)
      if (phone.trim()) {
        await supabase.from('customer_phones').insert({
          customer_id: customer.id,
          phone_number: phone.trim(),
          is_primary: true,
          is_whatsapp: true,
          label: 'whatsapp',
        });
      }

      // 3. Link the new customer to the WhatsApp conversation
      const { error: linkError } = await supabase
        .from('whatsapp_conversations')
        .update({ customer_id: customer.id })
        .eq('id', conversationId);

      if (linkError) throw linkError;

      toast.success('Cliente cadastrado e vinculado à conversa!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onCreated?.(customer.id);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar cliente';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Cadastrar cliente
          </DialogTitle>
          <DialogDescription>
            Os dados do contato do WhatsApp já vêm preenchidos. Complete o endereço para facilitar futuras entregas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Telefone (WhatsApp)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5579..."
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Rua</Label>
              <Input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Nome da rua"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número</Label>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="nº"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Bairro</Label>
            <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione o bairro" />
              </SelectTrigger>
              <SelectContent>
                {neighborhoods.map((n) => (
                  <SelectItem key={n.id} value={n.id} className="text-sm">
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ponto de referência</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: próximo à padaria..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
              </>
            ) : (
              'Cadastrar e vincular'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
