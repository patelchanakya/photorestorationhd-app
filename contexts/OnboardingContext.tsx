import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onboardingUtils } from '@/utils/onboarding';
import { useSubscriptionStore } from '@/store/subscriptionStore';

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
  }, [isPro]);

  const completeOnboarding = async () => {
    // Don't save completion state, just hide onboarding for this session
    setShowOnboarding(false);
  };

  return (
    <OnboardingContext.Provider value={{ showOnboarding, completeOnboarding }}>
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