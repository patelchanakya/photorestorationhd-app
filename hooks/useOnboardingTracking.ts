import { useCallback } from 'react';
import { onboardingTrackingService } from '@/services/onboardingTracking';

export interface UseOnboardingTrackingReturn {
  trackPermissionRequest: (permissionType: string, granted: boolean) => Promise<void>;
  trackFeatureView: (featureId: string, durationMs?: number) => Promise<void>;
  trackFeatureSelection: (featureId: string, metadata?: Record<string, any>) => Promise<void>;
  trackCustomPromptUsage: (prompt: string) => Promise<void>;
  trackPhotoSelection: (photoMetadata: { width: number; height: number; source: string }) => Promise<void>;
  trackStepSkip: (stepName: string, reason?: string) => Promise<void>;
  trackStepBack: (fromStep: string, toStep: string) => Promise<void>;
}

/**
 * Hook for tracking onboarding interactions
 * Provides easy-to-use methods for common tracking events
 */
export function useOnboardingTracking(): UseOnboardingTrackingReturn {
  const trackPermissionRequest = useCallback(async (permissionType: string, granted: boolean) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'permissions',
        status: granted ? 'completed' : 'skipped',
        stepData: { 
          permissionType, 
          granted,
          timestamp: Date.now()
        }
      });

      // Update device info with permission status
      await onboardingTrackingService.updateDeviceInfo({}, { [permissionType]: granted });

      if (__DEV__) {
        console.log(`📱 [Tracking] Permission ${permissionType}: ${granted ? 'granted' : 'denied'}`);
      }
    } catch (error) {
      console.error('Failed to track permission request:', error);
    }
  }, []);

  const trackFeatureView = useCallback(async (featureId: string, durationMs?: number) => {
    try {
      await onboardingTrackingService.trackFeatureInteraction({
        featureId,
        interactionType: 'viewed',
        interactionDurationMs: durationMs,
        featureMetadata: { 
          viewedAt: Date.now(),
          context: 'feature_selection'
        }
      });

      if (__DEV__) {
        console.log(`👀 [Tracking] Feature viewed: ${featureId} (${durationMs}ms)`);
      }
    } catch (error) {
      console.error('Failed to track feature view:', error);
    }
  }, []);

  const trackFeatureSelection = useCallback(async (featureId: string, metadata?: Record<string, any>) => {
    try {
      await onboardingTrackingService.trackFeatureInteraction({
        featureId,
        interactionType: 'selected',
        featureMetadata: {
          ...metadata,
          selectedAt: Date.now(),
          context: 'feature_selection'
        }
      });

      if (__DEV__) {
        console.log(`✅ [Tracking] Feature selected: ${featureId}`);
      }
    } catch (error) {
      console.error('Failed to track feature selection:', error);
    }
  }, []);

  const trackCustomPromptUsage = useCallback(async (prompt: string) => {
    try {
      await onboardingTrackingService.trackFeatureInteraction({
        featureId: 'custom_prompt',
        interactionType: 'selected',
        featureMetadata: {
          promptLength: prompt.length,
          hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(prompt),
          wordCount: prompt.split(' ').length,
          context: 'custom_prompt_entry'
        }
      });

      if (__DEV__) {
        console.log(`✏️ [Tracking] Custom prompt used: ${prompt.length} chars`);
      }
    } catch (error) {
      console.error('Failed to track custom prompt usage:', error);
    }
  }, []);

  const trackPhotoSelection = useCallback(async (photoMetadata: { width: number; height: number; source: string }) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: 'preview',
        status: 'completed',
        stepData: {
          photoSelected: true,
          photoWidth: photoMetadata.width,
          photoHeight: photoMetadata.height,
          photoSource: photoMetadata.source,
          aspectRatio: (photoMetadata.width / photoMetadata.height).toFixed(2),
          resolution: photoMetadata.width * photoMetadata.height
        }
      });

      if (__DEV__) {
        console.log(`📸 [Tracking] Photo selected: ${photoMetadata.width}x${photoMetadata.height} from ${photoMetadata.source}`);
      }
    } catch (error) {
      console.error('Failed to track photo selection:', error);
    }
  }, []);

  const trackStepSkip = useCallback(async (stepName: string, reason?: string) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName,
        status: 'skipped',
        stepData: {
          skipReason: reason,
          skippedAt: Date.now()
        }
      });

      if (__DEV__) {
        console.log(`⏭️ [Tracking] Step skipped: ${stepName} (${reason || 'no reason'})`);
      }
    } catch (error) {
      console.error('Failed to track step skip:', error);
    }
  }, []);

  const trackStepBack = useCallback(async (fromStep: string, toStep: string) => {
    try {
      await onboardingTrackingService.trackStepProgress({
        stepName: fromStep,
        status: 'abandoned',
        stepData: {
          navigatedBackTo: toStep,
          backNavigationAt: Date.now()
        }
      });

      if (__DEV__) {
        console.log(`◀️ [Tracking] Back navigation: ${fromStep} -> ${toStep}`);
      }
    } catch (error) {
      console.error('Failed to track back navigation:', error);
    }
  }, []);

  return {
    trackPermissionRequest,
    trackFeatureView,
    trackFeatureSelection,
    trackCustomPromptUsage,
    trackPhotoSelection,
    trackStepSkip,
    trackStepBack,
  };
}

export default useOnboardingTracking;