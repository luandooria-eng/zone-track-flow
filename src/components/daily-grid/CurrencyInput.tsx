import { useState, useEffect, useRef } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  isEditing?: boolean;
}

export function CurrencyInput({ value, onChange, disabled, isEditing }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [localEditing, setLocalEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localEditing) {
      setDisplayValue(formatCurrency(value));
    }
  }, [value, localEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const parseCurrency = (str: string): number => {
    const cleaned = str.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
  };

  const handleFocus = () => {
    setLocalEditing(true);
    // Show raw number for easier editing
    setDisplayValue(value > 0 ? value.toFixed(2).replace('.', ',') : '');
  };

  const handleBlur = () => {
    setLocalEditing(false);
    const numericValue = parseCurrency(displayValue);
    onChange(numericValue);
    setDisplayValue(formatCurrency(numericValue));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const numericValue = parseCurrency(displayValue);
      onChange(numericValue);
      setLocalEditing(false);
      setDisplayValue(formatCurrency(numericValue));
    }
    if (e.key === 'Escape') {
      setLocalEditing(false);
      setDisplayValue(formatCurrency(value));
    }
  };

  if (!isEditing && !localEditing) {
    return (
      <span className="text-sm font-medium">
        {formatCurrency(value)}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="w-full bg-transparent border-none outline-none text-sm font-medium text-right"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder="0,00"
    />
  );
}
