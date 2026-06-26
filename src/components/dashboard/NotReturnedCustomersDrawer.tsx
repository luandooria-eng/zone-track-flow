import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MessageCircle, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerIds: string[];
}

export function NotReturnedCustomersDrawer({ open, onOpenChange, customerIds }: Props) {
  const { data: customers, isLoading } = useQuery({
    queryKey: ['not-returned-30d', customerIds],
    enabled: open && customerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, last_order_at, total_orders, total_spent')
        .in('id', customerIds)
        .order('last_order_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const openWhatsApp = (phone: string | null, name: string) => {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá ${name.split(' ')[0]}! Sentimos sua falta. Que tal um novo pedido hoje? 💧`);
    window.open(`https://wa.me/55${cleaned}?text=${text}`, '_blank');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Clientes para reativar</SheetTitle>
          <SheetDescription>
            Clientes que fizeram a 1ª compra mas não voltaram em 30 dias. Bons candidatos para mensagem de reativação.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && (!customers || customers.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente para reativar 🎉</p>
          )}
          {customers?.map((c) => (
            <div key={c.id} className="p-3 rounded-lg border bg-card flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{c.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.last_order_at && (
                    <span>· última: {format(new Date(c.last_order_at), "dd/MM/yy", { locale: ptBR })}</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!c.phone}
                onClick={() => openWhatsApp(c.phone, c.name)}
                className="gap-1.5 shrink-0"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}