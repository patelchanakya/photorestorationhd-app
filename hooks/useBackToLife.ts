import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation } from '@tanstack/react-query';
import { backToLifeService } from '../services/backToLifeService';
import { generateVideo } from '../services/videoServiceProxy';
import { useCropModalStore } from '../store/cropModalStore';

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
        // STEP 2: Check usage limits BEFORE attempting atomic increment
        const usage = await backToLifeService.checkUsage();
        if (!usage.canUse) {
          if (usage.limit <= 0) {
            setVideoError('Back to Life videos are a Pro feature.');
            // Small delay to let UI update before throwing
            await new Promise(resolve => setTimeout(resolve, 100));
            throw new Error('PRO_REQUIRED');
          }
          if (usage.canUseToday === false) {
            setVideoError('Daily limit reached. Try again tomorrow.');
            // Small delay to let UI update before throwing
            await new Promise(resolve => setTimeout(resolve, 100));
            throw new Error('DAILY_LIMIT_REACHED');
          }
          const nextReset = usage.nextResetDate ? new Date(usage.nextResetDate) : null;
          const resetSuffix = nextReset ? ` on ${nextReset.toLocaleDateString()}` : '';
          setVideoError(`Monthly limit reached (${usage.used}/${usage.limit}). Resets${resetSuffix}.`);
          // Small delay to let UI update before throwing
          await new Promise(resolve => setTimeout(resolve, 100));
          throw new Error('MONTHLY_LIMIT_REACHED');
        }
        
        // STEP 3: Atomically pre-increment usage (protects against multi-device race conditions)
        const canProceed = await backToLifeService.checkAndIncrementUsage();
        if (!canProceed) {
          // This should rarely happen since we checked above, but handles edge cases
          setVideoError('Usage limit reached. Please try again later.');
          // Small delay to let UI update before throwing
          await new Promise(resolve => setTimeout(resolve, 100));
          throw new Error('ATOMIC_INCREMENT_FAILED');
        }
      } catch (error) {
        // If we failed before video generation, make sure to reset processing state
        setIsProcessing(false);
        throw error;
      }


      try {
        // Import the new server-side API service
        const { startVideoGeneration, pollVideoGeneration } = await import('../services/videoApiService');
        
        // STEP 2: Start video generation on server
        const startResponse = await startVideoGeneration(imageUri, animationPrompt, {
          mode: 'standard',
          duration: 5,
          negativePrompt: 'blurry, distorted, low quality, static, frozen'
        });

        // IMMEDIATELY save pending video state for recovery
        const { videoModeTag } = useCropModalStore.getState();
        const pendingVideoData = {
          predictionId: startResponse.predictionId,
          localPath: null, // Will be set when completed
          imageUri: imageUri,
          message: 'Your video is ready! 🎬',
          modeTag: videoModeTag || 'Life',
          timestamp: Date.now(),
          status: 'processing'
        };
        
        try {
          await AsyncStorage.setItem('pending_video_toast', JSON.stringify(pendingVideoData));
          console.log('🔒 Pending video state saved for recovery:', startResponse.predictionId);
        } catch (storageError) {
          console.error('⚠️ Failed to save pending video state:', storageError);
          // Continue anyway - don't fail generation for storage issues
        }


        // STEP 3: Poll for completion with the real prediction ID
        const videoUrl = await pollVideoGeneration(startResponse.predictionId, (status) => {
        });

        // STEP 4: Video generation succeeded - keep the pre-increment

        // Validate video URL before storing
        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error('Invalid video URL received from server');
        }

        try {
          new URL(videoUrl); // Validate URL format
        } catch {
          throw new Error('Malformed video URL received from server');
        }

        // Use the real prediction ID for consistent tracking
        const videoId = `video-${startResponse.predictionId}`;
        const videoData = {
          id: videoId,
          predictionId: startResponse.predictionId, // Store the real prediction ID
          url: videoUrl,
          originalImage: imageUri,
          prompt: animationPrompt,
          created_at: new Date().toISOString(),
          status: 'completed',
          service: 'secure-server-api'
        };

        try {
          await AsyncStorage.setItem(`video_${videoId}`, JSON.stringify(videoData));
          
          // Also store the prediction ID mapping for easier lookup
          await AsyncStorage.setItem(`prediction_${startResponse.predictionId}`, videoId);
          
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

        return { id: videoId, url: videoUrl, predictionId: startResponse.predictionId };
      } catch (error) {
        // STEP 4: Video generation failed - rollback the pre-increment
        
        const rollbackSuccess = await backToLifeService.rollbackUsage();
        
        // Re-throw the original error
        throw error;
      }
    },

    onSuccess: async (data) => {
      const { setCompletedRestorationId, setProcessingStatus, setIsProcessing, setIsVideoProcessing, currentImageUri, videoModeTag } = useCropModalStore.getState();
      const { showVideoReady } = await import('@/store/videoToastStore').then(m => m.useVideoToastStore.getState());
      
      // Set completion state for toast
      setCompletedRestorationId(data.id);
      setProcessingStatus('completed');
      setIsProcessing(false);
      setIsVideoProcessing(false);

      // Also show through videoToastStore for persistence
      showVideoReady({
        id: data.predictionId, // Use the real prediction ID
        localPath: data.url, // Using URL as localPath for now
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