import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
// Video generation is now handled by the webhook-based system
import { useCropModalStore } from '../store/cropModalStore';
import { useVideoToastStore } from '../store/videoToastStore';

interface BackToLifeParams {
  imageUri: string;
  animationPrompt?: string;
  imageSource?: 'camera' | 'gallery';
}

export function useBackToLife() {
  return useMutation({
    mutationFn: async ({ imageUri, animationPrompt = 'bring this photo to life with natural animation' }: BackToLifeParams) => {
      const { setErrorMessage, setIsProcessing, setIsVideoProcessing, setVideoError } = useCropModalStore.getState();
      
      // STEP 1: Check if video is already processing (prevent simultaneous video generations)
      const { isVideoProcessing } = useCropModalStore.getState();
      if (isVideoProcessing) {
        setErrorMessage('Video is already processing. Please wait for it to complete.');
        // Small delay to let UI update before throwing
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('VIDEO_ALREADY_PROCESSING');
      }
      
      // Immediately set both processing states to block subsequent calls
      setIsProcessing(true);
      setIsVideoProcessing(true);
      
      
      try {
        // Server-side webhook handles all usage tracking and limits
        if (__DEV__) {
          console.log('✅ Using webhook system - server handles all video usage tracking and limits');
        }
      } catch (error) {
        // If we failed before video generation, make sure to reset processing state
        setIsProcessing(false);
        throw error;
      }


      try {
        // Import the new webhook-based video generation service
        const { generateVideoWithPolling } = await import('../services/videoGenerationV2');
        
        // IMMEDIATELY save pending video state for recovery
        const { videoModeTag } = useCropModalStore.getState();
        
        // Generate a temporary prediction ID for immediate storage
        const tempPredictionId = `temp-${Date.now()}`;
        const pendingVideoData = {
          predictionId: tempPredictionId,
          localPath: null, // Will be set when completed
          imageUri: imageUri,
          message: 'Your video is ready! 🎬',
          modeTag: videoModeTag || 'Life',
          timestamp: Date.now(),
          status: 'processing'
        };
        
        try {
          await AsyncStorage.setItem('pending_video_toast', JSON.stringify(pendingVideoData));
          console.log('🔒 Pending video state saved for recovery:', tempPredictionId);
        } catch (storageError) {
          console.error('⚠️ Failed to save pending video state:', storageError);
          // Continue anyway - don't fail generation for storage issues
        }

        // STEP 2: Start webhook-based video generation with polling
        const videoUrl = await generateVideoWithPolling(imageUri, animationPrompt, {
          duration: 5,
          onProgress: (status) => {
            if (__DEV__) {
              console.log(`⏳ Video webhook progress: ${status.status} - ${status.prediction_id}`);
            }
            // Update pending state with real prediction ID once available
            if (status.prediction_id && status.prediction_id !== tempPredictionId) {
              const updatedPendingData = {
                ...pendingVideoData,
                predictionId: status.prediction_id
              };
              AsyncStorage.setItem('pending_video_toast', JSON.stringify(updatedPendingData)).catch(console.error);
            }
          },
          timeoutMs: 180000 // 3 minutes for videos
        });

        // STEP 3: Video generation succeeded - keep the pre-increment

        // Validate video URL before storing
        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error('Invalid video URL received from webhook system');
        }

        try {
          new URL(videoUrl); // Validate URL format
        } catch {
          throw new Error('Malformed video URL received from webhook system');
        }

        // Use timestamp-based ID for consistent tracking
        const videoId = `video-${Date.now()}`;
        const videoData = {
          id: videoId,
          predictionId: tempPredictionId, // Use our temp ID for now
          url: videoUrl,
          originalImage: imageUri,
          prompt: animationPrompt,
          created_at: new Date().toISOString(),
          status: 'completed',
          service: 'webhook-system'
        };

        try {
          await AsyncStorage.setItem(`video_${videoId}`, JSON.stringify(videoData));
          
          // Also store the prediction ID mapping for easier lookup
          await AsyncStorage.setItem(`prediction_${tempPredictionId}`, videoId);
          
          // Verify storage worked
          const stored = await AsyncStorage.getItem(`video_${videoId}`);
          if (!stored) {
            throw new Error('Failed to store video data');
          }

        } catch (error) {
          if (__DEV__) {
            console.error('❌ Failed to store video data:', error);
          }
          throw new Error('Failed to save video data locally');
        }

        return { id: videoId, url: videoUrl, predictionId: tempPredictionId };
      } catch (error) {
        // No client-side rollback needed - webhook system handles server-side rollback
        if (__DEV__) {
          console.log('✅ Server-side webhook will handle usage rollback automatically');
        }
        
        // Re-throw the original error
        throw error;
      }
    },

    onSuccess: async (data) => {
      const { setCompletedRestorationId, setProcessingStatus, setIsProcessing, setIsVideoProcessing, currentImageUri, videoModeTag } = useCropModalStore.getState();
      const { showVideoReady } = useVideoToastStore.getState();
      
      // Set completion state for toast
      setCompletedRestorationId(data.id);
      setProcessingStatus('completed');
      setIsProcessing(false);
      setIsVideoProcessing(false);

      // Also show through videoToastStore for persistence (webhook-system compatible)
      showVideoReady({
        id: data.predictionId, // Use our prediction ID (temp or real)
        localPath: data.url, // Using URL as localPath for webhook system
        imageUri: currentImageUri,
        message: 'Your video is ready! 🎬',
        modeTag: videoModeTag || null,
      });

    },

    onError: (error) => {
      const { setVideoError } = useCropModalStore.getState();
      // If the thrown error wasn't one of our known codes, set a generic message
      if (error instanceof Error) {
        const knownCodes = ['PRO_REQUIRED', 'DAILY_LIMIT_REACHED', 'MONTHLY_LIMIT_REACHED', 'VIDEO_ALREADY_PROCESSING', 'ATOMIC_INCREMENT_FAILED'];
        if (!knownCodes.includes(error.message)) {
          setVideoError('Something went wrong. Tap to try again.');
        }
        // For known codes, the error message was already set atomically above
      } else {
        setVideoError('Something went wrong. Tap to try again.');
      }

      if (__DEV__) {
        console.error(`❌ [${new Date().toISOString()}] Back to Life failed. Processing state cleared. Error:`, error);
      }
    }
  });
}