import { create } from 'zustand';

export type QuickStage = 'hidden' | 'select' | 'preview' | 'loading' | 'done' | 'error';

export interface QuickEditState {
  visible: boolean;
  stage: QuickStage;
  functionType: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'background' | 'outfit' | 'custom' | null;
  styleKey?: string | null;
  selectedImageUri?: string | null;
  restoredId?: string | null;
  restoredImageUri?: string | null;
  progress: number;
  customPrompt?: string | null;
  errorMessage?: string | null;
  // Actions
  open: (opts: { functionType: QuickEditState['functionType']; styleKey?: string | null; customPrompt?: string | null }) => void;
  openWithImage: (opts: { functionType: QuickEditState['functionType']; imageUri: string; styleKey?: string | null; customPrompt?: string | null }) => void;
  setSelectedImage: (uri: string | null) => void;
  setStage: (stage: QuickStage) => void;
  setProgress: (p: number) => void;
  setResult: (id: string, restoredUri: string) => void;
  setStyleKey: (key: string | null) => void;
  setError: (message: string) => void;
  close: () => void;
}

export const useQuickEditStore = create<QuickEditState>((set) => ({
  visible: false,
  stage: 'hidden',
  functionType: null,
  styleKey: null,
  selectedImageUri: null,
  restoredId: null,
  restoredImageUri: null,
  progress: 0,
  customPrompt: null,
  errorMessage: null,
  open: ({ functionType, styleKey = null, customPrompt = null }) => set({
    visible: true,
    stage: 'select',
    functionType,
    styleKey,
    selectedImageUri: null,
    restoredId: null,
    restoredImageUri: null,
    progress: 0,
    customPrompt,
  }),
  openWithImage: ({ functionType, imageUri, styleKey = null, customPrompt = null }) => set({
    visible: true,
    stage: 'preview',
    functionType,
    styleKey,
    selectedImageUri: imageUri,
    restoredId: null,
    restoredImageUri: null,
    progress: 0,
    customPrompt,
  }),
  setSelectedImage: (uri) => set({ selectedImageUri: uri, stage: uri ? 'preview' : 'select' }),
  setStage: (stage) => set({ stage }),
  setProgress: (p) => set({ progress: Math.max(0, Math.min(100, p)) }),
  setResult: (id, restoredUri) => set({ restoredId: id, restoredImageUri: restoredUri, stage: 'done', progress: 100 }),
  setStyleKey: (key) => set({ styleKey: key }),
  setError: (message) => set({ errorMessage: message, stage: 'error', progress: 0 }),
  close: () => set({ visible: false, stage: 'hidden', functionType: null, selectedImageUri: null, restoredId: null, restoredImageUri: null, progress: 0, styleKey: null, errorMessage: null }),
}));
