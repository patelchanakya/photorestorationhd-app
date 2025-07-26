import { analyticsService } from '@/services/analytics';
import { restorePhoto } from '@/services/replicate';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { useRestorationStore } from '@/store/restorationStore';
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

  return useMutation({
    mutationFn: async ({ imageUri, functionType, imageSource }: { imageUri: string; functionType: 'restoration' | 'unblur' | 'colorize'; imageSource?: 'camera' | 'gallery' }) => {
      const startTime = Date.now();
      
      // Track restoration started
      analyticsService.trackRestorationStarted(imageSource || 'gallery');
      
      try {
        // Save original photo locally
        const originalFilename = await photoStorage.saveOriginal(imageUri);

        // Create restoration record in database
        const restoration = await restorationService.create({
          user_id: 'anonymous',
          original_filename: originalFilename,
          status: 'processing',
          function_type: functionType,
        });

        // Call Replicate API
        const restoredUrl = await restorePhoto(imageUri);
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

        // Update restoration record
        await restorationService.update(restoration.id, {
          restored_filename: restoredFilename,
          thumbnail_filename: thumbnailFilename,
          status: 'completed',
          processing_time_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        });

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
          if (error.message.includes('network') || error.message.includes('fetch')) {
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
        
        // Track failed restoration
        await analyticsService.trackRestorationCompleted(
          false, 
          imageSource || 'gallery', 
          Date.now() - startTime,
          functionType
        );
        
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