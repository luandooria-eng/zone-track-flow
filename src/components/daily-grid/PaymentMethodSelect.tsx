import { memo, useMemo } from 'react';
import { useGridData } from '@/contexts/GridDataContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PaymentMethodSelectProps {
  value: string;
  onChange: (value: unknown, price?: number) => void;
  disabled?: boolean;
  productName?: string;
  salesChannel?: string;
}

// Helper to get color class based on payment method
function getPaymentMethodColorClass(value: string): string {
  const lowerValue = value?.toLowerCase() || '';
  
  // Yellow for "Fazer Pix" or variations
  if (lowerValue.includes('pix') && (lowerValue.includes('fazer') || lowerValue.includes('pendente') || lowerValue.includes('aguardando'))) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200';
  }
  
  // Red for "Em Aberto"
  if (lowerValue.includes('em aberto') || lowerValue === 'aberto') {
    return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
  }
  
  return '';
}

export const PaymentMethodSelect = memo(function PaymentMethodSelect({ 
  value, 
  onChange, 
  disabled, 
  productName 
}: PaymentMethodSelectProps) {
  const { 
    paymentMethods = [], 
    products = [], 
    productPaymentPrices = [],
    isLoading 
  } = useGridData();
  
  const activeMethods = paymentMethods?.filter(m => m.is_active) || [];

  const handleChange = (methodName: string) => {
    const method = activeMethods.find(m => m.name === methodName);
    
    // Check if there's a custom price for this payment method + product
    let customPrice: number | undefined;
    if (method && productName) {
      const product = products.find(p => p.name === productName);
      if (product) {
        const paymentPrice = productPaymentPrices.find(
          pp => pp.product_id === product.id && pp.payment_method_id === method.id
        );
        if (paymentPrice) {
          customPrice = paymentPrice.price;
        }
      }
    }
    
    onChange(methodName, customPrice);
  };

  // Memoize color class
  const colorClass = useMemo(() => getPaymentMethodColorClass(value), [value]);

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger 
        className={cn(
          "h-8 border-none shadow-none bg-transparent text-sm px-1 rounded",
          colorClass
        )}
      >
        <SelectValue placeholder="Pagamento..." />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {activeMethods.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
            Cadastre formas de pagamento em Configurações
          </div>
        ) : (
          activeMethods.map((method) => {
            const itemColorClass = getPaymentMethodColorClass(method.name);
            return (
              <SelectItem 
                key={method.id} 
                value={method.name}
                className={cn(itemColorClass && "font-medium", itemColorClass)}
              >
                {method.name}
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
});
