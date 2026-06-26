import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Customer, Product, DeliveryPerson, PaymentMethod, SalesChannel } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Initial data
const initialProducts: Product[] = [
  { id: '1', sku: 'AGUA20', name: 'Água 20L', price: 12.00, cost: 8.00, active: true, minStock: 50, currentStock: 0, createdAt: new Date() },
  { id: '2', sku: 'GAS13', name: 'Gás 13kg', price: 110.00, cost: 95.00, active: true, minStock: 20, currentStock: 0, createdAt: new Date() },
  { id: '3', sku: 'AGUA10', name: 'Água 10L', price: 8.00, cost: 5.00, active: true, minStock: 30, currentStock: 0, createdAt: new Date() },
  { id: '4', sku: 'GAS45', name: 'Gás 45kg', price: 380.00, cost: 340.00, active: true, minStock: 5, currentStock: 0, createdAt: new Date() },
  { id: '5', sku: 'COMBO1', name: 'Combo Água + Gás', price: 115.00, cost: 100.00, active: true, minStock: 10, currentStock: 0, createdAt: new Date() },
];

const initialPaymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Dinheiro', type: 'cash', active: true },
  { id: '2', name: 'PIX', type: 'pix', active: true },
  { id: '3', name: 'Cartão de Crédito', type: 'credit', active: true },
  { id: '4', name: 'Cartão de Débito', type: 'debit', active: true },
  { id: '5', name: 'Crediário', type: 'credit_account', active: true },
];

const initialSalesChannels: SalesChannel[] = [
  { id: '1', name: 'WhatsApp', active: true },
  { id: '2', name: 'Telefone', active: true },
  { id: '3', name: 'Loja Física', active: true },
  { id: '4', name: 'App', active: true },
];

const initialDeliveryPeople: DeliveryPerson[] = [
  { id: '1', name: 'Carlos Entregador', phone: '(11) 91111-1111', active: true },
  { id: '2', name: 'Roberto Entregas', phone: '(11) 92222-2222', active: true },
  { id: '3', name: 'Fernando Delivery', phone: '(11) 93333-3333', active: true },
];

export interface Neighborhood {
  id: string;
  name: string;
  active: boolean;
}

const initialNeighborhoods: Neighborhood[] = [
  { id: '1', name: 'Centro', active: true },
  { id: '2', name: 'Jardim América', active: true },
  { id: '3', name: 'Vila Nova', active: true },
];

interface DataStore {
  // Data
  customers: Customer[];
  products: Product[];
  deliveryPeople: DeliveryPerson[];
  paymentMethods: PaymentMethod[];
  salesChannels: SalesChannel[];
  neighborhoods: Neighborhood[];

  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;

  // Product actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  updateStock: (id: string, quantity: number) => void;

  // Delivery people actions
  addDeliveryPerson: (person: Omit<DeliveryPerson, 'id'>) => void;
  updateDeliveryPerson: (id: string, data: Partial<DeliveryPerson>) => void;
  deleteDeliveryPerson: (id: string) => void;

  // Payment methods actions
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => void;
  updatePaymentMethod: (id: string, data: Partial<PaymentMethod>) => void;

  // Sales channels actions
  addSalesChannel: (channel: Omit<SalesChannel, 'id'>) => void;
  updateSalesChannel: (id: string, data: Partial<SalesChannel>) => void;

  // Neighborhood actions
  addNeighborhood: (neighborhood: Omit<Neighborhood, 'id'>) => void;
  updateNeighborhood: (id: string, data: Partial<Neighborhood>) => void;
  deleteNeighborhood: (id: string) => void;
}

export const useDataStore = create<DataStore>()(
  persist(
    (set) => ({
      customers: [],
      products: initialProducts,
      deliveryPeople: initialDeliveryPeople,
      paymentMethods: initialPaymentMethods,
      salesChannels: initialSalesChannels,
      neighborhoods: initialNeighborhoods,

      // Customer actions
      addCustomer: (customer) => set((state) => ({
        customers: [...state.customers, {
          ...customer,
          id: uuidv4(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
      })),
      updateCustomer: (id, data) => set((state) => ({
        customers: state.customers.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date() } : c
        ),
      })),
      deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter((c) => c.id !== id),
      })),

      // Product actions
      addProduct: (product) => set((state) => ({
        products: [...state.products, {
          ...product,
          id: uuidv4(),
          createdAt: new Date(),
        }],
      })),
      updateProduct: (id, data) => set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, ...data } : p
        ),
      })),
      deleteProduct: (id) => set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      })),
      updateStock: (id, quantity) => set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, currentStock: quantity } : p
        ),
      })),

      // Delivery people actions
      addDeliveryPerson: (person) => set((state) => ({
        deliveryPeople: [...state.deliveryPeople, {
          ...person,
          id: uuidv4(),
        }],
      })),
      updateDeliveryPerson: (id, data) => set((state) => ({
        deliveryPeople: state.deliveryPeople.map((p) =>
          p.id === id ? { ...p, ...data } : p
        ),
      })),
      deleteDeliveryPerson: (id) => set((state) => ({
        deliveryPeople: state.deliveryPeople.filter((p) => p.id !== id),
      })),

      // Payment methods actions
      addPaymentMethod: (method) => set((state) => ({
        paymentMethods: [...state.paymentMethods, {
          ...method,
          id: uuidv4(),
        }],
      })),
      updatePaymentMethod: (id, data) => set((state) => ({
        paymentMethods: state.paymentMethods.map((m) =>
          m.id === id ? { ...m, ...data } : m
        ),
      })),

      // Sales channels actions
      addSalesChannel: (channel) => set((state) => ({
        salesChannels: [...state.salesChannels, {
          ...channel,
          id: uuidv4(),
        }],
      })),
      updateSalesChannel: (id, data) => set((state) => ({
        salesChannels: state.salesChannels.map((c) =>
          c.id === id ? { ...c, ...data } : c
        ),
      })),

      // Neighborhood actions
      addNeighborhood: (neighborhood) => set((state) => ({
        neighborhoods: [...state.neighborhoods, {
          ...neighborhood,
          id: uuidv4(),
        }],
      })),
      updateNeighborhood: (id, data) => set((state) => ({
        neighborhoods: state.neighborhoods.map((n) =>
          n.id === id ? { ...n, ...data } : n
        ),
      })),
      deleteNeighborhood: (id) => set((state) => ({
        neighborhoods: state.neighborhoods.filter((n) => n.id !== id),
      })),
    }),
    {
      name: 'aquagas-data-store',
    }
  )
);
