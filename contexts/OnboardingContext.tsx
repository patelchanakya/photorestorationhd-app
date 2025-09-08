import { onboardingTrackingService } from '@/services/onboardingTracking';
import { onboardingUtils } from '@/utils/onboarding';
import * as Device from 'expo-device';
import React, { createContext, useCallback, useEffect, useRef, useState, use } from 'react';
import { Platform } from 'react-native';

export type OnboardingScreen = 'welcome' | 'permissions' | 'features' | 'preview' | 'community' | 'setup';

interface OnboardingState {
  selectedFeature: string | null;
  selectedPhoto: { uri: string; width: number; height: number } | null;
  hasPickedPhoto: boolean;
  customPrompt: string | null;
  sessionId: string | null;
  stepStartTime: number | null;
}

interface OnboardingContextType {
  // Navigation
  currentScreen: OnboardingScreen;
  navigateToScreen: (screen: OnboardingScreen) => Promise<void>;
  
  // State
  onboardingState: OnboardingState;
  updateOnboardingState: (updates: Partial<OnboardingState>) => void;
  
  // Actions
  selectFeature: (featureId: string) => Promise<void>;
  pickPhoto: (photo: { uri: string; width: number; height: number }) => Promise<void>;
  setCustomPrompt: (prompt: string | null) => void;
  reset: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  trackPermission: (permissionType: string, granted: boolean) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

interface OnboardingProviderProps {
  children: React.ReactNode;
  initialScreen?: OnboardingScreen;
}

export function OnboardingProvider({ children, initialScreen = 'welcome' }: OnboardingProviderProps) {
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-PROVIDER] Component mounting...');
    console.log('🔥 [ONBOARDING-PROVIDER] InitialScreen:', initialScreen);
  }

  const [currentScreen, setCurrentScreen] = useState<OnboardingScreen>(initialScreen);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    selectedFeature: null,
    selectedPhoto: null,
    hasPickedPhoto: false,
    customPrompt: null,
    sessionId: null,
    stepStartTime: null,
  });
  
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-PROVIDER] State initialized');
    console.log('🔥 [ONBOARDING-PROVIDER] CurrentScreen:', currentScreen);
  }
  
  const screenStartTimes = useRef<Record<string, number>>({});
  const hasInitialized = useRef(false);

  // Initialize tracking session on mount
  useEffect(() => {
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-PROVIDER] useEffect triggered');
      console.log('🔥 [ONBOARDING-PROVIDER] hasInitialized:', hasInitialized.current);
    }
    
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (__DEV__) {
        console.log('🔥 [ONBOARDING-PROVIDER] Calling initializeTracking...');
      }
      initializeTracking();
    }
  }, []);

  const initializeTracking = async () => {
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-PROVIDER] initializeTracking started');
    }
    
    try {
      if (__DEV__) {
        console.log('🔥 [ONBOARDING-PROVIDER] Starting onboarding session...');
      }
      
      const sessionId = await onboardingTrackingService.startOnboardingSession('v3');
      
      if (__DEV__) {
        console.log('🔥 [ONBOARDING-PROVIDER] Session started:', sessionId);
        console.log('🔥 [ONBOARDING-PROVIDER] Collecting device info...');
      }
      
      // Collect device info
      const deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        deviceType: Device.deviceType,
        deviceName: Device.deviceName,
        osName: Device.osName,
        osVersion: Device.osVersion,
        modelName: Device.modelName,
      };
      
      if (__DEV__) {
        console.log('🔥 [ONBOARDING-PROVIDER] Device info collected:', deviceInfo);
      }
      
      await onboardingTrackingService.updateDeviceInfo(deviceInfo, {});
      
      setOnboardingState(prev => ({ ...prev, sessionId, stepStartTime: Date.now() }));
      screenStartTimes.current[initialScreen] = Date.now();
      
      // Track first step view
      await onboardingTrackingService.trackStepProgress({
        stepName: initialScreen,
        status: 'viewed',
        stepData: { initialScreen: true }
      });
      
      if (__DEV__) {
        console.log('🔥 [ONBOARDING-PROVIDER] Tracking initialized successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('🔥 [ONBOARDING-PROVIDER] ERROR in initializeTracking:', error);
      }
      console.error('Failed to initialize tracking:', error);
    }
  };

  const navigateToScreen = useCallback(async (screen: OnboardingScreen) => {
    const now = Date.now();
    const previousScreen = currentScreen;
    const startTime = screenStartTimes.current[previousScreen];
    const timeSpent = startTime ? Math.floor((now - startTime) / 1000) : 0;
    
    if (__DEV__) {
      console.log('🧭 [Context] Navigating from', previousScreen, 'to', screen, `(${timeSpent}s)`);
    }
    
    // Navigate immediately for instant transitions
    setCurrentScreen(screen);
    screenStartTimes.current[screen] = now;
    
    // Track in background without blocking navigation - use InteractionManager for better performance
    import('react-native').then(({ InteractionManager }) => {
      InteractionManager.runAfterInteractions(() => {
        Promise.all([
          onboardingTrackingService.trackStepProgress({
            stepName: previousScreen,
            status: 'completed',
            timeSpentSeconds: timeSpent
          }),
          onboardingTrackingService.trackStepProgress({
            stepName: screen,
            status: 'viewed'
          })
        ]).catch(error => {
          if (__DEV__) {
            console.error('Background tracking failed:', error);
          }
        });
      });
    });
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

  const selectFeature = useCallback(async (featureId: string) => {
    if (__DEV__) {
      console.log('✅ [Context] Feature selected:', featureId);
    }
    
    // Update state and navigate immediately
    updateOnboardingState({ selectedFeature: featureId });
    await navigateToScreen('preview');
    
    // Track in background using InteractionManager for better performance
    import('react-native').then(({ InteractionManager }) => {
      InteractionManager.runAfterInteractions(() => {
        onboardingTrackingService.trackFeatureInteraction({
          featureId,
          interactionType: 'selected',
          featureMetadata: { step: 'feature_selection' }
        }).catch(error => {
          if (__DEV__) {
            console.error('Background feature tracking failed:', error);
          }
        });
      });
    });
  }, [updateOnboardingState, navigateToScreen]);

  const pickPhoto = useCallback(async (photo: { uri: string; width: number; height: number }) => {
    if (__DEV__) {
      console.log('📸 [Context] Photo picked:', photo.uri);
    }
    
    // Track photo selection  
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'preview',
        status: 'completed',
        stepData: { 
          hasPhoto: true,
          photoSize: `${photo.width}x${photo.height}`
        }
      });
    } catch (error) {
      console.error('Failed to track photo selection:', error);
    }
    
    updateOnboardingState({ 
      selectedPhoto: photo,
      hasPickedPhoto: true 
    });
    await navigateToScreen('community');
  }, [updateOnboardingState, navigateToScreen]);

  const setCustomPrompt = useCallback((prompt: string | null) => {
    if (__DEV__) {
      console.log('✏️ [Context] Custom prompt set:', prompt);
    }
    updateOnboardingState({ customPrompt: prompt });
  }, [updateOnboardingState]);

  const completeOnboarding = useCallback(async () => {
    try {
      const now = Date.now();
      const startTime = screenStartTimes.current[currentScreen];
      const timeSpent = startTime ? Math.floor((now - startTime) / 1000) : 0;
      
      // Track final step completion
      await onboardingTrackingService.trackStepProgress({
        stepName: currentScreen,
        status: 'completed',
        timeSpentSeconds: timeSpent
      });
      
      // Mark onboarding as completed in tracking service
      await onboardingTrackingService.completeOnboarding('completed');
      
      // IMPORTANT: Also mark as completed in local storage for hasSeenOnboarding check
      await onboardingUtils.completeOnboarding();
      
      if (__DEV__) {
        console.log('🎆 [Context] Onboarding completed successfully');
      }
    } catch (error) {
      console.error('Failed to complete onboarding tracking:', error);
    }
  }, [currentScreen]);

  const trackPermission = useCallback(async (permissionType: string, granted: boolean) => {
    try {
      const permissions = { [permissionType]: granted };
      await onboardingTrackingService.updateDeviceInfo({}, permissions);
      
      await onboardingTrackingService.trackStepProgress({
        stepName: 'permissions',
        status: granted ? 'completed' : 'skipped',
        stepData: { permissionType, granted }
      });
    } catch (error) {
      console.error('Failed to track permission:', error);
    }
  }, []);

  const reset = useCallback(async () => {
    if (__DEV__) {
      console.log('🔄 [Context] Resetting onboarding state');
    }
    
    // Track abandonment
    try {
      await onboardingTrackingService.completeOnboarding('abandoned', currentScreen);
    } catch (error) {
      console.error('Failed to track onboarding reset:', error);
    }
    
    setCurrentScreen('welcome');
    setOnboardingState({
      selectedFeature: null,
      selectedPhoto: null,
      hasPickedPhoto: false,
      customPrompt: null,
      sessionId: null,
      stepStartTime: null,
    });
    
    // Reinitialize tracking
    hasInitialized.current = false;
  }, [currentScreen]);

  const contextValue: OnboardingContextType = {
    currentScreen,
    navigateToScreen,
    onboardingState,
    updateOnboardingState,
    selectFeature,
    pickPhoto,
    setCustomPrompt,
    reset,
    completeOnboarding,
    trackPermission,
  };

  if (__DEV__) {
    console.log('🔥 [ONBOARDING-PROVIDER] About to render Provider');
    console.log('🔥 [ONBOARDING-PROVIDER] Children exists:', !!children);
    console.log('🔥 [ONBOARDING-PROVIDER] Context value:', contextValue);
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {(() => {
        if (__DEV__) {
          console.log('🔥 [ONBOARDING-PROVIDER] Rendering children...');
        }
        return children;
      })()}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingContext() {
  const context = use(OnboardingContext);
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