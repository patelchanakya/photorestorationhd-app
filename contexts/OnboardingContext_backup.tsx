import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onboardingUtils } from '@/utils/onboarding';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { analyticsService } from '@/services/analytics';

interface OnboardingContextType {
  showOnboarding: boolean | null;
  completeOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const { isPro } = useSubscriptionStore();

  useEffect(() => {
    if (__DEV__) {
      console.log('🔍 OnboardingContext: Checking onboarding status...');
      console.log('💎 User isPro:', isPro);
    }
    
    // RESET: Back to production logic - only show onboarding for non-pro users
    const shouldShowOnboarding = !isPro;
    
    if (__DEV__) {
      console.log('🎯 OnboardingContext: shouldShowOnboarding =', shouldShowOnboarding);
    }
    
    setShowOnboarding(shouldShowOnboarding);

    // Track onboarding started for non-pro users
    if (shouldShowOnboarding) {
      analyticsService.trackOnboardingStarted();
    }
  }, [isPro]);

  const completeOnboarding = React.useCallback(async () => {
    // Track onboarding completion
    analyticsService.trackOnboardingCompleted();
    
    // Don't save completion state, just hide onboarding for this session
    setShowOnboarding(false);
  }, []);

  const contextValue = React.useMemo(
    () => ({ showOnboarding, completeOnboarding }),
    [showOnboarding, completeOnboarding]
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}