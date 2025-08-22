import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface VideoGenerationState {
  // Current generation state (not persisted to avoid UI flicker)
  isGenerating: boolean;
  currentPredictionId: string | null;
  currentImageUri: string | null;
  progress: number;
  error: string | null;
  
  // Recovery data (persisted)
  pendingGeneration: {
    predictionId: string;
    imageUri: string;
    prompt: string;
    startedAt: string;
    // Enhanced recovery tracking
    lastRecoveryAttempt?: string;
    recoveryAttempts?: number;
    lastSuccessfulCheck?: string;
  } | null;
  
  // Recovery state (not persisted)
  isRecovering: boolean;
  appForegroundTime: number | null;
  allowNewGeneration: boolean;
  
  // Generated videos (persisted)
  videos: Record<string, {
    id: string;
    url: string;
    originalImage: string;
    prompt: string;
    createdAt: string;
    predictionId: string;
  }>;
  
  // Unviewed video tracking (persisted)
  hasUnviewedVideo: boolean;
  lastCompletedVideoId: string | null;
  
  // Toast state (not persisted)
  showToast: boolean;
  toastType: 'processing' | 'success' | 'error';
  toastMessage: string;
  
  // Completion modal state (not persisted)
  showCompletionModal: boolean;
  completionModalData: {
    predictionId: string;
    imageUri: string;
    videoUrl: string;
    message: string;
  } | null;
  
  // Actions
  startGeneration: (imageUri: string, predictionId: string, prompt: string) => void;
  updatePredictionId: (predictionId: string) => void;
  updateProgress: (progress: number, predictionId?: string) => void;
  completeGeneration: (videoData: {
    id: string;
    url: string;
    originalImage: string;
    prompt: string;
    predictionId: string;
  }) => void;
  failGeneration: (error: string) => void;
  clearGeneration: () => void;
  resumeGeneration: (pendingData: {
    predictionId: string;
    imageUri: string;
    prompt: string;
  }) => void;
  
  // Toast actions
  showSuccessToast: (message: string) => void;
  showErrorToast: (message: string) => void;
  hideToast: () => void;
  
  // Completion modal actions
  showCompletionModalAction: (data: {
    predictionId: string;
    imageUri: string;
    videoUrl: string;
    message: string;
  }) => void;
  hideCompletionModal: () => void;
  
  // Video management
  getVideo: (id: string) => any;
  getAllVideos: () => any[];
  deleteVideo: (id: string) => void;
  
  // Unviewed video management
  markVideoAsViewed: () => void;
  isVideoExpired: (videoId: string) => boolean;
  clearExpiredUnviewedVideo: () => void;
  
  // Recovery function (for use outside hooks)
  checkForPendingVideo: () => Promise<void>;
  
  // Enhanced recovery functions
  startRecovery: () => void;
  updateRecoveryAttempt: () => void;
  markRecoverySuccess: () => void;
  shouldAttemptRecovery: () => boolean;
  setAppForegroundTime: () => void;
  shouldDelayFirstRecovery: () => boolean;
  updateAllowNewGeneration: () => void;
  isRecentGeneration: () => boolean;
  shouldTreatAsProcessing: () => boolean;
}

