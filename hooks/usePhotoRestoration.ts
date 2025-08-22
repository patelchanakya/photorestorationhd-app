import { analyticsService } from '@/services/analytics';
import { type FunctionType, getModelConfig } from '@/services/modelConfigs';
import { useInvalidatePhotoUsage } from '@/services/photoUsageService';
import { generatePhotoWithPolling } from '@/services/photoGenerationV2';
import { restorationTrackingService } from '@/services/restorationTracking';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InteractionManager } from 'react-native';

// Request deduplication map to prevent duplicate API calls
const activeRequests = new Map<string, Promise<RestorationResult>>();

export interface RestorationResult {
  id: string;
  originalImageUri: string;
  restoredImageUri: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

// All function types now use the webhook-based v2 system

// Query key factory
export const photoRestorationKeys = {
  all: ['photo-restoration'] as const,
  restoration: (id: string) => [...photoRestorationKeys.all, 'restoration', id] as const,
  history: () => [...photoRestorationKeys.all, 'history'] as const,
};

// Hook to start photo restoration
export function usePhotoRestoration() {
  const queryClient = useQueryClient();
  const incrementRestorationCount = useRestorationStore((state) => state.incrementRestorationCount);
  const incrementTotalRestorations = useRestorationStore((state) => state.incrementTotalRestorations);
  const { isPro } = useSubscriptionStore();
  const invalidatePhotoUsage = useInvalidatePhotoUsage();
  
  // Get JobContext functions (we'll use this inside the mutation)
  // Note: We can't use useJob hook directly inside mutation, so we'll pass it via closure

  return useMutation({
    mutationFn: async ({ imageUri, functionType, imageSource, customPrompt }: { imageUri: string; functionType: FunctionType; imageSource?: 'camera' | 'gallery'; customPrompt?: string }) => {
      // Create deduplication key based on image URI and function type
      const requestKey = `${imageUri}_${functionType}_${customPrompt || ''}`;
      
      // Check if this request is already in progress
      if (activeRequests.has(requestKey)) {
        if (__DEV__) {
          console.log('🔄 Request deduplication: Returning existing promise for', requestKey);
        }
        return activeRequests.get(requestKey)!;
      }
      
      // Create promise for the actual processing
      const processingPromise = (async (): Promise<RestorationResult> => {
        const startTime = Date.now();
        let supabaseRestorationId: string | null = null;
        let progressInterval: ReturnType<typeof setInterval> | null = null;
        
        if (__DEV__) {
          console.log(`🚀 [TIMING] Starting ${functionType} restoration at:`, new Date().toISOString());
        }

      // Track restoration started
      analyticsService.trackRestorationStarted(imageSource || 'gallery');
      
      // Server-side webhook handles all usage limits and paywall presentation
      
      // All function types now use the webhook system with server-side usage tracking
      if (__DEV__) {
        console.log('✅ Using webhook system - server handles all usage tracking and limits');
      }
      
      try {
        // Save original photo locally
        const originalFilename = await photoStorage.saveOriginal(imageUri);

        // Get proper user ID from RevenueCat (not anonymous)
        const { getAppUserId } = await import('@/services/revenuecat');
        const revenueCatUserId = await getAppUserId();
        
        // Create restoration record in local database (AsyncStorage)
        const restoration = await restorationService.create({
          user_id: revenueCatUserId || 'fallback-anonymous',
          original_filename: originalFilename,
          status: 'processing',
          function_type: (functionType as any),
        });

        // Track restoration start in Supabase (metadata only)
        const trackingType = (['restoration','repair','unblur','colorize','descratch'] as const).includes(functionType as any)
          ? (functionType as 'restoration'|'repair'|'unblur'|'colorize'|'descratch')
          : 'restoration';
        supabaseRestorationId = await restorationTrackingService.trackRestorationStarted(
          originalFilename,
          trackingType
        );

        // Call Replicate API with timeout (max 3 minutes)
        const apiStartTime = Date.now();
        if (__DEV__) {
          console.log(`📡 [TIMING] Starting API call at: +${apiStartTime - startTime}ms`);
        }
        
        // Use webhook-based system with built-in polling and progress tracking
        if (__DEV__) {
          console.log('🚀 Using webhook system for generation');
        }

        // Get styleKey from QuickEditStore if available (passed via global context)
        const styleKey = (global as any).__quickEditStyleKey || undefined;
        
        const restoredUrl = await generatePhotoWithPolling(imageUri, functionType, {
          styleKey,
          customPrompt,
          userId: revenueCatUserId || 'fallback-anonymous',
          onProgress: (progress, status) => {
            // Update global progress tracker for JobContext compatibility
            (global as any).__currentJobProgress = progress;
            
            if (__DEV__) {
              console.log(`📊 Webhook progress: ${progress}% (${status})`);
            }
          },
          timeoutMs: 120000 // 2 minutes timeout for webhook system
        });
        const apiEndTime = Date.now();
        if (__DEV__) {
          console.log(`🎉 [TIMING] API completed in ${apiEndTime - apiStartTime}ms, URL:`, restoredUrl);
        }

        // Check if this is a video result (Back to Life returns MP4 videos)
        const modelConfig = getModelConfig(functionType);
        const USE_BTL_TEST_IMAGE_MODEL = process.env.EXPO_PUBLIC_BTL_TEST_IMAGE_MODEL === '1';
        // Treat Back to Life as image when test-image flag is on
        const isVideoResult = (modelConfig.isVideo && !USE_BTL_TEST_IMAGE_MODEL) || restoredUrl.includes('.mp4');
        
        // Phase 1: Return URL immediately for instant display
        const intermediateUpdate = {
          replicate_url: isVideoResult ? undefined : restoredUrl,
          video_replicate_url: isVideoResult ? restoredUrl : undefined,
          local_files_ready: false,
          status: 'completed' as const,
          processing_time_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        };
        
        // Update restoration with Replicate URL for immediate display
        await restorationService.update(restoration.id, intermediateUpdate);
        
        // Update restoration tracking in Supabase (metadata only)
        await restorationTrackingService.trackRestorationCompleted(
          supabaseRestorationId,
          true,
          Date.now() - startTime
        );

        // Return immediate result with Replicate URL
        const immediateResult: RestorationResult = {
          id: restoration.id,
          originalImageUri: imageUri,
          restoredImageUri: restoredUrl, // Direct Replicate URL for instant display
          status: 'completed',
          createdAt: new Date(),
        };

        // Track successful restoration (immediate response)
        const immediateTime = Date.now() - startTime;
        if (__DEV__) {
          console.log(`⚡ [TIMING] Immediate response in ${immediateTime}ms (${(immediateTime/1000).toFixed(1)}s) - starting background processing`);
          console.log(`📊 [TIMING] API=${apiEndTime - apiStartTime}ms, Response=${immediateTime}ms`);
        }
        
        await analyticsService.trackRestorationCompleted(
          true, 
          imageSource || 'gallery', 
          immediateTime,
          (['restoration','repair','unblur','colorize','descratch'] as const).includes(functionType as any)
            ? (functionType as 'restoration'|'repair'|'unblur'|'colorize'|'descratch')
            : 'restoration'
        );

        // Phase 2: Start background processing for local files (non-blocking)
        // This happens after the immediate return, so UI shows result instantly
        InteractionManager.runAfterInteractions(async () => {
          try {
            if (__DEV__) {
              console.log('🔄 [BACKGROUND] Starting local file processing...');
            }
            
            let restoredFilename: string;
            let restoredUri: string;
            
            if (isVideoResult) {
              // Save as video with .mp4 extension
              restoredFilename = await photoStorage.saveVideo(restoredUrl, originalFilename);
              restoredUri = photoStorage.getPhotoUri('video', restoredFilename);
              if (__DEV__) {
                console.log('🎬 [BACKGROUND] Video saved:', restoredFilename, restoredUri);
              }
            } else {
              // Save as photo with original extension
              restoredFilename = await photoStorage.saveRestored(restoredUrl, originalFilename);
              restoredUri = photoStorage.getPhotoUri('restored', restoredFilename);
              if (__DEV__) {
                console.log('💾 [BACKGROUND] Photo saved:', restoredFilename, restoredUri);
              }
            }

            // Create thumbnails (skip for video generations)
            let thumbnailFilename: string | undefined;
            
            if (!isVideoResult) {
              // Only create thumbnails for image restorations
              thumbnailFilename = await photoStorage.createThumbnail(
                restoredUri,
                'restored'
              );
              if (__DEV__) {
                console.log('🖼️ [BACKGROUND] Thumbnail created:', thumbnailFilename);
              }
            } else {
              if (__DEV__) {
                console.log('🎬 [BACKGROUND] Skipping thumbnail creation for video result');
              }
            }

            // Final update with local files ready
            await restorationService.update(restoration.id, {
              restored_filename: restoredFilename,
              thumbnail_filename: thumbnailFilename,
              video_filename: isVideoResult ? restoredFilename : undefined,
              local_files_ready: true,
            });
            
            const backgroundTime = Date.now() - startTime;
            if (__DEV__) {
              console.log(`✅ [BACKGROUND] Local files ready in ${backgroundTime}ms (${(backgroundTime/1000).toFixed(1)}s total)`);
            }
            
            // Invalidate queries to refresh UI with local files
            queryClient.invalidateQueries({ queryKey: photoRestorationKeys.restoration(restoration.id) });
            queryClient.invalidateQueries({ queryKey: photoRestorationKeys.history() });
            
          } catch (backgroundError) {
            if (__DEV__) {
              console.error('❌ [BACKGROUND] Local file processing failed:', backgroundError);
            }
            // Don't throw - the user already has the working Replicate URL
            // Just log the error and continue with URL-only mode
          }
        });
        
        // Clear progress interval on success
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        
        // For video results, store the result ID for navigation
        if (isVideoResult) {
          // Videos are saved with a different naming pattern
          // Store the video filename for later retrieval
          (immediateResult as any).videoFilename = `${originalFilename}_restored.mp4`;
        }

        return immediateResult;
      } catch (error) {
        // Clear progress interval on error
        if (progressInterval) {
          clearInterval(progressInterval);
        }
        if (__DEV__) {
          console.error('Photo restoration failed:', error);
        }
        
        // Determine error type for analytics
        let errorType: 'api_error' | 'network_error' | 'processing_error' | 'validation_error' = 'processing_error';
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          errorMessage = error.message;
          if (error.message.includes('network') || 
              error.message.includes('fetch') || 
              error.message.includes('internet connection') ||
              error.message.includes('connection lost') ||
              error.message.includes('timed out') ||
              error.message.includes('timeout') ||
              error.message.includes('Network request failed')) {
            errorType = 'network_error';
          } else if (error.message.includes('API') || error.message.includes('replicate')) {
            errorType = 'api_error';
          } else if (error.message.includes('validation') || error.message.includes('invalid')) {
            errorType = 'validation_error';
          }
        }
        
        // Track restoration error
        analyticsService.trackRestorationError(
          errorType,
          errorMessage,
          imageSource || 'gallery',
          (['restoration','repair','unblur','colorize','descratch'] as const).includes(functionType as any)
            ? (functionType as 'restoration'|'repair'|'unblur'|'colorize'|'descratch')
            : 'restoration'
        );
        
        // Track failed restoration in Supabase (metadata only)
        await restorationTrackingService.trackRestorationCompleted(
          supabaseRestorationId,
          false,
          Date.now() - startTime,
          errorMessage
        );

        // Track failed restoration
        await analyticsService.trackRestorationCompleted(
          false, 
          imageSource || 'gallery', 
          Date.now() - startTime,
          (['restoration','repair','unblur','colorize','descratch'] as const).includes(functionType as any)
            ? (functionType as 'restoration'|'repair'|'unblur'|'colorize'|'descratch')
            : 'restoration'
        );
        
        // No client-side rollback needed - webhook functions handle server-side rollback
        if (__DEV__) {
          console.log('✅ Server-side webhook will handle usage rollback automatically');
        }
        
        throw error;
      }
      })(); // End of processingPromise
      
      // Store the promise in the deduplication map
      activeRequests.set(requestKey, processingPromise);
      
      try {
        const result = await processingPromise;
        return result;
      } finally {
        // Clean up the request from the deduplication map
        activeRequests.delete(requestKey);
        if (__DEV__) {
          console.log('🧹 Cleaned up request from deduplication map:', requestKey);
        }
      }
    },
    onSuccess: (data, variables) => {
      // Update individual restoration query
      queryClient.setQueryData(photoRestorationKeys.restoration(data.id), data);
      
      // Invalidate history to refresh the list
      queryClient.invalidateQueries({ queryKey: photoRestorationKeys.history() });
      
      // CRITICAL: Invalidate photo usage cache to update the usage banner
      invalidatePhotoUsage();
      
      // Increment restoration count in Zustand
      incrementRestorationCount();
      // Also increment total restorations for rating prompt
      incrementTotalRestorations();
      
      if (__DEV__) {
        console.log('✅ Photo restoration success - invalidated photo usage cache');
      }
    },
    onError: (error, variables) => {
      if (__DEV__) {
        console.error('Photo restoration failed:', error);
      }
      
      // Invalidate photo usage cache after rollback to ensure accurate count
      invalidatePhotoUsage();
      
      if (__DEV__) {
        console.log('🔄 Photo restoration error - invalidated photo usage cache after rollback');
      }
    },
  });
}

// Hook to get restoration status
export function useRestorationStatus(id: string) {
  return useQuery({
    queryKey: photoRestorationKeys.restoration(id),
    queryFn: () => {
      // In a real implementation, this might fetch from local storage
      // For now, we'll rely on the cache set by the mutation
      return null;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}