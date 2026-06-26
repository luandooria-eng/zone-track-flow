import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AddressSuggestion {
  suggestion_type: 'street' | 'customer';
  display_text: string;
  street_type: string | null;
  street_name: string | null;
  house_number: string | null;
  neighborhood_name: string | null;
  neighborhood_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address_id: string | null;
  usage_count: number;
}

export function useAddressAutocomplete(search: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['address-autocomplete', search],
    queryFn: async (): Promise<AddressSuggestion[]> => {
      if (!search || search.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .rpc('search_addresses_autocomplete', {
          p_search: search,
          p_limit: 15
        });

      if (error) {
        console.error('Error searching addresses:', error);
        return [];
      }

      return (data || []) as AddressSuggestion[];
    },
    enabled: enabled && search.length >= 2,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });
}
