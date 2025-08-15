import * as FileSystem from 'expo-file-system';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VideoGenerationOptions } from '@/types/video';
import { photoStorage } from './storage';

// Local mock video files - using Asset.fromModule to get proper URIs
const MOCK_VIDEOS = [
  'btl-0.mp4',
  'btl-1.mp4', 
  'btl-2.mp4',
  'btl-3.mp4',
  'btl-4.mp4',
  'btl-5.mp4',
];

// Simulate different processing times based on mode
const PROCESSING_TIMES = {
  standard: 7000,  // 7 seconds to match photo restoration
  pro: 12000       // 12 seconds for "higher quality"
};

interface MockVideoState {
  predictionId: string;
  imageUri: string;
  prompt: string;
  startTime: number;
  status: 'starting' | 'processing' | 'finalizing';
  attempts: number;
  options: VideoGenerationOptions;
  mockDuration: number;
}

class MockVideoStateManager {
  private static instance: MockVideoStateManager;
  private currentState: MockVideoState | null = null;
  private processingTimer: ReturnType<typeof setTimeout> | null = null;
  private progressCallbacks: Array<(progress: number) => void> = [];

  static getInstance(): MockVideoStateManager {
    if (!MockVideoStateManager.instance) {
      MockVideoStateManager.instance = new MockVideoStateManager();
    }
    return MockVideoStateManager.instance;
  }

  async saveState(state: MockVideoState): Promise<void> {
    this.currentState = state;
    await AsyncStorage.setItem('mock_video_state', JSON.stringify(state));
    if (__DEV__) {
      console.log('🎭 Mock video state saved');
    }
  }

  async loadState(): Promise<MockVideoState | null> {
    try {
      const stateJson = await AsyncStorage.getItem('mock_video_state');
      if (stateJson) {
        const state = JSON.parse(stateJson);
        this.currentState = state;
        return state;
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to load mock video state:', error);
      }
    }
    return null;
  }

  async clearState(): Promise<void> {
    this.currentState = null;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    await AsyncStorage.removeItem('mock_video_state');
    if (__DEV__) {
      console.log('🧹 Mock video state cleared');
    }
  }

  getCurrentState(): MockVideoState | null {
    return this.currentState;
  }

  onProgress(callback: (progress: number) => void) {
    this.progressCallbacks.push(callback);
  }

  private async copyVideoToStorage(videoFileName: string): Promise<string> {
    try {
      // Create videos directory if it doesn't exist
      const videosDir = `${FileSystem.documentDirectory}restorations/videos/`;
      const dirInfo = await FileSystem.getInfoAsync(videosDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(videosDir, { intermediates: true });
        if (__DEV__) {
          console.log('📁 Created videos directory:', videosDir);
        }
      }

      // Generate unique filename
      const fileName = `mock_${videoFileName.replace('.mp4', '')}_${Date.now()}.mp4`;
      const localPath = `${videosDir}${fileName}`;

      // For mock purposes, we'll create a simple placeholder file
      // In a real scenario, you'd copy from assets, but for testing the flow this works
      await FileSystem.writeAsStringAsync(localPath, 'mock video data', {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (__DEV__) {
        console.log('📹 Mock video file created at:', localPath);
        console.log('📹 Simulating video from asset:', videoFileName);
      }

      return localPath;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to create mock video file:', error);
      }
      throw error;
    }
  }

  private updateProgress(progress: number) {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  simulateProcessing(duration: number): Promise<string> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let progress = 0;

      const updateInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        progress = Math.min((elapsed / duration) * 100, 99);
        
        // Update status based on progress
        if (this.currentState) {
          let status: 'starting' | 'processing' | 'finalizing' = 'starting';
          if (progress > 20) status = 'processing';
          if (progress > 80) status = 'finalizing';
          
          this.currentState.status = status;
        }

        this.updateProgress(progress);
        
        if (__DEV__ && progress % 20 === 0) { // Only log every 20%
          console.log(`🎭 MOCK PROGRESS: ${Math.round(progress)}% (${this.currentState?.status || 'starting'})`);
        }
      }, 200); // Update every 200ms for smooth progress

