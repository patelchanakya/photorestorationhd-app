import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// High-performance debounced storage with error handling and batching
let persistenceTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingWrites = new Map<string, string>();

const debouncedStorage = {
  getItem: async (name: string) => {
    try {
      const value = await AsyncStorage.getItem(name);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      if (__DEV__) {
        console.error('Storage getItem error:', error);
      }
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    // Batch multiple writes for better performance
    pendingWrites.set(name, value);
    
    if (persistenceTimeout) {
      clearTimeout(persistenceTimeout);
    }
    
    persistenceTimeout = setTimeout(async () => {
      try {
        // Batch write all pending items
        const writes = Array.from(pendingWrites.entries());
        pendingWrites.clear();
        
        await Promise.all(
          writes.map(([key, val]) => AsyncStorage.setItem(key, val))
        );
      } catch (error) {
        if (__DEV__) {
          console.error('Storage batch write error:', error);
        }
      } finally {
        persistenceTimeout = null;
      }
    }, 500); // Reduced from 1000ms to 500ms for better responsiveness
  },
  removeItem: async (name: string) => {
    try {
      // Remove from pending writes if exists
      pendingWrites.delete(name);
      await AsyncStorage.removeItem(name);
    } catch (error) {
      if (__DEV__) {
        console.error('Storage removeItem error:', error);
      }
    }
  },
};

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
      storage: debouncedStorage as any,
      partialize: (state) => ({
        hasShownRatingPrompt: state.hasShownRatingPrompt,
        totalRestorations: state.totalRestorations,
        galleryViewMode: state.galleryViewMode,
        simpleSlider: state.simpleSlider,
      }),
    }
  )
); 