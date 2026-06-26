import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getStoredToken, getStoredCustomer, saveSession, clearSession, fetchPortalCustomer } from '@/lib/portalApi';

interface PortalCustomer {
  id: string;
  name: string;
  phone: string;
  points_balance: number;
  email?: string;
}

interface PortalAuthContextType {
  customer: PortalCustomer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, customer: PortalCustomer) => void;
  logout: () => void;
  refreshCustomer: () => Promise<void>;
}

const PortalAuthContext = createContext<PortalAuthContextType>({} as PortalAuthContextType);

export function usePortalAuth() {
  return useContext(PortalAuthContext);
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchPortalCustomer(token)
        .then((c) => { setCustomer(c); saveSession(token, c); })
        .catch(() => { clearSession(); })
        .finally(() => setIsLoading(false));
    } else {
      const stored = getStoredCustomer();
      if (stored) setCustomer(stored);
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((token: string, cust: PortalCustomer) => {
    saveSession(token, cust);
    setCustomer(cust);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCustomer(null);
  }, []);

  const refreshCustomer = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const c = await fetchPortalCustomer(token);
      setCustomer(c);
    } catch { /* session may be expired */ }
  }, []);

  return (
    <PortalAuthContext.Provider value={{ customer, isLoading, isAuthenticated: !!customer, login, logout, refreshCustomer }}>
      {children}
    </PortalAuthContext.Provider>
  );
}
