import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simplified video generation store - single source of truth with 59-minute expiration
interface SimpleVideoState {
  // Current generation (persisted for recovery)
  currentGeneration: {
    predictionId: string;
    startedAt: string;      // ISO timestamp when generation started
    imageUri: string;
    prompt: string;
  } | null;
  
  // UI state (not persisted)
  status: 'idle' | 'starting' | 'processing' | 'completed' | 'failed' | 'expired';
  progress: number;
  videoUrl: string | null;
  error: string | null;
  isCheckingStatus: boolean;  // NEW - for "Calculating ETA..." state
  
  // Toast state (not persisted)
  showToast: boolean;
  toastMessage: string;
  
  // Completed videos cache (persisted)
  completedVideos: Record<string, {
    id: string;
    url: string;
    originalImage: string;
    prompt: string;
    predictionId: string;
    completedAt: string;
  }>;
  
  // Unviewed video tracking (persisted)
  hasUnviewedVideo: boolean;
  lastCompletedVideoId: string | null;
  
  // Background tracking (not persisted)
  lastBackgroundTime: number | null;
  
  // Toast scheduling (not persisted)
  toastScheduleTimer: NodeJS.Timeout | null;
  toastHideTimer: NodeJS.Timeout | null;
  
  // State update mutex (not persisted)
  _isUpdating: boolean;
  
  // Completion modal state (not persisted)
  showCompletionModal: boolean;
  completionModalData: {
    predictionId: string;
    imageUri: string;
    videoUrl: string;
    message: string;
  } | null;
  
  // Actions
  startGeneration: (predictionId: string, startedAt: string, imageUri: string, prompt: string) => void;
  updateStatus: (status: SimpleVideoState['status'], progress?: number, videoUrl?: string, error?: string) => void;
  completeGeneration: (videoUrl: string) => void;
  failGeneration: (error: string) => void;
  clearGeneration: () => void;
  
  // Expiration check
  checkExpiration: () => boolean; // Returns true if current generation has expired (>59 minutes)
  
  // Status checking state
  setCheckingStatus: (checking: boolean) => void;
  
  // Background tracking
  setLastBackgroundTime: (time: number) => void;
  
  // Toast scheduling
  scheduleToast: (delayMs: number) => void;
  cancelToastSchedule: () => void;
  scheduleToastHide: (delayMs: number) => void;
  cancelToastHide: () => void;
  
  // Mutex helpers (internal use)
  _acquireMutex: () => boolean;
  _releaseMutex: () => void;
  
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
  markVideoAsViewed: () => void;
}

const MAX_AGE_MS = 59 * 60 * 1000; // 59 minutes in milliseconds

