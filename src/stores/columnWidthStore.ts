import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ColumnWidthState {
  columnWidths: Record<string, number>;
  setColumnWidth: (key: string, width: number) => void;
  resetColumnWidths: () => void;
}

const DEFAULT_WIDTHS: Record<string, number> = {
  customerName: 180,
  address: 200,
  neighborhood: 120,
  productName: 150,
  quantity: 70,
  paymentMethod: 120,
  dueDate: 120,
  channel: 100,
  deliverer: 120,
  value: 100,
  status: 100,
};

export const useColumnWidthStore = create<ColumnWidthState>()(
  persist(
    (set) => ({
      columnWidths: { ...DEFAULT_WIDTHS },
      
      setColumnWidth: (key: string, width: number) => {
        set((state) => ({
          columnWidths: {
            ...state.columnWidths,
            [key]: Math.max(50, Math.min(500, width)), // Min 50px, max 500px
          },
        }));
      },
      
      resetColumnWidths: () => {
        set({ columnWidths: { ...DEFAULT_WIDTHS } });
      },
    }),
    {
      name: 'daily-grid-column-widths',
    }
  )
);
