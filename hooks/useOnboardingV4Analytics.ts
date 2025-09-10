import { useCallback } from 'react';
import { onboardingTrackingService } from '@/services/onboardingTracking';

export function useOnboardingV4Analytics() {
  
  const trackOnboardingStarted = useCallback(async () => {
    try {
      await onboardingTrackingService.startOnboardingSession('v4');
      await onboardingTrackingService.trackStepProgress({
        stepName: 'onboarding_started',
        status: 'viewed',
        stepData: {
          version: 'v4',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track onboarding started:', error);
    }
  }, []);

  const trackStepCompleted = useCallback(async (
    stepNumber: number, 
    stepName: string, 
    metadata?: Record<string, any>
  ) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName,
        status: 'completed',
        stepData: {
          step: stepNumber,
          timestamp: Date.now(),
          ...metadata
        }
      });
    } catch (error) {
      console.error(`Failed to track step ${stepNumber} completion:`, error);
    }
  }, []);

  const trackIntentSelected = useCallback(async (intentId: string) => {
    try {
      await onboardingTrackingService.trackFeatureInteraction({
        featureId: intentId,
        interactionType: 'selected',
        featureMetadata: {
          context: 'intent_selection',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track intent selection:', error);
    }
  }, []);

  const trackPhotoSelected = useCallback(async (photoMetadata: {
    source: 'gallery' | 'camera';
    width: number;
    height: number;
  }) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'photo_selected',
        status: 'completed',
        stepData: {
          ...photoMetadata,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track photo selection:', error);
    }
  }, []);

  const trackRestorationCompleted = useCallback(async (processingTime: number) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'restoration_completed',
        status: 'completed',
        stepData: {
          processing_time: processingTime,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track restoration completion:', error);
    }
  }, []);

  const trackTrialShown = useCallback(async () => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'trial_shown',
        status: 'viewed',
        stepData: {
          context: 'onboarding_v4',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track trial shown:', error);
    }
  }, []);

  const trackTrialStarted = useCallback(async () => {
    try {
      await onboardingTrackingService.trackConversionEvent({
        conversionType: 'subscription',
        triggerFeature: 'onboarding_v4_trial',
        conversionMetadata: {
          source: 'onboarding_v4',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track trial started:', error);
    }
  }, []);

  const trackOnboardingAbandoned = useCallback(async (lastStep: string, reason?: string) => {
    try {
      await onboardingTrackingService.completeOnboarding('abandoned', lastStep);
    } catch (error) {
      console.error('Failed to track onboarding abandonment:', error);
    }
  }, []);

  const trackOnboardingCompleted = useCallback(async (completionData: {
    conversion_path: 'trial' | 'free';
    completed_steps: number;
    total_time: number;
  }) => {
    try {
      await onboardingTrackingService.completeOnboarding('completed');
      
      // Track conversion funnel metrics
      await onboardingTrackingService.trackConversionEvent({
        conversionType: completionData.conversion_path === 'trial' ? 'subscription' : 'first_edit',
        triggerFeature: 'onboarding_v4_complete',
        conversionMetadata: {
          ...completionData,
          version: 'v4',
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track onboarding completion:', error);
    }
  }, []);

  // Social proof tracking
  const trackSocialProofShown = useCallback(async (proofType: 'counter' | 'testimonial' | 'location') => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'social_proof_shown',
        status: 'viewed',
        stepData: {
          proof_type: proofType,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Failed to track social proof:', error);
    }
  }, []);

  return {
    trackOnboardingStarted,
    trackStepCompleted,
    trackIntentSelected,
    trackPhotoSelected,
    trackRestorationCompleted,
    trackTrialShown,
    trackTrialStarted,
    trackOnboardingAbandoned,
    trackOnboardingCompleted,
    trackSocialProofShown,
  };
}