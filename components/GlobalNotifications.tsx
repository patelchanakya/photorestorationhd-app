import { useBackToLife } from '@/hooks/useBackToLife';
import { cancelVideoGeneration } from '@/services/videoServiceProxy';
import { useCropModalStore } from '@/store/cropModalStore';
import { useVideoToastStore } from '@/store/videoToastStore';
import { router, usePathname } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { JobBlockingModal } from './JobBlockingModal';
import { PhotoProcessingModal } from './PhotoProcessingModal';
import { ProUpgradeModal } from './ProUpgradeModal';
import { VideoCompletionModal } from './VideoCompletionModal';
import { VideoProcessingToast } from './VideoProcessingToast';

/**
 * Global notification system for video and photo processing
 * 
 * Video Toast Persistence:
 * - Video toasts (Back to Life) remain visible until explicit user interaction
 * - They persist across navigation, screen changes, and app state changes
 * - Only dismissed when user taps the toast or cancel button
 * - This ensures users never miss their completed video results
 */
export function GlobalNotifications() {
  const pathname = usePathname();
  const suppressToastOnRestoration = pathname?.startsWith('/restoration');
  const { 
    isProcessing, 
    isVideoProcessing,
    videoModeTag,
    currentImageUri, 
    progress, 
    canCancel, 
    setIsProcessing,
    completedRestorationId,
    processingStatus,
    errorMessage,
    setCompletedRestorationId,
    setProcessingStatus,
    setErrorMessage
  } = useCropModalStore();
  
  const backToLife = useBackToLife();
  
  // Video completion modal state
  const { 
    showCompletionModal, 
    predictionId, 
    localPath, 
    imageUri: completionImageUri,
    dismissTemporarily,
    isVisible: videoToastVisible,
    message: videoMessage,
    viewVideo,
    hideVideoReady
  } = useVideoToastStore();
  
  const [showStillGeneratingModal, setShowStillGeneratingModal] = useState(false);
  const [showProUpgradeModal, setShowProUpgradeModal] = useState(false);

  // Handle Pro upgrade modal close
  const handleProUpgradeModalClose = () => {
    setShowProUpgradeModal(false);
    // Only clear error states, NOT video processing states
    // Video toast should persist independently of photo operations
    if (processingStatus === 'error' && !isVideoProcessing) {
      // Only clear if it's an error state and not actively processing video
      setProcessingStatus(null);
      setErrorMessage(null);
      setCompletedRestorationId(null);
    }
    
    if (__DEV__) {
      console.log('🔄 Pro upgrade modal dismissed - video toast preserved');
    }
  };

  // Handle toast cancel button based on current state
  const handleToastCancel = () => {
    if (processingStatus === 'loading' || isVideoProcessing) {
      // Show confirmation for active processing
      Alert.alert(
        'Cancel Generation',
        'Your video is currently being generated. Are you sure you want to cancel?',
        [
          { text: 'Keep Generating', style: 'cancel' },
          {
            text: 'Cancel',
            style: 'destructive',
            onPress: async () => {
              try {
                if (canCancel) {
                  await cancelVideoGeneration();
                }
                // Clear all states
                setIsProcessing(false);
                // Also clear video processing flag so the processing toast hides
                useCropModalStore.getState().setIsVideoProcessing(false);
                setProcessingStatus(null);
                setCompletedRestorationId(null);
                setErrorMessage(null);
                
                if (__DEV__) {
                  console.log('🚫 User cancelled video generation via toast');
                }
              } catch (error) {
                if (__DEV__) {
                  console.error('❌ Failed to cancel via toast:', error);
                }
                // Still clear the UI state even if cancel fails
                setIsProcessing(false);
                useCropModalStore.getState().setIsVideoProcessing(false);
                setProcessingStatus(null);
                setCompletedRestorationId(null);
                setErrorMessage(null);
              }
            }
          }
        ]
      );
    } else {
      // For error or completed states, dismiss the video toast (user explicitly clicked cancel)
      setProcessingStatus(null);
      setErrorMessage(null);
      setCompletedRestorationId(null);
      setIsProcessing(false);
      useCropModalStore.getState().setIsVideoProcessing(false);
      
      if (__DEV__) {
        console.log('🔄 Video toast dismissed via cancel button (explicit user action)');
      }
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Processing',
      'Are you sure you want to cancel this operation? This cannot be undone.',
      [
        { text: 'Keep Processing', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              if (canCancel) {
                await cancelVideoGeneration();
              }
              setIsProcessing(false);
            } catch (error) {
              if (__DEV__) {
                console.error('Failed to cancel operation:', error);
              }
              // Still stop processing in UI
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  // Navigation handler for Back to Life toast
  const handleToastPress = () => {
    if (processingStatus === 'completed' && completedRestorationId) {
      // Check if this is a video ID (starts with 'video-') or regular restoration
      if (completedRestorationId.startsWith('video-')) {
        // Strip 'video-' prefix for navigation (video-result page expects raw prediction ID)
        const predictionId = completedRestorationId.replace('video-', '');
        router.push(`/video-result/${predictionId}`);
        
        if (__DEV__) {
          console.log('🎬 Navigating to video result with raw ID:', predictionId);
        }
      } else {
        // Navigate to photo restoration screen
        router.push(`/restoration/${completedRestorationId}`);
        
        if (__DEV__) {
          console.log('🎬 Navigating to photo restoration:', completedRestorationId);
        }
      }
      
      // Clear completion state (user explicitly tapped the toast)
      setCompletedRestorationId(null);
      setProcessingStatus(null);
      setErrorMessage(null);
      setIsProcessing(false);
      
      if (__DEV__) {
        console.log('🔄 Video toast dismissed after user tapped to view result');
      }
    } else if (processingStatus === 'error') {
      // Handle error for failed Back to Life video generation
      if (__DEV__) {
        console.log('🔄 Handling Back to Life error:', errorMessage);
      }
      
      // Check if this is a "video already processing" error
      if (errorMessage?.includes('Video is already processing')) {
        // Show "still generating" modal for this case
        setShowStillGeneratingModal(true);
      } else {
        // For other Back to Life errors, show Pro upgrade modal
        // Most Back to Life errors are subscription-related (usage limits, etc.)
        setShowProUpgradeModal(true);
      }
      
    } else if (processingStatus === 'loading' || isVideoProcessing) {
      // Show custom "still generating" modal instead of Alert
      setShowStillGeneratingModal(true);
      
      if (__DEV__) {
        console.log('🎬 Showing still generating modal');
      }
    }
  };

  // Determine if we should show video toast (from videoToastStore) or processing toast (from cropModalStore)
  const showVideoToast = videoToastVisible && predictionId && localPath;
  // Only tie the processing toast to video-related state, not photo state
  const showProcessingToast = isVideoProcessing || !!processingStatus;
  const estimatedSeconds = isVideoProcessing || processingStatus === 'loading' ? 120 : 0; // 2 minutes estimate for video generation
  const progressForVideo = isVideoProcessing ? progress : 0; // avoid using photo progress for video
  const timeRemaining = estimatedSeconds > 0 
    ? Math.max(0, Math.ceil(((100 - progressForVideo) / 100) * estimatedSeconds))
    : 0;
  
  // Show processing toast when video is actively processing, or when completed/error (and no dedicated video toast)
  const shouldShowProcessingToast = !showVideoToast && (isVideoProcessing || processingStatus === 'completed' || processingStatus === 'error');
  
  // Debug toast visibility for errors
  React.useEffect(() => {
    if (__DEV__ && processingStatus === 'error') {
      console.log('🔍 Toast visibility debug for error state:', {
        canCancel,
        processingStatus,
        isProcessing,
        showProcessingToast: !!showProcessingToast,
        shouldShowProcessingToast,
        showVideoToast,
        errorMessage
      });
    }
  }, [processingStatus, canCancel, isVideoProcessing, showProcessingToast, shouldShowProcessingToast, errorMessage]);
  
  // Log toast persistence for debugging
  React.useEffect(() => {
    if (__DEV__ && (shouldShowProcessingToast || showVideoToast)) {
      const toastType = showVideoToast ? 'completed-video' : (showProcessingToast ? 'processing-video' : 'photo');
      console.log(`🎬 Toast shown - Type: ${toastType}, VideoToast: ${showVideoToast}, ProcessingToast: ${shouldShowProcessingToast}`);
      console.log(`📱 Video toast persistence: Video toasts remain visible until user interaction (tap or cancel)`);
    }
  }, [shouldShowProcessingToast, showVideoToast, showProcessingToast, processingStatus, isVideoProcessing]);

  // Handler for video toast (from videoToastStore)
  const handleVideoToastPress = () => {
    if (predictionId && localPath) {
      router.push(`/video-result/${predictionId}`);
      // Mark as viewed
      viewVideo();
      
      if (__DEV__) {
        console.log('🎬 Navigating to completed video from toast');
      }
    }
  };

  const handleVideoToastCancel = () => {
    // For completed video toast, just hide it
    hideVideoReady();
    
    if (__DEV__) {
      console.log('🔄 Video toast hidden via cancel button');
    }
  };

  return (
    <>
      {/* Show video toast from videoToastStore (highest priority) */}
      {showVideoToast && !suppressToastOnRestoration && (
        <VideoProcessingToast
          visible={true}
          imageUri={completionImageUri}
          progress={100}
          timeRemaining={0}
          jobType={'video'}
          status={'completed'}
          errorMessage={null}
          mode={videoModeTag || undefined}
          onPress={handleVideoToastPress}
          onCancel={handleVideoToastCancel}
          stackLevel={0}
        />
      )}
      
      {/* Show processing toast from cropModalStore (only if no dedicated video toast) */}
      {!showVideoToast && showProcessingToast && !suppressToastOnRestoration && (
        <VideoProcessingToast
          visible={shouldShowProcessingToast}
          imageUri={currentImageUri}
          progress={progressForVideo}
          timeRemaining={timeRemaining}
          jobType={'video'}
          status={processingStatus || 'loading'}
          errorMessage={errorMessage}
          mode={videoModeTag || undefined}
          onPress={handleToastPress}
          onCancel={handleToastCancel}
          stackLevel={0}
        />
      )}

      {/* Only show photo processing modal when processing photos (not videos) */}
      <PhotoProcessingModal
        visible={isProcessing && !isVideoProcessing}
        imageUri={currentImageUri}
        progress={progress}
        canCancel={canCancel}
        onCancel={handleCancel}
        onDismiss={() => {}}
      />
      
      {/* Custom "Still Generating" Modal */}
      <JobBlockingModal
        visible={showStillGeneratingModal}
        onDismiss={() => setShowStillGeneratingModal(false)}
      />
      
      {/* Pro Upgrade Modal */}
      <ProUpgradeModal
        visible={showProUpgradeModal}
        onClose={handleProUpgradeModalClose}
        title="Upgrade to Pro"
        message="Back to Life videos are a Pro feature."
      />
      
      {/* Video Completion Modal */}
      <VideoCompletionModal
        visible={showCompletionModal}
        imageUri={completionImageUri || undefined}
        videoPath={localPath || undefined}
        predictionId={predictionId || undefined}
        onMaybeLater={dismissTemporarily}
      />
    </>
  );
}