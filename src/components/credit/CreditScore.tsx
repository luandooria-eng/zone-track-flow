import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CreditScoreProps {
  customerId: string;
  customerName: string;
  totalPurchases: number;
  onTimePayments: number;
  latePayments: number;
  currentDebt: number;
  creditLimit: number;
  lastPurchaseDate: Date;
  accountAge: number; // months
}

export function CreditScore({
  customerName,
  totalPurchases,
  onTimePayments,
  latePayments,
  currentDebt,
  creditLimit,
  lastPurchaseDate,
  accountAge,
}: CreditScoreProps) {
  const score = useMemo(() => {
    // Simple scoring algorithm
    let points = 500; // Base score

    // Payment history (40% weight)
    const paymentRatio = totalPurchases > 0 ? onTimePayments / totalPurchases : 0;
    points += paymentRatio * 200;

    // Credit utilization (30% weight)
    const utilizationRatio = creditLimit > 0 ? currentDebt / creditLimit : 0;
    if (utilizationRatio < 0.3) points += 150;
    else if (utilizationRatio < 0.6) points += 100;
    else if (utilizationRatio < 0.9) points += 50;
    else points -= 50;

    // Account age (15% weight)
    if (accountAge > 24) points += 75;
    else if (accountAge > 12) points += 50;
    else if (accountAge > 6) points += 25;

    // Recent activity (15% weight)
    const daysSinceLastPurchase = Math.floor(
      (Date.now() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastPurchase < 30) points += 75;
    else if (daysSinceLastPurchase < 60) points += 50;
    else if (daysSinceLastPurchase < 90) points += 25;

    return Math.min(1000, Math.max(0, Math.round(points)));
  }, [totalPurchases, onTimePayments, currentDebt, creditLimit, accountAge, lastPurchaseDate]);

  const scoreCategory = useMemo(() => {
    if (score >= 800) return { label: 'Excelente', color: 'text-success', bg: 'bg-success' };
    if (score >= 650) return { label: 'Bom', color: 'text-chart-2', bg: 'bg-chart-2' };
    if (score >= 500) return { label: 'Regular', color: 'text-warning', bg: 'bg-warning' };
    return { label: 'Risco', color: 'text-destructive', bg: 'bg-destructive' };
  }, [score]);

  const utilizationPercent = creditLimit > 0 ? (currentDebt / creditLimit) * 100 : 0;
  const paymentSuccessRate = totalPurchases > 0 ? (onTimePayments / totalPurchases) * 100 : 0;

  const factors = [
    {
      label: 'Histórico de Pagamentos',
      value: `${onTimePayments}/${totalPurchases}`,
      status: paymentSuccessRate >= 90 ? 'positive' : paymentSuccessRate >= 70 ? 'neutral' : 'negative',
      description: paymentSuccessRate >= 90 ? 'Excelente histórico' : 'Alguns atrasos',
    },
    {
      label: 'Utilização do Crédito',
      value: `${utilizationPercent.toFixed(0)}%`,
      status: utilizationPercent <= 30 ? 'positive' : utilizationPercent <= 60 ? 'neutral' : 'negative',
      description: utilizationPercent <= 30 ? 'Uso saudável' : 'Uso elevado',
    },
    {
      label: 'Tempo de Conta',
      value: `${accountAge} meses`,
      status: accountAge >= 12 ? 'positive' : accountAge >= 6 ? 'neutral' : 'negative',
      description: accountAge >= 12 ? 'Cliente antigo' : 'Cliente recente',
    },
    {
      label: 'Atividade Recente',
      value: 'Ativo',
      status: 'positive',
      description: 'Compras regulares',
    },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-lg">Score de Crédito</h3>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </div>
        <Badge
          className={cn(
            'text-sm px-3 py-1',
            scoreCategory.color === 'text-success' && 'bg-success/20 text-success border-0',
            scoreCategory.color === 'text-chart-2' && 'bg-chart-2/20 text-chart-2 border-0',
            scoreCategory.color === 'text-warning' && 'bg-warning/20 text-warning border-0',
            scoreCategory.color === 'text-destructive' && 'bg-destructive/20 text-destructive border-0'
          )}
        >
          {scoreCategory.label}
        </Badge>
      </div>

      {/* Score Gauge */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          <div
            className={cn(
              'flex h-32 w-32 items-center justify-center rounded-full border-8',
              scoreCategory.color === 'text-success' && 'border-success/20',
              scoreCategory.color === 'text-chart-2' && 'border-chart-2/20',
              scoreCategory.color === 'text-warning' && 'border-warning/20',
              scoreCategory.color === 'text-destructive' && 'border-destructive/20'
            )}
          >
            <div className="text-center">
              <p className={cn('text-4xl font-bold', scoreCategory.color)}>{score}</p>
              <p className="text-xs text-muted-foreground">de 1000</p>
            </div>
          </div>
          <div
            className={cn(
              'absolute -right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full',
              scoreCategory.bg
            )}
          >
            {score >= 650 ? (
              <ShieldCheck className="h-4 w-4 text-white" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Fatores do Score</h4>
        {factors.map((factor) => (
          <div key={factor.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  factor.status === 'positive' && 'bg-success/10 text-success',
                  factor.status === 'neutral' && 'bg-warning/10 text-warning',
                  factor.status === 'negative' && 'bg-destructive/10 text-destructive'
                )}
              >
                {factor.status === 'positive' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : factor.status === 'neutral' ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{factor.label}</p>
                <p className="text-xs text-muted-foreground">{factor.description}</p>
              </div>
            </div>
            <span className="font-semibold">{factor.value}</span>
          </div>
        ))}
      </div>

      {/* Credit Summary */}
      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Limite Disponível</p>
            <p className="text-lg font-bold text-success">
              R$ {(creditLimit - currentDebt).toFixed(2)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Saldo Devedor</p>
            <p className={cn('text-lg font-bold', currentDebt > 0 ? 'text-warning' : 'text-foreground')}>
              R$ {currentDebt.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Utilização do limite</span>
            <span>{utilizationPercent.toFixed(0)}%</span>
          </div>
          <Progress
            value={utilizationPercent}
            className={cn(
              'h-2',
              utilizationPercent <= 30 && '[&>div]:bg-success',
              utilizationPercent > 30 && utilizationPercent <= 60 && '[&>div]:bg-warning',
              utilizationPercent > 60 && '[&>div]:bg-destructive'
            )}
          />
        </div>
      </div>
    </Card>
  );
}
