import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { VideoGenerationOptions } from '@/types/video';

// Webhook-based video generation service for secure server-side generation
// This replaces the client-side polling approach with secure server-side generation

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('EXPO_PUBLIC_SUPABASE_URL is not set in environment variables');
}
if (!SUPABASE_ANON_KEY) {
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set in environment variables');
}

// Helper function to convert local image to base64
async function imageToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

// Helper function to process image if needed (same logic as photos)
async function processImageIfNeeded(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const fileSize = info.size || 0;
    const maxFileSize = 10 * 1024 * 1024; // 10MB for videos (smaller than photos)
    
    // Get image dimensions
    const result = await ImageManipulator.manipulateAsync(uri, [], {});
    const maxDimension = 4096; // Smaller max for video generation
    
    if (__DEV__) {
      console.log(`📸 Video image info: ${result.width}x${result.height}, ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Only process if image is large
    if (fileSize > maxFileSize || (result.width || 0) > maxDimension || (result.height || 0) > maxDimension) {
      if (__DEV__) {
        console.log('⚠️ Large image detected, applying processing for video API compatibility');
      }
      
      const transforms = [];
      if ((result.width || 0) > maxDimension || (result.height || 0) > maxDimension) {
        transforms.push({ resize: { width: maxDimension } });
      }
      
      const processed = await ImageManipulator.manipulateAsync(
        uri,
        transforms,
        { 
          compress: 0.9, // Slightly higher compression for videos
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      if (__DEV__) {
        console.log('✨ Processed large image for video generation');
      }
      
      return processed.uri;
    }
    
    // For normal sized images, check if it's already JPEG
    if (uri.toLowerCase().includes('.jpg') || uri.toLowerCase().includes('.jpeg')) {
      if (__DEV__) {
        console.log('🎯 Sending original JPEG for video generation');
      }
      return uri;
    }
    
    // Convert non-JPEG formats to JPEG
    if (__DEV__) {
      console.log('🔄 Converting to JPEG format for video generation');
    }
    
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { 
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    return processed.uri;
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Failed to analyze image for video generation, using original:', error);
    }
    return uri;
  }
}

// Response types
export interface VideoGenerationResponse {
  success: boolean;
  prediction_id: string;
  status: string;
  eta_seconds: number;
  mode_tag: string;
  error?: string;
}

export interface VideoStatusResponse {
  success: boolean;
  prediction_id: string;
  status: string;
  mode_tag: string;
  progress?: {
    elapsed_seconds: number;
    phase: string;
  };
  video_url?: string;
  image_uri: string;
  prompt: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  is_complete: boolean;
  is_successful: boolean;
  has_output: boolean;
}

// Helper function to extract mode tag from animation prompt
function extractModeTag(animationPrompt: string): string {
  const promptModeMap: { [key: string]: string } = {
    'animate with a warm hug gesture': 'Hug',
    'animate as a group celebration': 'Group',
    'animate with love and affection': 'Love',
    'animate with dancing movements': 'Dance',
    'animate with fun and playful movements': 'Fun',
    'animate with a warm smile': 'Smile',
    'bring this photo to life with natural animation': 'Life'
  };
  
  return promptModeMap[animationPrompt] || 'Life';
}

// Generic video generation function
async function callVideoGenerationEndpoint(
  imageUri: string,
  animationPrompt: string,
  options: VideoGenerationOptions = {},
  userId?: string
): Promise<VideoGenerationResponse> {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL not configured');
  }

  // Process image
  const processedUri = await processImageIfNeeded(imageUri);
  const base64 = await imageToBase64(processedUri);
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  // Extract mode tag for UI display
  const modeTag = extractModeTag(animationPrompt);

  // Get user ID for server-side limits validation
  let actualUserId = userId;
  if (!actualUserId) {
    try {
      // Try to get user ID from RevenueCat
      const Purchases = await import('react-native-purchases');
      actualUserId = await Purchases.default.getAppUserID();
    } catch (error) {
      if (__DEV__) {
        console.warn('Could not get user ID from RevenueCat:', error);
      }
      actualUserId = 'fallback-anonymous';
    }
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/video-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      dataUrl,
      prompt: animationPrompt,
      modeTag,
      duration: options.duration || 5,
      user_id: actualUserId, // Send user ID for server-side limits
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video generation failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.predictionId) {
    throw new Error(data.error || 'Video generation failed');
  }

  return {
    success: true,
    prediction_id: data.predictionId,
    status: data.status || 'starting',
    eta_seconds: data.etaSeconds || 120,
    mode_tag: modeTag
  };
}

// Video generation function
export async function generateVideo(
  imageUri: string,
  animationPrompt: string = 'bring this photo to life with natural animation',
  options: VideoGenerationOptions = {},
  userId?: string
): Promise<VideoGenerationResponse> {
  if (__DEV__) {
    console.log('🎬 Starting video generation via webhook system');
  }

  return callVideoGenerationEndpoint(imageUri, animationPrompt, options, userId);
}

// Status polling
export async function pollVideoStatus(predictionId: string): Promise<VideoStatusResponse> {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/video-status/${predictionId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video status check failed: ${error}`);
  }

  const data = await response.json();
  
  // Transform the response to match our expected format
  const isComplete = ['completed', 'failed', 'canceled', 'expired'].includes(data.status);
  const isSuccessful = data.status === 'completed' && !!data.videoUrl;
  const hasOutput = !!data.videoUrl;

  return {
    success: true,
    prediction_id: data.predictionId,
    status: data.status,
    mode_tag: data.modeTag || 'Life',
    progress: data.progress,
    video_url: data.videoUrl,
    image_uri: data.imageUri,
    prompt: data.prompt,
    created_at: data.createdAt,
    completed_at: data.completedAt,
    error_message: data.errorMessage,
    is_complete: isComplete,
    is_successful: isSuccessful,
    has_output: hasOutput
  };
}

