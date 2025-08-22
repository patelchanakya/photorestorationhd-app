import { useCallback, useEffect } from 'react';
import { AppState, InteractionManager } from 'react-native';
import { useVideoGenerationStore } from '../store/videoGenerationStore';

export function useVideoRecovery() {
  const { 
    pendingGeneration, 
    isGenerating,
    resumeGeneration,
    completeGeneration,
    failGeneration,
    clearGeneration,
    clearExpiredUnviewedVideo 
  } = useVideoGenerationStore();

  const checkAndRecover = useCallback(async () => {
    // First, clear any expired unviewed videos
    clearExpiredUnviewedVideo();
    
    // Don't recover if already generating
    if (isGenerating) {
      return;
    }
    
    // If no pending generation, still check for any unviewed completed videos
    // This handles edge cases where pendingGeneration expired but video is still cached
    if (!pendingGeneration) {
      await checkForUnviewedCompletedVideos();
      return;
    }

    const { predictionId, imageUri, prompt, startedAt } = pendingGeneration;
    
    // Check if the pending generation is too old (3 hours)
    // Extended timeout since videos are cached in Supabase Storage and remain accessible
    const now = new Date();
    const started = new Date(startedAt);
    const elapsedMs = now.getTime() - started.getTime();
    const timeoutMs = 3 * 60 * 60 * 1000; // 3 hours

    if (elapsedMs > timeoutMs) {
      console.log('🧹 Clearing expired pending generation (>3 hours old):', predictionId);
      clearGeneration();
      return;
    }

    // All prediction IDs are now real server IDs from the start
    // No need to check for local IDs anymore

    console.log('🔄 Attempting to recover pending video generation:', predictionId);

    try {
      // Resume the UI state
      resumeGeneration({ predictionId, imageUri, prompt });

      // Check the current status on the server
      const { pollVideoStatus } = await import('../services/videoGenerationV2');
      const statusResponse = await pollVideoStatus(predictionId);

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
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        const estimatedTotalSeconds = 120; // 2 minutes estimate
        const initialProgress = Math.min(90, (elapsedSeconds / estimatedTotalSeconds) * 100);
        
        // Update progress based on elapsed time
        useVideoGenerationStore.getState().updateProgress(initialProgress, predictionId);
        
        // Continue polling by simulating the ongoing generation
        // We can't use the original generateVideoWithPolling because it starts a new generation
        // Instead, we'll start a polling loop manually
        startPollingForRecovery(predictionId, elapsedMs);
      }

    } catch (error) {
      console.error('❌ Video recovery failed:', error);
      failGeneration('Failed to recover video generation. Please try again.');
    }
  }, [pendingGeneration, isGenerating, resumeGeneration, completeGeneration, failGeneration, clearGeneration]);

  // Manual polling for recovery (doesn't start new generation)
  const startPollingForRecovery = useCallback(async (predictionId: string, elapsedMs: number) => {
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

        const statusResponse = await pollVideoStatus(predictionId);
        
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
      } catch (error) {
        console.error('❌ Recovery polling error:', error);
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