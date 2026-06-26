import { useState, useEffect, useRef } from 'react';
import { Search, User, UserX } from 'lucide-react';
import { useGridData } from '@/contexts/GridDataContext';
import { cn } from '@/lib/utils';

const UNIDENTIFIED_CUSTOMER = {
  id: 'S.ID',
  name: 'S.ID - Sem Identificação',
  displayName: 'S.ID',
};

interface CustomerAutocompleteProps {
  value: string;
  onChange: (name: string, customerId?: string) => void;
  disabled?: boolean;
  isEditing?: boolean;
}

export function CustomerAutocomplete({
  value,
  onChange,
  disabled,
  isEditing,
}: CustomerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { customers } = useGridData();
  const customersList = customers ?? [];

  useEffect(() => {
    setSearch(value);
  }, [value]);

  const filteredCustomers = search.length >= 2
    ? customersList.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search) ||
          c.cpf?.includes(search)
      )
    : [];

  // Only show S.ID option when explicitly searching for it by typing "s" followed by ID patterns
  const searchLower = search.toLowerCase().trim();
  const isSearchingForSID = searchLower === 's' || 
    searchLower === 's.' ||
    searchLower === 's.i' ||
    searchLower === 's.id' ||
    searchLower === 'sid' ||
    searchLower.startsWith('sem id') ||
    searchLower.startsWith('sem iden');
  
  const showUnidentifiedOption = search.length === 0 || (isSearchingForSID && filteredCustomers.length === 0);

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

  const handleSelect = (customer: typeof customersList[0]) => {
    onChange(customer.name, customer.id);
    setSearch(customer.name);
    setIsOpen(false);
  };

  const handleSelectUnidentified = () => {
    onChange(UNIDENTIFIED_CUSTOMER.displayName, undefined);
    setSearch(UNIDENTIFIED_CUSTOMER.displayName);
    setIsOpen(false);
  };

  const isUnidentified = value === UNIDENTIFIED_CUSTOMER.displayName || value === 'S.ID';

  if (!isEditing) {
    return (
      <span className="text-sm truncate flex items-center gap-1">
        {isUnidentified ? (
          <>
            <UserX className="h-3 w-3 text-orange-500" />
            <span className="text-orange-600 font-medium">S.ID</span>
          </>
        ) : value ? (
          <>
            <User className="h-3 w-3 text-muted-foreground" />
            {value}
          </>
        ) : (
          <span className="text-muted-foreground">Selecionar cliente...</span>
        )}
      </span>
    );
  }

  const hasResults = showUnidentifiedOption || filteredCustomers.length > 0;

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-1">
        <Search className="h-3 w-3 text-muted-foreground" />
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
          placeholder="Buscar cliente..."
          disabled={disabled}
        />
      </div>

      {isOpen && hasResults && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {/* S.ID Option - Always shown first when matching */}
          {showUnidentifiedOption && (
            <button
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
                'flex items-center gap-2 border-b border-border/50'
              )}
              onClick={handleSelectUnidentified}
            >
              <UserX className="h-4 w-4 text-orange-500" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-orange-600">S.ID - Sem Identificação</span>
                <span className="text-xs text-muted-foreground">
                  Cliente não cadastrado no sistema
                </span>
              </div>
            </button>
          )}

          {/* Regular customers */}
          {filteredCustomers.slice(0, 10).map((customer) => (
            <button
              key={customer.id}
              className={cn(
                'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
                'flex flex-col gap-0.5'
              )}
              onClick={() => handleSelect(customer)}
            >
              <span className="font-medium">{customer.name}</span>
              <span className="text-xs text-muted-foreground">
                {customer.phone} • {customer.neighborhood?.name || 'Sem bairro'}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && !hasResults && search.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50"
        >
          <button
            className={cn(
              'w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors',
              'flex items-center gap-2'
            )}
            onClick={handleSelectUnidentified}
          >
            <UserX className="h-4 w-4 text-orange-500" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-orange-600">S.ID - Sem Identificação</span>
              <span className="text-xs text-muted-foreground">
                Usar para cliente não cadastrado
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
