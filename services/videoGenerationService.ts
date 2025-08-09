import Replicate from 'replicate';
import * as FileSystem from 'expo-file-system';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { networkStateService } from './networkState';

// Validate API token
const apiToken = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;
if (!apiToken) {
  console.error('EXPO_PUBLIC_REPLICATE_API_TOKEN is not set in environment variables');
} else {
  if (__DEV__) {
    console.log('✅ Replicate API token loaded for video generation');
  }
}

const replicate = new Replicate({
  auth: apiToken,
});

// Animation-specific prompts optimized for Kling v2.1
const ANIMATION_PROMPTS = {
  'animate with a warm hug gesture': 'person opens arms and makes a warm hugging gesture, showing affection',
  'animate as a group celebration': 'person celebrates with group-friendly gestures and movements, expressing joy',
  'animate with love and affection': 'person shows affection with gentle loving gestures and warm expressions',
  'animate with dancing movements': 'person starts dancing with rhythmic movements and joy, moving to music',
  'animate with fun and playful movements': 'person makes playful and fun movements with energy and enthusiasm',
  'animate with a warm smile': "person's face lights up with a warm, genuine smile, expressing happiness",
  'bring this photo to life with natural animation': 'person makes subtle natural movements with gentle expressions'
} as const;

// Helper function to convert image to accessible URL
async function uploadImageToReplicate(imageUri: string): Promise<string> {
  try {
    // Validate the image URI exists
    const imageInfo = await FileSystem.getInfoAsync(imageUri);
    if (!imageInfo.exists) {
      throw new Error('Selected image file not found');
    }
    
    // Check file size (Kling has limits)
    if (imageInfo.size && imageInfo.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Image is too large. Please select an image smaller than 10MB.');
    }
    
    if (__DEV__) {
      console.log('📸 Processing image for video generation');
      console.log('📏 Image size:', Math.round((imageInfo.size || 0) / 1024), 'KB');
    }
    
    // Read the image as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Validate base64 content
    if (!base64 || base64.length < 100) {
      throw new Error('Invalid image content');
    }
    
    // Convert to data URL format for Replicate (Kling accepts this)
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    
    if (__DEV__) {
      console.log('✅ Image successfully converted to data URL');
      console.log('📊 Data URL length:', dataUrl.length, 'characters');
    }
    
    return dataUrl;
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to process image:', error);
    }
    
    if (error instanceof Error) {
      throw error; // Re-throw our custom errors
    }
    
    throw new Error('Failed to process image for video generation. Please try with a different image.');
  }
}

// Test network connectivity
async function testNetworkConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
    });
    
    clearTimeout(timeoutId);
    return response.status === 204 || response.ok;
  } catch (error) {
    if (__DEV__) {
      console.log('🌐 Network test failed:', error);
    }
    return false;
  }
}

// Sleep helper for polling
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Video generation state for persistence and background handling
interface VideoGenerationState {
  predictionId: string;
  imageUri: string;
  prompt: string;
  startTime: number;
  status: 'starting' | 'processing' | 'finalizing';
  attempts: number;
  options: VideoGenerationOptions;
}

// State manager for video generation persistence
class VideoGenerationStateManager {
  private static instance: VideoGenerationStateManager;
  private currentState: VideoGenerationState | null = null;
  private appStateSubscription: any = null;
  private isInBackground = false;

  static getInstance(): VideoGenerationStateManager {
    if (!VideoGenerationStateManager.instance) {
      VideoGenerationStateManager.instance = new VideoGenerationStateManager();
    }
    return VideoGenerationStateManager.instance;
  }

  async saveState(state: VideoGenerationState): Promise<void> {
    try {
      this.currentState = state;
      await AsyncStorage.setItem('video_generation_state', JSON.stringify(state));
      if (__DEV__) {
        console.log('💾 Video generation state saved');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to save video generation state:', error);
      }
    }
  }

  async loadState(): Promise<VideoGenerationState | null> {
    try {
      const stateJson = await AsyncStorage.getItem('video_generation_state');
      if (stateJson) {
        const state = JSON.parse(stateJson);
        this.currentState = state;
        if (__DEV__) {
          console.log('📱 Video generation state restored');
        }
        return state;
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to load video generation state:', error);
      }
    }
    return null;
  }

  async clearState(): Promise<void> {
    try {
      this.currentState = null;
      await AsyncStorage.removeItem('video_generation_state');
      if (__DEV__) {
        console.log('🧹 Video generation state cleared');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to clear video generation state:', error);
      }
    }
  }

