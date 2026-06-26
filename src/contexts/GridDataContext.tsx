import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useProducts, usePaymentMethods, useSalesChannels, useDeliveryPeople, useNeighborhoods } from '@/hooks/useSupabaseQuery';
import { useCustomers } from '@/hooks/useCustomers';
import { useProductPaymentPrices } from '@/hooks/useProductPaymentPrices';
import { useProductChannelPrices } from '@/hooks/useProductChannelPrices';

interface GridDataContextType {
  products: ReturnType<typeof useProducts>['data'];
  customers: ReturnType<typeof useCustomers>['data'];
  paymentMethods: ReturnType<typeof usePaymentMethods>['data'];
  salesChannels: ReturnType<typeof useSalesChannels>['data'];
  deliveryPeople: ReturnType<typeof useDeliveryPeople>['data'];
  neighborhoods: ReturnType<typeof useNeighborhoods>['data'];
  productPaymentPrices: ReturnType<typeof useProductPaymentPrices>['data'];
  productChannelPrices: ReturnType<typeof useProductChannelPrices>['data'];
  isLoading: boolean;
}

const GridDataContext = createContext<GridDataContextType | null>(null);

export function GridDataProvider({ children }: { children: ReactNode }) {
  const { data: products, isLoading: loadingProducts } = useProducts();
  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  const { data: paymentMethods, isLoading: loadingPayments } = usePaymentMethods();
  const { data: salesChannels, isLoading: loadingChannels } = useSalesChannels();
  const { data: deliveryPeople, isLoading: loadingDeliverers } = useDeliveryPeople();
  const { data: neighborhoods, isLoading: loadingNeighborhoods } = useNeighborhoods();
  const { data: productPaymentPrices, isLoading: loadingPPP } = useProductPaymentPrices();
  const { data: productChannelPrices, isLoading: loadingPCP } = useProductChannelPrices();

  const isLoading = loadingProducts || loadingCustomers || loadingPayments || 
                    loadingChannels || loadingDeliverers || loadingNeighborhoods ||
                    loadingPPP || loadingPCP;

  const value = useMemo(() => ({
    products,
    customers,
    paymentMethods,
    salesChannels,
    deliveryPeople,
    neighborhoods,
    productPaymentPrices,
    productChannelPrices,
    isLoading,
  }), [products, customers, paymentMethods, salesChannels, deliveryPeople, 
      neighborhoods, productPaymentPrices, productChannelPrices, isLoading]);

  return (
    <GridDataContext.Provider value={value}>
      {children}
    </GridDataContext.Provider>
  );
}

export function useGridData() {
  const context = useContext(GridDataContext);
  if (!context) {
    throw new Error('useGridData must be used within a GridDataProvider');
  }
  return context;
}
