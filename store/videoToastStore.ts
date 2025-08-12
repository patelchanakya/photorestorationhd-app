import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabaseClient';
import Purchases from 'react-native-purchases';
import { useCropModalStore } from './cropModalStore';

interface VideoToastState {
  isVisible: boolean;
  predictionId: string | null;
  localPath: string | null;
  imageUri: string | null;
  message: string;
  modeTag: string | null;
  isTransitioning: boolean;
  isDismissed: boolean; // Temporarily hidden with "Maybe Later"
  hasBeenViewed: boolean; // Permanently dismissed after viewing
  showCompletionModal: boolean; // Show the completion modal
}

interface VideoToastActions {
  showVideoReady: (video: {
    id: string;
    localPath: string;
    imageUri?: string;
    message: string;
    modeTag?: string | null;
  }) => void;
  dismissTemporarily: () => void; // "Maybe Later" action
  viewVideo: () => void; // "View Video" action - marks as viewed
  hideVideoReady: () => void;
  clearVideoReady: () => void;
  checkForPendingVideo: () => Promise<void>; // Check storage on app launch
  showModal: () => void; // Show completion modal
  hideModal: () => void; // Hide completion modal
}

const PENDING_VIDEO_KEY = 'pending_video_toast';

export const useVideoToastStore = create<VideoToastState & VideoToastActions>((set, get) => ({
  // State
  isVisible: false,
  predictionId: null,
  localPath: null,
  imageUri: null,
  message: 'Your video is ready! 🎬',
  modeTag: null,
  isTransitioning: false,
  isDismissed: false,
  hasBeenViewed: false,
  showCompletionModal: false,

  // Actions
  showVideoReady: async (video) => {
    if (__DEV__) {
      console.log('🎬 Showing video completion toast AND modal for:', video.id);
    }
    
    // Save pending video to storage for persistence
    await AsyncStorage.setItem(PENDING_VIDEO_KEY, JSON.stringify({
      predictionId: video.id,
      localPath: video.localPath,
      imageUri: video.imageUri,
      message: video.message,
      modeTag: video.modeTag || null,
      timestamp: Date.now()
    }));
    
    set({
      predictionId: video.id,
      localPath: video.localPath,
      imageUri: video.imageUri,
      message: video.message,
      modeTag: video.modeTag || null,
      isTransitioning: false,
      isDismissed: false,
      hasBeenViewed: false,
      showCompletionModal: true, // Show modal
      isVisible: true, // ALSO show toast
    });
  },

  dismissTemporarily: async () => {
    if (__DEV__) {
      console.log('🎬 Video modal dismissed temporarily (Maybe Later) - toast remains visible');
    }
    
    set({ 
      showCompletionModal: false, // Hide modal
      isVisible: true, // Keep toast visible
      isDismissed: false, // Toast is not dismissed
      isTransitioning: false 
    });
    
    // Keep in storage - will reappear on app restart
  },

  viewVideo: async () => {
    const { predictionId } = get();
    
    if (__DEV__) {
      console.log('🎬 Video viewed, marking as complete:', predictionId);
    }
    
    // Mark as viewed in database
    if (predictionId) {
      try {
        const userId = await Purchases.getAppUserID();
        if (userId) {
          await supabase
            .from('user_video_jobs')
            .update({ 
              metadata: { viewed: true, viewed_at: new Date().toISOString() }
            })
            .eq('prediction_id', predictionId)
            .eq('user_id', userId);
        }
      } catch (error) {
        console.error('Failed to mark video as viewed:', error);
      }
    }
    
    // Remove from storage permanently
    await AsyncStorage.removeItem(PENDING_VIDEO_KEY);
    
    set({
      isVisible: false,
      showCompletionModal: false,
      isDismissed: false,
      hasBeenViewed: true,
      isTransitioning: false,
    });
  },

  hideVideoReady: () => {
    const { isVisible } = get();
    if (!isVisible) return;
    
    set({ isTransitioning: true });
    
    // Allow animation to complete before hiding
    setTimeout(() => {
      set({
        isVisible: false,
        isTransitioning: false,
      });
    }, 300);
  },

  clearVideoReady: async () => {
    await AsyncStorage.removeItem(PENDING_VIDEO_KEY);
    
    set({
      isVisible: false,
      showCompletionModal: false,
      predictionId: null,
      localPath: null,
      imageUri: null,
      message: 'Your video is ready! 🎬',
      modeTag: null,
      isTransitioning: false,
      isDismissed: false,
      hasBeenViewed: false,
    });
  },

  showModal: () => {
    set({ showCompletionModal: true });
  },

  hideModal: () => {
    set({ showCompletionModal: false });
  },

  checkForPendingVideo: async () => {
    try {
      const pendingVideoStr = await AsyncStorage.getItem(PENDING_VIDEO_KEY);
      
      if (!pendingVideoStr) {
        return; // No pending video
      }
      
      const pendingVideo = JSON.parse(pendingVideoStr);
      
      // Check if video still exists and hasn't been viewed
      try {
        const userId = await Purchases.getAppUserID();
        if (!userId) return;
        
        const { data: videoJob } = await supabase
          .from('user_video_jobs')
          .select('metadata')
          .eq('prediction_id', pendingVideo.predictionId)
          .eq('user_id', userId)
          .single();
        
        // If video was viewed in database, clear from storage
        if (videoJob?.metadata?.viewed) {
          await AsyncStorage.removeItem(PENDING_VIDEO_KEY);
          return;
        }
        
        // Show the pending video modal again
        if (__DEV__) {
          console.log('🎬 Restoring pending video modal AND toast from storage');
        }
        
        set({
          showCompletionModal: true, // Show modal on app restart
          predictionId: pendingVideo.predictionId,
          localPath: pendingVideo.localPath,
          imageUri: pendingVideo.imageUri,
          message: pendingVideo.message,
          modeTag: pendingVideo.modeTag || null,
          isTransitioning: false,
          isDismissed: false,
          hasBeenViewed: false,
          isVisible: true, // ALSO show toast on app restart
        });
        
        // ALSO sync CropModalStore to show toast
        const cropModalStore = useCropModalStore.getState();
        cropModalStore.setProcessingStatus('completed');
        cropModalStore.setCompletedRestorationId(`video-${pendingVideo.predictionId}`);
        cropModalStore.setIsProcessing(false);
        cropModalStore.setIsVideoProcessing(true);
        
        if (__DEV__) {
          console.log('🔄 CropModalStore synced for toast visibility on app restart');
        }
        
      } catch (dbError) {
        console.error('Error checking video status:', dbError);
        // If there's an error, still show the modal - better safe than sorry
        set({
          showCompletionModal: true, // Show modal on error fallback
          predictionId: pendingVideo.predictionId,
          localPath: pendingVideo.localPath,
          imageUri: pendingVideo.imageUri,
          message: pendingVideo.message,
          modeTag: pendingVideo.modeTag || null,
          isTransitioning: false,
          isDismissed: false,
          hasBeenViewed: false,
          isVisible: true, // ALSO show toast on error fallback
        });
        
        // ALSO sync CropModalStore for error fallback
        const cropModalStore = useCropModalStore.getState();
        cropModalStore.setProcessingStatus('completed');
        cropModalStore.setCompletedRestorationId(`video-${pendingVideo.predictionId}`);
        cropModalStore.setIsProcessing(false);
        cropModalStore.setIsVideoProcessing(true);
      }
      
    } catch (error) {
      console.error('Error checking for pending video:', error);
    }
  },
}));