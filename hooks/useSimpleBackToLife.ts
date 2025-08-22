import { useMutation } from '@tanstack/react-query';
import { useVideoGenerationStore } from '../store/videoGenerationStore';
import { DEFAULT_ANIMATION_PROMPT } from '../constants/videoPrompts';

interface BackToLifeParams {
  imageUri: string;
  animationPrompt?: string;
}

export function useSimpleBackToLife() {
  const { 
    isGenerating, 
    hasUnviewedVideo,
    startGeneration, 
    updateProgress, 
    completeGeneration, 
    failGeneration
  } = useVideoGenerationStore();

  return useMutation({
    mutationFn: async ({ imageUri, animationPrompt = DEFAULT_ANIMATION_PROMPT }: BackToLifeParams) => {
      let usageWasIncremented = false;
      
      // Strict duplicate prevention - if already generating, reject
      if (isGenerating) {
        return Promise.reject(new Error('Video already generating. Please wait.'));
      }
      
      // Block if there's an unviewed video
      if (hasUnviewedVideo) {
        return Promise.reject(new Error('Please view your completed video before generating a new one.'));
      }

      // Additional protection: check if this exact image+prompt combo is already being processed
      // This prevents double-tap or rapid-fire generation attempts
      const currentImageUri = useVideoGenerationStore.getState().currentImageUri;
      if (currentImageUri === imageUri) {
        return Promise.reject(new Error('This image is already being processed.'));
      }

      // Check and increment usage atomically before starting generation
      const { backToLifeService } = await import('../services/backToLifeService');
      const usageIncremented = await backToLifeService.checkAndIncrementUsage();
      usageWasIncremented = usageIncremented;
      
      if (!usageIncremented) {
        // Get detailed usage info for better error message
        const usageCheck = await backToLifeService.checkUsage();
        if (!usageCheck.canUse) {
          if (usageCheck.limit === 0) {
            return Promise.reject(new Error('Video generation requires PRO subscription'));
          } else {
            return Promise.reject(new Error(`You've reached your ${usageCheck.planType} video limit (${usageCheck.used}/${usageCheck.limit}). Resets on ${new Date(usageCheck.nextResetDate).toLocaleDateString()}`));
          }
        }
        return Promise.reject(new Error('Usage limit reached. Please try again later.'));
      }

      try {
        // Import the video generation service
        const { generateVideo, generateVideoWithPolling } = await import('../services/videoGenerationV2');
        
        // Step 1: Get real server prediction ID first (fast - responds immediately)
        const serverResponse = await generateVideo(imageUri, animationPrompt, { duration: 5 });
        const realPredictionId = serverResponse.prediction_id;
        
        // Step 2: Now save to store with real prediction ID
        startGeneration(imageUri, realPredictionId, animationPrompt);
        
        // Step 3: Start polling loop with the real ID
        const { pollVideoStatus } = await import('../services/videoGenerationV2');
        
        const startTime = Date.now();
        const timeoutMs = 180000; // 3 minutes
        
        const videoUrl = await new Promise<string>((resolve, reject) => {
          const poll = async () => {
            try {
              const elapsed = Date.now() - startTime;
              
              if (elapsed > timeoutMs) {
                reject(new Error('Video generation timed out. Please try again.'));
                return;
              }

              const statusResponse = await pollVideoStatus(realPredictionId);
              
              // Update progress
              const progressMap: Record<string, number> = {
                'starting': 10,
                'processing': 50,
                'succeeded': 90
              };
              updateProgress(progressMap[statusResponse.status] || 0, realPredictionId);

              if (statusResponse.is_complete) {
                if (statusResponse.is_successful && statusResponse.video_url) {
                  resolve(statusResponse.video_url);
                } else {
                  const error = statusResponse.error_message || 'Video generation failed';
                  reject(new Error(error));
                }
                return;
              }

              // Continue polling with adaptive interval
              let nextPollInterval: number;
              if (elapsed < 10000) {
                nextPollInterval = 3000;
              } else if (elapsed < 30000) {
                nextPollInterval = 5000;
              } else {
                nextPollInterval = 7000;
              }

              setTimeout(poll, nextPollInterval);
            } catch (error) {
              reject(error);
            }
          };

          // Start polling after initial delay
          setTimeout(poll, 5000);
        });

        const videoData = {
          id: realPredictionId,
          url: videoUrl,
          originalImage: imageUri,
          prompt: animationPrompt,
          predictionId: realPredictionId
        };

        return { ...videoData, usageWasIncremented };
      } catch (error) {
        // Attach usage info to error for rollback decision
        (error as any).usageWasIncremented = usageWasIncremented;
        throw error;
      }
    },

    onSuccess: (data) => {
      completeGeneration(data);
      console.log(`✅ Video generation completed: ${data.id}`);
    },

    onError: async (error) => {
      if (error instanceof Error && 
          (error.message === 'Video already generating. Please wait.' ||
           error.message === 'Please view your completed video before generating a new one.')) {
        return; // silent no-op for these cases
      }

      // Only rollback usage if it was actually incremented
      const shouldRollback = (error as any).usageWasIncremented;
      if (shouldRollback) {
        try {
          // Use robust rollback service with retry logic and persistence
          const { rollbackService } = await import('../services/rollbackService');
          const { getVideoTrackingId } = await import('../services/trackingIds');
          
          const userId = await getVideoTrackingId();
          if (userId) {
            const rollbackSuccess = await rollbackService.attemptRollback(
              userId, 
              'video', 
              `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            
            if (rollbackSuccess) {
              console.log('🔄 Usage count rolled back due to generation failure');
            } else {
              console.log('⏳ Usage rollback queued for retry (will be processed in background)');
            }
          } else {
            console.error('⚠️ No user ID available for rollback');
          }
        } catch (rollbackError) {
          console.error('⚠️ Failed to initiate usage rollback:', rollbackError);
        }
      }

      let errorMessage = 'Generation failed. Tap to try again.';
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message === 'PRO_REQUIRED') {
          errorMessage = 'PRO subscription required.';
        } else if (error.message.includes('Video generation requires PRO subscription')) {
          errorMessage = 'PRO subscription required for video generation.';
        } else if (error.message.includes('video limit')) {
          errorMessage = error.message; // Use the detailed limit message
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = 'Video generation timed out. Please try again.';
        } else if (error.message.includes('Usage limit reached')) {
          errorMessage = 'Usage limit reached. Please try again later.';
        }
      }

      failGeneration(errorMessage);
      console.error('❌ Video generation failed:', error);
    }
  });
}