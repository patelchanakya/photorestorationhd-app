import { useMutation } from '@tanstack/react-query';
import { useSimpleVideoStore } from '../store/simpleVideoStore';
import { simpleVideoService } from '../services/simpleVideoService';
import { DEFAULT_ANIMATION_PROMPT } from '../constants/videoPrompts';

interface BackToLifeParams {
  imageUri: string;
  animationPrompt?: string;
}

export function useSimpleBackToLife() {
  const { 
    status,
    hasUnviewedVideo,
    currentGeneration,
    showErrorToast
  } = useSimpleVideoStore();

  return useMutation({
    mutationFn: async ({ imageUri, animationPrompt = DEFAULT_ANIMATION_PROMPT }: BackToLifeParams) => {
      let usageWasIncremented = false;
      
      // Strict duplicate prevention - if already generating, reject
      if (status === 'starting' || status === 'processing') {
        return Promise.reject(new Error('Video already generating. Please wait.'));
      }
      
      // Block if there's an unviewed video
      if (hasUnviewedVideo) {
        return Promise.reject(new Error('Please view your completed video before generating a new one.'));
      }

      // Additional protection: check if this exact image+prompt combo is already being processed
      if (currentGeneration && currentGeneration.imageUri === imageUri) {
        return Promise.reject(new Error('This image is already being processed.'));
      }

      // CRITICAL SECURITY: First validate subscription with iOS StoreKit cross-validation
      console.log('🔒 [SECURITY] Starting simplified video generation with enhanced security validation...');
      
      const { validateForVideoGeneration } = await import('../services/simpleSubscriptionService');
      const securityValidation = await validateForVideoGeneration();
      
      if (!securityValidation.canGenerate) {
        if (securityValidation.securityViolation) {
          console.log('🚨 [SECURITY] SECURITY VIOLATION DETECTED:', securityValidation.reason);
          // Log this for monitoring - this indicates potential Apple ID switching exploit
          console.log('🚨 [SECURITY] User attempted to bypass subscription validation');
        }
        
        const errorMessage = securityValidation.securityViolation 
          ? 'Security validation failed. Please restart the app and try again.'
          : securityValidation.reason;
          
        return Promise.reject(new Error(errorMessage));
      }
      
      console.log('✅ [SECURITY] Security validation passed, starting simple video generation...');

      try {
        // Use the simplified video service - it handles everything internally
        await simpleVideoService.startVideo(imageUri, animationPrompt);
        
        // Service handles all polling, state updates, and completion
        // Return a simple success indicator
        return { success: true };
      } catch (error) {
        // Let the error propagate to onError handler
        throw error;
      }
    },

    onSuccess: () => {
      console.log('✅ Simple video generation initiated successfully');
      // No need to do anything here - the service handles completion
    },

    onError: async (error) => {
      if (error instanceof Error && 
          (error.message === 'Video already generating. Please wait.' ||
           error.message === 'Please view your completed video before generating a new one.' ||
           error.message === 'This image is already being processed.')) {
        return; // silent no-op for these cases
      }

      // Show error in store
      let errorMessage = 'Generation failed. Please try again.';
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message === 'PRO_REQUIRED' || error.message.includes('PRO subscription required')) {
          errorMessage = 'PRO subscription required for video generation.';
        } else if (error.message.includes('Security validation failed')) {
          errorMessage = 'Please restart the app and try again.';
        } else if (error.message.includes('video limit')) {
          errorMessage = error.message; // Use the detailed limit message
        } else if (error.message.includes('Network') || error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Video generation timed out. Please try again.';
        } else if (error.message.includes('Usage limit reached')) {
          errorMessage = 'Usage limit reached. Please try again later.';
        }
      }

      showErrorToast(errorMessage);
      console.error('❌ Simple video generation failed:', error);
    }
  });
}