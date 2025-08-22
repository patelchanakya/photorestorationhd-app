import { useCallback, useEffect } from 'react';
import { AppState, InteractionManager } from 'react-native';
import { useVideoGenerationStore } from '../store/videoGenerationStore';
import { checkReplicateDirectStatus, shouldUseDirectReplicateFallback, clearReplicateCache } from '../services/replicateDirectCheck';

export function useVideoRecovery() {
  const { 
    pendingGeneration, 
    isGenerating,
    isRecovering,
    resumeGeneration,
    completeGeneration,
    failGeneration,
    clearGeneration,
    clearExpiredUnviewedVideo,
    startRecovery,
    updateRecoveryAttempt,
    markRecoverySuccess,
    shouldAttemptRecovery,
    setAppForegroundTime,
    shouldDelayFirstRecovery,
    updateAllowNewGeneration,
    shouldTreatAsProcessing
  } = useVideoGenerationStore();

  const checkAndRecover = useCallback(async () => {
    // First, clear any expired unviewed videos
    clearExpiredUnviewedVideo();
    
    // Don't recover if already generating or recovering
    if (isGenerating || isRecovering) {
      return;
    }
    
    // If no pending generation, still check for any unviewed completed videos
    // This handles edge cases where pendingGeneration expired but video is still cached
    if (!pendingGeneration) {
      await checkForUnviewedCompletedVideos();
      return;
    }
    
    // Check if we should attempt recovery based on backoff logic
    if (!shouldAttemptRecovery()) {
      return;
    }
    
    // Check if this is a recent generation that should be treated as normal processing
    const treatAsProcessing = shouldTreatAsProcessing();
    
    // For recent generations (< 3 minutes, < 3 attempts), skip the delay and treat as normal processing
    if (!treatAsProcessing && shouldDelayFirstRecovery()) {
      const timeSinceForeground = Date.now() - (useVideoGenerationStore.getState().appForegroundTime || 0);
      const waitTime = 2000 - timeSinceForeground;
      
      if (__DEV__) {
        console.log(`⏳ Delaying first recovery by ${waitTime}ms to let iOS reconnect`);
      }
      
      // Schedule the recovery attempt after the delay
      setTimeout(() => {
        // Re-check conditions after delay
        if (shouldAttemptRecovery() && !shouldDelayFirstRecovery()) {
          checkAndRecover();
        }
      }, waitTime);
      return;
    }

    const { predictionId, imageUri, prompt, startedAt, recoveryAttempts = 0 } = pendingGeneration;
    
    // Start recovery tracking
    startRecovery();
    
    if (__DEV__) {
      if (treatAsProcessing) {
        console.log(`🎬 Continuing video processing check for:`, predictionId);
      } else {
        console.log(`🔄 Starting recovery attempt ${recoveryAttempts + 1} for:`, predictionId);
      }
    }

    try {
      // Try our backend first
      let statusResponse;
      let useDirectFallback = false;
      
      try {
        if (__DEV__) {
          console.log('🔄 Checking backend status first...');
        }
        
        const { pollVideoStatus } = await import('../services/videoGenerationV2');
        statusResponse = await pollVideoStatus(predictionId);
        
        markRecoverySuccess();
        
      } catch (backendError: any) {
        const errorMessage = backendError?.message || String(backendError);
        
        if (__DEV__) {
          console.log('❌ Backend check failed:', errorMessage);
        }
        
        // Check if this is a network error that warrants direct Replicate fallback
        useDirectFallback = shouldUseDirectReplicateFallback(errorMessage);
        
        if (useDirectFallback) {
          if (__DEV__) {
            console.log('🔗 Using direct Replicate fallback due to network error');
          }
          
          const directResult = await checkReplicateDirectStatus(predictionId);
          
          if (directResult.success) {
            // Convert direct result to status response format
            statusResponse = {
              success: true,
              prediction_id: predictionId,
              status: directResult.status,
              mode_tag: 'Life',
              video_url: directResult.videoUrl,
              image_uri: imageUri,
              prompt: prompt,
              created_at: startedAt,
              error_message: directResult.error,
              is_complete: ['succeeded', 'failed', 'canceled', 'expired'].includes(directResult.status),
              is_successful: directResult.status === 'succeeded' && !!directResult.videoUrl,
              has_output: !!directResult.videoUrl
            };
            
            if (directResult.isExpired) {
              if (__DEV__) {
                console.log('🗑️ Video expired on Replicate - clearing generation');
              }
              clearGeneration();
              clearReplicateCache(predictionId);
              return;
            }
            
            markRecoverySuccess();
            
          } else {
            // Both backend and direct check failed
            throw new Error(`Recovery failed: Backend error (${errorMessage}) and direct check failed (${directResult.error})`);
          }
        } else {
          // Not a network error, re-throw
          throw backendError;
        }
      }
      
      if (!statusResponse) {
        throw new Error('No status response available');
      }
      
      // Resume the UI state after we have a response
      resumeGeneration({ predictionId, imageUri, prompt });

      if (statusResponse.is_complete) {
        if (statusResponse.is_successful && statusResponse.video_url) {
          console.log('✅ Recovered completed video:', statusResponse.video_url);
          
          const videoData = {
            id: predictionId,
            url: statusResponse.video_url,
            originalImage: imageUri,
            prompt: prompt,
            predictionId
          };
          
          completeGeneration(videoData);
        } else {
          console.log('❌ Recovered video failed on server');
          failGeneration(statusResponse.error_message || 'Video generation failed');
        }
      } else {
        console.log('⏳ Video still processing, resuming polling...');
        
        // Resume polling from where we left off
        
        // Calculate elapsed time to adjust progress
        const elapsedMs = Date.now() - new Date(startedAt).getTime();
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const estimatedTotalSeconds = 120; // 2 minutes estimate
        const initialProgress = Math.min(90, (elapsedSeconds / estimatedTotalSeconds) * 100);
        
        // Update progress based on elapsed time
        useVideoGenerationStore.getState().updateProgress(initialProgress, predictionId);
        
        // Continue polling by simulating the ongoing generation
        // We can't use the original generateVideoWithPolling because it starts a new generation
        // Instead, we'll start a polling loop manually
        startPollingForRecovery(predictionId, Date.now() - new Date(startedAt).getTime(), useDirectFallback);
      }

    } catch (error: any) {
      console.error('❌ Video recovery failed:', error);
      
      updateRecoveryAttempt();
      updateAllowNewGeneration(); // Update ability to start new generation
      
      // Don't immediately fail - let the recovery system retry with backoff
      const errorMessage = error?.message || String(error);
      
      if (__DEV__) {
        console.log(`⚠️ Recovery attempt ${recoveryAttempts + 1} failed, will retry with backoff:`, errorMessage);
      }
      
      // Only fail permanently if we've exceeded max attempts or it's been too long
      if (recoveryAttempts >= 15) {
        if (__DEV__) {
          console.log('🛑 Max recovery attempts reached, failing generation');
        }
        failGeneration('Video recovery failed after multiple attempts. Please try generating a new video.');
        clearReplicateCache(predictionId);
      }
      // Otherwise, let the backoff system handle the next retry
    }
  }, [pendingGeneration, isGenerating, isRecovering, resumeGeneration, completeGeneration, failGeneration, clearGeneration, startRecovery, updateRecoveryAttempt, markRecoverySuccess, shouldAttemptRecovery]);

  // Manual polling for recovery (doesn't start new generation)
  const startPollingForRecovery = useCallback(async (predictionId: string, elapsedMs: number, useDirectFallback = false) => {
    const { updateProgress, completeGeneration, failGeneration } = useVideoGenerationStore.getState();
    const { pollVideoStatus } = await import('../services/videoGenerationV2');
    
    const startTime = Date.now() - elapsedMs; // Adjust for elapsed time
    const timeoutMs = 180000; // 3 minutes total
    
    const poll = async () => {
      try {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > timeoutMs) {
          failGeneration('Video generation timed out');
          return;
        }

        let statusResponse;
        
        if (useDirectFallback) {
          // Use direct Replicate check for subsequent polls
          const directResult = await checkReplicateDirectStatus(predictionId);
          
          if (directResult.success) {
            statusResponse = {
              success: true,
              prediction_id: predictionId,
              status: directResult.status,
              mode_tag: 'Life',
              video_url: directResult.videoUrl,
              image_uri: pendingGeneration?.imageUri || '',
              prompt: pendingGeneration?.prompt || '',
              created_at: pendingGeneration?.startedAt || new Date().toISOString(),
              error_message: directResult.error,
              is_complete: ['succeeded', 'failed', 'canceled', 'expired'].includes(directResult.status),
              is_successful: directResult.status === 'succeeded' && !!directResult.videoUrl,
              has_output: !!directResult.videoUrl
            };
            
            if (directResult.isExpired) {
              console.log('🗑️ Video expired during polling - clearing generation');
              clearGeneration();
              clearReplicateCache(predictionId);
              return;
            }
          } else {
            throw new Error(directResult.error || 'Direct Replicate check failed');
          }
        } else {
          // Use backend as usual
          const { pollVideoStatus } = await import('../services/videoGenerationV2');
          statusResponse = await pollVideoStatus(predictionId);
        }
        
        // Update progress
        const progressMap: Record<string, number> = {
          'starting': 10,
          'processing': 50,
          'succeeded': 90
        };
        updateProgress(progressMap[statusResponse.status] || 0, predictionId);

        if (statusResponse.is_complete) {
          if (statusResponse.is_successful && statusResponse.video_url) {
            const videoData = {
              id: predictionId,
              url: statusResponse.video_url,
              originalImage: pendingGeneration?.imageUri || '',
              prompt: pendingGeneration?.prompt || '',
              predictionId
            };
            completeGeneration(videoData);
          } else {
            failGeneration(statusResponse.error_message || 'Video generation failed');
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
      } catch (error: any) {
        console.error('❌ Recovery polling error:', error);
        
        // If backend polling fails, try direct Replicate as fallback
        if (!useDirectFallback && shouldUseDirectReplicateFallback(error?.message || String(error))) {
          if (__DEV__) {
            console.log('🔗 Switching to direct Replicate polling due to error');
          }
          
          // Restart polling with direct fallback
          setTimeout(() => {
            startPollingForRecovery(predictionId, Date.now() - startTime, true);
          }, 3000);
          return;
        }
        
        failGeneration('Video generation failed');
      }
    };

    // Start polling immediately
    poll();
  }, [pendingGeneration]);

  // Check for completed videos that might have been cached but lost due to expired pendingGeneration
  const checkForUnviewedCompletedVideos = useCallback(async () => {
    try {
      // Get the user's tracking ID to check for recent completed videos
      const { getVideoTrackingId } = await import('../services/trackingIds');
      const userId = await getVideoTrackingId();
      
      if (!userId) {
        return; // Can't check without user ID
      }

      console.log('🔍 Checking for any unviewed completed videos for user:', userId);
      
      // If hasUnviewedVideo is true but no pendingGeneration, 
      // the video data might still be in the store
      const state = useVideoGenerationStore.getState();
      if (state.hasUnviewedVideo && state.lastCompletedVideoId) {
        const video = state.videos[state.lastCompletedVideoId];
        if (video && !state.isVideoExpired(state.lastCompletedVideoId)) {
          console.log('✅ Found cached unviewed video:', state.lastCompletedVideoId);
          // Re-show the success toast and completion modal
          state.showSuccessToast('Your video is ready!');
          state.showCompletionModalAction({
            predictionId: video.predictionId,
            imageUri: video.originalImage,
            videoUrl: video.url,
            message: 'Your video is ready!'
          });
        }
      }
    } catch (error) {
      console.error('❌ Error checking for unviewed completed videos:', error);
    }
  }, []);

  return { checkAndRecover };
}

// Hook to automatically run recovery on mount and app foreground
export function useAutoVideoRecovery() {
  const { checkAndRecover } = useVideoRecovery();

  useEffect(() => {
    // Run recovery check on mount using InteractionManager
    const handle = InteractionManager.runAfterInteractions(() => {
      checkAndRecover();
    });

    return () => {
      if (handle && handle.cancel) {
        handle.cancel();
      }
    };
  }, [checkAndRecover]);

  useEffect(() => {
    // Run recovery when app comes to foreground using InteractionManager
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('📱 App foregrounded - scheduling video recovery check');
        
        // Set foreground time for delayed recovery logic
        useVideoGenerationStore.getState().setAppForegroundTime();
        
        InteractionManager.runAfterInteractions(() => {
          checkAndRecover();
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [checkAndRecover]);

  return { checkAndRecover };
}