export const useVideoGenerationStore = create<VideoGenerationState>()(
  persist(
    (set, get) => ({
      // Initial state
      isGenerating: false,
      currentPredictionId: null,
      currentImageUri: null,
      progress: 0,
      error: null,
      pendingGeneration: null,
      videos: {},
      hasUnviewedVideo: false,
      lastCompletedVideoId: null,
      showToast: false,
      toastType: 'processing' as const,
      toastMessage: '',
      showCompletionModal: false,
      completionModalData: null,
      isRecovering: false,
      appForegroundTime: null,
      allowNewGeneration: false,
      
      // Actions
      startGeneration: (imageUri: string, predictionId: string, prompt: string) => {
        const state = get();
        if (state.isGenerating) return; // silent no-op
        const startedAt = new Date().toISOString();
        set({
          isGenerating: true,
          currentPredictionId: predictionId,
          currentImageUri: imageUri,
          progress: 0,
          error: null,
          showToast: true,
          toastType: 'processing' as const,
          toastMessage: 'Generating video...',
          pendingGeneration: {
            predictionId,
            imageUri,
            prompt,
            startedAt,
            recoveryAttempts: 0,
            lastRecoveryAttempt: undefined,
            lastSuccessfulCheck: undefined
          }
        });
      },
      
      updatePredictionId: (predictionId: string) => {
        set((state) => ({
          currentPredictionId: predictionId,
          pendingGeneration: state.pendingGeneration ? {
            ...state.pendingGeneration,
            predictionId
          } : null
        }));
      },
      
      resumeGeneration: (pendingData) => {
        set({
          isGenerating: true,
          currentPredictionId: pendingData.predictionId,
          currentImageUri: pendingData.imageUri,
          progress: 0,
          error: null,
          showToast: true,
          toastType: 'processing' as const,
          toastMessage: 'Resuming video generation...',
          isRecovering: false // Clear recovery state when resuming
        });
      },
      
      updateProgress: (progress: number, predictionId?: string) => {
        const state = get();
        set({
          progress,
          // Update prediction ID if provided and we're still generating
          currentPredictionId: predictionId || state.currentPredictionId
        });
      },
      
      
      completeGeneration: (videoData) => {
        const state = get();
        // Only ignore completion if we're actively generating a DIFFERENT image
        // Don't ignore during recovery scenarios where currentImageUri might not be set
        if (state.isGenerating && state.currentImageUri && 
            videoData.originalImage !== state.currentImageUri && 
            !state.pendingGeneration) {
          if (__DEV__) {
            console.log('ℹ️ Ignoring completion for different image:', videoData.originalImage);
          }
          return;
        }
        const updatedState = {
          isGenerating: false,
          progress: 100,
          pendingGeneration: null, // Clear pending since completed
          videos: {
            ...state.videos,
            [videoData.id]: {
              ...videoData,
              createdAt: new Date().toISOString()
            }
          },
          hasUnviewedVideo: true,
          lastCompletedVideoId: videoData.id,
          showToast: true,
          toastType: 'success' as const,
          toastMessage: 'Your video is ready!',
          showCompletionModal: true,
          completionModalData: {
            predictionId: videoData.predictionId,
            imageUri: videoData.originalImage,
            videoUrl: videoData.url,
            message: 'Your video is ready!'
          }
        };
        set(updatedState);
      },
      
      failGeneration: (error: string) => {
        const state = get();
        set({
          isGenerating: false,
          currentPredictionId: null,
          currentImageUri: null,
          progress: 0,
          error,
          pendingGeneration: null, // Clear pending on failure
          showToast: true,
          toastType: 'error' as const,
          toastMessage: error
        });
      },
      
      clearGeneration: () => {
        set({
          isGenerating: false,
          currentPredictionId: null,
          currentImageUri: null,
          progress: 0,
          error: null,
          pendingGeneration: null, // Clear pending on manual clear
          showToast: false,
          toastType: 'processing' as const,
          toastMessage: '',
          isRecovering: false
        });
      },
      
      // Toast actions
      showSuccessToast: (message: string) => {
        set({
          showToast: true,
          toastType: 'success' as const,
          toastMessage: message
        });
      },
      
      showErrorToast: (message: string) => {
        set({
          showToast: true,
          toastType: 'error' as const,
          toastMessage: message
        });
      },
      
      hideToast: () => {
        set({ showToast: false });
      },
      
      // Completion modal actions
      showCompletionModalAction: (data) => {
        set({
          showCompletionModal: true,
          completionModalData: data
        });
      },
      
      hideCompletionModal: () => {
        set({
          showCompletionModal: false,
          completionModalData: null
        });
      },
      
      // Video management
      getVideo: (id: string) => {
        return get().videos[id];
      },
      
      getAllVideos: () => {
        const videos = get().videos;
        return Object.values(videos).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },
      
      deleteVideo: (id: string) => {
        const state = get();
        const { [id]: deleted, ...remainingVideos } = state.videos;
        set({ videos: remainingVideos });
      },
      
      // Unviewed video management
      markVideoAsViewed: () => {
        set({
          hasUnviewedVideo: false,
          lastCompletedVideoId: null
        });
      },
      
      isVideoExpired: (videoId: string) => {
        const state = get();
        const video = state.videos[videoId];
        if (!video) return true;
        
        const age = Date.now() - new Date(video.createdAt).getTime();
        return age > 24 * 60 * 60 * 1000; // 24 hours - videos cached in Supabase Storage
      },
      
      clearExpiredUnviewedVideo: () => {
        const state = get();
        if (state.hasUnviewedVideo && state.lastCompletedVideoId) {
          if (get().isVideoExpired(state.lastCompletedVideoId)) {
            console.log('🧹 Clearing expired unviewed video:', state.lastCompletedVideoId);
            get().markVideoAsViewed();
          }
        }
      },
      
      // Recovery function implementation
      checkForPendingVideo: async () => {
        const state = get();
        if (!state.pendingGeneration || state.isGenerating) {
          return;
        }
        
        // Delegate to the proper recovery function
        try {
          const { useVideoRecovery } = await import('@/hooks/useVideoRecovery');
          // We can't use the hook here, so we'll manually implement the recovery logic
          const { predictionId, imageUri, prompt, startedAt } = state.pendingGeneration;
          
          // Check if too old (59 minutes) - standardized with simpleVideoStore
          const now = new Date();
          const started = new Date(startedAt);
          const elapsedMs = now.getTime() - started.getTime();
          const timeoutMs = 59 * 60 * 1000; // 59 minutes
      
          if (elapsedMs > timeoutMs) {
            console.log('🧹 Clearing expired pending generation (>59 minutes old):', predictionId);
            get().clearGeneration();
            return;
          }
          
          // All prediction IDs are now real server IDs from the start
          // No need to check for local IDs anymore
          console.log('🔄 Checking for pending video:', predictionId);
          
          // Check status on server
          const { pollVideoStatus } = await import('@/services/videoGenerationV2');
          const statusResponse = await pollVideoStatus(predictionId);
          
          if (statusResponse.is_complete) {
            if (statusResponse.is_successful && statusResponse.video_url) {
              console.log('✅ Found completed video on recovery:', statusResponse.video_url);
              
              const videoData = {
                id: predictionId,
                url: statusResponse.video_url,
                originalImage: imageUri,
                prompt: prompt,
                predictionId
              };
              
              get().completeGeneration(videoData);
            } else {
              console.log('❌ Pending video failed on server');
              get().failGeneration(statusResponse.error_message || 'Video generation failed');
            }
          } else {
            console.log('⏳ Video still processing, will be handled by recovery hook...');
            // The recovery hook will handle ongoing generations
          }
        } catch (error) {
          console.error('❌ Video recovery check failed:', error);
        }
      },
      
      // Enhanced recovery functions
      startRecovery: () => {
        const state = get();
        if (!state.pendingGeneration || state.isRecovering) return;
        
        set({ isRecovering: true });
        
        const now = new Date().toISOString();
        const currentAttempts = state.pendingGeneration.recoveryAttempts || 0;
        
        set({
          pendingGeneration: {
            ...state.pendingGeneration,
            lastRecoveryAttempt: now,
            recoveryAttempts: currentAttempts + 1
          }
        });
      },
      
      updateRecoveryAttempt: () => {
        const state = get();
        if (!state.pendingGeneration) return;
        
        const now = new Date().toISOString();
        const currentAttempts = state.pendingGeneration.recoveryAttempts || 0;
        
        set({
          pendingGeneration: {
            ...state.pendingGeneration,
            lastRecoveryAttempt: now,
            recoveryAttempts: currentAttempts + 1
          }
        });
      },
      
      markRecoverySuccess: () => {
        const state = get();
        if (!state.pendingGeneration) return;
        
        const now = new Date().toISOString();
        
        set({
          pendingGeneration: {
            ...state.pendingGeneration,
            lastSuccessfulCheck: now
          },
          isRecovering: false
        });
      },
      
      shouldAttemptRecovery: () => {
        const state = get();
        if (!state.pendingGeneration || state.isGenerating || state.isRecovering) {
          return false;
        }
        
        const { lastRecoveryAttempt, recoveryAttempts = 0, startedAt } = state.pendingGeneration;
        
        // Don't attempt if too many attempts (but allow across sessions)
        if (recoveryAttempts >= 20) {
          console.log('🛑 Too many recovery attempts, stopping:', recoveryAttempts);
          return false;
        }
        
        // Don't attempt if too old (59 minutes - standardized with simpleVideoStore)
        const started = new Date(startedAt);
        const elapsedMs = Date.now() - started.getTime();
        const maxAge = 59 * 60 * 1000; // 59 minutes
        
        if (elapsedMs > maxAge) {
          console.log('🛑 Pending generation too old for recovery:', elapsedMs / (60 * 1000), 'minutes');
          return false;
        }
        
        // Implement responsive backoff for better UX
        if (lastRecoveryAttempt) {
          const lastAttempt = new Date(lastRecoveryAttempt);
          const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();
          
          // Responsive backoff schedule - even faster for recent generations
          let backoffMs;
          
          // For recent generations (< 3 minutes old), use faster polling
          const isRecent = get().isRecentGeneration();
          
          if (isRecent && recoveryAttempts <= 10) {
            // Very fast polling for recent videos still processing
            backoffMs = 3000; // 3 seconds for first 10 attempts on recent videos
          } else if (recoveryAttempts <= 3) {
            backoffMs = 5000; // 5 seconds
          } else if (recoveryAttempts <= 6) {
            backoffMs = 10000; // 10 seconds
          } else if (recoveryAttempts <= 10) {
            backoffMs = 15000; // 15 seconds
          } else {
            backoffMs = 20000; // 20 seconds max
          }
          
          if (timeSinceLastAttempt < backoffMs) {
            if (__DEV__) {
              const waitTimeSeconds = Math.ceil((backoffMs - timeSinceLastAttempt) / 1000);
              console.log(`⏳ Recovery backoff: wait ${waitTimeSeconds}s more (attempt ${recoveryAttempts + 1})`);
            }
            return false;
          }
        }
        
        return true;
      },
      
      // App foreground tracking for delayed recovery
      setAppForegroundTime: () => {
        set({ appForegroundTime: Date.now() });
      },
      
      shouldDelayFirstRecovery: () => {
        const state = get();
        if (!state.appForegroundTime || !state.pendingGeneration) return false;
        
        // Only delay if this is the first attempt after foreground
        const timeSinceForeground = Date.now() - state.appForegroundTime;
        const isFirstAttemptAfterForeground = !state.pendingGeneration.lastRecoveryAttempt || 
          new Date(state.pendingGeneration.lastRecoveryAttempt).getTime() < state.appForegroundTime;
        
        return isFirstAttemptAfterForeground && timeSinceForeground < 2000; // 2 second delay
      },
      
      updateAllowNewGeneration: () => {
        const state = get();
        const recoveryAttempts = state.pendingGeneration?.recoveryAttempts || 0;
        
        // Allow new generation after 5 failed attempts
        const shouldAllow = recoveryAttempts >= 5;
        
        if (shouldAllow !== state.allowNewGeneration) {
          set({ allowNewGeneration: shouldAllow });
        }
      },
      
      // Check if generation is recent (still likely processing)
      isRecentGeneration: () => {
        const state = get();
        if (!state.pendingGeneration) return false;
        
        const started = new Date(state.pendingGeneration.startedAt);
        const elapsedMs = Date.now() - started.getTime();
        const recentThreshold = 3 * 60 * 1000; // 3 minutes - typical video processing time
        
        return elapsedMs < recentThreshold;
      },
      
      // Check if we should treat this as active processing vs recovery
      shouldTreatAsProcessing: () => {
        const state = get();
        if (!state.pendingGeneration) return false;
        
        const isRecent = get().isRecentGeneration();
        const hasLowAttempts = (state.pendingGeneration.recoveryAttempts || 0) <= 2;
        
        // Treat as processing if it's recent AND hasn't failed multiple times
        return isRecent && hasLowAttempts;
      }
    }),
    {
      name: 'video-generation-store',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => AsyncStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => AsyncStorage.removeItem(name),
      },
      partialize: (state) => ({
        // Only persist recovery data, videos, and unviewed state
        pendingGeneration: state.pendingGeneration,
        videos: state.videos,
        hasUnviewedVideo: state.hasUnviewedVideo,
        lastCompletedVideoId: state.lastCompletedVideoId
      }) as any
    }
  )
);