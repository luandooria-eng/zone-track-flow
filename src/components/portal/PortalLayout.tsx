import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Receipt, Gift, Ticket, Users2, LogOut, Home } from 'lucide-react';

const navItems = [
  { path: '/c', icon: Home, label: 'Início' },
  { path: '/c/extrato', icon: Receipt, label: 'Extrato' },
  { path: '/c/catalogo', icon: Gift, label: 'Resgatar' },
  { path: '/c/vouchers', icon: Ticket, label: 'Vouchers' },
  { path: '/c/indicar', icon: Users2, label: 'Indicar' },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const { customer, logout } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="portal-theme h-[100dvh] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--portal-primary))] text-white shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[hsl(var(--portal-accent))]" />
            <span className="font-semibold text-sm">Clube de Pontos</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs opacity-80">{customer?.name}</p>
              <p className="text-sm font-bold flex items-center gap-1">
                <Star className="h-3 w-3 text-[hsl(var(--portal-accent))]" />
                {(customer?.points_balance ?? 0).toLocaleString('pt-BR')} pts
              </p>
            </div>
            <button
              onClick={() => { logout(); navigate('/c/login'); }}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-4 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="shrink-0 bg-[hsl(var(--portal-card))] border-t border-[hsl(var(--portal-border))] shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1.5">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors text-[10px] font-medium ${
                  isActive
                    ? 'text-[hsl(var(--portal-primary))]'
                    : 'text-[hsl(var(--portal-muted-foreground))] hover:text-[hsl(var(--portal-card-foreground))]'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
