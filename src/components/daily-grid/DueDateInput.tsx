import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DueDateInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DueDateInput({ value, onChange, disabled }: DueDateInputProps) {
  const [open, setOpen] = useState(false);
  
  // Parse date string as local date (not UTC) to avoid timezone issues
  const selectedDate = value ? parseISO(value + 'T00:00:00') : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Format using local date components to avoid timezone shifts
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      onChange(`${year}-${month}-${day}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full h-8 justify-start text-left font-normal px-1 text-sm',
            !value && 'text-muted-foreground'
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-1 h-3 w-3" />
          {selectedDate ? (
            format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })
          ) : (
            <span>Vencimento...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          locale={ptBR}
          disabled={(date) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date < today;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
