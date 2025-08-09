import { useMutation } from '@tanstack/react-query';
import { generateVideo } from '../services/videoServiceProxy';
import { backToLifeService } from '../services/backToLifeService';
import { useCropModalStore } from '../store/cropModalStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackToLifeParams {
  imageUri: string;
  animationPrompt?: string;
  imageSource?: 'camera' | 'gallery';
}

export function useBackToLife() {
  return useMutation({
    mutationFn: async ({ imageUri, animationPrompt = 'bring this photo to life with natural animation' }: BackToLifeParams) => {
      // Check usage limits first
      const usage = await backToLifeService.checkUsage();
      if (!usage.canUse) {
        throw new Error('Video generation limit reached. Please try again tomorrow or upgrade your plan.');
      }

      if (__DEV__) {
        console.log('🎬 Starting Back to Life video generation');
        console.log('📸 Image:', imageUri.substring(0, 50) + '...');
        console.log('🎭 Prompt:', animationPrompt);
      }

      // Generate video with Kling API
      const videoUrl = await generateVideo(imageUri, animationPrompt, {
        mode: 'standard',
        duration: 5,
        negativePrompt: 'blurry, distorted, low quality, static, frozen'
      });

      // Increment usage after successful generation
      const usageIncremented = await backToLifeService.incrementUsage();
      if (!usageIncremented) {
        console.warn('⚠️ Failed to increment Back to Life usage counter');
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
    },

    onSuccess: (data) => {
      const { setCompletedRestorationId, setProcessingStatus, setIsProcessing } = useCropModalStore.getState();
      
      // Set completion state for toast
      setCompletedRestorationId(data.id);
      setProcessingStatus('completed');
      setIsProcessing(false);

      if (__DEV__) {
        console.log('🎬 Back to Life success! Toast will show completion.');
      }
    },

    onError: (error) => {
      const { setProcessingStatus, setIsProcessing } = useCropModalStore.getState();
      setProcessingStatus('error');
      setIsProcessing(false);

      if (__DEV__) {
        console.error('❌ Back to Life failed:', error);
      }
    }
  });
}