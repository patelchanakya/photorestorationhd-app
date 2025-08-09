/**
 * Video Service Proxy - Switches between mock and real video generation
 * 
 * Set USE_MOCK_VIDEO to true to test with local video files
 * Set USE_MOCK_VIDEO to false to use real video API
 */

import { VideoGenerationOptions } from './videoGenerationService';

// Toggle this flag to switch between mock and real service
const USE_MOCK_VIDEO = false; // Set to false for real API

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
      console.log('⚡ USING REAL KLING API - This will make actual API calls!');
    }
    const { generateVideo: realGenerateVideo } = await import('./videoGenerationService');
    return realGenerateVideo(imageUri, animationPrompt, options);
  }
}

export async function cancelVideoGeneration(predictionId?: string): Promise<void> {
  if (USE_MOCK_VIDEO) {
    const { cancelMockVideoGeneration } = await import('./mockVideoService');
    return cancelMockVideoGeneration();
  } else {
    const { cancelVideoGeneration: realCancelVideo } = await import('./videoGenerationService');
    return realCancelVideo(predictionId);
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
    const { resumeVideoGenerationIfExists: realResumeVideo } = await import('./videoGenerationService');
    return realResumeVideo();
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
    const mockService = require('./mockVideoService');
    return mockService.getMockVideoGenerationProgress();
  } else {
    const realService = require('./videoGenerationService');
    return realService.getVideoGenerationProgress();
  }
}

// Export the flag so components can check which service is active
export const isUsingMockVideo = () => USE_MOCK_VIDEO;

export const getServiceInfo = () => ({
  isMock: USE_MOCK_VIDEO,
  serviceName: USE_MOCK_VIDEO ? 'Mock Video Service' : 'Real Video API',
  description: USE_MOCK_VIDEO 
    ? 'Using local test videos from assets/videos/' 
    : 'Using real Kling v2.1 API via Replicate'
});

if (__DEV__) {
  const info = getServiceInfo();
  console.log('🎬 ===============================================');
  console.log('🎬 VIDEO SERVICE PROXY INITIALIZED');
  console.log('🎬 ===============================================');
  console.log('🎬 Mode:', USE_MOCK_VIDEO ? 'MOCK (SAFE)' : 'REAL API (COSTS MONEY)');
  console.log('🎬 Service:', info.serviceName);
  console.log('🎬 Description:', info.description);
  console.log('🎬 ===============================================');
}