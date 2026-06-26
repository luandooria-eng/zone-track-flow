import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDailyGridStore } from '@/stores/dailyGridStore';

/**
 * Subscribes to realtime changes on the orders table.
 * When a change is detected from ANOTHER session (not our own saves),
 * it reloads the current sheet to sync data across devices.
 */
export function useDailyGridRealtime() {
  const currentSheet = useDailyGridStore(s => s.currentSheet);
  const isSaving = useDailyGridStore(s => s.isSaving);
  const openSheet = useDailyGridStore(s => s.openSheet);
  const isSavingRef = useRef(isSaving);
  const reloadTimeout = useRef<number | null>(null);

  // Keep ref in sync
  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    if (!currentSheet?.date) return;

    const channel = supabase
      .channel('daily-grid-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Skip if WE are currently saving (avoid re-fetch loop)
          if (isSavingRef.current) return;

          // Debounce reload to batch rapid changes
          if (reloadTimeout.current) {
            window.clearTimeout(reloadTimeout.current);
          }

          reloadTimeout.current = window.setTimeout(() => {
            reloadTimeout.current = null;
            const state = useDailyGridStore.getState();
            // Only reload if no dirty rows (to not overwrite user edits)
            const hasDirtyRows = state.rows.some(r => r.isDirty);
            if (!hasDirtyRows && state.currentSheet) {
              console.log('[Realtime] Syncing grid from another device...');
              openSheet(state.currentSheet.date);
            }
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      if (reloadTimeout.current) {
        window.clearTimeout(reloadTimeout.current);
      }
      supabase.removeChannel(channel);
    };
  }, [currentSheet?.date, openSheet]);
}
