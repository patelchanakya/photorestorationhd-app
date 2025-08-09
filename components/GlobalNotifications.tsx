import { cancelVideoGeneration } from '@/services/videoServiceProxy';
import { useCropModalStore } from '@/store/cropModalStore';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { PhotoProcessingModal } from './PhotoProcessingModal';
import { VideoProcessingToast } from './VideoProcessingToast';
import { JobBlockingModal } from './JobBlockingModal';

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
  
  const [showStillGeneratingModal, setShowStillGeneratingModal] = useState(false);

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
          jobType={'photo'}
          status={processingStatus || 'loading'}
          onPress={handleToastPress}
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
    </>
  );
}