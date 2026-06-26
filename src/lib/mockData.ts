import { Customer, Product, Order, PaymentMethod, SalesChannel, DeliveryPerson, KPIData, CreditAccount, CreditEntry, StockMove, AuditLog, User } from '@/types';

// ==========================================
// DADOS ZERADOS - INÍCIO LIMPO
// Estrutura mantida para rastreabilidade futura
// ==========================================

// Clientes - Vazio (cadastrar novos)
export const mockCustomers: Customer[] = [];

// Produtos - Manter catálogo base
export const mockProducts: Product[] = [
  { id: '1', sku: 'AGUA20', name: 'Água 20L', price: 12.00, cost: 8.00, active: true, minStock: 50, currentStock: 0, createdAt: new Date() },
  { id: '2', sku: 'GAS13', name: 'Gás 13kg', price: 110.00, cost: 95.00, active: true, minStock: 20, currentStock: 0, createdAt: new Date() },
  { id: '3', sku: 'AGUA10', name: 'Água 10L', price: 8.00, cost: 5.00, active: true, minStock: 30, currentStock: 0, createdAt: new Date() },
  { id: '4', sku: 'GAS45', name: 'Gás 45kg', price: 380.00, cost: 340.00, active: true, minStock: 5, currentStock: 0, createdAt: new Date() },
  { id: '5', sku: 'COMBO1', name: 'Combo Água + Gás', price: 115.00, cost: 100.00, active: true, minStock: 10, currentStock: 0, createdAt: new Date() },
];

// Formas de Pagamento - Manter configuração
export const mockPaymentMethods: PaymentMethod[] = [
  { id: '1', name: 'Dinheiro', type: 'cash', active: true },
  { id: '2', name: 'PIX', type: 'pix', active: true },
  { id: '3', name: 'Cartão de Crédito', type: 'credit', active: true },
  { id: '4', name: 'Cartão de Débito', type: 'debit', active: true },
  { id: '5', name: 'Crediário', type: 'credit_account', active: true },
];

// Canais de Venda - Manter configuração
export const mockSalesChannels: SalesChannel[] = [
  { id: '1', name: 'WhatsApp', active: true },
  { id: '2', name: 'Telefone', active: true },
  { id: '3', name: 'Loja Física', active: true },
  { id: '4', name: 'App', active: true },
];

// Entregadores - Manter configuração
export const mockDeliveryPeople: DeliveryPerson[] = [
  { id: '1', name: 'Carlos Entregador', phone: '(11) 91111-1111', active: true },
  { id: '2', name: 'Roberto Entregas', phone: '(11) 92222-2222', active: true },
  { id: '3', name: 'Fernando Delivery', phone: '(11) 93333-3333', active: true },
];

// Pedidos - Zerado (novos pedidos a partir de agora)
export const mockOrders: Order[] = [];

// KPIs - Zerados (calcular a partir de novos pedidos)
export const mockKPIData: KPIData = {
  revenue: 0,
  revenueChange: 0,
  salesCount: 0,
  salesCountChange: 0,
  averageTicket: 0,
  averageTicketChange: 0,
  itemsSold: 0,
  itemsSoldChange: 0,
  cancellationRate: 0,
  cancellationRateChange: 0,
  avgDeliveryTime: 0,
  avgDeliveryTimeChange: 0,
};

// Dados de Gráficos - Zerados
export const mockSalesChartData: { date: string; revenue: number; sales: number }[] = [];

export const mockProductsChartData: { name: string; value: number; fill: string }[] = [];

export const mockPaymentChartData: { name: string; current: number; previous: number }[] = [];

// Contas de Crédito - Zerado
export const mockCreditAccounts: CreditAccount[] = [];

// Títulos de Crédito - Zerado
export const mockCreditEntries: CreditEntry[] = [];

// Movimentos de Estoque - Zerado
export const mockStockMoves: StockMove[] = [];

// Logs de Auditoria - Zerado (novo histórico a partir de agora)
export const mockAuditLogs: AuditLog[] = [];

// Usuário Admin - Manter para acesso
export const mockUsers: User[] = [
  { id: '1', name: 'Administrador', email: 'admin@aquagas.com', role: 'admin', active: true, lastLogin: new Date(), createdAt: new Date() },
];
