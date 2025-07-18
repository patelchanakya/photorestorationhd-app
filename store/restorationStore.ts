import { create } from 'zustand';

interface RestorationStore {
  restorationCount: number;
  setRestorationCount: (count: number) => void;
  incrementRestorationCount: () => void;
  decrementRestorationCount: () => void;
}

export const useRestorationStore = create<RestorationStore>((set) => ({
  restorationCount: 0,
  setRestorationCount: (count) => {
    console.log('[Zustand] setRestorationCount called with:', count);
    set({ restorationCount: count });
  },
  incrementRestorationCount: () => set((state) => ({ restorationCount: state.restorationCount + 1 })),
  decrementRestorationCount: () => set((state) => ({ restorationCount: Math.max(0, state.restorationCount - 1) })),
})); 