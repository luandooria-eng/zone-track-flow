import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type WhatsAppTemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  status: string;
  header_type: string | null;
  body_preview: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplateInput {
  name: string;
  language: string;
  category: WhatsAppTemplateCategory;
  body_preview: string;
  variables: string[];
  is_active: boolean;
}

export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_templates' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as WhatsAppTemplate[];
    },
  });
}

export function useSaveWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: WhatsAppTemplateInput & { id?: string }) => {
      const { error } = await supabase
        .from('whatsapp_templates' as any)
        .upsert(id ? { id, ...input } : input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template salvo!');
    },
    onError: (error) => {
      console.error('Save template error:', error);
      toast.error('Erro ao salvar template');
    },
  });
}

export function useDeleteWhatsAppTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template removido!');
    },
    onError: (error) => {
      console.error('Delete template error:', error);
      toast.error('Erro ao remover template');
    },
  });
}
