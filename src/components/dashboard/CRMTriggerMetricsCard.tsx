import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { useCRMTriggerMetrics } from '@/hooks/useCRMTriggerMetrics';

export function CRMTriggerMetricsCard() {
  // Last 30 days
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { data, isLoading } = useCRMTriggerMetrics(start.toISOString(), end.toISOString());

  const totals = data?.totals ?? { total_sent: 0, total_responded: 0, avg_response_minutes: null };
  const rate = totals.total_sent > 0 ? (totals.total_responded / totals.total_sent) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Disparos do CRM (30d)
        </CardTitle>
        <Button asChild size="sm" variant="ghost">
          <Link to="/crm/metricas">
            Ver tudo <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Enviadas</p>
              <p className="text-2xl font-semibold">{totals.total_sent}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Respondidas</p>
              <p className="text-2xl font-semibold text-success">{totals.total_responded}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Taxa</p>
              <p className="text-2xl font-semibold">{rate.toFixed(1)}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}