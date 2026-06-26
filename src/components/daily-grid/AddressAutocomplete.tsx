import { useState, useEffect, useRef } from 'react';
import { MapPin, User, Building } from 'lucide-react';
import { useAddressAutocomplete, AddressSuggestion } from '@/hooks/useAddressAutocomplete';
import { cn } from '@/lib/utils';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, data?: {
    neighborhood?: string;
    neighborhoodId?: string;
    customerId?: string;
    customerName?: string;
  }) => void;
  disabled?: boolean;
  isEditing?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  disabled,
  isEditing,
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [], isLoading } = useAddressAutocomplete(search, isOpen);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group suggestions by type
  const streetSuggestions = suggestions.filter(s => s.suggestion_type === 'street');
  const customerSuggestions = suggestions.filter(s => s.suggestion_type === 'customer');

  const handleSelect = (suggestion: AddressSuggestion) => {
    if (suggestion.suggestion_type === 'street') {
      // Build full address from street
      const fullAddress = suggestion.street_type 
        ? `${suggestion.street_type} ${suggestion.street_name}`
        : suggestion.street_name || '';
      
      onChange(fullAddress, {
        neighborhood: suggestion.neighborhood_name || undefined,
        neighborhoodId: suggestion.neighborhood_id || undefined,
      });
      setSearch(fullAddress);
    } else {
      // Customer - fill address and optionally customer
      const fullAddress = suggestion.house_number
        ? `${suggestion.street_name}, ${suggestion.house_number}`
        : suggestion.street_name || '';
      
      onChange(fullAddress, {
        neighborhood: suggestion.neighborhood_name || undefined,
        customerId: suggestion.customer_id || undefined,
        customerName: suggestion.customer_name || undefined,
      });
      setSearch(fullAddress);
    }
    setIsOpen(false);
  };

  const handleBlur = () => {
    // Update value on blur if changed
    if (search !== value) {
      onChange(search);
    }
  };

  if (!isEditing) {
    return (
      <span className="text-sm truncate flex items-center gap-1">
        {value && <MapPin className="h-3 w-3 text-muted-foreground" />}
        {value || <span className="text-muted-foreground">Endereço...</span>}
      </span>
    );
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-1">
        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent border-none outline-none text-sm"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          placeholder="Digite rua, número ou nome do cliente..."
          disabled={disabled}
        />
      </div>

      {isOpen && (streetSuggestions.length > 0 || customerSuggestions.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {/* Street suggestions */}
          {streetSuggestions.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 flex items-center gap-1.5">
                <Building className="h-3 w-3" />
                Endereços / Ruas
              </div>
              {streetSuggestions.slice(0, 5).map((suggestion, idx) => (
                <button
                  key={`street-${idx}`}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
                    'flex items-center gap-2'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(suggestion);
                  }}
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{suggestion.display_text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Customer suggestions */}
          {customerSuggestions.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 flex items-center gap-1.5 border-t">
                <User className="h-3 w-3" />
                Clientes nesta rua
              </div>
              {customerSuggestions.slice(0, 8).map((suggestion, idx) => (
                <button
                  key={`customer-${idx}`}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
                    'flex flex-col gap-0.5'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(suggestion);
                  }}
                >
                  <span className="font-medium flex items-center gap-1.5">
                    <User className="h-3 w-3 text-primary" />
                    {suggestion.customer_name}
                  </span>
                  <span className="text-xs text-muted-foreground ml-4">
                    {suggestion.street_name}, {suggestion.house_number || 'S/N'} — {suggestion.neighborhood_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && search.length >= 2 && suggestions.length === 0 && !isLoading && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50"
        >
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Nenhum endereço encontrado
          </div>
        </div>
      )}

      {isOpen && isLoading && search.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50"
        >
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Buscando...
          </div>
        </div>
      )}
    </div>
  );
}
