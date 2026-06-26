import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface StatusSelectProps {
  value: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'Aceito', label: 'Aceito', color: 'bg-accent text-accent-foreground' },
  { value: 'Enviado', label: 'Enviado', color: 'bg-warning-bg text-warning-foreground' },
  { value: 'Entregue', label: 'Entregue', color: 'bg-success-bg text-success' },
  { value: 'Cancelado', label: 'Cancelado', color: 'bg-destructive-bg text-destructive' },
];

export function StatusSelect({ value, onChange, disabled }: StatusSelectProps) {
  const currentStatus = STATUS_OPTIONS.find(s => s.value === value);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 border-none shadow-none bg-transparent text-sm px-0">
        <SelectValue placeholder="Status...">
          {currentStatus && (
            <span className={cn('px-2 py-0.5 rounded-full text-xs', currentStatus.color)}>
              {currentStatus.label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <span className={cn('px-2 py-0.5 rounded-full text-xs', status.color)}>
              {status.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
