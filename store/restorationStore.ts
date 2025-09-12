import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RestorationStore {
  restorationCount: number;
  setRestorationCount: (count: number) => void;
  incrementRestorationCount: () => void;
  decrementRestorationCount: () => void;
  showFlashButton: boolean;
  setShowFlashButton: (show: boolean) => void;
  toggleFlashButton: () => void;
  galleryViewMode: 'grid' | 'list';
  setGalleryViewMode: (mode: 'grid' | 'list') => void;
  toggleGalleryViewMode: () => void;
  simpleSlider: boolean;
  setSimpleSlider: (simple: boolean) => void;
  toggleSimpleSlider: () => void;
  hasShownRatingPrompt: boolean;
  setHasShownRatingPrompt: (shown: boolean) => void;
  totalRestorations: number;
  incrementTotalRestorations: () => void;
}

export const useRestorationStore = create<RestorationStore>()(
  persist(
    (set) => ({
  restorationCount: 0,
  setRestorationCount: (count) => set({ restorationCount: count }),
  incrementRestorationCount: () => set((state) => ({ restorationCount: state.restorationCount + 1 })),
  decrementRestorationCount: () => set((state) => ({ restorationCount: Math.max(0, state.restorationCount - 1) })),
  showFlashButton: true,
  setShowFlashButton: (show) => set({ showFlashButton: show }),
  toggleFlashButton: () => set((state) => ({ showFlashButton: !state.showFlashButton })),
  galleryViewMode: 'list',
  setGalleryViewMode: (mode) => set({ galleryViewMode: mode }),
  toggleGalleryViewMode: () => set((state) => ({ 
    galleryViewMode: state.galleryViewMode === 'list' ? 'grid' : 'list' 
  })),
  simpleSlider: true,
  setSimpleSlider: (simple) => set({ simpleSlider: simple }),
  toggleSimpleSlider: () => set((state) => ({ simpleSlider: !state.simpleSlider })),
  hasShownRatingPrompt: false,
  setHasShownRatingPrompt: (shown) => set({ hasShownRatingPrompt: shown }),
  totalRestorations: 0,
  incrementTotalRestorations: () => set((state) => ({ 
    totalRestorations: state.totalRestorations + 1 
  })),
    }),
    {
      name: 'restoration-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasShownRatingPrompt: state.hasShownRatingPrompt,
        totalRestorations: state.totalRestorations,
        galleryViewMode: state.galleryViewMode,
        simpleSlider: state.simpleSlider,
      }),
    }
  )
); 