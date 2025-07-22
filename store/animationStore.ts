import { create } from 'zustand';

interface AnimationStore {
  // PRO button animation
  proAnimationDuration: number;
  isProAnimationActive: boolean;
  
  // Actions
  setProAnimationDuration: (duration: number) => void;
  startProAnimation: () => void;
  stopProAnimation: () => void;
}

export const useAnimationStore = create<AnimationStore>((set) => ({
  // Initial state
  proAnimationDuration: 2250, // 2.5 seconds for smooth, elegant animation
  isProAnimationActive: true,
  
  // Actions
  setProAnimationDuration: (duration) => set({ proAnimationDuration: duration }),
  startProAnimation: () => set({ isProAnimationActive: true }),
  stopProAnimation: () => set({ isProAnimationActive: false }),
}));