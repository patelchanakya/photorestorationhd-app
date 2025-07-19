import { create } from 'zustand';

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
}

export const useRestorationStore = create<RestorationStore>((set) => ({
  restorationCount: 0,
  setRestorationCount: (count) => {
    console.log('[Zustand] setRestorationCount called with:', count);
    set({ restorationCount: count });
  },
  incrementRestorationCount: () => set((state) => ({ restorationCount: state.restorationCount + 1 })),
  decrementRestorationCount: () => set((state) => ({ restorationCount: Math.max(0, state.restorationCount - 1) })),
  showFlashButton: true,
  setShowFlashButton: (show) => {
    console.log('[Zustand] setShowFlashButton called with:', show);
    set({ showFlashButton: show });
  },
  toggleFlashButton: () => set((state) => ({ showFlashButton: !state.showFlashButton })),
  galleryViewMode: 'list',
  setGalleryViewMode: (mode) => {
    console.log('[Zustand] setGalleryViewMode called with:', mode);
    set({ galleryViewMode: mode });
  },
  toggleGalleryViewMode: () => set((state) => ({ 
    galleryViewMode: state.galleryViewMode === 'list' ? 'grid' : 'list' 
  })),
})); 