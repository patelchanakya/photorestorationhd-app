import { cancelVideoGeneration } from '@/services/videoServiceProxy';
import { useCropModalStore } from '@/store/cropModalStore';
import { useBackToLife } from '@/hooks/useBackToLife';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { PhotoProcessingModal } from './PhotoProcessingModal';
import { VideoProcessingToast } from './VideoProcessingToast';
import { JobBlockingModal } from './JobBlockingModal';
import { ProUpgradeModal } from './ProUpgradeModal';

export function GlobalNotifications() {
  const { 
    isProcessing, 
    currentImageUri, 
    progress, 
    canCancel, 
    setIsProcessing,
    completedRestorationId,
    processingStatus,
    setCompletedRestorationId,
    setProcessingStatus 
  } = useCropModalStore();
  
  const backToLife = useBackToLife();
  
  const [showStillGeneratingModal, setShowStillGeneratingModal] = useState(false);
  const [showProUpgradeModal, setShowProUpgradeModal] = useState(false);

  // Handle Pro upgrade modal close
  const handleProUpgradeModalClose = () => {
    setShowProUpgradeModal(false);
    // Clear the error state when modal is dismissed
    setProcessingStatus(null);
    setCompletedRestorationId(null);
    setIsProcessing(false);
  };

  // Handle toast cancel button based on current state
  const handleToastCancel = () => {
    if (processingStatus === 'loading' || isProcessing) {
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
                setProcessingStatus(null);
                setCompletedRestorationId(null);
                
                if (__DEV__) {
                  console.log('🚫 User cancelled video generation via toast');
                }
              } catch (error) {
                if (__DEV__) {
                  console.error('❌ Failed to cancel via toast:', error);
                }
                // Still clear the UI state even if cancel fails
                setIsProcessing(false);
                setProcessingStatus(null);
                setCompletedRestorationId(null);
              }
            }
          }
        ]
      );
    } else {
      // For error or completed states, just dismiss
      setProcessingStatus(null);
      setCompletedRestorationId(null);
      setIsProcessing(false);
      
      if (__DEV__) {
        console.log('🔄 Toast dismissed via cancel button');
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
        // Navigate to video result screen
        router.push(`/video-result/${completedRestorationId}`);
        
        if (__DEV__) {
          console.log('🎬 Navigating to video result:', completedRestorationId);
        }
      } else {
        // Navigate to photo restoration screen
        router.push(`/restoration/${completedRestorationId}`);
        
        if (__DEV__) {
          console.log('🎬 Navigating to photo restoration:', completedRestorationId);
        }
      }
      
      // Clear completion state
      setCompletedRestorationId(null);
      setProcessingStatus(null);
      setIsProcessing(false);
    } else if (processingStatus === 'error') {
      // Handle error for failed Back to Life video generation
      if (__DEV__) {
        console.log('🔄 Handling Back to Life error - showing Pro upgrade modal');
      }
      
      // For Back to Life errors, show Pro upgrade modal instead of retry
      // Most Back to Life errors are subscription-related (usage limits, etc.)
      setShowProUpgradeModal(true);
      
    } else if (processingStatus === 'loading' || isProcessing) {
      // Show custom "still generating" modal instead of Alert
      setShowStillGeneratingModal(true);
      
      if (__DEV__) {
        console.log('🎬 Showing still generating modal');
      }
    }
  };

  const showToast = canCancel || processingStatus; // Show toast for Back to Life or any processing status
  const estimatedSeconds = showToast ? 7 : 0; // quick test duration for photo-based test
  const timeRemaining = showToast ? Math.max(0, Math.ceil(((100 - progress) / 100) * estimatedSeconds)) : 0;
  
  // Show toast if processing OR if Back to Life is completed/error
  const shouldShowToast = isProcessing || processingStatus === 'completed' || processingStatus === 'error';

  return (
    <>
      {showToast ? (
        <VideoProcessingToast
          visible={shouldShowToast}
          imageUri={currentImageUri}
          progress={progress}
          timeRemaining={timeRemaining}
          jobType={'video'}
          status={processingStatus || 'loading'}
          onPress={handleToastPress}
          onCancel={handleToastCancel}
        />
      ) : (
        <PhotoProcessingModal
          visible={isProcessing}
          imageUri={currentImageUri}
          progress={progress}
          canCancel={canCancel}
          onCancel={handleCancel}
          onDismiss={() => {}}
        />
      )}
      
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
        message="You've reached your Back to Life video limit. Upgrade to Pro for unlimited video generation!"
      />
    </>
  );
}