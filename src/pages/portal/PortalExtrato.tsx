import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchLedger } from '@/lib/portalApi';
import { useQuery } from '@tanstack/react-query';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { motion } from 'framer-motion';
import { TrendingUp, Filter } from 'lucide-react';
import { format } from 'date-fns';

const FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'credit', label: 'Créditos' },
  { value: 'debit', label: 'Débitos' },
];

export default function PortalExtrato() {
  const { customer, isAuthenticated, isLoading } = usePortalAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/c/login');
  }, [isLoading, isAuthenticated, navigate]);

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['portal-ledger-full', customer?.id],
    enabled: !!customer?.id,
    queryFn: () => fetchLedger(customer!.id, 200),
  });

  if (isLoading || !customer) return null;

  const filtered = filter === 'all' ? ledger : ledger?.filter((e: any) => e.type === filter);

  return (
    <PortalLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Extrato de Pontos</h2>

        {/* Filters */}
        <div className="flex gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-[hsl(var(--portal-primary))] text-white'
                  : 'bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-muted-foreground))] hover:bg-[hsl(var(--portal-border))]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] divide-y divide-[hsl(var(--portal-border))]">
          {ledgerLoading ? (
            <div className="p-6 text-center text-sm text-[hsl(var(--portal-muted-foreground))]">Carregando...</div>
          ) : !filtered?.length ? (
            <div className="p-6 text-center text-sm text-[hsl(var(--portal-muted-foreground))]">Nenhuma movimentação encontrada</div>
          ) : filtered.map((entry: any, i: number) => (
            <motion.div
              key={entry.id}
              className="flex items-center justify-between px-4 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(0.02 * i, 0.5) }}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  entry.type === 'credit' ? 'bg-[hsl(var(--portal-success))/0.1]' : 'bg-[hsl(var(--portal-destructive))/0.1]'
                }`}>
                  <TrendingUp className={`h-4 w-4 ${
                    entry.type === 'credit' ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-destructive))] rotate-180'
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{entry.description || entry.origin}</p>
                  <p className="text-[10px] text-[hsl(var(--portal-muted-foreground))]">
                    {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm")} · {entry.origin}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold shrink-0 ml-2 ${
                entry.type === 'credit' ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-destructive))]'
              }`}>
                {entry.type === 'credit' ? '+' : '-'}{entry.points}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
