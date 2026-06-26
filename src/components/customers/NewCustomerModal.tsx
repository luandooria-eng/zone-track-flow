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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAddCustomer } from '@/hooks/useCustomers';
import { useSearchAddresses, useCreateAddress, useLinkCustomerToAddress, AddressWithCustomers } from '@/hooks/useAddresses';
import { useAddCustomerPhone, useSearchPhoneNumber, PhoneWithCustomer } from '@/hooks/useCustomerPhones';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Phone, MapPin, AlertTriangle, Users, MessageCircle } from 'lucide-react';

interface NewCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PhoneEntry {
  phone_number: string;
  label: string;
  is_whatsapp: boolean;
  is_primary: boolean;
}

export function NewCustomerModal({ open, onOpenChange }: NewCustomerModalProps) {
  const addCustomerMutation = useAddCustomer();
  const searchAddressesMutation = useSearchAddresses();
  const createAddressMutation = useCreateAddress();
  const linkCustomerToAddressMutation = useLinkCustomerToAddress();
  const addPhoneMutation = useAddCustomerPhone();
  const searchPhoneMutation = useSearchPhoneNumber();
  
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

  const [formData, setFormData] = useState({
    name: '',
    cpf: '',
    email: '',
    street: '',
    number: '',
    complement: '',
    reference: '',
    neighborhood_id: '',
    city: 'Lagarto',
    zipCode: '',
  });

  const [phones, setPhones] = useState<PhoneEntry[]>([
    { phone_number: '', label: 'principal', is_whatsapp: true, is_primary: true }
  ]);

  const [existingAddress, setExistingAddress] = useState<AddressWithCustomers | null>(null);
  const [useExistingAddress, setUseExistingAddress] = useState<boolean>(false);
  const [phoneConflicts, setPhoneConflicts] = useState<{ index: number; matches: PhoneWithCustomer[] }[]>([]);

  // Check for existing address when street/number/neighborhood changes
  useEffect(() => {
    const checkAddress = async () => {
      if (formData.street && formData.number && formData.neighborhood_id) {
        const result = await searchAddressesMutation.mutateAsync({
          street: formData.street,
          number: formData.number,
          neighborhoodId: formData.neighborhood_id,
        });
        setExistingAddress(result);
        setUseExistingAddress(false);
      } else {
        setExistingAddress(null);
        setUseExistingAddress(false);
      }
    };

    const timer = setTimeout(checkAddress, 500);
    return () => clearTimeout(timer);
  }, [formData.street, formData.number, formData.neighborhood_id]);

  // Check for existing phone numbers
  const checkPhoneNumber = async (phoneNumber: string, index: number) => {
    if (phoneNumber.replace(/\D/g, '').length >= 8) {
      const matches = await searchPhoneMutation.mutateAsync(phoneNumber);
      if (matches.length > 0) {
        setPhoneConflicts(prev => {
          const filtered = prev.filter(c => c.index !== index);
          return [...filtered, { index, matches }];
        });
      } else {
        setPhoneConflicts(prev => prev.filter(c => c.index !== index));
      }
    }
  };

  const addPhone = () => {
    setPhones([...phones, { phone_number: '', label: '', is_whatsapp: true, is_primary: false }]);
  };

  const removePhone = (index: number) => {
    if (phones.length > 1) {
      const newPhones = phones.filter((_, i) => i !== index);
      // If we removed the primary, make the first one primary
      if (phones[index].is_primary && newPhones.length > 0) {
        newPhones[0].is_primary = true;
      }
      setPhones(newPhones);
      setPhoneConflicts(prev => prev.filter(c => c.index !== index));
    }
  };

  const updatePhone = (index: number, field: keyof PhoneEntry, value: any) => {
    const newPhones = [...phones];
    
    if (field === 'is_primary' && value === true) {
      // Unset other primaries
      newPhones.forEach((p, i) => {
        p.is_primary = i === index;
      });
    } else {
      (newPhones[index] as any)[field] = value;
    }
    
    setPhones(newPhones);

    // Check for conflicts when phone number changes
    if (field === 'phone_number') {
      checkPhoneNumber(value, index);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Nome é obrigatório');
      return;
    }

    const validPhones = phones.filter(p => p.phone_number.trim());
    if (validPhones.length === 0) {
      toast.error('Adicione pelo menos um telefone');
      return;
    }

    try {
      // 1. Create customer (without address fields in the old model)
      const customer = await addCustomerMutation.mutateAsync({
        name: formData.name,
        cpf: formData.cpf || undefined,
        email: formData.email || undefined,
      });

      // 2. Handle address
      let addressId: string | null = null;
      
      if (useExistingAddress && existingAddress) {
        // Use existing address
        addressId = existingAddress.id;
      } else if (formData.street && formData.number && formData.neighborhood_id) {
        // Create new address
        const address = await createAddressMutation.mutateAsync({
          street_name: formData.street,
          house_number: formData.number,
          neighborhood_id: formData.neighborhood_id,
          complement: formData.complement || undefined,
          reference_point: formData.reference || undefined,
          city: formData.city || 'Lagarto',
          zip_code: formData.zipCode || undefined,
        });
        addressId = address.id;
      }

      // 3. Link customer to address
      if (addressId) {
        await linkCustomerToAddressMutation.mutateAsync({
          customer_id: customer.id,
          address_id: addressId,
          is_default: true,
        });
      }

      // 4. Add phones
      for (const phone of validPhones) {
        await addPhoneMutation.mutateAsync({
          customer_id: customer.id,
          phone_number: phone.phone_number,
          label: phone.label || 'principal',
          is_whatsapp: phone.is_whatsapp,
          is_primary: phone.is_primary,
        });
      }

      toast.success('Cliente cadastrado com sucesso!');
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error('Erro ao cadastrar cliente');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      cpf: '',
      email: '',
      street: '',
      number: '',
      complement: '',
      reference: '',
      neighborhood_id: '',
      city: 'Lagarto',
      zipCode: '',
    });
    setPhones([{ phone_number: '', label: 'principal', is_whatsapp: true, is_primary: true }]);
    setExistingAddress(null);
    setUseExistingAddress(false);
    setPhoneConflicts([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thick">
          {/* Basic Info */}
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

          {/* Phones Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefones
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar telefone
              </Button>
            </div>

            <div className="space-y-3">
              {phones.map((phone, index) => {
                const conflict = phoneConflicts.find(c => c.index === index);
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={phone.phone_number}
                          onChange={(e) => updatePhone(index, 'phone_number', e.target.value)}
                          placeholder="(79) 99999-9999"
                        />
                      </div>
                      <div className="w-32">
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
                          WhatsApp
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
                      {phones.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removePhone(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {conflict && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Este telefone já está vinculado a: {conflict.matches.map(m => m.customer.name).join(', ')}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Address Section */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Nome da rua"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  placeholder="Apto, Bloco, etc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Select
                  value={formData.neighborhood_id}
                  onValueChange={(value) => setFormData({ ...formData, neighborhood_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o bairro" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]">
                    {neighborhoods.length === 0 ? (
                      <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                        Nenhum bairro cadastrado
                      </div>
                    ) : (
                      neighborhoods.map((n) => (
                        <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="reference">Ponto de Referência</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Próximo a..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            {/* Existing Address Alert */}
            {existingAddress && (
              <Alert className="mt-4 border-warning bg-warning/10">
                <Users className="h-4 w-4" />
                <AlertTitle className="flex items-center gap-2">
                  Endereço já cadastrado
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                  <p className="text-sm">
                    <strong>{existingAddress.street_name}, nº {existingAddress.house_number}</strong>
                    {existingAddress.neighborhood && ` – ${existingAddress.neighborhood.name}`}
                    {existingAddress.complement && ` (${existingAddress.complement})`}
                  </p>
                  
                  {existingAddress.customers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-muted-foreground">Clientes neste endereço:</span>
                      {existingAddress.customers.map(c => (
                        <Badge key={c.id} variant="secondary" className="text-xs">
                          {c.name} {c.phone && `(${c.phone})`}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={useExistingAddress ? 'default' : 'outline'}
                      onClick={() => setUseExistingAddress(true)}
                    >
                      Vincular a este endereço
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!useExistingAddress ? 'default' : 'outline'}
                      onClick={() => setUseExistingAddress(false)}
                    >
                      Criar novo mesmo assim
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => {
              resetForm();
              onOpenChange(false);
            }}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={addCustomerMutation.isPending}
            >
              {addCustomerMutation.isPending ? 'Cadastrando...' : 'Cadastrar Cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
