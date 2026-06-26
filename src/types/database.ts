// Database types matching Supabase schema

export type OrderStatus = 'accepted' | 'preparing' | 'sent' | 'delivered' | 'cancelled';
export type AppRole = 'admin' | 'manager' | 'operator' | 'finance' | 'deliverer';
export type StockMovementType = 'in' | 'out' | 'adjustment' | 'reserve' | 'release';
export type CreditStatus = 'open' | 'partial' | 'paid' | 'overdue';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  delivery_fee: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalesChannel {
  id: string;
  name: string;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string | null;
  requires_change: boolean;
  is_credit: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string | null;
  vehicle_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number;
  unit: string;
  min_stock: number;
  current_stock: number;
  reserved_stock: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  neighborhood_id: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  reference: string | null;
  notes: string | null;
  credit_limit: number;
  credit_balance: number;
  last_order_at: string | null;
  total_orders: number;
  total_spent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined relations
  neighborhood?: Neighborhood;
}

export interface Order {
  id: string;
  order_number: number;
  customer_id: string | null;
  channel_id: string | null;
  payment_method_id: string | null;
  delivery_person_id: string | null;
  neighborhood_id: string | null;
  status: OrderStatus;
  delivery_address: string | null;
  delivery_number: string | null;
  delivery_complement: string | null;
  delivery_reference: string | null;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  customer?: Customer;
  channel?: SalesChannel;
  payment_method?: PaymentMethod;
  delivery_person?: DeliveryPerson;
  neighborhood?: Neighborhood;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
  // Joined relations
  product?: Product;
}

export interface StockMovement {
  id: string;
  product_id: string;
  order_id: string | null;
  quantity: number;
  type: StockMovementType;
  reason: string | null;
  previous_stock: number | null;
  new_stock: number | null;
  created_by: string | null;
  created_at: string;
  // Joined relations
  product?: Product;
}

export interface CreditEntry {
  id: string;
  customer_id: string;
  order_id: string | null;
  amount: number;
  paid_amount: number;
  due_date: string;
  paid_at: string | null;
  status: CreditStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  customer?: Customer;
  order?: Order;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface DailySalesSummary {
  id: string;
  date: string;
  total_revenue: number;
  total_orders: number;
  avg_ticket: number;
  delivered_orders: number;
  cancelled_orders: number;
  updated_at: string;
}

// Insert types (for creating new records)
export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'last_order_at' | 'total_orders' | 'total_spent' | 'neighborhood'>;
export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
export type OrderInsert = Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at' | 'customer' | 'channel' | 'payment_method' | 'delivery_person' | 'neighborhood' | 'items'>;
export type OrderItemInsert = Omit<OrderItem, 'id' | 'created_at' | 'product'>;
export type NeighborhoodInsert = Omit<Neighborhood, 'id' | 'created_at' | 'updated_at'>;
export type SalesChannelInsert = Omit<SalesChannel, 'id' | 'created_at'>;
export type PaymentMethodInsert = Omit<PaymentMethod, 'id' | 'created_at'>;
export type DeliveryPersonInsert = Omit<DeliveryPerson, 'id' | 'created_at' | 'updated_at'>;
export type CreditEntryInsert = Omit<CreditEntry, 'id' | 'created_at' | 'updated_at' | 'customer' | 'order'>;
