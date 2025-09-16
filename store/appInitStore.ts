import { create } from 'zustand';

export type InitialRoute = 'explore' | 'onboarding-v3' | 'onboarding-v4';

export interface RecoveryState {
  hasRecovery: boolean;
  recoveryType?: 'quickEdit' | 'restoration' | 'textEdit';
  recoveryData?: {
    predictionId?: string;
    restoredUri?: string;
    route?: string;
  };
}

interface AppInitStore {
  // State
  isInitialized: boolean;
  initialRoute: InitialRoute | null;
  recoveryState: RecoveryState;
  
  // Actions
  setInitialRoute: (route: InitialRoute) => void;
  markInitialized: () => void;
  resetRoute: () => void;
  reset: () => void;
  setRecoveryState: (state: RecoveryState) => void;
  clearRecoveryState: () => void;
}

export const useAppInitStore = create<AppInitStore>((set) => ({
  // Initial state
  isInitialized: false,
  initialRoute: null,
  recoveryState: {
    hasRecovery: false
  },
  
  // Actions
  setInitialRoute: (route) => set({ initialRoute: route }),
  markInitialized: () => set({ isInitialized: true }),
  resetRoute: () => set({ initialRoute: null }),
  reset: () => set({ 
    isInitialized: false, 
    initialRoute: null, 
    recoveryState: { hasRecovery: false } 
  }),
  setRecoveryState: (state) => set({ recoveryState: state }),
  clearRecoveryState: () => set({ recoveryState: { hasRecovery: false } }),
}));