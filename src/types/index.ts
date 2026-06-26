// Core types for the application

export type OrderStatus = 'accepted' | 'sent' | 'delivered' | 'canceled';

export interface CustomerTag {
  id: string;
  name: string;
  color: string;
}

export interface Customer {
  id: string;
  cpf: string;
  name: string;
  phone: string;
  email?: string;
  address: Address;
  tags: CustomerTag[];
  segment?: CustomerSegment;
  creditLimit?: number;
  lastOrderDate?: Date;
  totalOrders?: number;
  totalRevenue?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CustomerSegment = 'so_agua' | 'so_gas' | 'gas_agua' | 'inativo' | 'recorrente';

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  cost?: number;
  active: boolean;
  minStock: number;
  currentStock: number;
  createdAt: Date;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'credit' | 'debit' | 'pix' | 'credit_account';
  active: boolean;
}

export interface SalesChannel {
  id: string;
  name: string;
  active: boolean;
}

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  channelId: string;
  channelName: string;
  status: OrderStatus;
  totalAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  deliveryPersonId: string;
  deliveryPersonName: string;
  deliveryAddress: Address;
  items: OrderItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  canceledAt?: Date;
}

export interface KPIData {
  revenue: number;
  revenueChange: number;
  salesCount: number;
  salesCountChange: number;
  averageTicket: number;
  averageTicketChange: number;
  itemsSold: number;
  itemsSoldChange: number;
  cancellationRate: number;
  cancellationRateChange: number;
  avgDeliveryTime: number;
  avgDeliveryTimeChange: number;
}

export interface GlobalFilters {
  dateRange: { from: Date; to: Date };
  channelId?: string;
  deliveryPersonId?: string;
  productId?: string;
  paymentMethodId?: string;
}

// Credit/Wallet Types
export type CreditEntryStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'renegotiated';

export interface CreditAccount {
  id: string;
  customerId: string;
  customerName: string;
  limitAmount: number;
  balance: number;
  createdAt: Date;
}

export interface CreditEntry {
  id: string;
  creditAccountId: string;
  customerId: string;
  customerName: string;
  orderId?: string;
  order?: Order;
  amount: number;
  originalAmount: number;
  dueDate: Date;
  status: CreditEntryStatus;
  paidAt?: Date;
  paidAmount?: number;
  payments?: CreditPayment[];
  createdAt: Date;
}

export interface CreditPayment {
  id: string;
  creditEntryId: string;
  amount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  paidAt: Date;
  createdBy: string;
}

// Stock Movement Types
export type StockMoveType = 'entry' | 'exit' | 'adjustment';

export interface StockMove {
  id: string;
  productId: string;
  productName: string;
  type: StockMoveType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceId?: string;
  createdBy: string;
  createdAt: Date;
}

// Audit Log Types
export type AuditAction = 'create' | 'update' | 'delete' | 'status_change';

export interface AuditLog {
  id: string;
  entityType: 'order' | 'customer' | 'product' | 'credit_entry' | 'stock_move' | 'user';
  entityId: string;
  action: AuditAction;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  userId: string;
  userName: string;
  description: string;
  createdAt: Date;
}

// User & RBAC Types
export type UserRole = 'admin' | 'manager' | 'operator' | 'delivery';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  lastLogin?: Date;
  createdAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  roles: UserRole[];
}

// Dashboard Panel Block Types
export type PanelBlockType = 'kpi' | 'sales' | 'customers' | 'operation' | 'stock' | 'credit';

export interface PanelBlock {
  id: string;
  type: PanelBlockType;
  title: string;
  order: number;
  visible: boolean;
}
