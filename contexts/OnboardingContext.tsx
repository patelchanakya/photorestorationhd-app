import React, { createContext, useContext, useState, useCallback } from 'react';

export type OnboardingScreen = 'welcome' | 'permissions' | 'features' | 'preview' | 'community' | 'setup';

interface OnboardingState {
  selectedFeature: string | null;
  selectedPhoto: { uri: string; width: number; height: number } | null;
  hasPickedPhoto: boolean;
  customPrompt: string | null;
}

interface OnboardingContextType {
  // Navigation
  currentScreen: OnboardingScreen;
  navigateToScreen: (screen: OnboardingScreen) => void;
  
  // State
  onboardingState: OnboardingState;
  updateOnboardingState: (updates: Partial<OnboardingState>) => void;
  
  // Actions
  selectFeature: (featureId: string) => void;
  pickPhoto: (photo: { uri: string; width: number; height: number }) => void;
  setCustomPrompt: (prompt: string | null) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

interface OnboardingProviderProps {
  children: React.ReactNode;
  initialScreen?: OnboardingScreen;
}

export function OnboardingProvider({ children, initialScreen = 'welcome' }: OnboardingProviderProps) {
  const [currentScreen, setCurrentScreen] = useState<OnboardingScreen>(initialScreen);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    selectedFeature: null,
    selectedPhoto: null,
    hasPickedPhoto: false,
    customPrompt: null,
  });

  const navigateToScreen = useCallback((screen: OnboardingScreen) => {
    if (__DEV__) {
      console.log('🧭 [Context] Navigating from', currentScreen, 'to', screen);
    }
    setCurrentScreen(screen);
  }, [currentScreen]);

  const updateOnboardingState = useCallback((updates: Partial<OnboardingState>) => {
    setOnboardingState(prev => {
      const newState = { ...prev, ...updates };
      if (__DEV__) {
        console.log('📊 [Context] State updated:', newState);
      }
      return newState;
    });
  }, []);

  const selectFeature = useCallback((featureId: string) => {
    if (__DEV__) {
      console.log('✅ [Context] Feature selected:', featureId);
    }
    updateOnboardingState({ selectedFeature: featureId });
    navigateToScreen('preview');
  }, [updateOnboardingState, navigateToScreen]);

  const pickPhoto = useCallback((photo: { uri: string; width: number; height: number }) => {
    if (__DEV__) {
      console.log('📸 [Context] Photo picked:', photo.uri);
    }
    updateOnboardingState({ 
      selectedPhoto: photo,
      hasPickedPhoto: true 
    });
    navigateToScreen('community');
  }, [updateOnboardingState, navigateToScreen]);

  const setCustomPrompt = useCallback((prompt: string | null) => {
    if (__DEV__) {
      console.log('✏️ [Context] Custom prompt set:', prompt);
    }
    updateOnboardingState({ customPrompt: prompt });
  }, [updateOnboardingState]);

  const reset = useCallback(() => {
    if (__DEV__) {
      console.log('🔄 [Context] Resetting onboarding state');
    }
    setCurrentScreen('welcome');
    setOnboardingState({
      selectedFeature: null,
      selectedPhoto: null,
      hasPickedPhoto: false,
      customPrompt: null,
    });
  }, []);

  const contextValue: OnboardingContextType = {
    currentScreen,
    navigateToScreen,
    onboardingState,
    updateOnboardingState,
    selectFeature,
    pickPhoto,
    setCustomPrompt,
    reset,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboardingContext must be used within an OnboardingProvider');
  }
  return context;
}

// Optional: Hook for just navigation (cleaner API)
export function useOnboardingNavigation() {
  const { currentScreen, navigateToScreen } = useOnboardingContext();
  return { currentScreen, navigateToScreen };
}

// Optional: Hook for just state (cleaner API)
export function useOnboardingState() {
  const { onboardingState, updateOnboardingState, selectFeature, pickPhoto } = useOnboardingContext();
  return { onboardingState, updateOnboardingState, selectFeature, pickPhoto };
}