import { useJob } from '@/contexts/JobContext';
import { usePhotoRestoration } from './usePhotoRestoration';
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

  // Note: Video generation is now handled by useSimpleBackToLife system
  // JobContext only handles photo processing jobs
  
  // Cleanup progress intervals when not needed (photo jobs don't use intervals)
  useEffect(() => {
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
  }, [activeJob]);

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

  // Note: Video generation is now handled by useSimpleBackToLife system
  // Only photo restoration jobs are managed here

  // Check if new job can be started (for button states)
  const canStartJob = () => {
    return canStartNewJob();
  };

  return {
    activeJob,
    startPhotoRestoration,
    canStartJob,
    isProcessing: !!activeJob && activeJob.status === 'processing',
  };
}