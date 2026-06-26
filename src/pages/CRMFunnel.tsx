import { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Zap,
  Search,
  TrendingUp,
  Users,
  CheckCircle2,
  DollarSign,
  XCircle,
  Loader2,
  RefreshCw,
  Filter,
  Settings2,
  RefreshCcw,
  MoreVertical,
  Timer,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useCRMStages,
  useCRMLeads,
  useMoveLead,
  useDeleteLead,
  useCRMStats,
  useProcessTimers,
} from '@/hooks/useCRMFunnel';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadDetailDrawer } from '@/components/crm/LeadDetailDrawer';
import { NewLeadModal } from '@/components/crm/NewLeadModal';
import { TriggerConfigModal } from '@/components/crm/TriggerConfigModal';
import { FunnelFlowEditor } from '@/components/crm/FunnelFlowEditor';
import { RecurrencePanel } from '@/components/crm/RecurrencePanel';
import { TagStageMappingModal } from '@/components/crm/TagStageMappingModal';
import type { CRMLead } from '@/hooks/useCRMFunnel';

export default function CRMFunnel() {
  const { data: stages = [], isLoading: stagesLoading } = useCRMStages();
  const { data: leads = [], isLoading: leadsLoading, refetch } = useCRMLeads();
  const moveLead = useMoveLead();
  const deleteLead = useDeleteLead();
  const processTimers = useProcessTimers();

  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLeadStageId, setNewLeadStageId] = useState<string | undefined>(undefined);
  const [triggersOpen, setTriggersOpen] = useState(false);
  const [flowEditorOpen, setFlowEditorOpen] = useState(false);
  const [recurrenceOpen, setRecurrenceOpen] = useState(false);
  const [tagMappingOpen, setTagMappingOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; leadId: string | null }>({
    open: false,
    leadId: null,
  });
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const stats = useCRMStats(leads, stages);

  // Process timer triggers on page load (silently)
  useEffect(() => {
    processTimers.mutate();
    // Re-check every 10 minutes while the page is open
    const interval = setInterval(() => processTimers.mutate(), 10 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.product_interest?.toLowerCase().includes(q),
      );
    }
    if (sourceFilter !== 'all') {
      result = result.filter((l) => l.source === sourceFilter);
    }
    return result;
  }, [leads, search, sourceFilter]);

  const getLeadsByStage = (stageId: string) =>
    filteredLeads.filter((l) => l.stage_id === stageId);

  const handleOpenDetail = (lead: CRMLead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const handleMove = (leadId: string, stageId: string) => {
    moveLead.mutate({ leadId, stageId });
  };

  const handleDelete = (leadId: string) => {
    setDeleteDialog({ open: true, leadId });
  };

  const confirmDelete = () => {
    if (deleteDialog.leadId) deleteLead.mutate(deleteDialog.leadId);
    setDeleteDialog({ open: false, leadId: null });
  };

  const handleAddLeadInStage = (stageId: string) => {
    setNewLeadStageId(stageId);
    setNewLeadOpen(true);
  };

  const handleProcessTimers = () => {
    processTimers.mutate(undefined, {
      onSuccess: (r) => {
        if (r && r.processed === 0) toast.info('Nenhum gatilho de tempo pendente.');
      },
    });
  };

  const isLoading = stagesLoading || leadsLoading;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM — Funil de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {leads.length} leads no funil · {stages.length} etapas configuradas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Recurrence panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => setRecurrenceOpen(true)} className="gap-2">
                <RefreshCcw className="h-4 w-4 text-blue-500" />
                Recorrência
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clientes em atraso para recompra de água/gás</TooltipContent>
          </Tooltip>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTriggersOpen(true)}>
                <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                Gatilhos de Automação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTagMappingOpen(true)}>
                <Zap className="h-4 w-4 mr-2 text-pink-500" />
                Mapear Tag → Funil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFlowEditorOpen(true)}>
                <Settings2 className="h-4 w-4 mr-2 text-muted-foreground" />
                Editar Fluxo do Funil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProcessTimers} disabled={processTimers.isPending}>
                <Timer className="h-4 w-4 mr-2 text-orange-500" />
                Processar Gatilhos de Tempo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => { setNewLeadStageId(undefined); setNewLeadOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPICard
          icon={<Users className="h-4 w-4 text-blue-500" />}
          label="Total de Leads"
          value={stats.total}
          color="blue"
        />
        <KPICard
          icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
          label="Ativos"
          value={stats.active}
          color="purple"
        />
        <KPICard
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          label="Ganhos"
          value={stats.won}
          color="green"
        />
        <KPICard
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          label="Perdidos"
          value={stats.lost}
          color="red"
        />
        <KPICard
          icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
          label="Pipeline"
          value={`R$ ${stats.pipelineValue.toFixed(0)}`}
          sub={`${stats.conversionRate}% conversão`}
          color="emerald"
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="indicacao">Indicação</SelectItem>
            <SelectItem value="ligacao">Ligação</SelectItem>
            <SelectItem value="portal">Portal</SelectItem>
            <SelectItem value="site">Site</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>

        {processTimers.isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verificando gatilhos de tempo...
          </div>
        )}
      </div>

      {/* ── Kanban Board ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
          {stages.map((stage) => {
            const stageLeads = getLeadsByStage(stage.id);
            const stageValue = stageLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0);

            return (
              <div key={stage.id} className="flex-shrink-0 w-[280px] flex flex-col">
                {/* Column header */}
                <div
                  className="rounded-t-lg px-3 py-2.5 flex items-center justify-between"
                  style={{ backgroundColor: `${stage.color}18`, borderTop: `3px solid ${stage.color}` }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="font-semibold text-sm">{stage.name}</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {stageLeads.length}
                    </Badge>
                    {stage.is_entry && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className="text-[10px] h-4 px-1 bg-blue-500/10 text-blue-700 border-blue-500/20">
                            auto
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>Leads entram aqui automaticamente via WhatsApp</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {stageValue > 0 && (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        R$ {stageValue.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards list */}
                <div className="flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[300px] border border-t-0 overflow-y-auto max-h-[calc(100vh-380px)]">
                  {stageLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <p className="text-xs text-muted-foreground">Nenhum lead nesta etapa</p>
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stages={stages}
                        onMove={handleMove}
                        onDelete={handleDelete}
                        onOpenDetail={handleOpenDetail}
                        isMoving={moveLead.isPending}
                      />
                    ))
                  )}

                  <button
                    className="w-full py-2 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors flex items-center justify-center gap-1"
                    onClick={() => handleAddLeadInStage(stage.id)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar lead
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add stage shortcut */}
          <div className="flex-shrink-0 w-[180px] flex items-start pt-1">
            <button
              className="w-full py-3 rounded-xl border border-dashed border-border/40 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              onClick={() => setFlowEditorOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nova etapa
            </button>
          </div>
        </div>
      )}

      {/* ── Modals & Drawers ── */}
      <NewLeadModal
        open={newLeadOpen}
        onOpenChange={setNewLeadOpen}
        stages={stages}
        defaultStageId={newLeadStageId}
      />

      <TriggerConfigModal
        open={triggersOpen}
        onOpenChange={setTriggersOpen}
        stages={stages}
      />

      <FunnelFlowEditor
        open={flowEditorOpen}
        onOpenChange={setFlowEditorOpen}
        stages={stages}
      />

      <RecurrencePanel
        open={recurrenceOpen}
        onOpenChange={setRecurrenceOpen}
      />

      <TagStageMappingModal
        open={tagMappingOpen}
        onOpenChange={setTagMappingOpen}
        stages={stages}
      />

      <LeadDetailDrawer
        lead={selectedLead}
        stages={stages}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, leadId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lead e todo seu histórico serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20',
  purple: 'bg-purple-500/10 border-purple-500/20',
  green: 'bg-green-500/10 border-green-500/20',
  red: 'bg-red-500/10 border-red-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20',
};

function KPICard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className={cn('rounded-xl border p-3 space-y-1', colorMap[color] ?? '')}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
