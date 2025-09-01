import { create } from 'zustand';

interface CropModalState {
  isProcessing: boolean;
  isVideoProcessing: boolean;
  videoModeTag: string | null;
  currentImageUri: string | null;
  progress: number;
  canCancel: boolean;
  completedRestorationId: string | null;
  processingStatus: 'loading' | 'completed' | 'error' | 'ready' | null;
  errorMessage: string | null;
  pendingVideoGeneration: any | null;
}

interface CropModalActions {
  setIsProcessing: (processing: boolean) => void;
  setIsVideoProcessing: (processing: boolean) => void;
  setVideoModeTag: (tag: string | null) => void;
  setCurrentImageUri: (uri: string | null) => void;
  setProgress: (progress: number) => void;
  setCanCancel: (canCancel: boolean) => void;
  setCompletedRestorationId: (id: string | null) => void;
  setProcessingStatus: (status: 'loading' | 'completed' | 'error' | 'ready' | null) => void;
  setErrorMessage: (message: string | null) => void;
  setVideoError: (message: string) => void;
  setPendingVideoGeneration: (context: any) => void;
  reset: () => void;
}

const initialState: CropModalState = {
  isProcessing: false,
  isVideoProcessing: false,
  videoModeTag: null,
  currentImageUri: null,
  progress: 0,
  canCancel: false,
  completedRestorationId: null,
  processingStatus: null,
  errorMessage: null,
  pendingVideoGeneration: null,
};

export const useCropModalStore = create<CropModalState & CropModalActions>((set) => ({
  ...initialState,

  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setIsVideoProcessing: (processing) => set({ isVideoProcessing: processing }),
  setVideoModeTag: (tag) => set({ videoModeTag: tag }),
  setCurrentImageUri: (uri) => set({ currentImageUri: uri }),
  setProgress: (progress) => set({ progress }),
  setCanCancel: (canCancel) => set({ canCancel }),
  setCompletedRestorationId: (id) => set({ completedRestorationId: id }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  setVideoError: (message) => set({ errorMessage: message, processingStatus: 'error' }),
  setPendingVideoGeneration: (context) => set({ pendingVideoGeneration: context }),
  
  reset: () => set(initialState),
}));