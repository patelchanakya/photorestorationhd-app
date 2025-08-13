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
  debugVideoState: () => void; // Debug current video state
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

  debugVideoState: () => {
    const state = get();
    console.log('🔍 === VIDEO TOAST STORE DEBUG ===');
    console.log('📊 Current State:', {
      isVisible: state.isVisible,
      showCompletionModal: state.showCompletionModal,
      predictionId: state.predictionId,
      localPath: state.localPath,
      imageUri: state.imageUri,
      message: state.message,
      modeTag: state.modeTag,
      isTransitioning: state.isTransitioning,
      isDismissed: state.isDismissed,
      hasBeenViewed: state.hasBeenViewed
    });
    
    // Also debug AsyncStorage
    AsyncStorage.getItem(PENDING_VIDEO_KEY).then(pendingStr => {
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        console.log('💾 AsyncStorage Pending Video:', pending);
      } else {
        console.log('💾 No pending video in AsyncStorage');
      }
    });
    
    // Debug crop modal store too
    const cropState = useCropModalStore.getState();
    console.log('🔄 CropModal Store State:', {
      processingStatus: cropState.processingStatus,
      isVideoProcessing: cropState.isVideoProcessing,
      isProcessing: cropState.isProcessing,
      completedRestorationId: cropState.completedRestorationId,
      videoModeTag: cropState.videoModeTag
    });
    console.log('🔍 === DEBUG END ===');
  },

  checkForPendingVideo: async () => {
    try {
      console.log('🔍 === VIDEO RECOVERY DEBUG START ===');
      const pendingVideoStr = await AsyncStorage.getItem(PENDING_VIDEO_KEY);
      
      if (!pendingVideoStr) {
        console.log('📝 No pending video found in AsyncStorage');
        return; // No pending video
      }
      
      const pendingVideo = JSON.parse(pendingVideoStr);
      console.log('📝 Found pending video in AsyncStorage:', {
        predictionId: pendingVideo.predictionId,
        status: pendingVideo.status,
        modeTag: pendingVideo.modeTag,
        savedAt: new Date(pendingVideo.timestamp).toISOString()
      });
      
      // BULLETPROOF DATABASE RECOVERY - Handle ALL possible video states
      try {
        console.log('🔍 Starting video recovery for prediction:', pendingVideo.predictionId);
        
        const userId = await Purchases.getAppUserID();
        if (!userId) {
          console.log('❌ No user ID found for recovery');
          return;
        }
        
        console.log('👤 Checking database for user:', userId);
        
        const { data: videoJob, error: dbError } = await supabase
          .from('user_video_jobs')
          .select('*')
          .eq('prediction_id', pendingVideo.predictionId)
          .eq('user_id', userId)
          .single();
        
        if (dbError) {
          console.log('❌ Database query error:', dbError.message);
          // Don't clear - video might exist but query failed
          return;
        }
        
        if (!videoJob) {
          console.log('❌ Video job not found in database - clearing pending state');
          await AsyncStorage.removeItem(PENDING_VIDEO_KEY);
          return;
        }
        
        console.log('✅ Video job found:', {
          status: videoJob.status,
          has_video_url: !!videoJob.video_url,
          viewed: videoJob.metadata?.viewed,
          created_at: videoJob.created_at
        });
        
        // If video was viewed, clear from storage
        if (videoJob?.metadata?.viewed) {
          console.log('✅ Video already viewed - clearing pending state');
          await AsyncStorage.removeItem(PENDING_VIDEO_KEY);
          return;
        }
        
        // Handle ALL possible video states
        const cropModalStore = useCropModalStore.getState();
        
        switch (videoJob.status) {
          case 'starting':
          case 'processing':
            console.log('🔄 Restoring PROCESSING state for video');
            cropModalStore.setProcessingStatus('loading');
            cropModalStore.setIsVideoProcessing(true);
            cropModalStore.setIsProcessing(true);
            cropModalStore.setVideoModeTag(videoJob.mode_tag || null);
            cropModalStore.setCurrentImageUri(videoJob.image_uri);
            break;
            
          case 'completed':
            if (videoJob.video_url) {
              console.log('🎬 Restoring COMPLETED state - showing modal and toast');
              
              // Show completion modal
              set({
                showCompletionModal: true,
                predictionId: pendingVideo.predictionId,
                localPath: videoJob.video_url,
                imageUri: videoJob.image_uri,
                message: pendingVideo.message || 'Your video is ready! 🎬',
                modeTag: videoJob.mode_tag || null,
                isTransitioning: false,
                isDismissed: false,
                hasBeenViewed: false,
                isVisible: true,
              });
              
              // Sync CropModalStore for toast
              cropModalStore.setProcessingStatus('completed');
              cropModalStore.setCompletedRestorationId(`video-${pendingVideo.predictionId}`);
              cropModalStore.setIsProcessing(false);
              cropModalStore.setIsVideoProcessing(false);
              cropModalStore.setCurrentImageUri(videoJob.image_uri);
              
              console.log('✅ Video completion state fully restored');
            } else {
              console.log('⚠️ Video marked completed but no video_url - treating as failed');
              // Fall through to failed case
            }
            break;
            
          case 'failed':
          case 'canceled':
            console.log('❌ Restoring FAILED/CANCELED state');
            cropModalStore.setProcessingStatus('error');
            cropModalStore.setVideoError(videoJob.error_message || 'Video generation failed');
            cropModalStore.setIsVideoProcessing(false);
            cropModalStore.setIsProcessing(false);
            break;
            
          default:
            console.log('⚠️ Unknown video status:', videoJob.status);
            // Don't clear - might be a new status we don't handle yet
            break;
        }
        
      } catch (dbError) {
        console.error('❌ Database recovery failed:', dbError);
        // Don't clear pending state - retry next time
        console.log('⚠️ Keeping pending state for retry on next app open');
      }
      
      // Final recovery state summary
      const finalState = get();
      console.log('🎯 === VIDEO RECOVERY FINAL STATE ===');
      console.log('📊 Recovery Results:', {
        showCompletionModal: finalState.showCompletionModal,
        isVisible: finalState.isVisible,
        predictionId: finalState.predictionId,
        hasLocalPath: !!finalState.localPath,
        hasImageUri: !!finalState.imageUri,
        modeTag: finalState.modeTag
      });
      
      // Also log crop modal store state for debugging
      const cropModalState = useCropModalStore.getState();
      console.log('🔄 CropModal State After Recovery:', {
        processingStatus: cropModalState.processingStatus,
        isVideoProcessing: cropModalState.isVideoProcessing,
        isProcessing: cropModalState.isProcessing,
        completedRestorationId: cropModalState.completedRestorationId
      });
      console.log('🔍 === VIDEO RECOVERY DEBUG END ===');
      
    } catch (error) {
      console.error('❌ Critical error in video recovery:', error);
      console.log('🧹 Clearing corrupted pending video state');
      // Clear the pending video to avoid infinite loops
      try {
        await AsyncStorage.removeItem(PENDING_VIDEO_KEY);
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup pending video:', cleanupError);
      }
    }
  },
}));