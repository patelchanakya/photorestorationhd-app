import { create } from 'zustand';

interface CropModalState {
  // Image state
  currentImageUri: string;
  
  // UI state
  isProcessing: boolean;
  showCropTool: boolean;
  useImageLoading: boolean;
  buttonText: string;
  
  // Actions
  setCurrentImageUri: (uri: string) => void;
  setIsProcessing: (processing: boolean) => void;
  setShowCropTool: (show: boolean) => void;
  setUseImageLoading: (loading: boolean) => void;
  setButtonText: (text: string) => void;
  
  // Reset function for new image
  resetForNewImage: (imageUri: string) => void;
  
  // Complete reset
  reset: () => void;
}

const initialState = {
  currentImageUri: '',
  isProcessing: false,
  showCropTool: false,
  useImageLoading: false,
  buttonText: 'Use Image',
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
  
  // Reset for new image - maintains consistency with existing patterns
  resetForNewImage: (imageUri) => {
    if (__DEV__) {
      console.log('🔄 CropModal: Resetting for new image:', imageUri);
    }
    set({
      currentImageUri: imageUri,
      isProcessing: false,
      showCropTool: false,
      useImageLoading: false,
      buttonText: 'Use Image',
    });
  },
  
  // Complete reset - useful for cleanup
  reset: () => {
    if (__DEV__) {
      console.log('🧹 CropModal: Complete reset');
    }
    set(initialState);
  },
}));