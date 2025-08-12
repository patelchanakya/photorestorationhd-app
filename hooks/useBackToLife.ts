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
        if (__DEV__) {
          console.log(`🚫 [${new Date().toISOString()}] Duplicate video generation blocked - video already processing`);
        }
        setErrorMessage('Video is already processing. Please wait for it to complete.');
        // Small delay to let UI update before throwing
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('VIDEO_ALREADY_PROCESSING');
      }
      
      // Immediately set both processing states to block subsequent calls
      setIsProcessing(true);
      setIsVideoProcessing(true);
      
      if (__DEV__) {
        console.log(`🔒 [${new Date().toISOString()}] Processing state locked - preventing duplicate video generation`);
      }
      
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

      if (__DEV__) {
        console.log('🔒 Usage pre-incremented successfully - proceeding with generation');
        console.log('🎬 Starting Back to Life video generation');
        console.log('📸 Image:', imageUri.substring(0, 50) + '...');
        console.log('🎭 Prompt:', animationPrompt);
      }

      try {
        // STEP 2: Generate video with Kling API (1-2 minutes)
        const videoUrl = await generateVideo(imageUri, animationPrompt, {
          mode: 'standard',
          duration: 5,
          negativePrompt: 'blurry, distorted, low quality, static, frozen'
        });

        // STEP 3: Video generation succeeded - keep the pre-increment
        if (__DEV__) {
          console.log('✅ Video generation successful - usage increment kept');
        }

        // Validate video URL before storing
        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error('Invalid video URL received from API');
        }

        try {
          new URL(videoUrl); // Validate URL format
        } catch {
          throw new Error('Malformed video URL received from API');
        }

        // Create video ID and store in AsyncStorage
        const videoId = `video-${Date.now()}`;
        const videoData = {
          id: videoId,
          url: videoUrl,
          originalImage: imageUri,
          prompt: animationPrompt,
          created_at: new Date().toISOString(),
          status: 'completed',
          service: 'kling-v2.1'
        };

        try {
          await AsyncStorage.setItem(`video_${videoId}`, JSON.stringify(videoData));
          
          // Verify storage worked
          const stored = await AsyncStorage.getItem(`video_${videoId}`);
          if (!stored) {
            throw new Error('Failed to store video data');
          }

          if (__DEV__) {
            console.log('✅ Back to Life video completed and stored:', videoId);
            console.log('📦 Stored data size:', stored.length, 'characters');
          }
        } catch (error) {
          if (__DEV__) {
            console.error('❌ Failed to store video data:', error);
          }
          throw new Error('Failed to save video data locally');
        }

        return { id: videoId, url: videoUrl };
      } catch (error) {
        // STEP 4: Video generation failed - rollback the pre-increment
        if (__DEV__) {
          console.log('❌ Video generation failed - rolling back usage increment');
        }
        
        const rollbackSuccess = await backToLifeService.rollbackUsage();
        if (__DEV__) {
          console.log(rollbackSuccess ? '✅ Usage rollback successful' : '⚠️ Usage rollback failed');
        }
        
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
      await showVideoReady({
        id: data.id.replace('video-', ''), // Remove prefix for consistency
        localPath: data.url, // Using URL as localPath for now
        imageUri: currentImageUri,
        message: 'Your video is ready! 🎬',
        modeTag: videoModeTag || null,
      });

      if (__DEV__) {
        console.log(`🎬 [${new Date().toISOString()}] Back to Life success! Processing state cleared. Video toast shown via videoToastStore.`);
      }
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