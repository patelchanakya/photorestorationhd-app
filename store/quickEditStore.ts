import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type QuickStage = 'hidden' | 'select' | 'preview' | 'loading' | 'done' | 'error';

export interface QuickEditState {
  visible: boolean;
  stage: QuickStage;
  functionType: 'restoration' | 'repair' | 'restore_repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'background' | 'outfit' | 'custom' | 'memorial' | 'water_damage' | null;
  styleKey?: string | null;
  styleName?: string | null;
  selectedImageUri?: string | null;
  restoredId?: string | null;
  restoredImageUri?: string | null;
  progress: number;
  customPrompt?: string | null;
  errorMessage?: string | null;
  tourMode?: boolean;
  // Actions
  open: (opts: { functionType: QuickEditState['functionType']; styleKey?: string | null; styleName?: string | null; customPrompt?: string | null }) => void;
  openWithImage: (opts: { functionType: QuickEditState['functionType']; imageUri: string; styleKey?: string | null; styleName?: string | null; customPrompt?: string | null }) => void;
  openForTour: (opts: { functionType: QuickEditState['functionType']; styleKey?: string | null; styleName?: string | null }) => void;
  setSelectedImage: (uri: string | null) => void;
  setStage: (stage: QuickStage) => void;
  setProgress: (p: number) => void;
  setResult: (id: string, restoredUri: string) => void;
  setStyleKey: (key: string | null) => void;
  setError: (message: string) => void;
  close: () => void;
  forceClose: () => void;
}

export const useQuickEditStore = create<QuickEditState>((set) => ({
  visible: false,
  stage: 'hidden',
  functionType: null,
  styleKey: null,
  styleName: null,
  selectedImageUri: null,
  restoredId: null,
  restoredImageUri: null,
  progress: 0,
  customPrompt: null,
  errorMessage: null,
  tourMode: false,
  open: ({ functionType, styleKey = null, styleName = null, customPrompt = null }) => set({
    visible: true,
    stage: 'select',
    functionType,
    styleKey,
    styleName,
    selectedImageUri: null,
    restoredId: null,
    restoredImageUri: null,
    progress: 0,
    customPrompt,
  }),
  openWithImage: ({ functionType, imageUri, styleKey = null, styleName = null, customPrompt = null }) => set({
    visible: true,
    stage: 'preview',
    functionType,
    styleKey,
    styleName,
    selectedImageUri: imageUri,
    restoredId: null,
    restoredImageUri: null,
    progress: 0,
    customPrompt,
    tourMode: false,
  }),
  openForTour: ({ functionType, styleKey = null, styleName = null }) => {
    console.log('🎯 QuickEditStore: openForTour called', { functionType, styleKey, styleName });
    return set({
      visible: true,
      stage: 'preview',
      functionType,
      styleKey,
      styleName,
      selectedImageUri: 'demo', // Demo image URI
      restoredId: null,
      restoredImageUri: null,
      progress: 0,
      tourMode: true,
    });
  },
  setSelectedImage: (uri) => set({ selectedImageUri: uri, stage: uri ? 'preview' : 'select' }),
  setStage: (stage) => set({ stage }),
  setProgress: (p) => set({ progress: Math.max(0, Math.min(100, p)) }),
  setResult: (id, restoredUri) => {
    set({ restoredId: id, restoredImageUri: restoredUri, stage: 'done', progress: 100 });
    // Clear activePredictionId immediately when result is shown to user
    AsyncStorage.removeItem('activePredictionId').catch(() => {});
    if (__DEV__) {
      console.log('🧹 [RECOVERY] Cleared prediction state - result shown to user');
    }
  },
  setStyleKey: (key) => set({ styleKey: key }),
  setError: (message) => set({ errorMessage: message, stage: 'error', progress: 0 }),
  close: () => {
    set({ visible: false, stage: 'hidden', functionType: null, selectedImageUri: null, restoredId: null, restoredImageUri: null, progress: 0, styleKey: null, styleName: null, errorMessage: null, tourMode: false });
    // Clear any active prediction ID to prevent stale recovery
    AsyncStorage.removeItem('activePredictionId').catch(() => {});
    if (__DEV__) {
      console.log('🧹 [RECOVERY] Cleared prediction state on Quick Edit Sheet close');
    }
  },
  forceClose: () => {
    set({ visible: false, stage: 'hidden', functionType: null, selectedImageUri: null, restoredId: null, restoredImageUri: null, progress: 0, styleKey: null, styleName: null, errorMessage: null, tourMode: false });
    // Do NOT clear activePredictionId during force close - recovery needs it for navigation
    if (__DEV__) {
      console.log('🧹 [RECOVERY] Force closed Quick Edit Sheet for recovery navigation (preserving activePredictionId)');
    }
  },
}));
