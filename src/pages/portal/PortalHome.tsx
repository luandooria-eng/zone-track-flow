import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchLedger, fetchCoupons } from '@/lib/portalApi';
import { useQuery } from '@tanstack/react-query';
import { useCustomerLevel, useCustomerBadges, useCustomerMissions, useLoyaltyMissions } from '@/hooks/useLoyaltyGamification';
import { motion } from 'framer-motion';
import { Star, Gift, Receipt, Users2, TrendingUp, ChevronRight, Trophy, Target } from 'lucide-react';
import { format } from 'date-fns';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { AnimatedCounter } from '@/components/portal/AnimatedCounter';
import { Progress } from '@/components/ui/progress';

export default function PortalHome() {
  const { customer, isAuthenticated, isLoading } = usePortalAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/c/login');
  }, [isLoading, isAuthenticated, navigate]);

  const balance = customer?.points_balance ?? 0;
  const customerId = customer?.id;
  const { current: currentLevel, next: nextLevel, progress: levelProgress } = useCustomerLevel(balance);
  const { data: badgeAwards } = useCustomerBadges(customerId);
  const { data: missionProgress } = useCustomerMissions(customerId);
  const { data: allMissions } = useLoyaltyMissions();

  const { data: ledger } = useQuery({
    queryKey: ['portal-ledger', customerId],
    enabled: !!customerId,
    queryFn: () => fetchLedger(customerId!, 5),
  });

  const { data: coupons } = useQuery({
    queryKey: ['portal-coupons'],
    enabled: !!customerId,
    queryFn: fetchCoupons,
  });

  if (isLoading || !customer) return null;

  const cheapestCoupon = coupons?.length ? coupons[0] : null;
  const now = new Date();
  const activeMissions = (allMissions || []).filter((m: any) => m.is_active && new Date(m.starts_at) <= now && new Date(m.ends_at) >= now);
  const progressMap = new Map((missionProgress || []).map((p: any) => [p.mission_id, p]));

  return (
    <PortalLayout>
      <div className="space-y-5">
        {/* Balance Card */}
        <motion.div
          className="rounded-2xl p-6 text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg, hsl(var(--portal-primary)), hsl(211 85% 30%))' }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[hsl(var(--portal-accent))]" />
              <span className="text-sm opacity-90">Seu saldo</span>
            </div>
            {currentLevel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                {(currentLevel as any).icon} {(currentLevel as any).name}
              </span>
            )}
          </div>
          <AnimatedCounter value={balance} className="text-4xl font-bold tracking-tight" />
          <p className="text-sm opacity-70 mt-0.5">pontos disponíveis</p>

          {nextLevel && (
            <div className="mt-4">
              <div className="flex justify-between text-xs opacity-70 mb-1">
                <span>{(currentLevel as any)?.name || 'Início'}</span>
                <span>{(nextLevel as any).name}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <motion.div
                  className="h-2 rounded-full bg-[hsl(var(--portal-accent))]"
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Gift, label: 'Resgatar', path: '/c/catalogo', color: 'var(--portal-accent)' },
            { icon: Users2, label: 'Indicar', path: '/c/indicar', color: 'var(--portal-primary)' },
            { icon: Receipt, label: 'Extrato', path: '/c/extrato', color: 'var(--portal-success)' },
          ].map(({ icon: Icon, label, path, color }, i) => (
            <motion.button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[hsl(var(--portal-card))] border border-[hsl(var(--portal-border))] shadow-sm hover:shadow-md transition-all"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `hsl(${color} / 0.12)` }}>
                <Icon className="h-5 w-5" style={{ color: `hsl(${color})` }} />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </motion.button>
          ))}
        </div>

        {/* Badges */}
        {badgeAwards && badgeAwards.length > 0 && (
          <motion.div
            className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Trophy className="h-4 w-4 text-[hsl(var(--portal-accent-foreground))]" /> Conquistas</h3>
            <div className="flex flex-wrap gap-3">
              {badgeAwards.map((a: any) => (
                <motion.div
                  key={a.id}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[hsl(var(--portal-muted))] min-w-[60px]"
                  whileHover={{ scale: 1.1 }}
                >
                  <span className="text-2xl">{(a.badge as any)?.icon}</span>
                  <span className="text-[9px] font-medium text-center leading-tight">{(a.badge as any)?.name}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active Missions */}
        {activeMissions.length > 0 && (
          <motion.div
            className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Target className="h-4 w-4 text-[hsl(var(--portal-primary))]" /> Missões Ativas</h3>
            <div className="space-y-3">
              {activeMissions.slice(0, 3).map((m: any) => {
                const prog = progressMap.get(m.id);
                const current = (prog as any)?.current_value || 0;
                const pct = Math.min(100, (current / m.target_value) * 100);
                const completed = !!(prog as any)?.completed_at;
                return (
                  <div key={m.id} className="p-3 rounded-lg bg-[hsl(var(--portal-muted))]">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium">{m.title}</p>
                      {completed ? (
                        <span className="text-[10px] font-medium text-[hsl(var(--portal-success))]">✅ Concluída</span>
                      ) : (
                        <span className="text-[10px] text-[hsl(var(--portal-muted-foreground))]">{current}/{m.target_value}</span>
                      )}
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[10px] text-[hsl(var(--portal-primary))] mt-1 font-medium">+{m.reward_points} pts</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Highlight coupon */}
        {cheapestCoupon && (
          <motion.button
            onClick={() => navigate('/c/catalogo')}
            className="w-full p-4 rounded-xl border-2 border-dashed border-[hsl(var(--portal-accent))] bg-[hsl(var(--portal-accent))/0.06] flex items-center gap-3 text-left hover:bg-[hsl(var(--portal-accent))/0.1] transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.98 }}
          >
            <Gift className="h-8 w-8 text-[hsl(var(--portal-accent-foreground))] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{cheapestCoupon.title}</p>
              <p className="text-xs text-[hsl(var(--portal-muted-foreground))]">A partir de {cheapestCoupon.points_cost} pts</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[hsl(var(--portal-muted-foreground))] shrink-0" />
          </motion.button>
        )}

        {/* Recent Ledger */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Últimas movimentações</h3>
            <button onClick={() => navigate('/c/extrato')} className="text-xs text-[hsl(var(--portal-primary))] font-medium hover:underline flex items-center gap-0.5">
              Ver tudo <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="bg-[hsl(var(--portal-card))] rounded-xl border border-[hsl(var(--portal-border))] divide-y divide-[hsl(var(--portal-border))]">
            {!ledger?.length ? (
              <p className="text-sm text-[hsl(var(--portal-muted-foreground))] text-center py-6">Sem movimentações ainda</p>
            ) : ledger.map((entry: any, i: number) => (
              <motion.div
                key={entry.id}
                className="flex items-center justify-between px-4 py-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    entry.type === 'credit' ? 'bg-[hsl(var(--portal-success))/0.1]' : 'bg-[hsl(var(--portal-destructive))/0.1]'
                  }`}>
                    <TrendingUp className={`h-4 w-4 ${
                      entry.type === 'credit' ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-destructive))] rotate-180'
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{entry.description || entry.origin}</p>
                    <p className="text-[10px] text-[hsl(var(--portal-muted-foreground))]">
                      {format(new Date(entry.created_at), 'dd/MM/yy HH:mm')}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-bold shrink-0 ${
                  entry.type === 'credit' ? 'text-[hsl(var(--portal-success))]' : 'text-[hsl(var(--portal-destructive))]'
                }`}>
                  {entry.type === 'credit' ? '+' : '-'}{entry.points}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
