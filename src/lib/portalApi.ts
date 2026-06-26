import { supabase } from '@/integrations/supabase/client';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

async function callFunction(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  if (!digits.startsWith('55')) digits = '55' + digits;
  return '+' + digits;
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone;
}

// New password-based auth API
export async function checkPhone(phone: string) {
  return callFunction('portal-auth', { action: 'check', phone });
}

export async function portalLogin(phone: string, password: string) {
  return callFunction('portal-auth', { action: 'login', phone, password });
}

export async function portalRegister(phone: string, password: string, name: string) {
  return callFunction('portal-auth', { action: 'register', phone, password, name });
}

export async function portalSetPassword(phone: string, password: string) {
  return callFunction('portal-auth', { action: 'set_password', phone, password });
}

// Legacy — keep for backwards compat but no longer used
export async function sendOtp(phone: string) {
  return callFunction('portal-send-otp', { phone });
}

export async function verifyOtp(phone: string, code: string, name?: string) {
  return callFunction('portal-verify-otp', { phone, code, name });
}

export async function validateSession(token: string) {
  return callFunction('portal-session', { token });
}

// Session storage
const TOKEN_KEY = 'portal_session_token';
const CUSTOMER_KEY = 'portal_customer';

export function saveSession(token: string, customer: any) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredCustomer(): any | null {
  const raw = localStorage.getItem(CUSTOMER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_KEY);
}

// Fetch fresh customer data using service-level token validation
export async function fetchPortalCustomer(token: string) {
  const result = await validateSession(token);
  if (!result.success) throw new Error('Invalid session');
  saveSession(token, result.customer);
  return result.customer;
}

// Fetch ledger for customer
export async function fetchLedger(customerId: string, limit = 50) {
  const { data, error } = await supabase
    .from('loyalty_ledger')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Fetch vouchers for customer
export async function fetchVouchers(customerId: string) {
  const { data, error } = await supabase
    .from('loyalty_vouchers')
    .select('*, coupon:loyalty_coupons(title, description)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Fetch active coupons
export async function fetchCoupons() {
  const { data, error } = await supabase
    .from('loyalty_coupons')
    .select('*')
    .eq('is_active', true)
    .order('points_cost', { ascending: true });
  if (error) throw error;
  return data || [];
}
