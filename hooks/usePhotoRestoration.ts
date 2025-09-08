import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analyticsService } from '@/services/analytics';
import { generatePhoto, generatePhotoWithPolling, pollPhotoStatus, type FunctionType } from '@/services/photoGenerationV2';
import { performanceMonitor } from '@/services/performanceMonitor';
import { useInvalidatePhotoUsage } from '@/services/photoUsageService';
import { restorationTrackingService } from '@/services/restorationTracking';
import { getAppUserId } from '@/services/revenuecat';
import { photoStorage } from '@/services/storage';
import { restorationService } from '@/services/supabase';
import { getUnifiedTrackingId } from '@/services/trackingIds';
import { useRestorationStore } from '@/store/restorationStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const { isPro } = useRevenueCat();
  const invalidatePhotoUsage = useInvalidatePhotoUsage();
  
  // Get JobContext functions (we'll use this inside the mutation)
  // Note: We can't use useJob hook directly inside mutation, so we'll pass it via closure

  return useMutation({
    mutationFn: async ({ imageUri, functionType, imageSource, customPrompt }: { imageUri: string; functionType: FunctionType; imageSource?: 'camera' | 'gallery'; customPrompt?: string }) => {
      // Get styleKey from global context for more unique deduplication
      const styleKey = (global as any).__quickEditStyleKey || undefined;
      
      // Check AsyncStorage FIRST (survives app backgrounding)
      const existingPredictionId = await AsyncStorage.getItem('activePredictionId');
      if (existingPredictionId) {
        const existingContext = await AsyncStorage.getItem('predictionContext');
        if (existingContext) {
          try {
            const context = JSON.parse(existingContext);
            
            // Check if same request
            if (context.imageUri === imageUri && 
                context.functionType === functionType &&
                context.styleKey === (styleKey || null) &&
                context.customPrompt === (customPrompt || null)) {
              
              const status = await pollPhotoStatus(existingPredictionId);
              
              if (status.status === 'processing' || status.status === 'starting') {
                if (__DEV__) {
                  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                  console.log(`[${timestamp}] 🔄 DUPLICATE BLOCKED: Using existing prediction from AsyncStorage:`, {
                    prediction_id: existingPredictionId,
                    status: status.status,
                    progress: status.progress
                  });
                }
                
                // Get userId for the existing prediction
                const trackingId = await getUnifiedTrackingId('photo');
                let existingUserId = trackingId;
                if (!existingUserId) {
                  existingUserId = await getAppUserId();
                }
                
                // Poll existing to completion
                const restoredUrl = await generatePhotoWithPolling(imageUri, functionType, {
                  styleKey,
                  customPrompt,
                  userId: existingUserId || 'fallback-anonymous',
                  onProgress: (progress: any, status: any) => {
                    // Update global progress tracker
                    (global as any).__currentJobProgress = progress;
                    if (__DEV__) {
                      console.log(`📊 Existing prediction progress: ${progress}% (${status})`);
                    }
                  },
                  timeoutMs: 120000
                });
                
                return {
                  id: existingPredictionId,
                  originalImageUri: imageUri,
                  restoredImageUri: restoredUrl,
                  status: 'completed' as const,
                  createdAt: new Date(),
                };
              }
              
              if (status.status === 'succeeded' && status.output) {
                if (__DEV__) {
                  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                  console.log(`[${timestamp}] ✅ DUPLICATE BLOCKED: Using completed prediction from AsyncStorage:`, {
                    prediction_id: existingPredictionId,
                    output_length: status.output.length
                  });
                }
                await AsyncStorage.removeItem('activePredictionId');
                await AsyncStorage.removeItem('predictionContext');
                return {
                  id: existingPredictionId,
                  originalImageUri: imageUri,
                  restoredImageUri: status.output,
                  status: 'completed' as const,
                  createdAt: new Date(),
                };
              }
            }
          } catch (error) {
            if (__DEV__) {
              console.error('⚠️ Error checking existing prediction:', error);
            }
          }
        }
      }
      
      // Create simple, consistent deduplication key (NO timestamp!)
      const requestKey = `${imageUri}_${functionType}_${styleKey || 'none'}_${customPrompt || 'none'}`;
      
      // Check if this exact request is already in progress (in-memory deduplication)
      if (activeRequests.has(requestKey)) {
        if (__DEV__) {
          console.log('🔄 DUPLICATE BLOCKED: Returning existing promise for', requestKey);
        }
        return activeRequests.get(requestKey)!;
      }
      
      if (__DEV__) {
        console.log('🚀 NEW REQUEST: Creating new promise for', requestKey);
        console.log('📊 Active requests before:', activeRequests.size);
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
        // Clear any existing prediction state before starting new generation
        await AsyncStorage.removeItem('activePredictionId');
        await AsyncStorage.removeItem('predictionContext');
        
        if (__DEV__) {
          console.log('🧹 [RECOVERY] Cleared any existing prediction state before new generation');
        }
        
        // Save original photo locally
        const originalFilename = await performanceMonitor.measureAsync(
          'save_original_photo',
          () => photoStorage.saveOriginal(imageUri)
        );

        // Get unified tracking ID (transaction ID for Pro, anonymous ID for free)
        const trackingId = await getUnifiedTrackingId('photo');
        
        // Fallback to RevenueCat anonymous ID if unified tracking fails
        let userId = trackingId;
        if (!userId) {
          if (__DEV__) {
            console.log('⚠️ Unified tracking ID failed, falling back to RevenueCat anonymous ID');
          }
          userId = await getAppUserId();
        }
        
        if (__DEV__) {
          console.log('🔑 Photo restoration using tracking ID:', {
            trackingId: userId,
            source: trackingId ? 'unified' : 'fallback',
            isPro: userId?.startsWith('store:') || userId?.startsWith('orig:') || userId?.startsWith('fallback:')
          });
        }
        
        // Start generation FIRST to get prediction ID
        const startResponse = await performanceMonitor.measureAsync(
          'generate_photo_start',
          () => generatePhoto(imageUri, functionType, {
            styleKey,
            customPrompt,
            userId: userId || 'fallback-anonymous'
          })
        );
        
        const predictionId = startResponse.prediction_id;
        
        // NOW create restoration record using prediction ID
        const restoration = await restorationService.create({
          prediction_id: predictionId,
          user_id: userId || 'fallback-anonymous',
          original_filename: originalFilename,
          status: 'processing',
          function_type: (functionType as any),
          custom_prompt: customPrompt, // Store custom prompt for Photo Magic detection
        });

        // Track restoration start in Supabase (metadata only)
        const trackingType = (['restoration','repair','unblur','colorize','descratch'] as const).includes(functionType as any)
          ? (functionType as 'restoration'|'repair'|'unblur'|'colorize'|'descratch')
          : 'restoration';
        supabaseRestorationId = await restorationTrackingService.trackRestorationStarted(
          originalFilename,
          trackingType
        );

        // Store the prediction ID for recovery
        await AsyncStorage.setItem('activePredictionId', predictionId);
        await AsyncStorage.setItem('predictionContext', JSON.stringify({
          imageUri,
          functionType,
          styleKey: styleKey || null,
          customPrompt: customPrompt || null,
          timestamp: Date.now()
        }));
        
        if (__DEV__) {
          console.log('✅ Generation started, prediction ID:', predictionId);
          console.log('💾 [RECOVERY] Stored prediction ID and context for recovery');
        }
        
        // PROMPT LOGGING: Detailed client-side generation tracking
        if (__DEV__) {
          console.log('🎯 HOOK GENERATION DETAILS:', {
            functionType,
            styleKey,
            customPrompt,
            userId: userId || 'fallback-anonymous',
            hasCustomPrompt: !!customPrompt,
            hasStyleKey: !!styleKey,
            predictionId
          });
        }
        
        // Now poll for completion using the prediction ID
        const apiStartTime = Date.now();
        const restoredUrl = await new Promise<string>((resolve, reject) => {
          const poll = async () => {
            try {
              const statusResponse = await pollPhotoStatus(predictionId);
              
              // Update global progress tracker
              (global as any).__currentJobProgress = statusResponse.progress;
              
              if (__DEV__) {
                console.log(`📊 Webhook progress: ${statusResponse.progress}% (${statusResponse.status})`);
              }
              
              if (statusResponse.is_complete) {
                if (statusResponse.is_successful && statusResponse.output) {
                  // Clear storage on completion
                  await AsyncStorage.removeItem('activePredictionId');
                  await AsyncStorage.removeItem('predictionContext');
                  resolve(statusResponse.output);
                } else {
                  const error = statusResponse.error || 'Generation failed without error message';
                  reject(new Error(error));
                }
                return;
              }
              
              // Continue polling
              setTimeout(poll, 2000);
            } catch (error) {
              if (error instanceof Error && error.message?.includes('Network request failed')) {
                if (__DEV__) {
                  console.log('📱 Network interrupted during polling (likely backgrounded) - prediction still stored for recovery');
                }
                return; // Don't reject, let recovery handle it
              }
              reject(error);
            }
          };
          
          // Start polling after initial delay
          setTimeout(poll, 2500);
        });
        
        const apiEndTime = Date.now();
        if (__DEV__) {
          console.log(`🎉 [TIMING] API completed in ${apiEndTime - apiStartTime}ms, URL:`, restoredUrl);
        }

        // Phase 1: Return URL immediately for instant display
        const intermediateUpdate = {
          replicate_url: restoredUrl,
          video_replicate_url: undefined,
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
        
        // Track tile success if tile metadata is available
        const tileCategory = (global as any).__tileCategory;
        const tileName = (global as any).__tileName;  
        const tileId = (global as any).__tileId;
        
        if (tileCategory && tileName && tileId) {
          analyticsService.trackTileUsage({
            category: tileCategory,
            tileName: tileName,
            tileId: tileId,
            functionType: functionType,
            styleKey: (global as any).__quickEditStyleKey || undefined,
            stage: 'completed',
            success: true,
            processingTime: immediateTime
          });
          
          // Clean up global tile metadata
          (global as any).__tileCategory = undefined;
          (global as any).__tileName = undefined;
          (global as any).__tileId = undefined;
        }

        // Phase 2: Start background processing for local files (non-blocking)
        // This happens after the immediate return, so UI shows result instantly
        InteractionManager.runAfterInteractions(async () => {
          try {
            const backgroundStartTime = Date.now();
            if (__DEV__) {
              console.log('🔄 [BACKGROUND] Starting local file processing...');
            }
            
            let restoredFilename: string;
            let restoredUri: string;
            
            if (false) {
            } else {
              // Save as photo with original extension
              restoredFilename = await performanceMonitor.measureAsync(
                'save_restored_photo',
                () => photoStorage.saveRestored(restoredUrl, originalFilename)
              );
              restoredUri = photoStorage.getPhotoUri('restored', restoredFilename);
            }

            // Create thumbnails (skip for video generations)
            let thumbnailFilename: string | undefined;
            
            if (true) {
              // Only create thumbnails for image restorations
              thumbnailFilename = await performanceMonitor.measureAsync(
                'create_thumbnail',
                () => photoStorage.createThumbnail(restoredUri, 'restored')
              );
            } else {
            }

            // Final update with local files ready
            await restorationService.update(restoration.id, {
              restored_filename: restoredFilename,
              thumbnail_filename: thumbnailFilename,
              video_filename: undefined,
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
          
          // Special handling for backgrounding network interruptions
          if (error.message.includes('Network request failed')) {
            if (__DEV__) {
              const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
              console.log(`[${timestamp}] 📱 Network interruption during restoration (likely backgrounded) - prediction still stored for recovery`);
            }
            
            // Don't track as error if it's likely just backgrounding
            // The prediction is still stored and recovery will handle it
            // Throw the error so it can be handled by the mutation's onError
            throw new Error('Background network interruption - prediction preserved for recovery');
          }
          
          if (error.message.includes('network') || 
              error.message.includes('fetch') || 
              error.message.includes('internet connection') ||
              error.message.includes('connection lost') ||
              error.message.includes('timed out') ||
              error.message.includes('timeout')) {
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
        
        // Track tile failure if tile metadata is available
        const tileCategory = (global as any).__tileCategory;
        const tileName = (global as any).__tileName;  
        const tileId = (global as any).__tileId;
        
        if (tileCategory && tileName && tileId) {
          analyticsService.trackTileUsage({
            category: tileCategory,
            tileName: tileName,
            tileId: tileId,
            functionType: functionType,
            styleKey: (global as any).__quickEditStyleKey || undefined,
            stage: 'failed',
            success: false,
            processingTime: Date.now() - startTime
          });
          
          // Clean up global tile metadata
          (global as any).__tileCategory = undefined;
          (global as any).__tileName = undefined;
          (global as any).__tileId = undefined;
        }
        
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
      // Handle backgrounding network interruptions gracefully
      if (error instanceof Error && error.message?.includes('Background network interruption')) {
        if (__DEV__) {
          console.log('📱 Photo restoration interrupted by backgrounding - will resume via recovery');
        }
        // Don't invalidate usage cache or show error - the prediction is still valid
        return;
      }
      
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