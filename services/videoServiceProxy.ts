/**
 * Video Service Proxy - Switches between mock and secure server-side video generation
 * 
 * Set USE_MOCK_VIDEO to true to test with local video files
 * Set USE_MOCK_VIDEO to false to use secure server-side API
 */

import { VideoGenerationOptions } from '@/types/video';

// Toggle this flag to switch between mock and real service
const USE_MOCK_VIDEO = false; // Set to false for secure server-side API

// Import services dynamically to avoid loading unused code
export async function generateVideo(
  imageUri: string,
  animationPrompt: string,
  options: VideoGenerationOptions = {}
): Promise<string> {
  if (USE_MOCK_VIDEO) {
    if (__DEV__) {
      console.log('🎭 USING MOCK VIDEO SERVICE - No real API calls will be made!');
      console.log('📸 Image:', imageUri.substring(0, 50) + '...');
      console.log('🎬 Prompt:', animationPrompt);
    }
    const { generateMockVideo } = await import('./mockVideoService');
    return generateMockVideo(imageUri, animationPrompt, options);
  } else {
    if (__DEV__) {
      console.log('🔒 USING WEBHOOK-BASED VIDEO GENERATION - API token is secure on server!');
    }
    const { generateVideoWithPolling } = await import('./videoGenerationV2');
    
    // Use webhook-based video generation with polling
    return generateVideoWithPolling(imageUri, animationPrompt, {
      duration: options.duration,
      onProgress: (status) => {
        if (__DEV__ && status.progress) {
          console.log(`⏳ Video progress: ${status.progress.phase} (${status.progress.elapsed_seconds}s)`);
        }
      },
      timeoutMs: options.timeoutMs || 180000 // 3 minute default
    });
  }
}

export async function cancelVideoGeneration(predictionId?: string): Promise<void> {
  if (USE_MOCK_VIDEO) {
    const { cancelMockVideoGeneration } = await import('./mockVideoService');
    return cancelMockVideoGeneration();
  } else {
    if (!predictionId) {
      throw new Error('Prediction ID is required for cancellation');
    }
    const { cancelVideoGeneration: webhookCancelVideo } = await import('./videoGenerationV2');
    await webhookCancelVideo(predictionId);
  }
}

export async function resumeVideoGenerationIfExists(): Promise<{
  isResuming: boolean;
  state: any;
  estimatedTimeRemaining?: number;
}> {
  if (USE_MOCK_VIDEO) {
    const { resumeMockVideoGenerationIfExists } = await import('./mockVideoService');
    return resumeMockVideoGenerationIfExists();
  } else {
    // For server-side API, resumption is handled by checking video status
    // This would typically be done by checking AsyncStorage for pending prediction IDs
    // and then calling getVideoStatus to check current state
    
    // For now, return no resumable state - the new architecture handles this differently
    return {
      isResuming: false,
      state: null,
      estimatedTimeRemaining: undefined
    };
  }
}

export function getVideoGenerationProgress(): {
  isGenerating: boolean;
  state: any;
  elapsedSeconds?: number;
  progressPhase?: string;
  progress?: number;
} {
  if (USE_MOCK_VIDEO) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mockService = require('./mockVideoService');
    return mockService.getMockVideoGenerationProgress();
  } else {
    // For server-side API, progress is handled differently
    // The client would store the current prediction ID and poll the server
    // This function is mainly used by the old architecture
    
    return {
      isGenerating: false,
      state: null,
      elapsedSeconds: undefined,
      progressPhase: undefined,
      progress: undefined
    };
  }
}

// Export the flag so components can check which service is active
export const isUsingMockVideo = () => USE_MOCK_VIDEO;

export const getServiceInfo = () => ({
  isMock: USE_MOCK_VIDEO,
  serviceName: USE_MOCK_VIDEO ? 'Mock Video Service' : 'Webhook-Based Video API',
  description: USE_MOCK_VIDEO 
    ? 'Using local test videos from assets/videos/' 
    : 'Using secure webhook-based Kling v2.1 API (no client-side token exposure)'
});

if (__DEV__) {
  const info = getServiceInfo();
  console.log('🎬 ===============================================');
  console.log('🎬 VIDEO SERVICE PROXY INITIALIZED');
  console.log('🎬 ===============================================');
  console.log('🎬 Mode:', USE_MOCK_VIDEO ? 'MOCK (SAFE)' : 'WEBHOOK-BASED API');
  console.log('🎬 Service:', info.serviceName);
  console.log('🎬 Description:', info.description);
  console.log('🎬 Security:', USE_MOCK_VIDEO ? 'N/A (Mock)' : '✅ WEBHOOK SYSTEM WITH SECURE SERVER TOKENS');
  console.log('🎬 ===============================================');
}