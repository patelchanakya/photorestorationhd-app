import { useJob } from '@/contexts/JobContext';
import { usePhotoRestoration } from './usePhotoRestoration';
import { useVideoGeneration } from './useVideoGeneration';
import { notificationService } from '@/services/notificationService';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { type FunctionType } from '@/services/modelConfigs';

export function useJobManagement() {
  const { 
    activeJob, 
    startJob, 
    updateJobProgress, 
    completeJob, 
    failJob, 
    clearJob, 
    canStartNewJob 
  } = useJob();
  const router = useRouter();
  
  const photoRestoration = usePhotoRestoration();
  const videoGeneration = useVideoGeneration();
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor photo restoration progress
  useEffect(() => {
    if (photoRestoration.isPending && activeJob?.type === 'photo') {
      // Photo restoration is processing, no need to update progress as it's quick
    } else if (photoRestoration.isSuccess && activeJob?.type === 'photo') {
      // Photo completed - navigate to result
      const resultId = photoRestoration.data?.id;
      if (resultId) {
        completeJob(resultId);
        // Send notification for photo completion
        notificationService.sendVideoCompletionNotification('photo');
        router.replace(`/restoration/${resultId}`);
        // Clear job after navigation
        setTimeout(() => clearJob(), 1000);
      }
    } else if (photoRestoration.isError && activeJob?.type === 'photo') {
      // Photo failed
      failJob(photoRestoration.error?.message);
      setTimeout(() => clearJob(), 2000);
    }
  }, [photoRestoration.isPending, photoRestoration.isSuccess, photoRestoration.isError, photoRestoration.data, photoRestoration.error, activeJob, completeJob, failJob, clearJob, router]);

  // Monitor video generation progress
  useEffect(() => {
    if (videoGeneration.state.isGenerating && activeJob?.type === 'video') {
      // Clear any existing timer-based progress since we have real progress
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      
      // Update progress based on elapsed time from video generation service
      const elapsed = videoGeneration.state.elapsedSeconds;
      const estimatedTotal = 120; // 2 minutes estimated for video generation
      const progress = Math.min(95, Math.floor((elapsed / estimatedTotal) * 100)); // Cap at 95% until completion
      updateJobProgress(progress);
    } else if (activeJob?.type === 'video' && activeJob.status === 'processing' && !videoGeneration.state.isGenerating) {
      // Video job is processing but video generation hasn't started yet
      // Use timer-based progress to show something is happening
      if (!progressIntervalRef.current) {
        progressIntervalRef.current = setInterval(() => {
          if (activeJob && activeJob.status === 'processing') {
            const elapsed = (Date.now() - activeJob.startTime) / 1000;
            const progress = Math.min(85, Math.floor((elapsed / activeJob.estimatedDuration) * 85)); // Cap at 85% until video generation starts
            updateJobProgress(progress);
          }
        }, 2000); // Update every 2 seconds
      }
      
      // Check if photo restoration completed (video generation done)
      if (photoRestoration.isSuccess) {
        // Clear progress timer
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        
        const resultId = photoRestoration.data?.id;
        if (resultId) {
          completeJob(resultId);
          // Send notification for video completion
          notificationService.sendVideoCompletionNotification('video');
          router.replace(`/video-result/${resultId}`);
          // Clear job after navigation
          setTimeout(() => clearJob(), 1000);
        }
      }
    }
    
    // Cleanup interval on job completion or failure
    if (!activeJob || activeJob.status !== 'processing') {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [videoGeneration.state.elapsedSeconds, videoGeneration.state.isGenerating, activeJob, updateJobProgress, photoRestoration.isSuccess, photoRestoration.data, completeJob, clearJob, router]);

  // Start photo restoration job
  const startPhotoRestoration = (params: {
    imageUri: string;
    functionType: FunctionType;
    imageSource?: 'camera' | 'gallery';
    customPrompt?: string;
  }) => {
    if (!canStartNewJob()) {
      return false; // Job is already running
    }

    // Start job in context
    startJob({
      id: `photo_${Date.now()}`,
      type: 'photo',
      progress: 0,
      imageUri: params.imageUri,
      estimatedDuration: 7, // 7 seconds for photos
    });

    // Start photo restoration
    photoRestoration.mutate(params);
    return true;
  };

  // Start video generation job
  const startVideoGeneration = async (params: {
    imageUri: string;
    functionType: FunctionType;
    imageSource?: 'camera' | 'gallery';
    customPrompt?: string;
  }) => {
    if (!canStartNewJob()) {
      return false; // Job is already running
    }

    // Request notification permission on first video generation
    if (!notificationService.hasAlreadyRequestedPermission()) {
      Alert.alert(
        'Stay Notified! 🔔',
        'Video generation takes 2-5 minutes. Would you like to receive a notification when your video is ready?',
        [
          {
            text: 'No Thanks',
            style: 'cancel',
            onPress: () => {
              // Continue without notifications
              startVideoJob(params);
            }
          },
          {
            text: 'Enable Notifications',
            onPress: async () => {
              const granted = await notificationService.requestPermission();
              if (granted && __DEV__) {
                console.log('🔔 Notifications enabled for video completion');
              }
              startVideoJob(params);
            }
          }
        ]
      );
    } else {
      startVideoJob(params);
    }

    return true;
  };

  // Helper function to start video job
  const startVideoJob = (params: {
    imageUri: string;
    functionType: FunctionType;
    imageSource?: 'camera' | 'gallery';
    customPrompt?: string;
  }) => {
    // Start job in context
    startJob({
      id: `video_${Date.now()}`,
      type: 'video',
      progress: 0,
      imageUri: params.imageUri,
      estimatedDuration: 120, // 2 minutes for videos
    });

    // Start video generation monitoring
    videoGeneration.startMonitoring();
    
    // Start photo restoration (which handles video generation too)
    photoRestoration.mutate(params);
  };

  // Check if new job can be started (for button states)
  const canStartJob = () => {
    return canStartNewJob();
  };

  return {
    activeJob,
    startPhotoRestoration,
    startVideoGeneration,
    canStartJob,
    isProcessing: !!activeJob && activeJob.status === 'processing',
  };
}