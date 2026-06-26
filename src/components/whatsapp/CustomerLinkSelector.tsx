import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { QuickCustomerCreateModal } from './QuickCustomerCreateModal';
import { AddPhoneToCustomerDialog } from './AddPhoneToCustomerDialog';

interface Props {
  conversationId: string;
  onLinked: () => void;
  /** Pre-fill values when opening the quick-create modal */
  defaultName?: string | null;
  defaultPhone?: string | null;
}

export function CustomerLinkSelector({ conversationId, onLinked, defaultName, defaultPhone }: Props) {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [addPhoneFor, setAddPhoneFor] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['customer-search-link', search],
    queryFn: async () => {
      const term = search.trim();
      if (term.length < 2) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .eq('is_active', true)
        .order('name')
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: search.trim().length >= 2,
  });

  const linkMutation = useMutation({
    mutationFn: async (customer: { id: string; name: string }) => {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ customer_id: customer.id })
        .eq('id', conversationId);
      if (error) throw error;
      return customer;
    },
    onSuccess: (customer) => {
      toast.success('Cliente vinculado à conversa!');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      // Se temos o telefone da conversa, abre o diálogo para cadastrar como contato adicional
      if (defaultPhone) {
        setAddPhoneFor({ id: customer.id, name: customer.name });
      }
      onLinked();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao vincular cliente');
    },
  });

  return (
    <div className="rounded-lg border border-dashed border-border p-3 space-y-2.5">
      <p className="text-xs text-muted-foreground">
        Este número ainda não está vinculado. Busque um cliente cadastrado ou cadastre um novo.
      </p>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="h-9 pl-7 text-sm"
        />
      </div>

      {isFetching && (
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          Buscando...
        </div>
      )}

      {!isFetching && search.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1">Nenhum cliente encontrado.</p>
      )}

      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border bg-background">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => linkMutation.mutate({ id: c.id, name: c.name })}
              disabled={linkMutation.isPending}
              className="w-full text-left px-2.5 py-2 hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                {c.phone && (
                  <p className="text-[11px] text-muted-foreground truncate">{c.phone}</p>
                )}
              </div>
              {linkMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setCreateOpen(true)}
      >
        <UserPlus className="h-3.5 w-3.5" />
        Cadastrar novo cliente
      </Button>

      <QuickCustomerCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        conversationId={conversationId}
        defaultName={defaultName}
        defaultPhone={defaultPhone}
        onCreated={() => onLinked()}
      />

      {addPhoneFor && defaultPhone && (
        <AddPhoneToCustomerDialog
          open={!!addPhoneFor}
          onOpenChange={(open) => !open && setAddPhoneFor(null)}
          customerId={addPhoneFor.id}
          customerName={addPhoneFor.name}
          phoneNumber={defaultPhone}
          suggestedLabel={defaultName}
        />
      )}
    </div>
  );
}