  getCurrentState(): VideoGenerationState | null {
    return this.currentState;
  }

  setupAppStateListener(onAppStateChange?: (nextAppState: AppStateStatus) => void): void {
    if (this.appStateSubscription) return;

    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (__DEV__) {
        console.log('🔄 Video Generation AppState changed to:', nextAppState);
      }
      
      this.isInBackground = nextAppState !== 'active';
      
      if (onAppStateChange) {
        onAppStateChange(nextAppState);
      }
    });
  }

  removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  isAppInBackground(): boolean {
    return this.isInBackground;
  }
}

const stateManager = VideoGenerationStateManager.getInstance();

// Helper function to optimize prompt for Kling v2.1
function optimizePromptForKling(originalPrompt: string): string {
  // Check if we have a predefined optimized prompt
  const optimized = ANIMATION_PROMPTS[originalPrompt as keyof typeof ANIMATION_PROMPTS];
  if (optimized) {
    return optimized;
  }
  
  // For custom prompts, ensure they work well with Kling v2.1
  return originalPrompt;
}

export interface VideoGenerationOptions {
  mode?: 'standard' | 'pro';
  duration?: 5 | 10;
  negativePrompt?: string;
  subscriptionTier?: 'free' | 'pro';
}

// Track active video generation requests to prevent spam
const activeVideoRequests = new Map<string, Promise<string>>();

