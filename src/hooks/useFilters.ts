import { create } from 'zustand';
import { GlobalFilters } from '@/types';
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';

interface FiltersState {
  filters: GlobalFilters;
  pendingFilters: GlobalFilters;
  hasChanges: boolean;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  setPendingFilters: (filters: Partial<GlobalFilters>) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  setQuickFilter: (days: number | 'today' | 'month') => void;
}

const defaultFilters: GlobalFilters = {
  dateRange: {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  },
};

export const useFilters = create<FiltersState>((set, get) => ({
  filters: defaultFilters,
  pendingFilters: defaultFilters,
  hasChanges: false,
  
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      pendingFilters: { ...state.filters, ...newFilters },
      hasChanges: false,
    })),
    
  setPendingFilters: (newFilters) =>
    set((state) => {
      // Ensure dateRange is never undefined
      const updatedFilters = { ...state.pendingFilters, ...newFilters };
      if (!updatedFilters.dateRange || !updatedFilters.dateRange.from) {
        updatedFilters.dateRange = state.pendingFilters.dateRange || defaultFilters.dateRange;
      }
      return {
        pendingFilters: updatedFilters,
        hasChanges: true,
      };
    }),
    
  applyFilters: () =>
    set((state) => ({
      filters: state.pendingFilters,
      hasChanges: false,
    })),
    
  resetFilters: () => set({ 
    filters: defaultFilters, 
    pendingFilters: defaultFilters,
    hasChanges: false 
  }),
  
  setQuickFilter: (days) => {
    const today = new Date();
    let from: Date;
    let to: Date = endOfDay(today);
    
    if (days === 'today') {
      from = startOfDay(today);
    } else if (days === 'month') {
      from = startOfMonth(today);
      to = endOfMonth(today);
    } else {
      from = startOfDay(subDays(today, days));
    }
    
    // Apply immediately for quick filters
    set({
      filters: { 
        ...get().filters, 
        dateRange: { from, to } 
      },
      pendingFilters: { 
        ...get().pendingFilters, 
        dateRange: { from, to } 
      },
      hasChanges: false,
    });
  },
}));
