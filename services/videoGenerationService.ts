import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { AppState, AppStateStatus } from 'react-native';
import Purchases from 'react-native-purchases';
import Replicate from 'replicate';
import { photoStorage } from './storage';
import { supabase } from './supabaseClient';

// NOTE: This service is deprecated in favor of secure server-side API
// The EXPO_PUBLIC_REPLICATE_API_TOKEN is no longer used for security
// All video generation now goes through secure server endpoints

// Validate API token (kept for legacy compatibility)
const apiToken = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;
if (!apiToken) {
  console.warn('EXPO_PUBLIC_REPLICATE_API_TOKEN is not set - using secure server-side API instead');
} else {
  if (__DEV__) {
    console.warn('⚠️  EXPO_PUBLIC_REPLICATE_API_TOKEN found but should be removed for security');
    console.warn('⚠️  This service is deprecated - use videoApiService.ts instead');
  }
}

const replicate = apiToken ? new Replicate({
  auth: apiToken,
}) : null;

// Animation-specific prompts optimized for Kling v2.1
const ANIMATION_PROMPTS = {
  'animate with a warm hug gesture': 'In this scene, people very slowly embrace in a warm, affectionate hug with extremely gentle, natural movements. For groups, show a very calm group hug where everyone leans in very softly; for pairs or individuals, display very tender, gradual hugging gestures. Keep all actions realistic, extremely gentle, and ultra-fluid without any fast or sudden motions, maintaining the original photo\'s composition and background still.',
  'animate as a group celebration': 'The subjects celebrate together with very slow, peaceful joyful gestures like soft, gradual cheers or gentle high-fives, expressing happiness very naturally. In groups, show extremely subtle interactions such as slow smiling nods or very light pats on backs; for individuals, display quiet, gradual celebratory poses. Ensure movements are ultra-smooth, realistic, and extremely slow, preserving the photo\'s essence with a static background.',
  'animate with love and affection': 'People express love through extremely gentle, affectionate actions like very soft touches or slow, warm gazes, with natural and very calm movements. For groups or families, include very subtle caring interactions; for couples or individuals, show tender, gradual expressions. All animations should be ultra-fluid, realistic, and free of any quick or sudden elements, keeping the background unchanged.',
  'animate with dancing movements': 'Subjects move with very slow, rhythmic dancing steps that feel natural and extremely gentle, like a very slow sway or soft, gradual twirl. In groups, coordinate very calm collective dances; for singles, show extremely subtle personal rhythms. Avoid any quick motions, ensuring ultra-realistic, slow flow suitable for Kling v2.1, with the background remaining still.',
  'animate with fun and playful movements': 'The scene comes alive with fun, playful yet extremely calm movements like very gentle waves or soft, slow laughs, keeping everything natural and ultra-smooth. Groups interact with light, coordinated, slow playfulness; individuals display very subtle joyful gestures. Prevent any fast actions, focusing on realistic, ultra-fluid, gradual animations while the background stays static.',
  'animate with a warm smile': 'Faces very slowly light up with warm, genuine smiles that spread naturally across the group or individual, accompanied by extremely subtle, gentle head tilts or soft eye sparkles. For multiple people, smiles ripple very softly between them; ensure all expressions are calm, realistic, and gradual, with no sudden changes and a motionless background.',
  'bring this photo to life with natural animation': 'Bring the photo to life with extremely subtle, natural animations like very gentle breathing, soft blinks, or calm, gradual shifts in posture, suitable for individuals or groups. Movements should be ultra-smooth, realistic, and very unhurried, avoiding any fast or artificial effects, while keeping the background completely still for a lifelike feel.'
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

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  try {
    return await Purchases.getAppUserID();
  } catch (error) {
    console.error('Failed to get user ID:', error);
    return null;
  }
}

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
  // DANGER: This service is deprecated and should not be used
  if (__DEV__) {
    console.log('⚠️  ===============================================');
    console.log('⚠️  DEPRECATED SERVICE CALLED - USE SERVER API!');
    console.log('⚠️  ===============================================');
    console.log('⚠️  This service exposes API tokens to clients');
    console.log('⚠️  Use videoApiService.ts for secure server-side calls');
    console.log('⚠️  ===============================================');
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
    if (!apiToken || !replicate) {
      throw new Error('This service is deprecated. Please use the secure server-side API instead (videoApiService.ts).');
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

    // Get the webhook URL from Supabase
    const webhookUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/video-webhook`;
    
    // Create prediction with webhook for persistence
    const prediction = await replicate.predictions.create({
      model: 'kwaivgi/kling-v2.1',
      input,
      webhook: webhookUrl,
      webhook_events_filter: ['completed']
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
    
    // Also save to database for webhook and recovery
    try {
      const userId = await getCurrentUserId();
      if (userId) {
        const { error: dbError } = await supabase
          .from('user_video_jobs')
          .insert({
            user_id: userId,
            prediction_id: prediction.id,
            image_uri: imageUri,
            prompt: optimizedPrompt,
            status: 'starting',
            expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
          });
        
        if (dbError) {
          console.error('Failed to save video job to database:', dbError);
        } else if (__DEV__) {
          console.log('💾 Video job saved to database for persistence');
        }
      }
    } catch (dbErr) {
      console.error('Error saving video job:', dbErr);
    }

    // Poll for completion with optimized intervals for video processing
    let attempts = 0;
    let delay = 5000; // Start with 5 seconds as requested for better UX
    const maxAttempts = 100; // Up to 8-10 minutes with 5s intervals
    
    // Track last network check to avoid excessive checking
    let lastNetworkCheck = Date.now();
    const networkCheckInterval = 30000; // Check network every 30 seconds during long operations
    
    while (attempts < maxAttempts) {
      await sleep(delay);
      
      // Smart network connectivity checks - check less frequently as time goes on
      const now = Date.now();
      const shouldCheckNetwork = (now - lastNetworkCheck) > networkCheckInterval || 
                                 (attempts < 10 && attempts % 3 === 0) || // Check every 3rd attempt early on
                                 (attempts >= 10 && attempts % 6 === 0);  // Check every 6th attempt later
      
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
        
        // Determine status based on elapsed time and result status for better UX feedback
        if (elapsedMs < 15000) {
          status = 'starting'; // First 15 seconds
        } else if (result.status === 'processing' && elapsedMs > 90000) {
          status = 'finalizing'; // After 90s, likely in final stages
        } else {
          status = 'processing'; // Main processing phase
        }

        await stateManager.saveState({
          ...currentState,
          status,
          attempts
        });

        if (__DEV__) {
          const nextPollIn = Math.round(delay / 1000);
          console.log(`🔄 Video polling attempt ${attempts + 1}/${maxAttempts}: ${result.status} (${status}) - ${elapsedSeconds}s elapsed - next poll in ${nextPollIn}s`);
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
        
        // CRITICAL: Download video immediately to prevent URL expiration
        try {
          const localVideoPath = await downloadAndSaveVideo(videoUrl, prediction.id);
          
          // Update database with download status
          const userId = await getCurrentUserId();
          if (userId) {
            await supabase
              .from('user_video_jobs')
              .update({
                status: 'downloaded',
                video_url: videoUrl,
                local_video_path: localVideoPath,
                completed_at: new Date().toISOString(),
                downloaded_at: new Date().toISOString()
              })
              .eq('prediction_id', prediction.id);
          }
          
          if (__DEV__) {
            console.log('✅ Video downloaded and saved locally:', localVideoPath);
          }
        } catch (downloadError) {
          console.error('Failed to download video immediately:', downloadError);
          // Don't throw - still return the URL but log the issue
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
      
      // Conservative backoff for video generation: 5s -> 10s max for consistent UX
      delay = Math.min(delay * 1.1, 10000);
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
  
  // Estimate remaining time (assume 1-3 minutes total processing, being more conservative)
  const estimatedTotalMs = 120000; // 2 minutes average for better UX expectations
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
  
  let progressPhase = 'Preparing your video...';
  if (state.status === 'processing') {
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 1) {
      progressPhase = 'Analyzing your photo...';
    } else if (minutes < 2) {
      progressPhase = 'Creating video frames...';
    } else {
      progressPhase = 'Adding final touches...';
    }
  } else if (state.status === 'finalizing') {
    progressPhase = 'Almost ready! Finalizing your video...';
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

// Download video from Replicate URL and save locally (for app access only)
async function downloadAndSaveVideo(videoUrl: string, predictionId: string): Promise<string> {
  try {
    // Create a unique filename for the video
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `video_${predictionId}_${timestamp}.mp4`;
    const localUri = `${FileSystem.documentDirectory}videos/${fileName}`;
    
    // Ensure videos directory exists
    const videosDir = `${FileSystem.documentDirectory}videos/`;
    const dirInfo = await FileSystem.getInfoAsync(videosDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(videosDir, { intermediates: true });
    }
    
    if (__DEV__) {
      console.log('📥 Downloading video for local storage only (no auto-save to camera roll)');
    }
    
    // Download the video with progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      videoUrl,
      localUri,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (__DEV__) {
          console.log(`📥 Video download progress: ${Math.round(progress * 100)}%`);
        }
      }
    );
    
    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Failed to download video');
    }
    
    // Save video using photoStorage service (for app's internal gallery)
    await photoStorage.saveVideo(result.uri, fileName);
    
    if (__DEV__) {
      console.log('✅ Video saved locally, ready for user viewing');
    }
    
    return result.uri;
  } catch (error) {
    console.error('Error downloading video:', error);
    throw error;
  }
}

// Check for completed videos on app launch
export async function checkForCompletedVideos(): Promise<Array<{
  id: string;
  prediction_id: string;
  video_url: string;
  local_video_path: string;
  image_uri: string;
  created_at: string;
}>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    
    // Get pending videos from database
    const { data: pendingVideos, error } = await supabase
      .from('user_video_jobs')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['completed', 'processing', 'starting'])
      .is('local_video_path', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching pending videos:', error);
      return [];
    }
    
    if (!pendingVideos || pendingVideos.length === 0) {
      return [];
    }
    
    const completedVideos = [];
    
    // Check each pending video with Replicate
    for (const video of pendingVideos) {
      try {
        // Check if URL has expired (1 hour window)
        const expiresAt = new Date(video.expires_at);
        const now = new Date();
        
        if (now > expiresAt) {
          // URL expired, mark as expired
          await supabase
            .from('user_video_jobs')
            .update({ status: 'expired' })
            .eq('id', video.id);
          continue;
        }
        
        // Check prediction status with Replicate
        const prediction = await replicate.predictions.get(video.prediction_id);
        
        if (prediction.status === 'succeeded' && prediction.output) {
          // Download video immediately
          try {
            const localPath = await downloadAndSaveVideo(
              prediction.output as string,
              video.prediction_id
            );
            
            // Update database
            await supabase
              .from('user_video_jobs')
              .update({
                status: 'downloaded',
                video_url: prediction.output as string,
                local_video_path: localPath,
                completed_at: new Date().toISOString(),
                downloaded_at: new Date().toISOString()
              })
              .eq('id', video.id);
            
            completedVideos.push({
              ...video,
              video_url: prediction.output as string,
              local_video_path: localPath
            });
            
            if (__DEV__) {
              console.log('✅ Recovered completed video:', video.prediction_id);
            }
          } catch (downloadErr) {
            console.error('Failed to download recovered video:', downloadErr);
          }
        } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
          // Mark as failed
          await supabase
            .from('user_video_jobs')
            .update({ 
              status: 'failed',
              error_message: prediction.error || 'Video generation failed'
            })
            .eq('id', video.id);
        }
      } catch (checkError) {
        console.error('Error checking video status:', checkError);
      }
    }
    
    return completedVideos;
  } catch (error) {
    console.error('Error checking for completed videos:', error);
    return [];
  }
}

// Get count of ready videos for settings indicator
export async function getReadyVideosCount(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return 0;
    
    const { count, error } = await supabase
      .from('user_video_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'downloaded')
      .not('local_video_path', 'is', null);
    
    if (error) {
      console.error('Error counting ready videos:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error getting ready videos count:', error);
    return 0;
  }
}