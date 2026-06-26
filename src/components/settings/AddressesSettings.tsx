import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2, GitMerge, Search } from 'lucide-react';
import { useNeighborhoods } from '@/hooks/useSupabaseQuery';

interface Address {
  id: string;
  street_name: string;
  house_number: string;
  neighborhood_id: string | null;
  complement: string | null;
  reference_point: string | null;
  city: string | null;
  address_key: string;
  created_at: string;
  neighborhood?: {
    id: string;
    name: string;
  } | null;
  customer_count?: number;
}

export function AddressesSettings() {
  const queryClient = useQueryClient();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  
  const [editForm, setEditForm] = useState({
    street_name: '',
    house_number: '',
    neighborhood_id: '',
    complement: '',
    reference_point: '',
  });

  // Fetch addresses with customer count
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select(`
          *,
          neighborhood:neighborhoods(id, name),
          customer_addresses(customer_id)
        `)
        .order('street_name');

      if (error) throw error;
      
      return data.map((addr: any) => ({
        ...addr,
        customer_count: addr.customer_addresses?.length || 0,
      })) as Address[];
    },
  });

  // Update address
  const updateAddress = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Address> }) => {
      // Get neighborhood name to regenerate address_key
      const neighborhood = neighborhoods.find(n => n.id === data.updates.neighborhood_id);
      const neighborhoodName = neighborhood?.name || '';
      
      const normalize = (text: string) => {
        return text
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      const address_key = `${normalize(data.updates.street_name || '')}|${(data.updates.house_number || '').toLowerCase().trim()}|${normalize(neighborhoodName)}`;

      const { error } = await supabase
        .from('addresses')
        .update({
          street_name: data.updates.street_name,
          house_number: data.updates.house_number,
          neighborhood_id: data.updates.neighborhood_id,
          complement: data.updates.complement || null,
          reference_point: data.updates.reference_point || null,
          address_key,
        })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses-settings'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Endereço atualizado!');
      setEditOpen(false);
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um endereço com esses dados');
      } else {
        toast.error('Erro ao atualizar endereço');
      }
    },
  });

  // Delete address
  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      // First unlink all customers
      await supabase.from('customer_addresses').delete().eq('address_id', id);
      // Then delete address
      const { error } = await supabase.from('addresses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses-settings'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Endereço excluído!');
      setDeleteOpen(false);
    },
    onError: () => {
      toast.error('Erro ao excluir endereço');
    },
  });

  // Merge addresses
  const mergeAddresses = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      // Move all customer links from source to target
      const { data: sourceLinks } = await supabase
        .from('customer_addresses')
        .select('customer_id')
        .eq('address_id', sourceId);

      if (sourceLinks && sourceLinks.length > 0) {
        for (const link of sourceLinks) {
          // Check if customer already linked to target
          const { data: existingLink } = await supabase
            .from('customer_addresses')
            .select('id')
            .eq('customer_id', link.customer_id)
            .eq('address_id', targetId)
            .maybeSingle();

          if (!existingLink) {
            await supabase.from('customer_addresses').insert({
              customer_id: link.customer_id,
              address_id: targetId,
              is_default: false,
            });
          }
        }
      }

      // Delete source address links and address
      await supabase.from('customer_addresses').delete().eq('address_id', sourceId);
      await supabase.from('addresses').delete().eq('id', sourceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses-settings'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast.success('Endereços sincronizados!');
      setMergeOpen(false);
    },
    onError: () => {
      toast.error('Erro ao sincronizar endereços');
    },
  });

  const handleEdit = (address: Address) => {
    setSelectedAddress(address);
    setEditForm({
      street_name: address.street_name,
      house_number: address.house_number,
      neighborhood_id: address.neighborhood_id || '',
      complement: address.complement || '',
      reference_point: address.reference_point || '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedAddress) return;
    updateAddress.mutate({
      id: selectedAddress.id,
      updates: {
        street_name: editForm.street_name,
        house_number: editForm.house_number,
        neighborhood_id: editForm.neighborhood_id || null,
        complement: editForm.complement,
        reference_point: editForm.reference_point,
      },
    });
  };

  const handleDelete = (address: Address) => {
    setSelectedAddress(address);
    setDeleteOpen(true);
  };

  const handleMerge = (address: Address) => {
    setSelectedAddress(address);
    setMergeTarget('');
    setMergeOpen(true);
  };

  const handleConfirmMerge = () => {
    if (!selectedAddress || !mergeTarget) return;
    mergeAddresses.mutate({
      sourceId: selectedAddress.id,
      targetId: mergeTarget,
    });
  };

  const filteredAddresses = addresses.filter(addr => {
    const searchLower = search.toLowerCase();
    return (
      addr.street_name.toLowerCase().includes(searchLower) ||
      addr.house_number.toLowerCase().includes(searchLower) ||
      addr.neighborhood?.name?.toLowerCase().includes(searchLower)
    );
  });

  const mergeOptions = addresses.filter(addr => addr.id !== selectedAddress?.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar endereço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredAddresses.length} endereços
        </span>
      </div>

      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Rua</TableHead>
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Complemento</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead className="w-24 text-center">Clientes</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredAddresses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum endereço encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredAddresses.map((address) => (
                <TableRow key={address.id}>
                  <TableCell className="font-medium">{address.street_name}</TableCell>
                  <TableCell>{address.house_number}</TableCell>
                  <TableCell>{address.neighborhood?.name || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{address.complement || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{address.reference_point || '-'}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center justify-center h-6 min-w-6 px-1 bg-muted rounded text-sm font-medium">
                      {address.customer_count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(address)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleMerge(address)}
                        title="Sincronizar com outro endereço"
                      >
                        <GitMerge className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(address)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Endereço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Rua</Label>
                <Input
                  value={editForm.street_name}
                  onChange={(e) => setEditForm({ ...editForm, street_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={editForm.house_number}
                  onChange={(e) => setEditForm({ ...editForm, house_number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Select
                value={editForm.neighborhood_id}
                onValueChange={(value) => setEditForm({ ...editForm, neighborhood_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {neighborhoods.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input
                value={editForm.complement}
                onChange={(e) => setEditForm({ ...editForm, complement: e.target.value })}
                placeholder="Apto, bloco, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Ponto de Referência</Label>
              <Input
                value={editForm.reference_point}
                onChange={(e) => setEditForm({ ...editForm, reference_point: e.target.value })}
                placeholder="Próximo a..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateAddress.isPending}>
              {updateAddress.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Endereço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o endereço "{selectedAddress?.street_name}, {selectedAddress?.house_number}"?
              {selectedAddress?.customer_count && selectedAddress.customer_count > 0 && (
                <span className="block mt-2 text-warning font-medium">
                  Este endereço está vinculado a {selectedAddress.customer_count} cliente(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => selectedAddress && deleteAddress.mutate(selectedAddress.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sincronizar Endereços</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Mover todos os clientes de "{selectedAddress?.street_name}, {selectedAddress?.house_number}" para outro endereço e excluir o atual.
            </p>
            <div className="space-y-2">
              <Label>Endereço de destino</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o endereço destino" />
                </SelectTrigger>
                <SelectContent>
                  {mergeOptions.map((addr) => (
                    <SelectItem key={addr.id} value={addr.id}>
                      {addr.street_name}, {addr.house_number} - {addr.neighborhood?.name || 'S/B'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmMerge} 
              disabled={!mergeTarget || mergeAddresses.isPending}
            >
              {mergeAddresses.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