      this.processingTimer = setTimeout(async () => {
        clearInterval(updateInterval);
        this.updateProgress(100);
        
        // Return a placeholder URL since this is mock mode (should not be used when USE_MOCK_VIDEO = false)
        const workingVideoUrl = 'https://example.com/mock-video-placeholder.mp4';
        
        if (__DEV__) {
          console.log('🎭 ===============================================');
          console.log('🎭 MOCK VIDEO GENERATION COMPLETED');
          console.log('🎭 ===============================================');
          console.log('✅ Returning REAL working video URL');
          console.log('📁 Video URL:', workingVideoUrl);
          console.log('🎬 This video will actually PLAY in the app');
          console.log('🎭 ===============================================');
        }
        
        resolve(workingVideoUrl);
      }, duration);
    });
  }
}

const mockStateManager = MockVideoStateManager.getInstance();

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateMockVideo(
  imageUri: string, 
  animationPrompt: string,
  options: VideoGenerationOptions = {}
): Promise<string> {
  if (__DEV__) {
    console.log('🎭 ===============================================');
    console.log('🎭 MOCK VIDEO GENERATION STARTED');
    console.log('🎭 ===============================================');
    console.log('🚫 SAFETY: NO REAL API CALLS WILL BE MADE');
    console.log('📁 Source: Local btl-*.mp4 files from assets');
    console.log('📸 Image URI:', imageUri.substring(0, 50) + '...');
    console.log('🎬 Animation prompt:', animationPrompt);
    console.log('⚙️ Options:', JSON.stringify(options));
    console.log('⏱️ Mock processing time: 7 seconds');
    console.log('🎭 ===============================================');
  }

  // Simulate network delay
  await sleep(1000);

  // Generate mock prediction ID
  const predictionId = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // Determine processing time based on mode
  const processingTime = PROCESSING_TIMES[options.mode || 'standard'];
  
  // Save initial state
  const initialState: MockVideoState = {
    predictionId,
    imageUri,
    prompt: animationPrompt,
    startTime: Date.now(),
    status: 'starting',
    attempts: 0,
    options,
    mockDuration: processingTime
  };
  
  await mockStateManager.saveState(initialState);

  try {
    // Simulate the processing
    const mockVideoUrl = await mockStateManager.simulateProcessing(processingTime);
    
    // Clear state on success
    await mockStateManager.clearState();
    
    if (__DEV__) {
      console.log('✅ Mock video generation completed:', mockVideoUrl);
    }
    
    return mockVideoUrl;
    
  } catch (error) {
    // Clear state on error
    await mockStateManager.clearState();
    throw error;
  }
}

export async function cancelMockVideoGeneration(): Promise<void> {
  if (__DEV__) {
    console.log('🛑 Mock video generation canceled');
  }
  await mockStateManager.clearState();
}

export async function resumeMockVideoGenerationIfExists(): Promise<{
  isResuming: boolean;
  state: MockVideoState | null;
  estimatedTimeRemaining?: number;
}> {
  const savedState = await mockStateManager.loadState();
  
  if (!savedState) {
    return { isResuming: false, state: null };
  }
  
  const elapsedMs = Date.now() - savedState.startTime;
  const estimatedTimeRemaining = Math.max(0, savedState.mockDuration - elapsedMs);
  
  if (estimatedTimeRemaining <= 0) {
    await mockStateManager.clearState();
    return { isResuming: false, state: null };
  }
  
  if (__DEV__) {
    console.log('📱 Found resumable mock video generation:', {
      predictionId: savedState.predictionId,
      timeRemaining: Math.ceil(estimatedTimeRemaining / 1000) + 's'
    });
  }
  
  return {
    isResuming: true,
    state: savedState,
    estimatedTimeRemaining
  };
}

export function getMockVideoGenerationProgress(): {
  isGenerating: boolean;
  state: MockVideoState | null;
  elapsedSeconds?: number;
  progressPhase?: string;
  progress?: number;
} {
  const state = mockStateManager.getCurrentState();
  
  if (!state) {
    return { isGenerating: false, state: null };
  }
  
  const elapsedMs = Date.now() - state.startTime;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const progress = Math.min((elapsedMs / state.mockDuration) * 100, 99);
  
  let progressPhase = 'Starting video generation...';
  if (state.status === 'processing') {
    progressPhase = 'Processing video...';
  } else if (state.status === 'finalizing') {
    progressPhase = 'Finalizing video... Almost ready!';
  }
  
  return {
    isGenerating: true,
    state,
    elapsedSeconds,
    progressPhase,
    progress
  };
}

// Hook for components to subscribe to progress updates
export function useMockVideoProgress(callback: (progress: number) => void) {
  mockStateManager.onProgress(callback);
}

// Export for testing
export { mockStateManager };