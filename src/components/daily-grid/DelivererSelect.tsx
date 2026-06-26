import { memo } from 'react';
import { useGridData } from '@/contexts/GridDataContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface DelivererSelectProps {
  value: string;
  onChange: (value: unknown, delivererId?: string) => void;
  disabled?: boolean;
}

export const DelivererSelect = memo(function DelivererSelect({ 
  value, 
  onChange, 
  disabled 
}: DelivererSelectProps) {
  const { deliveryPeople = [], isLoading } = useGridData();
  const activeDeliverers = deliveryPeople?.filter(d => d.is_active) || [];

  const handleChange = (delivererName: string) => {
    if (delivererName === '__none__') {
      onChange('', undefined);
      return;
    }
    const deliverer = activeDeliverers.find(d => d.name === delivererName);
    onChange(delivererName, deliverer?.id);
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  return (
    <Select
      value={value || '__none__'}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 border-none shadow-none bg-transparent text-sm px-0">
        <SelectValue placeholder="Entregador..." />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        <SelectItem value="__none__">
          <span className="text-muted-foreground italic">Sem entregador</span>
        </SelectItem>
        {activeDeliverers.map((deliverer) => (
          <SelectItem key={deliverer.id} value={deliverer.name}>
            {deliverer.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
