import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerTagAssignment {
  id: string;
  customer_id: string;
  tag_id: string;
  created_at: string;
}

// Fetch all available tags
export function useCustomerTags() {
  return useQuery({
    queryKey: ['customer-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_tags')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as CustomerTag[];
    },
  });
}

// Fetch tag assignments for a specific customer
export function useCustomerTagAssignments(customerId: string | null) {
  return useQuery({
    queryKey: ['customer-tag-assignments', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select(`
          id,
          customer_id,
          tag_id,
          created_at,
          tag:customer_tags(id, name, color)
        `)
        .eq('customer_id', customerId);

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });
}

// Fetch all tag assignments (for customer list)
export function useAllCustomerTagAssignments() {
  return useQuery({
    queryKey: ['all-customer-tag-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .select(`
          id,
          customer_id,
          tag_id,
          tag:customer_tags(id, name, color, is_active)
        `);

      if (error) throw error;
      return data;
    },
  });
}

// Add a tag to a customer
export function useAddCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, tagId }: { customerId: string; tagId: string }) => {
      const { data, error } = await supabase
        .from('customer_tag_assignments')
        .insert({ customer_id: customerId, tag_id: tagId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['all-customer-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// Remove a tag from a customer
export function useRemoveCustomerTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, tagId }: { customerId: string; tagId: string }) => {
      const { error } = await supabase
        .from('customer_tag_assignments')
        .delete()
        .eq('customer_id', customerId)
        .eq('tag_id', tagId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['all-customer-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

// Create a new tag
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('customer_tags')
        .insert({ name, color })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags'] });
    },
  });
}

// Update tag assignments for a customer (replace all)
export function useUpdateCustomerTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ customerId, tagIds }: { customerId: string; tagIds: string[] }) => {
      // Delete existing assignments
      await supabase
        .from('customer_tag_assignments')
        .delete()
        .eq('customer_id', customerId);

      // Insert new assignments
      if (tagIds.length > 0) {
        const { error } = await supabase
          .from('customer_tag_assignments')
          .insert(tagIds.map(tagId => ({ customer_id: customerId, tag_id: tagId })));

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer-tag-assignments', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['all-customer-tag-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
