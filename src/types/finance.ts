// Finance module types

export type TransactionType = 'IN' | 'OUT';
export type BillStatus = 'open' | 'paid' | 'overdue';
export type RecurringType = 'expense' | 'payroll';
export type CategoryType = 'expense' | 'payroll' | 'purchase';

export interface ExpenseCategory {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  default_terms: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringRule {
  id: string;
  type: RecurringType;
  name: string;
  amount_default: number;
  day_of_month: number;
  category_id: string | null;
  vendor_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  category?: ExpenseCategory;
  vendor?: Vendor;
}

export interface ApBill {
  id: string;
  vendor_id: string | null;
  category_id: string | null;
  due_date: string;
  amount: number;
  status: BillStatus;
  is_recurring: boolean;
  recurring_rule_id: string | null;
  linked_stock_move_id: string | null;
  paid_at: string | null;
  paid_payment_method_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  vendor?: Vendor;
  category?: ExpenseCategory;
  payment_method?: { id: string; name: string };
}

export interface FinanceTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  transaction_date: string;
  payment_method_id: string | null;
  description: string | null;
  source_module: 'sales' | 'wallet' | 'stock' | 'expense' | 'payroll';
  source_id: string | null;
  created_by: string | null;
  created_at: string;
  // Joined
  payment_method?: { id: string; name: string };
}

export interface FinanceKPIs {
  totalIncome: number;
  totalExpenses: number;
  cashBalance: number;
  receivablesOpen: number;
  receivablesOverdue: number;
  payablesOpen: number;
  payablesOverdue: number;
  periodResult: number;
}

export interface DailyCashFlow {
  date: string;
  income: number;
  expenses: number;
  balance: number;
}