export const useSimpleVideoStore = create<SimpleVideoState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentGeneration: null,
      status: 'idle',
      progress: 0,
      videoUrl: null,
      error: null,
      isCheckingStatus: false,
      showToast: false,
      toastMessage: '',
      completedVideos: {},
      hasUnviewedVideo: false,
      lastCompletedVideoId: null,
      lastBackgroundTime: null,
      toastScheduleTimer: null,
      toastHideTimer: null,
      _isUpdating: false,
      showCompletionModal: false,
      completionModalData: null,
      
      // Actions
      startGeneration: (predictionId: string, startedAt: string, imageUri: string, prompt: string) => {
        console.log('🎬 Starting simple video generation:', { predictionId, imageUri: imageUri.substring(0, 20) + '...' });
        console.log('📅 Toast will appear in 45 seconds...');
        
        // Cancel any existing toast timers
        const state = get();
        if (state.toastScheduleTimer) {
          clearTimeout(state.toastScheduleTimer);
        }
        if (state.toastHideTimer) {
          clearTimeout(state.toastHideTimer);
        }
        
        set({
          currentGeneration: {
            predictionId,
            startedAt,
            imageUri,
            prompt
          },
          status: 'starting',
          progress: 0, // No fake progress
          videoUrl: null,
          error: null,
          showToast: false, // Don't show immediately
          toastMessage: '',
          toastScheduleTimer: null,
          toastHideTimer: null,
          // Clear any previous completion state
          hasUnviewedVideo: false,
          lastCompletedVideoId: null,
          showCompletionModal: false,
          completionModalData: null
        });
        
        // Schedule toast to appear in 45 seconds
        const store = get();
        store.scheduleToast(45000);
      },
      
      updateStatus: (status: SimpleVideoState['status'], progress?: number, videoUrl?: string, error?: string) => {
        const store = get();
        
        // Acquire mutex for atomic update
        if (!store._acquireMutex()) {
          console.log('🔒 updateStatus blocked by race condition');
          return;
        }
        
        try {
          const currentState = get();
          const updates: Partial<SimpleVideoState> = { status };
          
          if (progress !== undefined) updates.progress = progress;
          if (videoUrl !== undefined) updates.videoUrl = videoUrl;
          if (error !== undefined) updates.error = error;
          
          // Cancel any existing timers when status changes
          if (currentState.toastScheduleTimer) {
            clearTimeout(currentState.toastScheduleTimer);
            updates.toastScheduleTimer = null;
          }
          if (currentState.toastHideTimer) {
            clearTimeout(currentState.toastHideTimer);
            updates.toastHideTimer = null;
          }
          
          // Get progressive toast message based on status and video age
          if (currentState.currentGeneration) {
            const age = Date.now() - new Date(currentState.currentGeneration.startedAt).getTime();
            const ageMinutes = Math.floor(age / 60000);
            const ageSeconds = Math.floor(age / 1000);
            
            if (status === 'processing') {
              // Show toast immediately when processing starts
              updates.showToast = true;
              
              if (ageMinutes === 0) {
                updates.toastMessage = 'Generating your video...';
              } else if (ageMinutes === 1) {
                updates.toastMessage = 'Processing... 1 minute elapsed';
              } else if (ageMinutes === 2) {
                updates.toastMessage = 'Processing... 2 minutes elapsed';
              } else if (ageMinutes >= 3) {
                updates.toastMessage = 'Taking longer than usual...';
              } else {
                updates.toastMessage = `Processing... ${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} elapsed`;
              }
              
              // Schedule auto-hide after 15 seconds for processing updates
              const hideTimer = setTimeout(() => {
                const state = get();
                if (state.status === 'processing' && !state.hasUnviewedVideo) {
                  set({ showToast: false, toastHideTimer: null });
                }
              }, 15000);
              updates.toastHideTimer = hideTimer;
              
            } else if (status === 'completed') {
              updates.showToast = true;
              updates.toastMessage = 'Your video is ready!';
              // Don't auto-hide completion messages
              
            } else if (status === 'failed') {
              updates.showToast = true;
              updates.toastMessage = error || 'Generation failed';
              // Don't auto-hide error messages
              
            } else if (status === 'expired') {
              // Keep expired videos silent as per original design
              updates.toastMessage = 'Video expired (59 minute limit)';
              
            } else if (status === 'starting') {
              // For starting status updates, keep existing behavior
              if (ageSeconds >= 60) {
                updates.showToast = true;
                updates.toastMessage = 'Generating your video...';
              }
            }
          }
          
          set(updates);
        } finally {
          store._releaseMutex();
        }
      },
      
      completeGeneration: (videoUrl: string) => {
        const state = get();
        if (!state.currentGeneration) return;
        
        // Acquire mutex for atomic update
        if (!state._acquireMutex()) {
          console.log('🔒 completeGeneration blocked by race condition');
          return;
        }
        
        try {
          const { predictionId, imageUri, prompt } = state.currentGeneration;
          const completedAt = new Date().toISOString();
          
          // Create video record
          const videoRecord = {
            id: predictionId,
            url: videoUrl,
            originalImage: imageUri,
            prompt: prompt,
            predictionId: predictionId,
            completedAt
          };
          
          console.log('✅ Video generation completed:', predictionId);
          
          set({
            status: 'completed',
            progress: 100,
            videoUrl: videoUrl,
            error: null,
            completedVideos: {
              ...state.completedVideos,
              [predictionId]: videoRecord
            },
            hasUnviewedVideo: true,
            lastCompletedVideoId: predictionId,
            toastMessage: 'Your video is ready!',
            showCompletionModal: true,
            completionModalData: {
              predictionId,
              imageUri,
              videoUrl,
              message: 'Your video is ready!'
            }
          });
        } finally {
          state._releaseMutex();
        }
      },
      
      failGeneration: (error: string) => {
        const state = get();
        
        // Acquire mutex for atomic update
        if (!state._acquireMutex()) {
          console.log('🔒 failGeneration blocked by race condition');
          return;
        }
        
        try {
          console.log('❌ Video generation failed:', error);
          
          set({
            status: 'failed',
            progress: 0,
            videoUrl: null,
            error: error,
            toastMessage: error,
            showToast: true
          });
        } finally {
          state._releaseMutex();
        }
      },
      
      clearGeneration: () => {
        console.log('🧹 Clearing video generation state');
        
        const state = get();
        
        // Clear any pending toast timers
        if (state.toastScheduleTimer) {
          clearTimeout(state.toastScheduleTimer);
        }
        if (state.toastHideTimer) {
          clearTimeout(state.toastHideTimer);
        }
        
        set({
          currentGeneration: null,
          status: 'idle',
          progress: 0,
          videoUrl: null,
          error: null,
          showToast: false,
          toastMessage: '',
          toastScheduleTimer: null,
          toastHideTimer: null,
          hasUnviewedVideo: false,
          showCompletionModal: false,
          completionModalData: null
        });
      },
      
      // Check if current generation has expired (>59 minutes)
      checkExpiration: (): boolean => {
        const state = get();
        if (!state.currentGeneration) return false;
        
        const age = Date.now() - new Date(state.currentGeneration.startedAt).getTime();
        const isExpired = age > MAX_AGE_MS;
        
        if (isExpired) {
          console.log('⏰ Video generation expired - clearing silently:', { 
            ageMinutes: Math.floor(age / 60000),
            maxMinutes: 59 
          });
          
          // SILENTLY clear everything, no toast
          set({
            currentGeneration: null,
            status: 'idle',
            progress: 0,
            videoUrl: null,
            error: null,
            isCheckingStatus: false,
            showToast: false,  // DON'T show toast
            toastMessage: '',
            hasUnviewedVideo: false,
            showCompletionModal: false,
            completionModalData: null
          });
        }
        
        return isExpired;
      },
      
      // Toast actions
      showSuccessToast: (message: string) => {
        set({
          showToast: true,
          toastMessage: message
        });
      },
      
      showErrorToast: (message: string) => {
        set({
          showToast: true,
          toastMessage: message,
          error: message
        });
      },
      
      hideToast: () => {
        set({
          showToast: false
        });
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
        const state = get();
        return state.completedVideos[id] || null;
      },
      
      getAllVideos: () => {
        const state = get();
        return Object.values(state.completedVideos).sort((a, b) => 
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        );
      },
      
      markVideoAsViewed: () => {
        set({
          hasUnviewedVideo: false
        });
      },
      
      // Status checking state
      setCheckingStatus: (checking: boolean) => {
        set({
          isCheckingStatus: checking
        });
      },
      
      // Background tracking
      setLastBackgroundTime: (time: number) => {
        set({
          lastBackgroundTime: time
        });
      },

      // Toast scheduling
      scheduleToast: (delayMs: number) => {
        const state = get();
        
        // Cancel existing timer
        if (state.toastScheduleTimer) {
          clearTimeout(state.toastScheduleTimer);
        }
        
        const timer = setTimeout(() => {
          const currentState = get();
          if (currentState.currentGeneration && currentState.status === 'starting') {
            console.log('📅 Scheduled toast appearing now');
            set({
              showToast: true,
              toastMessage: 'Preparing your video...',
              toastScheduleTimer: null
            });
          }
        }, delayMs);
        
        set({ toastScheduleTimer: timer });
      },

      cancelToastSchedule: () => {
        const state = get();
        if (state.toastScheduleTimer) {
          clearTimeout(state.toastScheduleTimer);
          set({ toastScheduleTimer: null });
        }
      },

      scheduleToastHide: (delayMs: number) => {
        const state = get();
        
        // Cancel existing hide timer
        if (state.toastHideTimer) {
          clearTimeout(state.toastHideTimer);
        }
        
        const timer = setTimeout(() => {
          const currentState = get();
          // Only hide if still in same state and not completed/failed
          if (currentState.status === 'starting' || currentState.status === 'processing') {
            console.log('📅 Auto-hiding toast after inactivity');
            set({
              showToast: false,
              toastHideTimer: null
            });
          }
        }, delayMs);
        
        set({ toastHideTimer: timer });
      },

      cancelToastHide: () => {
        const state = get();
        if (state.toastHideTimer) {
          clearTimeout(state.toastHideTimer);
          set({ toastHideTimer: null });
        }
      },

      // Mutex helpers (internal use) - improved atomic implementation
      _acquireMutex: (): boolean => {
        const state = get();
        if (state._isUpdating) {
          console.log('🔒 State update blocked by mutex');
          return false;
        }
        
        // Use set callback to ensure atomicity
        let acquired = false;
        set((currentState) => {
          if (currentState._isUpdating) {
            return currentState; // No change if already updating
          }
          acquired = true;
          return { ...currentState, _isUpdating: true };
        });
        
        return acquired;
      },

      _releaseMutex: () => {
        set((currentState) => ({
          ...currentState,
          _isUpdating: false
        }));
      }
    }),
    {
      name: 'simple-video-generation-store',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
      // Only persist generation state and completed videos, not UI state
      partialize: (state) => ({
        currentGeneration: state.currentGeneration,
        completedVideos: state.completedVideos,
        hasUnviewedVideo: state.hasUnviewedVideo,
        lastCompletedVideoId: state.lastCompletedVideoId,
      }),
    }
  )
);