// Polling wrapper with timeout and progress tracking (optimized for videos)
export async function generateVideoWithPolling(
  imageUri: string,
  animationPrompt: string = 'bring this photo to life with natural animation',
  options: {
    duration?: number;
    onProgress?: (progress: VideoStatusResponse) => void;
    timeoutMs?: number;
    userId?: string;
  } = {}
): Promise<string> {
  const { onProgress, timeoutMs = 180000, userId } = options; // 3 minute default timeout for videos
  
  if (__DEV__) {
    console.log('🚀 Starting video generation with webhook-based polling');
  }

  // Start video generation with user ID for server-side limits
  const startResponse = await generateVideo(imageUri, animationPrompt, options, userId);
  const predictionId = startResponse.prediction_id;
  
  if (__DEV__) {
    console.log(`✅ Video generation started, prediction ID: ${predictionId}`);
  }

  // Poll for completion with video-optimized timing
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const elapsed = Date.now() - startTime;
        
        // Check timeout
        if (elapsed > timeoutMs) {
          reject(new Error('Video generation timed out. Please try again.'));
          return;
        }

        // Get status
        const statusResponse = await pollVideoStatus(predictionId);
        
        // Update progress if callback provided
        if (onProgress) {
          onProgress(statusResponse);
        }

        if (__DEV__) {
          console.log(`📊 Video status: ${statusResponse.status} - ${elapsed}ms elapsed`);
        }

        // Check if complete
        if (statusResponse.is_complete) {
          if (statusResponse.is_successful && statusResponse.video_url) {
            if (__DEV__) {
              console.log(`🎉 Video generation completed successfully: ${statusResponse.video_url}`);
            }
            resolve(statusResponse.video_url);
          } else {
            const error = statusResponse.error_message || 'Video generation failed without error message';
            if (__DEV__) {
              console.error(`❌ Video generation failed: ${error}`);
            }
            reject(new Error(error));
          }
          return;
        }

        // Determine next poll interval based on elapsed time (optimized for videos)
        let nextPollInterval: number;
        if (elapsed < 10000) {
          // 0-10 seconds: Poll every 3 seconds (videos are slower than photos)
          nextPollInterval = 3000;
        } else if (elapsed < 30000) {
          // 10-30 seconds: Poll every 5 seconds (normal video processing)
          nextPollInterval = 5000;
        } else {
          // 30+ seconds: Poll every 7 seconds (longer video operations)
          nextPollInterval = 7000;
        }

        if (__DEV__) {
          console.log(`⏱️ Next video poll in ${nextPollInterval/1000}s (adaptive)`)
        }

        // Continue polling with adaptive interval
        setTimeout(poll, nextPollInterval);
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Video polling error:', error);
        }
        reject(error);
      }
    };

    // Wait 5 seconds before starting polling (videos never complete faster than this)
    if (__DEV__) {
      console.log('⏳ Waiting 5 seconds before first video status check (optimization)');
    }
    
    setTimeout(() => {
      if (__DEV__) {
        console.log('🔍 Starting optimized video status polling');
      }
      poll();
    }, 5000); // 5 second delay before first poll for videos
  });
}

// Video cancellation
export async function cancelVideoGeneration(predictionId: string): Promise<void> {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/video-cancel/${predictionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Video cancellation failed: ${error}`);
  }

  if (__DEV__) {
    console.log(`🛑 Video generation canceled: ${predictionId}`);
  }
}