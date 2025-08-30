import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FunctionType = 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'outfit' | 'background' | 'enlighten' | 'custom' | 'restore_repair' | 'memorial';

// Webhook-based photo generation service for v2 endpoints
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

// Helper function to process image if needed (same logic as original)
async function processImageIfNeeded(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const fileSize = (info.exists && 'size' in info) ? info.size : 0;
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    
    // Get image dimensions
    const result = await ImageManipulator.manipulateAsync(uri, [], {});
    const maxDimension = 8192;
    
    if (__DEV__) {
      console.log(`📸 Image info: ${result.width}x${result.height}, ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Only process if image is extremely large
    if (fileSize > maxFileSize || (result.width || 0) > maxDimension || (result.height || 0) > maxDimension) {
      if (__DEV__) {
        console.log('⚠️ Large image detected, applying minimal processing for API compatibility');
      }
      
      const transforms = [];
      if ((result.width || 0) > maxDimension || (result.height || 0) > maxDimension) {
        transforms.push({ resize: { width: maxDimension } });
      }
      
      const processed = await ImageManipulator.manipulateAsync(
        uri,
        transforms,
        { 
          compress: 0.95,
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      if (__DEV__) {
        console.log('✨ Processed large image with minimal quality loss');
      }
      
      return processed.uri;
    }
    
    // For normal sized images, check if it's already JPEG
    if (uri.toLowerCase().includes('.jpg') || uri.toLowerCase().includes('.jpeg')) {
      if (__DEV__) {
        console.log('🎯 Sending original JPEG at full quality');
      }
      return uri;
    }
    
    // Convert non-JPEG formats to JPEG with minimal compression
    if (__DEV__) {
      console.log('🔄 Converting to JPEG format with minimal compression');
    }
    
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { 
        compress: 0.98,
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    return processed.uri;
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Failed to analyze image, using original:', error);
    }
    return uri;
  }
}

// Response types
export interface GenerationResponse {
  success: boolean;
  prediction_id: string;
  status: string;
  mode: string;
  estimated_time: string;
  style_used?: string;
  enhance_mode?: string;
  prompt_used?: string;
  error?: string;
}

export interface StatusResponse {
  success: boolean;
  prediction_id: string;
  status: string;
  mode: string;
  style_key?: string;
  progress: number;
  elapsed_seconds: number;
  output?: string;
  error?: string;
  is_complete: boolean;
  is_successful: boolean;
  has_output: boolean;
  // Mode-specific fields
  style_title?: string;
  enhance_mode?: string;
  prompt_used?: string;
  has_custom_prompt?: boolean;
}

// Generic generation function
async function callGenerationEndpoint(
  endpoint: string,
  imageUri: string,
  payload: Record<string, any>
): Promise<GenerationResponse> {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL not configured');
  }

  // Process image
  const processedUri = await processImageIfNeeded(imageUri);
  const base64 = await imageToBase64(processedUri);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      image_data: base64,
      ...payload
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Generation failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Generation failed');
  }

  return data;
}

// Outfit generation
export async function generateOutfit(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🎨 Starting outfit generation via webhook system');
    console.log('🎨 OUTFIT GENERATION PARAMS:', {
      styleKey: styleKey,
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !customPrompt && !!styleKey
    });
  }

  return callGenerationEndpoint('outfit-generation-v2', imageUri, {
    style_key: styleKey,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Background generation
export async function generateBackground(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🌅 Starting background generation via webhook system');
    console.log('🌅 BACKGROUND GENERATION PARAMS:', {
      styleKey: styleKey,
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !customPrompt && !!styleKey
    });
  }

  return callGenerationEndpoint('background-generation-v2', imageUri, {
    style_key: styleKey,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Custom generation
export async function generateCustom(
  imageUri: string,
  customPrompt: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('✨ Starting custom generation via webhook system');
  }

  if (!customPrompt) {
    throw new Error('Custom prompt is required for custom generation');
  }

  return callGenerationEndpoint('custom-generation-v2', imageUri, {
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Memorial generation
export async function generateMemorial(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🕊️ Starting memorial generation via webhook system');
    console.log('🕊️ MEMORIAL GENERATION PARAMS:', {
      styleKey: styleKey,
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !customPrompt && !!styleKey
    });
  }

  return callGenerationEndpoint('memorial-generation-v2', imageUri, {
    style_key: styleKey,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Enhance generation
export async function generateEnhance(
  imageUri: string,
  mode: 'unblur' | 'colorize' | 'descratch' | 'enlighten',
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log(`🔧 Starting ${mode} enhancement via webhook system`);
    console.log('🔧 ENHANCE GENERATION PARAMS:', {
      mode: mode,
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUsePresetPrompt: !customPrompt
    });
  }

  return callGenerationEndpoint('photo-enhance-v2', imageUri, {
    mode,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Restoration generation (uses restore-image model)
export async function generateRestoration(
  imageUri: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🔧 Starting photo restoration via webhook system');
    console.log('🔧 RESTORATION GENERATION PARAMS:', {
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseDefaultPrompt: !customPrompt
    });
  }

  return callGenerationEndpoint('photo-restoration-v2', imageUri, {
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Repair generation (uses restore-image model)
export async function generateRepair(
  imageUri: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🔧 Starting photo repair via webhook system');
  }

  return callGenerationEndpoint('photo-repair-v2', imageUri, {
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Status polling
export async function pollPhotoStatus(predictionId: string): Promise<StatusResponse> {
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/photo-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      prediction_id: predictionId
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Status check failed: ${error}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Status check failed');
  }

  return data;
}

// Helper function to determine which generation function to use
export async function generatePhoto(
  imageUri: string,
  functionType: FunctionType,
  options: {
    styleKey?: string;
    customPrompt?: string;
    userId?: string;
  } = {}
): Promise<GenerationResponse> {
  // Clear any existing prediction state before starting new generation
  // This prevents stale state from interfering with new generations
  await AsyncStorage.removeItem('activePredictionId');
  
  if (__DEV__) {
    console.log('🧹 [RECOVERY] Cleared any existing prediction state before new generation');
  }
  
  const { styleKey, customPrompt, userId } = options;

  // PROMPT LOGGING: Track which generation function is called
  if (__DEV__) {
    console.log('📡 SERVICE LAYER GENERATION:', {
      functionType: functionType,
      styleKey: styleKey,
      customPrompt: customPrompt,
      userId: userId
    });
  }

  switch (functionType) {
    case 'outfit':
      return generateOutfit(imageUri, styleKey, customPrompt, userId);
    
    case 'background':
      return generateBackground(imageUri, styleKey, customPrompt, userId);
    
    case 'memorial':
      return generateMemorial(imageUri, styleKey, customPrompt, userId);
    
    case 'custom':
      if (!customPrompt) {
        throw new Error('Custom prompt is required for custom generation');
      }
      return generateCustom(imageUri, customPrompt, userId);
    
    case 'unblur':
    case 'colorize':
    case 'descratch':
    case 'enlighten':
      return generateEnhance(imageUri, functionType, customPrompt, userId);
    
    case 'restoration':
      return generateRestoration(imageUri, customPrompt, userId);
    
    case 'repair':
      return generateRepair(imageUri, customPrompt, userId);
    
    case 'restore_repair':
      return generateRestoration(imageUri, customPrompt, userId);
    
    default:
      throw new Error(`Unsupported function type: ${functionType}`);
  }
}

// Polling wrapper with timeout and progress tracking
export async function generatePhotoWithPolling(
  imageUri: string,
  functionType: FunctionType,
  options: {
    styleKey?: string;
    customPrompt?: string;
    userId?: string;
    onProgress?: (progress: number, status: string) => void;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const { onProgress, timeoutMs = 120000 } = options; // 2 minute default timeout
  
  if (__DEV__) {
    console.log(`🚀 Starting ${functionType} generation with polling`);
  }

  // Start generation
  const startResponse = await generatePhoto(imageUri, functionType, options);
  const predictionId = startResponse.prediction_id;
  
  // Store the active prediction ID for recovery
  await AsyncStorage.setItem('activePredictionId', predictionId);
  
  if (__DEV__) {
    console.log(`✅ Generation started, prediction ID: ${predictionId}`);
    console.log('💾 [RECOVERY] Stored prediction ID for recovery');
  }

  // Poll for completion with optimized timing
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const elapsed = Date.now() - startTime;
        
        // Check timeout
        if (elapsed > timeoutMs) {
          reject(new Error('Generation timed out. Please try again.'));
          return;
        }

        // Get status
        const statusResponse = await pollPhotoStatus(predictionId);
        
        // Update progress if callback provided
        if (onProgress) {
          onProgress(statusResponse.progress, statusResponse.status);
        }

        if (__DEV__) {
          console.log(`📊 Status: ${statusResponse.status} (${statusResponse.progress}%) - ${elapsed}ms elapsed`);
        }

        // Check if complete
        if (statusResponse.is_complete) {
          if (statusResponse.is_successful && statusResponse.output) {
            if (__DEV__) {
              console.log(`🎉 Generation completed successfully: ${statusResponse.output}`);
            }
            resolve(statusResponse.output);
          } else {
            const error = statusResponse.error || 'Generation failed without error message';
            if (__DEV__) {
              console.error(`❌ Generation failed: ${error}`);
            }
            reject(new Error(error));
          }
          return;
        }

        // Determine next poll interval based on elapsed time (more aggressive)
        let nextPollInterval: number;
        if (elapsed < 5000) {
          // 0-5 seconds: Poll every 1 second (catch quick completions)
          nextPollInterval = 1000;
        } else if (elapsed < 10000) {
          // 5-10 seconds: Poll every 1.5 seconds (normal processing)
          nextPollInterval = 1500;
        } else {
          // 10+ seconds: Poll every 2 seconds (longer operations)
          nextPollInterval = 2000;
        }

        if (__DEV__) {
          console.log(`⏱️ Next poll in ${nextPollInterval/1000}s (adaptive)`);
        }

        // Continue polling with adaptive interval
        setTimeout(poll, nextPollInterval);
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Polling error:', error);
        }
        reject(error);
      }
    };

    // Wait 1 second before starting polling (reduced from 3s for better performance)
    if (__DEV__) {
      console.log('⏳ Waiting 1 second before first status check (optimization)');
    }
    
    setTimeout(() => {
      if (__DEV__) {
        console.log('🔍 Starting optimized status polling');
      }
      poll();
    }, 1000); // 1 second delay before first poll
  });
}