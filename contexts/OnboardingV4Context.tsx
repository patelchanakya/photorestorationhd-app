import React, { createContext, useCallback, useState, use } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingV4Step = 'welcome' | 'permissions' | 'intent' | 'demo' | 'processing' | 'result' | 'tour';

interface PhotoData {
  uri: string;
  width: number;
  height: number;
}

interface ProcessingResult {
  uri: string;
  processingTime: number;
}

interface OnboardingV4State {
  currentStep: OnboardingV4Step;
  selectedIntent: string | null;
  selectedPhoto: PhotoData | null;
  permissions: {
    photos: boolean;
  };
  processingResult: ProcessingResult | null;
  trialOffered: boolean;
  startTime: number;
}

interface OnboardingV4ContextType {
  // Current state
  currentStep: OnboardingV4Step;
  onboardingState: OnboardingV4State;
  
  // Navigation
  navigateToStep: (step: OnboardingV4Step) => void;
  
  // State updates
  selectIntent: (intentId: string) => Promise<void>;
  selectPhoto: (photo: PhotoData) => Promise<void>;
  setProcessingResult: (result: ProcessingResult) => Promise<void>;
  setTrialOffered: (offered: boolean) => void;
  
  // Actions
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingV4Context = createContext<OnboardingV4ContextType | null>(null);

interface OnboardingV4ProviderProps {
  children: React.ReactNode;
  initialStep?: OnboardingV4Step;
}

export function OnboardingV4Provider({ 
  children, 
  initialStep = 'welcome' 
}: OnboardingV4ProviderProps) {
  const [onboardingState, setOnboardingState] = useState<OnboardingV4State>({
    currentStep: initialStep,
    selectedIntent: null,
    selectedPhoto: null,
    permissions: {
      photos: false,
    },
    processingResult: null,
    trialOffered: false,
    startTime: Date.now(),
  });

  const navigateToStep = useCallback((step: OnboardingV4Step) => {
    setOnboardingState(prev => ({
      ...prev,
      currentStep: step
    }));
  }, []);

  const selectIntent = useCallback(async (intentId: string) => {
    setOnboardingState(prev => ({
      ...prev,
      selectedIntent: intentId
    }));
  }, []);

  const selectPhoto = useCallback(async (photo: PhotoData) => {
    setOnboardingState(prev => ({
      ...prev,
      selectedPhoto: photo
    }));
  }, []);

  const setProcessingResult = useCallback(async (result: ProcessingResult) => {
    setOnboardingState(prev => ({
      ...prev,
      processingResult: result
    }));
  }, []);

  const setTrialOffered = useCallback((offered: boolean) => {
    setOnboardingState(prev => ({
      ...prev,
      trialOffered: offered
    }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      // Mark onboarding V4 as completed in AsyncStorage
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      await AsyncStorage.setItem('onboardingVersion', 'v4');
      await AsyncStorage.setItem('onboardingCompletedAt', new Date().toISOString());
      
      // Store completion data for analytics
      const completionData = {
        version: 'v4',
        completedAt: new Date().toISOString(),
        selectedIntent: onboardingState.selectedIntent,
        hadPhoto: !!onboardingState.selectedPhoto,
        trialOffered: onboardingState.trialOffered,
        totalTime: Date.now() - onboardingState.startTime
      };
      
      await AsyncStorage.setItem('onboardingCompletionData', JSON.stringify(completionData));
      
      if (__DEV__) {
        console.log('✅ OnboardingV4 completed successfully', completionData);
      }
    } catch (error) {
      console.error('Failed to mark onboarding as completed:', error);
    }
  }, [onboardingState]);

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('hasSeenOnboarding');
      await AsyncStorage.removeItem('onboardingVersion');
      await AsyncStorage.removeItem('onboardingCompletedAt');
      await AsyncStorage.removeItem('onboardingCompletionData');
      
      setOnboardingState({
        currentStep: 'welcome',
        selectedIntent: null,
        selectedPhoto: null,
        permissions: {
          photos: false,
        },
        processingResult: null,
        trialOffered: false,
        startTime: Date.now(),
      });
      
      if (__DEV__) {
        console.log('🔄 OnboardingV4 reset successfully');
      }
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
    }
  }, []);

  const contextValue: OnboardingV4ContextType = {
    currentStep: onboardingState.currentStep,
    onboardingState,
    navigateToStep,
    selectIntent,
    selectPhoto,
    setProcessingResult,
    setTrialOffered,
    completeOnboarding,
    resetOnboarding,
  };

  return (
    <OnboardingV4Context.Provider value={contextValue}>
      {children}
    </OnboardingV4Context.Provider>
  );
}

export function useOnboardingV4Context() {
  const context = use(OnboardingV4Context);
  if (!context) {
    throw new Error('useOnboardingV4Context must be used within an OnboardingV4Provider');
  }
  return context;
}

// Convenience hooks
export function useOnboardingV4Navigation() {
  const { currentStep, navigateToStep } = useOnboardingV4Context();
  return { currentStep, navigateToStep };
}

export function useOnboardingV4State() {
  const { onboardingState, selectIntent, selectPhoto, setProcessingResult } = useOnboardingV4Context();
  return { onboardingState, selectIntent, selectPhoto, setProcessingResult };
}