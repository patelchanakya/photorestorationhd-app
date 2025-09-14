import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number; // 0-100 percentage
}

export interface ABTest {
  testName: string;
  variants: ABTestVariant[];
  isActive: boolean;
}

// Welcome screen copy - using translation keys
export const WELCOME_COPY_VARIANTS = {
  A: {
    titleKey: "onboardingV4.welcome.title",
    subtitleKey: "onboardingV4.welcome.subtitle"
  }
};

// Define A/B tests
export const AB_TESTS: Record<string, ABTest> = {
  welcomeScreenCopy: {
    testName: 'welcomeScreenCopy',
    variants: [
      { id: 'A', name: 'Magic Appeal', weight: 100 }
    ],
    isActive: false
  }
};

/**
 * Get consistent variant for a user based on their device/session
 * Uses deterministic hashing to ensure same user always gets same variant
 */
export function getABTestVariant(testName: string): string {
  const test = AB_TESTS[testName];
  
  if (!test || !test.isActive) {
    return test?.variants[0]?.id || 'A';
  }

  // Use session ID for consistent assignment
  const userId = Constants.sessionId || 'default';
  
  // Create hash from testName + userId for consistent assignment
  const hashInput = `${testName}-${userId}`;
  let hash = 0;
  
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive number and get percentage (0-99)
  const percentage = Math.abs(hash) % 100;
  
  // Determine variant based on weights
  let cumulativeWeight = 0;
  for (const variant of test.variants) {
    cumulativeWeight += variant.weight;
    if (percentage < cumulativeWeight) {
      return variant.id;
    }
  }
  
  // Fallback to first variant
  return test.variants[0].id;
}

/**
 * Track A/B test exposure for analytics
 */
export async function trackABTestExposure(testName: string, variant: string) {
  try {
    // Store locally for debugging
    const exposureData = {
      testName,
      variant,
      timestamp: new Date().toISOString(),
      sessionId: Constants.sessionId
    };
    
    await AsyncStorage.setItem(
      `abtest_${testName}_${variant}`, 
      JSON.stringify(exposureData)
    );
    
    // You can integrate with your analytics service here
    if (__DEV__) {
      console.log(`🧪 A/B Test Exposure: ${testName} = ${variant}`);
    }
    
    // TODO: Send to your analytics service
    // analyticsService.track('ab_test_exposure', exposureData);
    
  } catch (error) {
    console.warn('Failed to track A/B test exposure:', error);
  }
}

/**
 * Get welcome screen copy translation keys based on A/B test variant
 */
export function getWelcomeCopy(): { titleKey: string; subtitleKey: string; variant: string } {
  const variant = getABTestVariant('welcomeScreenCopy');
  const copy = WELCOME_COPY_VARIANTS[variant as keyof typeof WELCOME_COPY_VARIANTS] || WELCOME_COPY_VARIANTS.A;

  return {
    titleKey: copy.titleKey,
    subtitleKey: copy.subtitleKey,
    variant
  };
}

/**
 * Debug: Get all A/B test assignments for current user
 */
export function debugABTests(): Record<string, string> {
  const results: Record<string, string> = {};
  
  Object.keys(AB_TESTS).forEach(testName => {
    results[testName] = getABTestVariant(testName);
  });
  
  return results;
}