export async function generateVideo(
  imageUri: string, 
  animationPrompt: string,
  options: VideoGenerationOptions = {}
): Promise<string> {
  // DANGER: This should NOT be called if mock mode is enabled
  if (__DEV__) {
    console.log('⚡ ===============================================');
    console.log('⚡ REAL KLING API CALLED - THIS COSTS MONEY!');
    console.log('⚡ ===============================================');
    console.log('💰 WARNING: Real API call will be charged');
    console.log('🎬 Image:', imageUri.substring(0, 50) + '...');
    console.log('🎬 Prompt:', animationPrompt);
    console.log('⚡ ===============================================');
  }
  // Create a unique key for this request to prevent duplicates
  const requestKey = `${imageUri}_${animationPrompt}`;
  
  // If we already have an active request for this exact combination, return it
  if (activeVideoRequests.has(requestKey)) {
    if (__DEV__) {
      console.log('🚫 Preventing duplicate video generation request');
    }
    return activeVideoRequests.get(requestKey)!;
  }

  // Create the video generation promise
  const videoGenerationPromise = (async () => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 480000); // 8 minute timeout for video generation (2-5 min processing + buffer)

  // Setup AppState monitoring for background handling
  stateManager.setupAppStateListener((nextAppState) => {
    if (nextAppState === 'background' && stateManager.getCurrentState()) {
      if (__DEV__) {
        console.log('📱 Video generation continuing in background...');
      }
    } else if (nextAppState === 'active' && stateManager.getCurrentState()) {
      if (__DEV__) {
        console.log('📱 Video generation resumed from background');
      }
    }
  });

  try {
    // Check if API token is available
    if (!apiToken) {
      throw new Error('Replicate API token is not configured. Please check your environment variables.');
    }

    // Test network connection
    const hasConnection = await testNetworkConnection();
    if (!hasConnection) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }

    // Convert image to accessible URL
    const imageUrl = await uploadImageToReplicate(imageUri);
    
    // Optimize prompt for Kling v2.1
    const optimizedPrompt = optimizePromptForKling(animationPrompt);
    
    // Determine video quality based on subscription tier
    // For now, always use standard mode as requested
    const videoMode = 'standard'; // Always 720p
    const videoDuration = 5; // Always 5 seconds for better performance
    
    // Prepare input for Kling v2.1
    const input = {
      prompt: optimizedPrompt,
      start_image: imageUrl,
      mode: videoMode,
      duration: videoDuration,
      negative_prompt: options.negativePrompt || 'blurry, distorted, low quality, static, frozen'
    };

    if (__DEV__) {
      console.log('🎬 Starting video generation with Kling v2.1');
      console.log('📝 Optimized prompt:', optimizedPrompt);
      console.log('🎥 Settings:', { mode: input.mode, duration: input.duration });
    }

    // Create prediction
    const prediction = await replicate.predictions.create({
      model: 'kwaivgi/kling-v2.1',
      input
    });

    if (__DEV__) {
      console.log('🚀 Video generation started, prediction ID:', prediction.id);
    }

    // Save initial state for persistence and background handling
    const initialState: VideoGenerationState = {
      predictionId: prediction.id,
      imageUri,
      prompt: optimizedPrompt,
      startTime: Date.now(),
      status: 'starting',
      attempts: 0,
      options
    };
    await stateManager.saveState(initialState);

    // Poll for completion with optimized intervals for video processing
    let attempts = 0;
    let delay = 3000; // Start with 3 seconds for video generation (longer than image)
    const maxAttempts = 120; // Up to 8 minutes of polling with longer intervals
    
    // Track last network check to avoid excessive checking
    let lastNetworkCheck = Date.now();
    const networkCheckInterval = 30000; // Check network every 30 seconds during long operations
    
    while (attempts < maxAttempts) {
      await sleep(delay);
      
      // More frequent network connectivity checks for long video operations
      const now = Date.now();
      const shouldCheckNetwork = (now - lastNetworkCheck) > networkCheckInterval || attempts % 5 === 0;
      
      if (shouldCheckNetwork) {
        const hasRealConnection = await testNetworkConnection();
        if (!hasRealConnection) {
          // Single network check - no expensive retries for video generation
          throw new Error('Network connection lost during video generation. Please check your internet connection and try again.');
        }
        lastNetworkCheck = now;
      }
      
      // Check if we've been aborted
      if (abortController.signal.aborted) {
        throw new Error('Video generation timed out. Please try again.');
      }

      let result;
      try {
        result = await replicate.predictions.get(prediction.id);
      } catch (networkError) {
        if (networkError instanceof Error && 
            (networkError.message.includes('fetch') || 
             networkError.message.includes('network') ||
             networkError.message.includes('timeout'))) {
          throw new Error('Network error during video processing. Please check your internet connection and try again.');
        }
        throw networkError;
      }

      // Update state with current progress
      const currentState = stateManager.getCurrentState();
      if (currentState) {
        const elapsedMs = Date.now() - currentState.startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        let status: 'starting' | 'processing' | 'finalizing' = 'processing';
        
        // Determine status based on elapsed time and result status
        if (elapsedMs < 10000) {
          status = 'starting';
        } else if (result.status === 'processing' && elapsedMs > 90000) {
          status = 'finalizing'; // After 90s, likely in final stages
        }

        await stateManager.saveState({
          ...currentState,
          status,
          attempts
        });

        if (__DEV__) {
          console.log(`🔄 Video polling attempt ${attempts + 1}: status = ${result.status} (${status}) - ${elapsedSeconds}s elapsed`);
        }
      }
      
      if (result.status === 'succeeded') {
        // Kling v2.1 returns a single video URL as output
        const videoUrl = result.output;
        
        if (__DEV__) {
          console.log('✅ Video generation completed');
          console.log('🎬 Output type:', typeof videoUrl);
          console.log('🎬 Video URL:', videoUrl);
        }
        
        // Validate the output is a valid URL
        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error('Invalid video output received from Kling API');
        }
        
        // Verify it's a valid URL format
        try {
          new URL(videoUrl);
        } catch {
          throw new Error('Invalid video URL format received from Kling API');
        }
        
        // Clear persisted state on success
        await stateManager.clearState();
        stateManager.removeAppStateListener();
        
        return videoUrl;
      } else if (result.status === 'failed') {
        const error = String(result.error) || 'Video generation failed';
        
        // Clear state on failure
        await stateManager.clearState();
        stateManager.removeAppStateListener();
        
        if (__DEV__) {
          console.error('🎬 Kling API Error Details:', result.error);
        }
        
        // Handle specific Kling v2.1 errors
        if (error.includes('NSFW') || error.includes('content policy') || error.includes('safety')) {
          throw new Error('Image contains content that cannot be processed. Please try with a different image.');
        }
        
        if (error.includes('invalid image') || error.includes('unsupported format')) {
          throw new Error('Image format not supported. Please use JPG or PNG images.');
        }
        
        if (error.includes('too large') || error.includes('size limit')) {
          throw new Error('Image is too large. Please use a smaller image (under 10MB).');
        }
        
        if (error.includes('quota') || error.includes('limit exceeded')) {
          throw new Error('Service temporarily unavailable due to high demand. Please try again later.');
        }
        
        if (error.includes('timeout') || error.includes('took too long')) {
          throw new Error('Video generation timed out. Please try again with a simpler image.');
        }
        
        // Generic error with original message
        throw new Error(`Video generation failed: ${error}`);
      } else if ((result.status as string) === 'canceled' || (result.status as string) === 'cancelled') {
        // Clear state on cancellation
        await stateManager.clearState();
        stateManager.removeAppStateListener();
        
        throw new Error('Video generation was canceled due to content policy restrictions. Please try with a different image.');
      } else if (result.status === 'processing' || result.status === 'starting') {
        // Continue polling
        if (__DEV__) {
          console.log(`⏳ Video processing... (${result.status})`);
        }
      }
      
      attempts++;
      
      // Optimized exponential backoff for video generation: 3s -> 8s max
      delay = Math.min(delay * 1.15, 8000);
    }
    
    // Clear state if we exceed max attempts
    await stateManager.clearState();
    stateManager.removeAppStateListener();
    
    throw new Error('Video generation took longer than expected. Please try again.');
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Clean up state and listeners on any error
    await stateManager.clearState();
    stateManager.removeAppStateListener();
    
    if (__DEV__) {
      console.error('❌ Video generation error:', error);
    }
    
    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Video generation timed out. Please try again.');
    }
    
    // Handle content policy errors
    if (error instanceof Error && error.message.includes('content policy')) {
      throw error;
    }
    
    // Handle API errors
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthenticated')) {
        throw new Error('Authentication failed. Please contact support.');
      } else if (error.message.includes('402') || error.message.includes('Payment Required')) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        throw new Error('Too many requests. Please try again in a few minutes.');
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
    }
    
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  })();

  // Store the promise in the active requests map
  activeVideoRequests.set(requestKey, videoGenerationPromise);

  try {
    const result = await videoGenerationPromise;
    return result;
  } finally {
    // Always clean up the active request when done
    activeVideoRequests.delete(requestKey);
  }
}

