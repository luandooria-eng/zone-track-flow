import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAddCustomerPhone } from '@/hooks/useCustomerPhones';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  phoneNumber: string;
  /** Suggestion shown as default label (e.g., contact name from WhatsApp) */
  suggestedLabel?: string | null;
}

/**
 * Asks the user whether to register the WhatsApp number as an additional contact
 * for the customer (e.g., wife, son, employee). Used right after linking a
 * conversation to an existing customer.
 */
export function AddPhoneToCustomerDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  phoneNumber,
  suggestedLabel,
}: Props) {
  const [label, setLabel] = useState(suggestedLabel ?? '');
  const addPhone = useAddCustomerPhone();

  async function handleSave() {
    if (!label.trim()) {
      toast.error('Informe um rótulo (ex: Esposa, Filho, Trabalho)');
      return;
    }
    try {
      await addPhone.mutateAsync({
        customer_id: customerId,
        phone_number: phoneNumber,
        label: label.trim(),
        is_whatsapp: true,
        is_primary: false,
      });
      toast.success(`Contato "${label}" adicionado a ${customerName}`);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao adicionar contato';
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Adicionar contato à conta
          </DialogTitle>
          <DialogDescription>
            Este número parece ser de outra pessoa da mesma conta. Identifique quem é
            para que pedidos futuros vinculem automaticamente a <strong>{customerName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md bg-muted/40 p-2.5 text-sm">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</p>
            <p className="font-mono mt-0.5">{phoneNumber}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-label" className="text-xs">
              Quem é? <span className="text-muted-foreground">(ex: Esposa Amanda, Filho João, Trabalho)</span>
            </Label>
            <Input
              id="contact-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Esposa Amanda"
              maxLength={60}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={addPhone.isPending}>
            Agora não
          </Button>
          <Button onClick={handleSave} disabled={addPhone.isPending || !label.trim()}>
            {addPhone.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Salvando...
              </>
            ) : (
              'Adicionar contato'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}