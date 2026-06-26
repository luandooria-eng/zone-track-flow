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

interface NeighborhoodSelectProps {
  value: string;
  onChange: (value: string, neighborhoodId?: string) => void;
  disabled?: boolean;
}

export const NeighborhoodSelect = memo(function NeighborhoodSelect({ 
  value, 
  onChange, 
  disabled 
}: NeighborhoodSelectProps) {
  const { neighborhoods = [], isLoading } = useGridData();
  const activeNeighborhoods = neighborhoods?.filter(n => n.is_active) || [];

  const handleChange = (neighborhoodName: string) => {
    const neighborhood = activeNeighborhoods.find(n => n.name === neighborhoodName);
    onChange(neighborhoodName, neighborhood?.id);
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 border-none shadow-none bg-transparent text-sm px-0">
        <SelectValue placeholder="Bairro..." />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {activeNeighborhoods.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
            Cadastre bairros em Configurações
          </div>
        ) : (
          activeNeighborhoods.map((neighborhood) => (
            <SelectItem key={neighborhood.id} value={neighborhood.name}>
              {neighborhood.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
});
