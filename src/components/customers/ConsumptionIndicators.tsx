import { Badge } from '@/components/ui/badge';
import {
  Droplet,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConsumptionIndicatorsProps {
  waterCurrent: number;
  waterVariation: number;
  gasCurrent: number;
  gasVariation: number;
  alerts: { type: string; severity: string }[];
}

export function ConsumptionIndicators({
  waterCurrent,
  waterVariation,
  gasCurrent,
  gasVariation,
  alerts,
}: ConsumptionIndicatorsProps) {
  const hasWaterAlert = alerts.some(a => a.type.includes('water'));
  const hasGasAlert = alerts.some(a => a.type.includes('gas'));

  const getVariationDisplay = (variation: number, current: number, isAlert: boolean) => {
    if (current === 0 && isAlert) {
      return { icon: AlertTriangle, color: 'text-warning', label: 'parou' };
    }
    if (variation > 10) {
      return { icon: TrendingUp, color: 'text-success', label: `+${Math.round(variation)}%` };
    }
    if (variation < -10) {
      return { icon: TrendingDown, color: 'text-destructive', label: `${Math.round(variation)}%` };
    }
    return { icon: Minus, color: 'text-muted-foreground', label: '-' };
  };

  const waterDisplay = getVariationDisplay(waterVariation, waterCurrent, hasWaterAlert);
  const gasDisplay = getVariationDisplay(gasVariation, gasCurrent, hasGasAlert);
  const WaterIcon = waterDisplay.icon;
  const GasIcon = gasDisplay.icon;

  // Get the most severe alert badge
  const getAlertBadge = () => {
    if (alerts.length === 0) return null;
    
    const highSeverity = alerts.find(a => a.severity === 'high');
    const mediumSeverity = alerts.find(a => a.severity === 'medium');
    
    if (highSeverity) {
      const isGas = highSeverity.type.includes('gas');
      return (
        <Badge variant="outline" className="bg-destructive-bg text-destructive border-destructive/30 text-xs">
          {isGas ? 'Em risco – Gás' : 'Em risco – Água'}
        </Badge>
      );
    }
    
    if (mediumSeverity) {
      const isGas = mediumSeverity.type.includes('gas');
      return (
        <Badge variant="outline" className="bg-warning-bg text-warning border-warning/30 text-xs">
          {mediumSeverity.type.includes('stopped') 
            ? `Parou ${isGas ? 'Gás' : 'Água'}`
            : `Caiu ${isGas ? 'Gás' : 'Água'}`
          }
        </Badge>
      );
    }
    
    return null;
  };

  return (
    <div className="flex items-center gap-3">
      {/* Water Indicator */}
      <div className="flex items-center gap-1.5 text-sm">
        <Droplet className={cn("h-4 w-4", hasWaterAlert ? "text-warning" : "text-chart-1")} />
        <span className="font-medium">{waterCurrent}</span>
        <span className={cn("flex items-center gap-0.5 text-xs", waterDisplay.color)}>
          <WaterIcon className="h-3 w-3" />
          {waterDisplay.label}
        </span>
      </div>

      {/* Gas Indicator */}
      <div className="flex items-center gap-1.5 text-sm">
        <Flame className={cn("h-4 w-4", hasGasAlert ? "text-warning" : "text-warning/70")} />
        <span className="font-medium">{gasCurrent}</span>
        <span className={cn("flex items-center gap-0.5 text-xs", gasDisplay.color)}>
          <GasIcon className="h-3 w-3" />
          {gasDisplay.label}
        </span>
      </div>

      {/* Alert Badge */}
      {getAlertBadge()}
    </div>
  );
}
