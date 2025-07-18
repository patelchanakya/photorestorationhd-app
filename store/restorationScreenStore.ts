import { create } from 'zustand';
import { Restoration } from '@/types';

interface RestorationScreenStore {
  // Current restoration data
  restoration: Restoration | null;
  setRestoration: (restoration: Restoration | null) => void;
  
  // Loading states
  loading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Download button text
  downloadText: string;
  setDownloadText: (text: string) => void;
  
  // All restorations for gallery
  allRestorations: Restoration[];
  setAllRestorations: (restorations: Restoration[]) => void;
  
  // Navigation state
  isNavigating: boolean;
  setIsNavigating: (navigating: boolean) => void;
  
  // Files exist check
  filesExist: boolean;
  setFilesExist: (exist: boolean) => void;
  
  // Reset all state
  resetState: () => void;
}

const initialState = {
  restoration: null,
  loading: true,
  downloadText: 'Save',
  allRestorations: [],
  isNavigating: false,
  filesExist: true,
};

export const useRestorationScreenStore = create<RestorationScreenStore>((set) => ({
  ...initialState,
  
  setRestoration: (restoration) => set({ restoration }),
  setLoading: (loading) => set({ loading }),
  setDownloadText: (text) => set({ downloadText: text }),
  setAllRestorations: (restorations) => set({ allRestorations: restorations }),
  setIsNavigating: (navigating) => set({ isNavigating: navigating }),
  setFilesExist: (exist) => set({ filesExist: exist }),
  
  resetState: () => set(initialState),
}));