import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuantitySelectProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const QUICK_OPTIONS = [1, 2, 3, 4, 5];

export function QuantitySelect({ value, onChange, disabled }: QuantitySelectProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(value + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && value > 1) {
      onChange(value - 1);
    }
  };

  const handleQuickSelect = (qty: number) => {
    if (!disabled) {
      onChange(qty);
      setIsExpanded(false);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div 
        className={cn(
          "flex items-center justify-center gap-1 h-full cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={handleClick}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-muted"
          onClick={handleDecrement}
          disabled={disabled || value <= 1}
        >
          <Minus className="h-3 w-3" />
        </Button>
        
        <span className={cn(
          "font-semibold text-sm min-w-[24px] text-center px-1 py-0.5 rounded",
          value > 0 && "bg-primary/10 text-primary"
        )}>
          {value}
        </span>
        
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-muted"
          onClick={handleIncrement}
          disabled={disabled}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {isExpanded && !disabled && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg p-1 min-w-[120px]">
          <div className="grid grid-cols-5 gap-1">
            {QUICK_OPTIONS.map((qty) => (
              <button
                key={qty}
                type="button"
                className={cn(
                  "h-8 rounded text-sm font-medium transition-colors",
                  value === qty 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted"
                )}
                onClick={() => handleQuickSelect(qty)}
              >
                {qty}
              </button>
            ))}
          </div>
          <div className="mt-1 pt-1 border-t">
            <div className="grid grid-cols-4 gap-1">
              {[6, 10, 12, 20].map((qty) => (
                <button
                  key={qty}
                  type="button"
                  className={cn(
                    "h-7 rounded text-xs font-medium transition-colors",
                    value === qty 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleQuickSelect(qty)}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