// Enhanced cancel video generation with state cleanup
export async function cancelVideoGeneration(predictionId?: string): Promise<void> {
  try {
    // Use current state's prediction ID if not provided
    const currentState = stateManager.getCurrentState();
    const idToCancel = predictionId || currentState?.predictionId;
    
    if (idToCancel) {
      await replicate.predictions.cancel(idToCancel);
      if (__DEV__) {
        console.log('🛑 Video generation canceled:', idToCancel);
      }
    }
    
    // Always clean up state and listeners
    await stateManager.clearState();
    stateManager.removeAppStateListener();
    
  } catch (error) {
    if (__DEV__) {
      console.error('❌ Failed to cancel video generation:', error);
    }
    
    // Still clean up state even if cancel fails
    await stateManager.clearState();
    stateManager.removeAppStateListener();
  }
}

// Resume video generation from saved state (for app restart scenarios)
export async function resumeVideoGenerationIfExists(): Promise<{
  isResuming: boolean;
  state: VideoGenerationState | null;
  estimatedTimeRemaining?: number;
}> {
  const savedState = await stateManager.loadState();
  
  if (!savedState) {
    return { isResuming: false, state: null };
  }
  
  const elapsedMs = Date.now() - savedState.startTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  
  // If more than 10 minutes have passed, assume it failed
  if (elapsedMinutes > 10) {
    await stateManager.clearState();
    return { isResuming: false, state: null };
  }
  
  // Estimate remaining time (assume 2-5 minutes total processing)
  const estimatedTotalMs = 180000; // 3 minutes average
  const estimatedTimeRemaining = Math.max(0, estimatedTotalMs - elapsedMs);
  
  if (__DEV__) {
    console.log('📱 Found resumable video generation:', {
      predictionId: savedState.predictionId,
      elapsedMinutes,
      estimatedMinutesRemaining: Math.ceil(estimatedTimeRemaining / 60000)
    });
  }
  
  return {
    isResuming: true,
    state: savedState,
    estimatedTimeRemaining
  };
}

// Get current video generation progress
export function getVideoGenerationProgress(): {
  isGenerating: boolean;
  state: VideoGenerationState | null;
  elapsedSeconds?: number;
  progressPhase?: string;
} {
  const state = stateManager.getCurrentState();
  
  if (!state) {
    return { isGenerating: false, state: null };
  }
  
  const elapsedMs = Date.now() - state.startTime;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  
  let progressPhase = 'Starting video generation...';
  if (state.status === 'processing') {
    progressPhase = 'Processing video... This may take 2-5 minutes.';
  } else if (state.status === 'finalizing') {
    progressPhase = 'Finalizing video... Almost ready!';
  }
  
  return {
    isGenerating: true,
    state,
    elapsedSeconds,
    progressPhase
  };
}

// Export state manager for external use
export { stateManager as videoStateManager };