import { memo, useState, useRef, useEffect } from 'react';
import { useGridData } from '@/contexts/GridDataContext';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface ProductSelectProps {
  value: string;
  onChange: (value: unknown, price?: number, productId?: string) => void;
  disabled?: boolean;
  paymentMethod?: string;
  salesChannel?: string;
}

// Normalize string for search (remove accents)
const normalizeString = (str: string) => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export const ProductSelect = memo(function ProductSelect({ 
  value, 
  onChange, 
  disabled, 
  paymentMethod, 
  salesChannel 
}: ProductSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  
  const { 
    products = [], 
    paymentMethods = [], 
    salesChannels = [],
    productPaymentPrices = [],
    productChannelPrices = [],
    isLoading 
  } = useGridData();
  
  const activeProducts = products?.filter(p => p.is_active) || [];

  const handleSelect = (productName: string) => {
    const product = activeProducts.find(p => p.name === productName);
    if (!product) {
      onChange(productName);
      setOpen(false);
      return;
    }

    let finalPrice = product.price;
    const channel = salesChannels.find(c => c.name === salesChannel);
    const orderFee = (channel as any)?.order_fee ?? 0;
    const deliveryFee = (channel as any)?.delivery_fee ?? 0;
    const totalFees = orderFee + deliveryFee;
    let foundCustomPrice = false;

    // 1. Check product_channel_prices for channel-specific price
    if (channel) {
      const channelPrice = productChannelPrices.find(
        cp => cp.product_id === product.id && cp.channel_id === channel.id
      );
      if (channelPrice) {
        finalPrice = channelPrice.price + totalFees;
        foundCustomPrice = true;
      }
    }

    // 2. Fallback: check product_payment_prices for matching channel name or selected payment method
    if (!foundCustomPrice) {
      // First try matching a payment method with the same name as the channel
      if (channel) {
        const matchingPM = paymentMethods.find(
          m => m.name.toLowerCase().trim() === salesChannel!.toLowerCase().trim()
        );
        if (matchingPM) {
          const paymentPrice = productPaymentPrices.find(
            pp => pp.product_id === product.id && pp.payment_method_id === matchingPM.id
          );
          if (paymentPrice) {
            finalPrice = paymentPrice.price + totalFees;
            foundCustomPrice = true;
          }
        }
      }
      
      // Then try the selected payment method
      if (!foundCustomPrice && paymentMethod) {
        const pm = paymentMethods.find(m => m.name === paymentMethod);
        if (pm) {
          const paymentPrice = productPaymentPrices.find(
            pp => pp.product_id === product.id && pp.payment_method_id === pm.id
          );
          if (paymentPrice) {
            finalPrice = paymentPrice.price;
            foundCustomPrice = true;
          }
        }
      }
    }

    // 3. If no custom price but channel has order_fee, add it to base price
    if (!foundCustomPrice && totalFees > 0) {
      finalPrice = product.price + totalFees;
    }

    onChange(productName, finalPrice, product.id);
    setOpen(false);
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-8 w-full justify-between px-2 font-normal text-sm hover:bg-transparent"
        >
          <span className="truncate">
            {value || <span className="text-muted-foreground">Produto...</span>}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command
          filter={(value, search) => {
            // Custom filter that normalizes accents
            const normalizedValue = normalizeString(value);
            const normalizedSearch = normalizeString(search);
            return normalizedValue.includes(normalizedSearch) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Buscar produto..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
            <CommandGroup>
              {activeProducts.length === 0 ? (
                <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                  Cadastre produtos em Configurações
                </div>
              ) : (
                activeProducts.map((product) => {
                  const stockLow = (product.current_stock ?? 0) <= (product.min_stock ?? 0);
                  return (
                    <CommandItem
                      key={product.id}
                      value={product.name}
                      onSelect={() => handleSelect(product.name)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value === product.name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{product.name}</span>
                      </div>
                      <span className={cn(
                        'text-xs whitespace-nowrap',
                        stockLow ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        R$ {product.price.toFixed(2)}
                        {stockLow && ' ⚠️'}
                      </span>
                    </CommandItem>
                  );
                })
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
