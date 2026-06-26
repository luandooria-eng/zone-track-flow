import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Megaphone, Calendar, Users, Send, Target } from 'lucide-react';
import { useCRMCampaigns } from '@/hooks/useCRMCampaigns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  sending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  paused: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sending: 'Enviando',
  paused: 'Pausada',
  done: 'Concluída',
  cancelled: 'Cancelada',
};

export default function CRMCampaigns() {
  const { data: campaigns = [], isLoading } = useCRMCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Campanhas de Conversão
          </h1>
          <p className="text-sm text-muted-foreground">
            Disparo em massa para converter leads em clientes
          </p>
        </div>
        <Button asChild>
          <Link to="/crm/campanhas/nova">
            <Plus className="h-4 w-4 mr-2" />
            Nova campanha
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              Nenhuma campanha criada. Comece pela primeira.
            </p>
            <Button asChild>
              <Link to="/crm/campanhas/nova">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira campanha
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c: any) => {
            const summary = c.audience_summary || {};
            return (
              <Link key={c.id} to={`/crm/campanhas/${c.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{c.name}</h3>
                          <Badge className={STATUS_COLORS[c.status]}>
                            {STATUS_LABELS[c.status]}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {c.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(c.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {summary.total_dedup ?? 0} destinatários
                          </span>
                          <span className="flex items-center gap-1">
                            <Send className="h-3.5 w-3.5" />
                            {c.rate_limit_per_min}/min
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" />
                            atribuição {c.attribution_days}d
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
