import { analyticsService } from '@/services/analytics';
import { restorePhoto } from '@/services/replicate';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { restorationTrackingService } from '@/services/restorationTracking';
import { networkStateService } from '@/services/networkState';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RestorationResult {
  id: string;
  originalImageUri: string;
  restoredImageUri: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
}

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
  const { isPro, decrementFreeRestorations } = useSubscriptionStore();

  return useMutation({
    mutationFn: async ({ imageUri, functionType, imageSource }: { imageUri: string; functionType: 'restoration' | 'unblur' | 'colorize'; imageSource?: 'camera' | 'gallery' }) => {
      const startTime = Date.now();
      let supabaseRestorationId: string | null = null;
      

      // Track restoration started
      analyticsService.trackRestorationStarted(imageSource || 'gallery');
      
      try {
        // Save original photo locally
        const originalFilename = await photoStorage.saveOriginal(imageUri);

        // Create restoration record in local database (AsyncStorage)
        const restoration = await restorationService.create({
          user_id: 'anonymous',
          original_filename: originalFilename,
          status: 'processing',
          function_type: functionType,
        });

        // Track restoration start in Supabase (metadata only)
        supabaseRestorationId = await restorationTrackingService.trackRestorationStarted(
          originalFilename,
          functionType
        );

        // Call Replicate API with timeout (max 3 minutes)
        const restorePromise = restorePhoto(imageUri);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Photo restoration timed out. Please check your internet connection and try again.'));
          }, 180000); // 3 minutes timeout
        });
        
        const restoredUrl = await Promise.race([restorePromise, timeoutPromise]);
        if (__DEV__) {
          console.log('🎉 Photo restored successfully, URL:', restoredUrl);
        }

        // Save restored photo locally
        const restoredFilename = await photoStorage.saveRestored(restoredUrl, originalFilename);
        if (__DEV__) {
          console.log('💾 Restored photo saved locally:', restoredFilename);
        }

        // Get the URI for the restored photo
        const restoredUri = photoStorage.getPhotoUri('restored', restoredFilename);
        if (__DEV__) {
          console.log('📍 Restored photo URI:', restoredUri);
        }

        // Create thumbnails
        const thumbnailFilename = await photoStorage.createThumbnail(
          restoredUri,
          'restored'
        );
        if (__DEV__) {
          console.log('🖼️ Thumbnail created:', thumbnailFilename);
        }

        // Update restoration record in local database
        await restorationService.update(restoration.id, {
          restored_filename: restoredFilename,
          thumbnail_filename: thumbnailFilename,
          status: 'completed',
          processing_time_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        });

        // Update restoration tracking in Supabase (metadata only)
        await restorationTrackingService.trackRestorationCompleted(
          supabaseRestorationId,
          true,
          Date.now() - startTime
        );

        const completedData: RestorationResult = {
          id: restoration.id,
          originalImageUri: imageUri,
          restoredImageUri: restoredUri,
          status: 'completed',
          createdAt: new Date(),
        };

        // Track successful restoration
        await analyticsService.trackRestorationCompleted(
          true, 
          imageSource || 'gallery', 
          Date.now() - startTime,
          functionType
        );

        return completedData;
      } catch (error) {
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
          functionType
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
          functionType
        );
        
        // Refund credit for free users on any error
        if (!isPro) {
          try {
            // Pass current time since the restoration just failed
            await decrementFreeRestorations(new Date().toISOString());
            if (__DEV__) {
              console.log('💳 Credit refunded to free user due to restoration error');
            }
            
            // Track credit refund
            analyticsService.track('Free Credit Refunded', {
              error_type: errorType,
              error_message: errorMessage,
              function_type: functionType,
              image_source: imageSource || 'gallery',
              timestamp: new Date().toISOString(),
            });
          } catch (refundError) {
            if (__DEV__) {
              console.error('Failed to refund credit:', refundError);
            }
          }
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {
      // Update individual restoration query
      queryClient.setQueryData(photoRestorationKeys.restoration(data.id), data);
      
      // Invalidate history to refresh the list
      queryClient.invalidateQueries({ queryKey: photoRestorationKeys.history() });
      // Increment restoration count in Zustand
      incrementRestorationCount();
    },
    onError: (error) => {
      if (__DEV__) {
        console.error('Photo restoration failed:', error);
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