import { create } from 'zustand';

export type InitialRoute = 'explore' | 'onboarding-v3';

interface AppInitStore {
  // State
  isInitialized: boolean;
  initialRoute: InitialRoute | null;
  
  // Actions
  setInitialRoute: (route: InitialRoute) => void;
  markInitialized: () => void;
  resetRoute: () => void;
  reset: () => void;
}

export const useAppInitStore = create<AppInitStore>((set) => ({
  // Initial state
  isInitialized: false,
  initialRoute: null,
  
  // Actions
  setInitialRoute: (route) => set({ initialRoute: route }),
  markInitialized: () => set({ isInitialized: true }),
  resetRoute: () => set({ initialRoute: null }),
  reset: () => set({ isInitialized: false, initialRoute: null }),
}));