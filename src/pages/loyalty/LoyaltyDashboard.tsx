import { useLoyaltyDashboard, useLoyaltyLedger } from '@/hooks/useLoyaltyData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Star, Ticket, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const cardMotion = {
  initial: { y: 10, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export default function LoyaltyDashboard() {
  const { data: stats, isLoading } = useLoyaltyDashboard();
  const { data: recentLedger } = useLoyaltyLedger();

  const kpis = [
    { label: 'Participantes', value: stats?.participants ?? 0, icon: Users, color: 'text-primary' },
    { label: 'Pontos Creditados', value: stats?.totalPointsCredited ?? 0, icon: Star, color: 'text-warning' },
    { label: 'Vouchers Ativos', value: stats?.vouchersActive ?? 0, icon: Ticket, color: 'text-accent-foreground' },
    { label: 'Vouchers Validados', value: stats?.vouchersValidated ?? 0, icon: CheckCircle, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fidelidade — Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do programa de pontos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} {...cardMotion} transition={{ ...cardMotion.transition, delay: i * 0.06 }}>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                {isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <>
                    <div className={`p-3 rounded-xl bg-muted ${kpi.color}`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                      <p className="text-2xl font-bold text-foreground">{kpi.value.toLocaleString('pt-BR')}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentLedger?.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma movimentação ainda.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentLedger.slice(0, 15).map((entry: any) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={entry.type === 'credit' ? 'default' : 'destructive'} className="text-xs shrink-0">
                      {entry.type === 'credit' ? '+' : '-'}{entry.points}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {(entry as any).customer?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{entry.origin} — {entry.description || ''}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(entry.created_at), 'dd/MM HH:mm')}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
