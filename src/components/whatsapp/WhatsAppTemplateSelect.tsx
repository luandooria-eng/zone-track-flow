import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWhatsAppTemplates } from '@/hooks/useWhatsAppTemplates';

interface WhatsAppTemplateSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

const NONE = '__none__';

export function WhatsAppTemplateSelect({ value, onChange, placeholder }: WhatsAppTemplateSelectProps) {
  const { data: templates = [] } = useWhatsAppTemplates();
  const active = templates.filter((t) => t.is_active);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder || 'Nenhum template (só funciona com Z-API ou dentro da janela de 24h)'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Nenhum</SelectItem>
        {active.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name} ({t.language})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
