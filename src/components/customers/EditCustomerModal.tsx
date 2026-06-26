import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Phone, MapPin, MessageCircle, Loader2, User } from 'lucide-react';
import { Link2, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUpdateCustomer } from '@/hooks/useSupabaseQuery';
import { 
  useCustomerPhones, 
  useAddCustomerPhone, 
  useUpdateCustomerPhone, 
  useDeleteCustomerPhone,
  CustomerPhone 
} from '@/hooks/useCustomerPhones';
import { 
  useCustomerAddresses, 
  useCreateAddress, 
  useLinkCustomerToAddress,
  normalizeAddressKey 
} from '@/hooks/useAddresses';
import { Customer } from '@/types';

interface EditCustomerModalProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PhoneEntry {
  id?: string;
  phone_number: string;
  label: string;
  is_whatsapp: boolean;
  is_primary: boolean;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface AddressEntry {
  id?: string;
  customer_address_id?: string;
  street_name: string;
  house_number: string;
  complement: string;
  reference_point: string;
  neighborhood_id: string;
  is_default: boolean;
  isNew?: boolean;
}

export function EditCustomerModal({ customer, open, onOpenChange }: EditCustomerModalProps) {
  const queryClient = useQueryClient();
  const updateCustomerMutation = useUpdateCustomer();
  const addPhoneMutation = useAddCustomerPhone();
  const updatePhoneMutation = useUpdateCustomerPhone();
  const deletePhoneMutation = useDeleteCustomerPhone();
  const createAddressMutation = useCreateAddress();
  const linkAddressMutation = useLinkCustomerToAddress();

  // ----- Link existing address -----
  const [linkSearchOpen, setLinkSearchOpen] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  const { data: searchResults = [] } = useQuery({
    queryKey: ['edit-customer-search-addresses', linkSearchTerm],
    enabled: linkSearchOpen && linkSearchTerm.trim().length >= 2,
    queryFn: async () => {
      const term = linkSearchTerm.trim();
      const { data, error } = await supabase
        .from('addresses')
        .select(`
          id, street_name, house_number, complement, reference_point,
          neighborhood:neighborhoods(id, name),
          customer_addresses:customer_addresses(customer:customers(id, name))
        `)
        .ilike('street_name', `%${term}%`)
        .order('street_name')
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  async function handleLinkExisting(address: any) {
    if (!customerId) return;
    // Skip if already linked in current state
    if (addresses.some((a) => a.id === address.id)) {
      toast.info('Este endereço já está vinculado a este cliente.');
      setLinkSearchOpen(false);
      return;
    }
    setLinking(address.id);
    try {
      const result = await linkAddressMutation.mutateAsync({
        customer_id: customerId,
        address_id: address.id,
        is_default: addresses.length === 0,
      });
      // Add to local UI list immediately
      setAddresses((prev) => [
        ...prev,
        {
          id: address.id,
          customer_address_id: (result as any)?.id,
          street_name: address.street_name || '',
          house_number: address.house_number || '',
          complement: address.complement || '',
          reference_point: address.reference_point || '',
          neighborhood_id: address.neighborhood?.id || '',
          is_default: prev.length === 0,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] });
      toast.success('Endereço vinculado ao cliente.');
      setLinkSearchOpen(false);
      setLinkSearchTerm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao vincular endereço';
      toast.error(msg);
    } finally {
      setLinking(null);
    }
  }

  const customerId = customer?.id;

  const { data: existingPhones = [], isLoading: phonesLoading } = useCustomerPhones(customerId);
  const { data: existingAddresses = [], isLoading: addressesLoading } = useCustomerAddresses(customerId);

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('neighborhoods')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    email: '',
  });
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when customer changes
  useEffect(() => {
    if (customer && open) {
      setFormData({
        name: customer.name || '',
        cpf: customer.cpf || '',
        email: customer.email || '',
      });
      setActiveTab('basic');
    }
  }, [customer, open]);

  // Initialize phones when data loads
  useEffect(() => {
    if (existingPhones.length > 0) {
      setPhones(existingPhones.map(p => ({
        id: p.id,
        phone_number: p.phone_number,
        label: p.label || 'principal',
        is_whatsapp: p.is_whatsapp ?? true,
        is_primary: p.is_primary ?? false,
      })));
    } else if (customer && open) {
      // If no phones in DB but customer has legacy phone
      const legacyPhone = customer.phone || (customer as any).phone;
      if (legacyPhone) {
        setPhones([{
          phone_number: legacyPhone,
          label: 'principal',
          is_whatsapp: true,
          is_primary: true,
          isNew: true,
        }]);
      } else {
        setPhones([]);
      }
    }
  }, [existingPhones, customer, open]);

  // Initialize addresses when data loads
  useEffect(() => {
    if (existingAddresses.length > 0) {
      setAddresses(existingAddresses.map((ca: any) => ({
        id: ca.address?.id,
        customer_address_id: ca.id,
        street_name: ca.address?.street_name || '',
        house_number: ca.address?.house_number || '',
        complement: ca.address?.complement || '',
        reference_point: ca.address?.reference_point || '',
        neighborhood_id: ca.address?.neighborhood?.id || '',
        is_default: ca.is_default ?? false,
      })));
    } else if (customer && open) {
      // Use legacy address fields (support both nested customer.address and flat customer.street)
      const nested = (customer as any).address;
      const legacyStreet = nested?.street || (customer as any).street;
      const legacyNumber = nested?.number || (customer as any).number;
      const legacyComplement = nested?.complement || (customer as any).complement;
      const legacyReference = nested?.reference || (customer as any).reference;
      const legacyNeighborhoodId =
        (customer as any).neighborhood_id ||
        (customer as any).neighborhood?.id ||
        nested?.neighborhood?.id ||
        '';
      if (legacyStreet) {
        setAddresses([{
          street_name: legacyStreet,
          house_number: legacyNumber || '',
          complement: legacyComplement || '',
          reference_point: legacyReference || '',
          neighborhood_id: legacyNeighborhoodId,
          is_default: true,
          isNew: true,
        }]);
      } else {
        // Auto-open a blank address form so the user can immediately fill it in
        setAddresses([{
          street_name: '',
          house_number: '',
          complement: '',
          reference_point: '',
          neighborhood_id: legacyNeighborhoodId,
          is_default: true,
          isNew: true,
        }]);
      }
    }
  }, [existingAddresses, customer, open]);

  const addPhone = () => {
    setPhones([...phones, { phone_number: '', label: '', is_whatsapp: true, is_primary: false, isNew: true }]);
  };

  const removePhone = (index: number) => {
    const phone = phones[index];
    if (phone.id) {
      // Mark for deletion
      const newPhones = [...phones];
      newPhones[index] = { ...phone, isDeleted: true };
      setPhones(newPhones);
    } else {
      // Just remove from array
      setPhones(phones.filter((_, i) => i !== index));
    }
  };

  const updatePhone = (index: number, field: keyof PhoneEntry, value: any) => {
    const newPhones = [...phones];
    if (field === 'is_primary' && value === true) {
      newPhones.forEach((p, i) => {
        p.is_primary = i === index;
      });
    } else {
      (newPhones[index] as any)[field] = value;
    }
    setPhones(newPhones);
  };

  const addAddress = () => {
    setAddresses([...addresses, {
      street_name: '',
      house_number: '',
      complement: '',
      reference_point: '',
      neighborhood_id: '',
      is_default: addresses.length === 0,
      isNew: true,
    }]);
  };

  const updateAddress = (index: number, field: keyof AddressEntry, value: any) => {
    const newAddresses = [...addresses];
    if (field === 'is_default' && value === true) {
      newAddresses.forEach((a, i) => {
        a.is_default = i === index;
      });
    } else {
      (newAddresses[index] as any)[field] = value;
    }
    setAddresses(newAddresses);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customer) return;

    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Update basic customer data
      await updateCustomerMutation.mutateAsync({
        id: customer.id,
        name: formData.name.trim(),
        cpf: formData.cpf || null,
        email: formData.email || null,
      } as any);

      // 2. Handle phone changes
      const phonesToDelete = phones.filter(p => p.isDeleted && p.id);
      const phonesToUpdate = phones.filter(p => p.id && !p.isDeleted && !p.isNew);
      const phonesToCreate = phones.filter(p => p.isNew && !p.isDeleted && p.phone_number.trim());

      for (const phone of phonesToDelete) {
        await deletePhoneMutation.mutateAsync({ id: phone.id!, customer_id: customer.id });
      }

      for (const phone of phonesToUpdate) {
        await updatePhoneMutation.mutateAsync({
          id: phone.id!,
          customer_id: customer.id,
          phone_number: phone.phone_number,
          label: phone.label,
          is_whatsapp: phone.is_whatsapp,
          is_primary: phone.is_primary,
        });
      }

      for (const phone of phonesToCreate) {
        await addPhoneMutation.mutateAsync({
          customer_id: customer.id,
          phone_number: phone.phone_number,
          label: phone.label || 'principal',
          is_whatsapp: phone.is_whatsapp,
          is_primary: phone.is_primary,
        });
      }

      // 3. Handle address changes (only create new addresses)
      const addressesToCreate = addresses.filter(a => a.isNew && a.street_name.trim() && a.neighborhood_id);

      for (const addr of addressesToCreate) {
        const newAddress = await createAddressMutation.mutateAsync({
          street_name: addr.street_name,
          house_number: addr.house_number,
          neighborhood_id: addr.neighborhood_id,
          complement: addr.complement || undefined,
          reference_point: addr.reference_point || undefined,
        });

        if (newAddress) {
          await linkAddressMutation.mutateAsync({
            customer_id: customer.id,
            address_id: newAddress.id,
            is_default: addr.is_default,
          });
        }
      }

      // 4. Update existing addresses
      const addressesToUpdate = addresses.filter(a => a.id && !a.isNew);
      for (const addr of addressesToUpdate) {
        // Get neighborhood name for address key
        const neighborhood = neighborhoods.find(n => n.id === addr.neighborhood_id);
        if (!neighborhood) continue;

        const address_key = normalizeAddressKey(addr.street_name, addr.house_number, neighborhood.name);

        await supabase
          .from('addresses')
          .update({
            street_name: addr.street_name,
            house_number: addr.house_number,
            complement: addr.complement || null,
            reference_point: addr.reference_point || null,
            neighborhood_id: addr.neighborhood_id,
            address_key,
          })
          .eq('id', addr.id);

        // Update is_default in customer_addresses
        if (addr.customer_address_id) {
          await supabase
            .from('customer_addresses')
            .update({ is_default: addr.is_default })
            .eq('id', addr.customer_address_id);
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-phones', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', customer.id] });

      toast.success('Cliente atualizado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Erro ao atualizar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = phonesLoading || addressesLoading;

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Cliente
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                <TabsTrigger value="phones">Telefones</TabsTrigger>
                <TabsTrigger value="addresses">Endereços</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </TabsContent>

              {/* Phones Tab */}
              <TabsContent value="phones" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefones
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                <div className="space-y-3">
                  {phones.filter(p => !p.isDeleted).map((phone, index) => (
                    <div key={phone.id || index} className="flex items-start gap-2 p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={phone.phone_number}
                          onChange={(e) => updatePhone(index, 'phone_number', e.target.value)}
                          placeholder="(79) 99999-9999"
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          value={phone.label}
                          onChange={(e) => updatePhone(index, 'label', e.target.value)}
                          placeholder="Rótulo"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Checkbox
                          id={`whatsapp-${index}`}
                          checked={phone.is_whatsapp}
                          onCheckedChange={(checked) => updatePhone(index, 'is_whatsapp', checked)}
                        />
                        <Label htmlFor={`whatsapp-${index}`} className="text-xs flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          WA
                        </Label>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Checkbox
                          id={`primary-${index}`}
                          checked={phone.is_primary}
                          onCheckedChange={(checked) => updatePhone(index, 'is_primary', checked)}
                        />
                        <Label htmlFor={`primary-${index}`} className="text-xs">Principal</Label>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => removePhone(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {phones.filter(p => !p.isDeleted).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum telefone cadastrado
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Addresses Tab */}
              <TabsContent value="addresses" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereços
                  </h3>
                  <div className="flex items-center gap-2">
                    <Popover open={linkSearchOpen} onOpenChange={setLinkSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Link2 className="h-4 w-4 mr-1" />
                          Vincular existente
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] p-0" align="end">
                        <div className="p-3 border-b">
                          <div className="relative">
                            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                            <Input
                              autoFocus
                              placeholder="Buscar por nome da rua..."
                              value={linkSearchTerm}
                              onChange={(e) => setLinkSearchTerm(e.target.value)}
                              className="pl-8 h-9"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            Mostra endereços já cadastrados (de qualquer cliente). Útil para vincular mais um morador ao mesmo endereço.
                          </p>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto">
                          {linkSearchTerm.trim().length < 2 ? (
                            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                              Digite ao menos 2 letras da rua…
                            </p>
                          ) : searchResults.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                              Nenhum endereço encontrado.
                            </p>
                          ) : (
                            <ul className="divide-y">
                              {searchResults.map((addr: any) => {
                                const linkedCustomers = (addr.customer_addresses ?? [])
                                  .map((ca: any) => ca.customer?.name)
                                  .filter(Boolean);
                                const alreadyLinked = addresses.some((a) => a.id === addr.id);
                                return (
                                  <li key={addr.id} className="px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-muted/50">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium truncate">
                                        {addr.street_name}, {addr.house_number || 's/n'}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {addr.neighborhood?.name ?? '—'}
                                        {addr.complement ? ` · ${addr.complement}` : ''}
                                      </p>
                                      {linkedCustomers.length > 0 && (
                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                          Clientes: {linkedCustomers.slice(0, 3).join(', ')}
                                          {linkedCustomers.length > 3 ? ` +${linkedCustomers.length - 3}` : ''}
                                        </p>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={alreadyLinked ? 'ghost' : 'default'}
                                      disabled={alreadyLinked || linking === addr.id}
                                      onClick={() => handleLinkExisting(addr)}
                                      className="shrink-0"
                                    >
                                      {linking === addr.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : alreadyLinked ? (
                                        'Já vinculado'
                                      ) : (
                                        'Vincular'
                                      )}
                                    </Button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                      <Plus className="h-4 w-4 mr-1" />
                      Novo
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {addresses.map((addr, index) => (
                    <div key={addr.id || index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`default-addr-${index}`}
                            checked={addr.is_default}
                            onCheckedChange={(checked) => updateAddress(index, 'is_default', checked)}
                          />
                          <Label htmlFor={`default-addr-${index}`} className="text-sm">
                            Endereço Principal
                          </Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Rua</Label>
                          <Input
                            value={addr.street_name}
                            onChange={(e) => updateAddress(index, 'street_name', e.target.value)}
                            placeholder="Nome da rua"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Número</Label>
                          <Input
                            value={addr.house_number}
                            onChange={(e) => updateAddress(index, 'house_number', e.target.value)}
                            placeholder="123"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Complemento</Label>
                          <Input
                            value={addr.complement}
                            onChange={(e) => updateAddress(index, 'complement', e.target.value)}
                            placeholder="Apto, Bloco..."
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Bairro</Label>
                          <Select
                            value={addr.neighborhood_id}
                            onValueChange={(value) => updateAddress(index, 'neighborhood_id', value)}
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
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Ponto de Referência</Label>
                        <Input
                          value={addr.reference_point}
                          onChange={(e) => updateAddress(index, 'reference_point', e.target.value)}
                          placeholder="Próximo a..."
                        />
                      </div>
                    </div>
                  ))}

                  {addresses.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum endereço cadastrado
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
