import { canAccessFeature } from '@/services/simpleSubscriptionService';
import { getVideoTrackingId } from '@/services/trackingIds';
import { getOrCreateStableUserId } from '@/services/stableUserId';
import { VideoGenerationOptions } from '@/types/video';
import { ANIMATION_PROMPTS, DEFAULT_ANIMATION_PROMPT, getPromptDisplayName } from '@/constants/videoPrompts';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

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
    const fileSize = 'size' in info ? (info as any).size || 0 : 0;
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
  return getPromptDisplayName(animationPrompt);
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

  // Get user ID for server-side limits validation with retry logic
  // Pro: orig:<transactionId>; Free: RC anonymous; Fallback: stable device UUID
  let actualUserId = userId;
  if (!actualUserId) {
    // Try with retry for Pro users who might have just subscribed
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        actualUserId = (await getVideoTrackingId()) || undefined;
        if (actualUserId) {
          if (__DEV__ && attempt > 1) {
            console.log(`✅ Got user ID on attempt ${attempt}:`, actualUserId ? `${actualUserId.substring(0, 15)}...` : null);
          }
          break;
        }
      } catch (e) {
        if (__DEV__) console.warn(`Attempt ${attempt} failed to get tracking ID:`, (e as any)?.message);
      }
      
      // Wait between attempts, but only if we haven't got a result
      if (!actualUserId && attempt < 3) {
        if (__DEV__) console.log(`⏳ Waiting 1s before retry attempt ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Fallback chain if still no ID
    if (!actualUserId) {
      try {
        const Purchases = await import('react-native-purchases');
        const customerInfo = await Purchases.default.getCustomerInfo();
        actualUserId = customerInfo.originalAppUserId || null as any;
      } catch (e) {
        if (__DEV__) console.warn('Failed to get RC anonymous ID, will use stable ID:', (e as any)?.message);
      }
    }
    if (!actualUserId) {
      actualUserId = await getOrCreateStableUserId();
      if (__DEV__) console.log('Using stable device user ID for video generation:', actualUserId);
    }
  }

  // Optional preflight: prevent server call if not allowed
  // Add retry mechanism to handle subscription sync timing issues
  try {
    let allowed = await canAccessFeature('video_generation');
    
    if (!allowed) {
      if (__DEV__) console.log('⛔ Preflight failed - trying once more with fresh subscription status...');
      
      // Force a fresh refresh and try again (fixes subscription sync timing issues)
      try {
        const { refreshProStatus } = await import('@/services/simpleSubscriptionService');
        const freshStatus = await refreshProStatus();
        if (__DEV__) console.log('🔄 Fresh subscription status:', { isPro: freshStatus.isPro, hasTransactionId: !!freshStatus.transactionId });
        
        // Try the access check again with fresh data
        allowed = await canAccessFeature('video_generation');
        if (__DEV__) console.log('🔄 Retry preflight result:', allowed);
      } catch (refreshError) {
        if (__DEV__) console.warn('Failed to refresh subscription for retry:', refreshError);
      }
    }
    
    if (!allowed) {
      if (__DEV__) console.log('⛔ Preflight: video_generation not allowed after retry');
      throw new Error('PRO_REQUIRED');
    } else {
      if (__DEV__) console.log('✅ Preflight: video_generation allowed');
    }
  } catch {}

  // Validate user ID format for Pro users
  if (actualUserId) {
    const isStoreFormat = actualUserId.startsWith('store:');
    const isOrigFormat = actualUserId.startsWith('orig:');
    
    if (__DEV__) {
      console.log('[VideoStart] User ID format validation:', {
        hasUserId: true,
        isStoreFormat,
        isOrigFormat,
        length: actualUserId.length,
        preview: `${actualUserId.substring(0, 15)}...`,
        expectedFormat: 'store:' + 'XXXXXXXXXXXXXXXX (16 digits)'
      });
      
      if (!isStoreFormat && !isOrigFormat) {
        console.warn('⚠️ User ID has unexpected format (not store: or orig:):', actualUserId);
      } else if (actualUserId.length < 10) {
        console.warn('⚠️ Transaction ID seems too short, may be invalid:', actualUserId);
      } else if (isStoreFormat) {
        console.log('✅ Using store: format (matches server database)');
      } else if (isOrigFormat) {
        console.log('⚠️ Using orig: format (may not match server database)');
      }
    }
  }
  
  if (__DEV__) {
    console.log('[VideoStart] Outgoing user_id:', actualUserId);
  }

  if (__DEV__) {
    console.log('[VideoStart] Making request to webhook endpoint...');
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

  if (__DEV__) {
    console.log('[VideoStart] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (__DEV__) {
      console.error('[VideoStart] Error response:', errorText);
    }
    throw new Error(`Video generation failed: ${errorText}`);
  }

  const data = await response.json();
  
  if (__DEV__) {
    console.log('[VideoStart] Success response data:', {
      predictionId: data.predictionId,
      status: data.status,
      hasError: !!data.error
    });
  }
  
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
  animationPrompt: string = DEFAULT_ANIMATION_PROMPT,
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

  // Log video URL source for debugging
  if (data.videoUrl && __DEV__) {
    const isReplicateUrl = data.videoUrl.includes('replicate.delivery');
    const isCachedUrl = data.videoUrl.includes('supabase') || data.localVideoPath;
    console.log('📹 Video URL type:', { 
      isReplicateUrl, 
      isCachedUrl, 
      hasLocalPath: !!data.localVideoPath 
    });
  }

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
  animationPrompt: string = DEFAULT_ANIMATION_PROMPT,
  options: {
    duration?: number;
    onProgress?: (progress: VideoStatusResponse) => void;
    onStart?: (predictionId: string) => void;
    timeoutMs?: number;
    userId?: string;
  } = {}
): Promise<string> {
  const { onProgress, onStart, timeoutMs = 180000, userId } = options; // 3 minute default timeout for videos
  
  if (__DEV__) {
    console.log('🚀 Starting video generation with webhook-based polling');
  }

  // Start video generation with user ID for server-side limits
  const startResponse = await generateVideo(imageUri, animationPrompt, options, userId);
  const predictionId = startResponse.prediction_id;
  try { onStart?.(predictionId); } catch {}
  
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