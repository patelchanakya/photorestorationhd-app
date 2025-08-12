import { create } from 'zustand';

interface CropModalState {
  // Image state
  currentImageUri: string;
  
  // UI state
  isProcessing: boolean;
  showCropTool: boolean;
  useImageLoading: boolean;
  buttonText: string;
  
  // Processing progress
  progress: number;
  canCancel: boolean;
  
  // Video-specific state (separate from regular processing)
  isVideoProcessing: boolean;
  // Selected Back to Life template/mode (e.g., Hug, Group, Fun)
  videoModeTag: string | null;
  
  // Back to Life completion tracking
  completedRestorationId: string | null;
  processingStatus: 'loading' | 'completed' | 'error' | null;
  errorMessage: string | null;
  
  // Actions
  setCurrentImageUri: (uri: string) => void;
  setIsProcessing: (processing: boolean) => void;
  setShowCropTool: (show: boolean) => void;
  setUseImageLoading: (loading: boolean) => void;
  setButtonText: (text: string) => void;
  setProgress: (progress: number) => void;
  setCanCancel: (canCancel: boolean) => void;
  setIsVideoProcessing: (processing: boolean) => void;
  setVideoModeTag: (mode: string | null) => void;
  setCompletedRestorationId: (id: string | null) => void;
  setProcessingStatus: (status: 'loading' | 'completed' | 'error' | null) => void;
  setErrorMessage: (message: string | null) => void;
  
  // Reset function for new image
  resetForNewImage: (imageUri: string) => void;
  
  // Complete reset
  reset: () => void;
  
  // Atomic operations to prevent flickering
  setVideoError: (errorMessage: string) => void;
}

const initialState = {
  currentImageUri: '',
  isProcessing: false,
  showCropTool: false,
  useImageLoading: false,
  buttonText: 'Use Image',
  progress: 0,
  canCancel: false,
  isVideoProcessing: false,
  videoModeTag: null,
  completedRestorationId: null,
  processingStatus: null,
  errorMessage: null,
};

export const useCropModalStore = create<CropModalState>((set, get) => ({
  ...initialState,
  
  // Individual setters
  setCurrentImageUri: (uri) => {
    if (__DEV__) {
      console.log('📸 CropModal: Setting current image URI:', uri);
    }
    set({ currentImageUri: uri });
  },
  
  setIsProcessing: (processing) => {
    if (__DEV__) {
      console.log('⚙️ CropModal: Setting processing:', processing);
    }
    set({ isProcessing: processing });
  },
  
  setShowCropTool: (show) => {
    if (__DEV__) {
      console.log('✂️ CropModal: Setting show crop tool:', show);
    }
    set({ showCropTool: show });
  },
  
  setUseImageLoading: (loading) => {
    if (__DEV__) {
      console.log('🔄 CropModal: Setting use image loading:', loading);
    }
    set({ useImageLoading: loading });
  },
  
  setButtonText: (text) => {
    if (__DEV__) {
      console.log('🔘 CropModal: Setting button text:', text);
    }
    set({ buttonText: text });
  },

  setProgress: (progress) => {
    if (__DEV__) {
      console.log('📊 CropModal: Setting progress:', progress);
    }
    set({ progress });
  },

  setCanCancel: (canCancel) => {
    if (__DEV__) {
      console.log('🚫 CropModal: Setting can cancel:', canCancel);
    }
    set({ canCancel });
  },

  setIsVideoProcessing: (processing) => {
    if (__DEV__) {
      console.log('🎬 CropModal: Setting video processing:', processing);
    }
    set({ isVideoProcessing: processing });
  },

  setVideoModeTag: (mode) => {
    if (__DEV__) {
      console.log('🏷️ CropModal: Setting video mode tag:', mode);
    }
    set({ videoModeTag: mode });
  },

  setCompletedRestorationId: (id) => {
    if (__DEV__) {
      console.log('🎬 CropModal: Setting completed restoration ID:', id);
    }
    set({ completedRestorationId: id });
  },

  setProcessingStatus: (status) => {
    if (__DEV__) {
      console.log('📊 CropModal: Setting processing status:', status);
    }
    set({ processingStatus: status });
  },

  setErrorMessage: (message) => {
    if (__DEV__) {
      console.log('⚠️ CropModal: Setting error message:', message);
    }
    set({ errorMessage: message });
  },
  
  // Reset for new image - maintains consistency with existing patterns
  resetForNewImage: (imageUri) => {
    if (__DEV__) {
      console.log('🔄 CropModal: Resetting for new image:', imageUri);
    }
    
    const currentState = get();
    const isVideoProcessingActive = (() => {
      return currentState.isVideoProcessing || 
             currentState.processingStatus === 'loading' || 
             currentState.processingStatus === 'completed' ||
             currentState.processingStatus === 'error';
    })();
    
    if (__DEV__ && isVideoProcessingActive) {
      console.log('🎬 CropModal: Preserving video state during image reset');
    }
    
    set({
      currentImageUri: imageUri,
      isProcessing: false,
      showCropTool: false,
      useImageLoading: false,
      buttonText: 'Use Image',
      progress: 0,
      canCancel: false,
      // Preserve video processing state if video is active
      completedRestorationId: isVideoProcessingActive ? currentState.completedRestorationId : null,
      processingStatus: isVideoProcessingActive ? currentState.processingStatus : null,
      errorMessage: isVideoProcessingActive ? currentState.errorMessage : null,
      videoModeTag: isVideoProcessingActive ? currentState.videoModeTag : null,
    });
  },
  
  // Complete reset - useful for cleanup
  reset: () => {
    if (__DEV__) {
      console.log('🧹 CropModal: Complete reset');
    }
    
    const currentState = get();
    const isVideoProcessingActive = (() => {
      return currentState.isVideoProcessing || 
             currentState.processingStatus === 'loading' || 
             currentState.processingStatus === 'completed' ||
             currentState.processingStatus === 'error';
    })();
    
    if (isVideoProcessingActive) {
      if (__DEV__) {
        console.log('🎬 CropModal: Preserving video state during complete reset');
      }
      // Reset everything except video processing state
      set({
        ...initialState,
        isVideoProcessing: currentState.isVideoProcessing,
        videoModeTag: currentState.videoModeTag,
        completedRestorationId: currentState.completedRestorationId,
        processingStatus: currentState.processingStatus,
        errorMessage: currentState.errorMessage,
      });
    } else {
      set(initialState);
    }
  },
  
  // Helper function to check if video processing is active
  isVideoStateActive: () => {
    const state = get();
    return state.isVideoProcessing || 
           state.processingStatus === 'loading' || 
           state.processingStatus === 'completed' ||
           state.processingStatus === 'error';
  },

  // Atomic video error - prevents flickering by setting all states at once
  setVideoError: (errorMessage: string) => {
    if (__DEV__) {
      console.log('⚠️ CropModal: Setting video error atomically:', errorMessage);
    }
    set({
      isProcessing: false,
      isVideoProcessing: false,
      processingStatus: 'error',
      errorMessage,
    });
    
    if (__DEV__) {
      const newState = get();
      console.log('🔍 Video error state after update:', {
        isProcessing: newState.isProcessing,
        isVideoProcessing: newState.isVideoProcessing,
        processingStatus: newState.processingStatus,
        errorMessage: newState.errorMessage,
        canCancel: newState.canCancel
      });
    }
  },
}));