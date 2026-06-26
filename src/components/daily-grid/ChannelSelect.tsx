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

interface ChannelSelectProps {
  value: string;
  onChange: (value: unknown, price?: number) => void;
  disabled?: boolean;
  productName?: string;
  paymentMethod?: string;
}

export const ChannelSelect = memo(function ChannelSelect({ 
  value, 
  onChange, 
  disabled, 
  productName 
}: ChannelSelectProps) {
  const { 
    salesChannels = [], 
    products = [], 
    productChannelPrices = [],
    productPaymentPrices = [],
    paymentMethods = [],
    isLoading 
  } = useGridData();
  
  const activeChannels = salesChannels?.filter(c => c.is_active) || [];

  const handleChange = (channelName: string) => {
    const channel = activeChannels.find(c => c.name === channelName);
    if (!channel) {
      onChange(channelName);
      return;
    }
    
    const orderFee = (channel as any).order_fee ?? 0;
    const deliveryFee = (channel as any).delivery_fee ?? 0;
    const totalFees = orderFee + deliveryFee;
    
    // Check if there's a custom price for this channel + product
    let customPrice: number | undefined;
    if (productName) {
      const product = products.find(p => p.name === productName);
      if (product) {
        // 1. First check product_channel_prices
        const channelPrice = productChannelPrices.find(
          cp => cp.product_id === product.id && cp.channel_id === channel.id
        );
        if (channelPrice) {
           customPrice = channelPrice.price + totalFees;
         } else {
          // 2. Fallback: check product_payment_prices for a payment method with the same name
          const matchingPaymentMethod = paymentMethods.find(
            pm => pm.name.toLowerCase().trim() === channelName.toLowerCase().trim()
          );
          if (matchingPaymentMethod) {
            const paymentPrice = productPaymentPrices.find(
              pp => pp.product_id === product.id && pp.payment_method_id === matchingPaymentMethod.id
            );
            if (paymentPrice) {
              customPrice = paymentPrice.price + totalFees;
            }
          }
        }
        
        // 3. If no custom price found but there's an order fee, add it to current product price
        if (customPrice === undefined && totalFees > 0) {
          customPrice = (product.price ?? 0) + totalFees;
        }
      }
    }
    
    onChange(channelName, customPrice);
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
        <SelectValue placeholder="Canal..." />
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {activeChannels.length === 0 ? (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
            Cadastre canais em Configurações
          </div>
        ) : (
          activeChannels.map((channel) => (
            <SelectItem key={channel.id} value={channel.name}>
              {channel.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
});
