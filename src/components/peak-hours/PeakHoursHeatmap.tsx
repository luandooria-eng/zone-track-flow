import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { TimeSlotData } from '@/hooks/usePeakHoursData';

interface PeakHoursHeatmapProps {
  data: TimeSlotData[];
  timeSlots: string[];
  days: string[];
  selectedSlot?: string;
  selectedDay?: number;
  onCellClick?: (timeSlot: string, dayOfWeek: number) => void;
}

export function PeakHoursHeatmap({
  data,
  timeSlots,
  days,
  selectedSlot,
  selectedDay,
  onCellClick,
}: PeakHoursHeatmapProps) {
  // Calculate max for color intensity
  const maxOrders = useMemo(() => {
    return Math.max(...data.map(d => d.orderCount), 1);
  }, [data]);

  // Get cell data
  const getCellData = (dayIndex: number, slot: string) => {
    return data.find(d => d.dayOfWeek === dayIndex && d.timeSlot === slot);
  };

  // Get intensity color
  const getIntensityColor = (count: number) => {
    const intensity = count / maxOrders;
    
    if (intensity === 0) return 'bg-muted/30';
    if (intensity < 0.2) return 'bg-blue-100 dark:bg-blue-900/30';
    if (intensity < 0.4) return 'bg-blue-200 dark:bg-blue-800/40';
    if (intensity < 0.6) return 'bg-blue-300 dark:bg-blue-700/50';
    if (intensity < 0.8) return 'bg-blue-400 dark:bg-blue-600/60';
    return 'bg-blue-500 dark:bg-blue-500/70';
  };

  const getTextColor = (count: number) => {
    const intensity = count / maxOrders;
    if (intensity >= 0.6) return 'text-white';
    return 'text-foreground';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-xs font-medium text-muted-foreground text-left w-20">Horário</th>
            {days.map((day, i) => (
              <th 
                key={day} 
                className={cn(
                  "p-2 text-xs font-medium text-center min-w-[60px]",
                  selectedDay === i ? "text-primary" : "text-muted-foreground"
                )}
              >
                {day.slice(0, 3)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((slot) => (
            <tr key={slot}>
              <td className={cn(
                "p-2 text-xs font-medium",
                selectedSlot === slot ? "text-primary" : "text-muted-foreground"
              )}>
                {slot}
              </td>
              {days.map((_, dayIndex) => {
                const cellData = getCellData(dayIndex, slot);
                const count = cellData?.orderCount || 0;
                const isSelected = selectedSlot === slot && selectedDay === dayIndex;
                
                return (
                  <td 
                    key={`${dayIndex}-${slot}`}
                    className="p-1"
                  >
                    <button
                      onClick={() => onCellClick?.(slot, dayIndex)}
                      className={cn(
                        "w-full h-10 rounded-md flex items-center justify-center transition-all duration-200",
                        getIntensityColor(count),
                        getTextColor(count),
                        isSelected && "ring-2 ring-primary ring-offset-1",
                        "hover:scale-105 hover:shadow-md cursor-pointer"
                      )}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        {count > 0 ? count : '–'}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/30">
        <span className="text-xs text-muted-foreground">Menos</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-muted/30" />
          <div className="w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/30" />
          <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-800/40" />
          <div className="w-4 h-4 rounded bg-blue-300 dark:bg-blue-700/50" />
          <div className="w-4 h-4 rounded bg-blue-400 dark:bg-blue-600/60" />
          <div className="w-4 h-4 rounded bg-blue-500 dark:bg-blue-500/70" />
        </div>
        <span className="text-xs text-muted-foreground">Mais</span>
      </div>
    </div>
  );
}
