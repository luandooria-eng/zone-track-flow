import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Phone,
  MessageCircle,
  DollarSign,
  Clock,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Eye,
  Package,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CRMLead, CRMStage } from '@/hooks/useCRMFunnel';

const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  portal: 'Portal',
  ligacao: 'Ligação',
  site: 'Site',
  outro: 'Outro',
};

interface LeadCardProps {
  lead: CRMLead;
  stages: CRMStage[];
  onMove: (leadId: string, stageId: string) => void;
  onDelete: (leadId: string) => void;
  onOpenDetail: (lead: CRMLead) => void;
  isMoving: boolean;
}

export function LeadCard({ lead, stages, onMove, onDelete, onOpenDetail, isMoving }: LeadCardProps) {
  const currentStageIdx = stages.findIndex((s) => s.id === lead.stage_id);
  const prevStage = currentStageIdx > 0 ? stages[currentStageIdx - 1] : null;
  const nextStage = currentStageIdx < stages.length - 1 ? stages[currentStageIdx + 1] : null;

  const daysInStage = Math.floor(
    (Date.now() - new Date(lead.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  const timeAgo = formatDistanceToNow(new Date(lead.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const isWon = lead.stage?.is_won;
  const isLost = lead.stage?.is_lost;

  return (
    <Card
      className={cn(
        'kanban-card cursor-pointer group transition-all duration-150 hover:shadow-md',
        isWon && 'border-green-500/40',
        isLost && 'border-red-400/40 opacity-75',
      )}
      onClick={() => onOpenDetail(lead)}
    >
      <CardContent className="p-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{lead.name}</p>
            {lead.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{lead.phone}</span>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isMoving}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onOpenDetail(lead)}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              {prevStage && (
                <DropdownMenuItem onClick={() => onMove(lead.id, prevStage.id)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar: {prevStage.name}
                </DropdownMenuItem>
              )}
              {nextStage && (
                <DropdownMenuItem onClick={() => onMove(lead.id, nextStage.id)}>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Avançar: {nextStage.name}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(lead.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Product interest */}
        {lead.product_interest && (
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground truncate">{lead.product_interest}</span>
          </div>
        )}

        {/* Value */}
        {lead.estimated_value !== null && lead.estimated_value !== undefined && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-600" />
            <span className="text-xs font-semibold text-green-700">
              R$ {lead.estimated_value.toFixed(2)}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {daysInStage === 0 ? 'hoje' : `${daysInStage}d neste estágio`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {lead.source && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {sourceLabels[lead.source] ?? lead.source}
              </Badge>
            )}
            {lead.phone && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                <MessageCircle className="h-2.5 w-2.5" />
                WA
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
