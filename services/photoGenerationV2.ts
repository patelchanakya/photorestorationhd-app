import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export type FunctionType = 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'outfit' | 'background' | 'enlighten' | 'custom' | 'restore_repair' | 'memorial' | 'water_damage' | 'nano_banana' | 'nano_background' | 'nano_outfit' | 'nano_memorial';

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

// Helper function for enhanced logging with timestamps
function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS format
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
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
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`Generation failed: ${errorText}`);
    }
    
    // Preserve error code for UI handling
    const error = new Error(errorData.error || 'Generation failed');
    (error as any).code = errorData.code;
    throw error;
  }

  const data = await response.json();
  
  if (!data.success) {
    // Preserve error code for UI handling
    const error = new Error(data.error || 'Generation failed');
    (error as any).code = data.code;
    throw error;
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

// Nano Background generation
export async function generateNanoBackground(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🎨 Starting nano-background generation via webhook system');
    console.log('🎨 NANO BACKGROUND PARAMS:', {
      styleKey,
      customPrompt,
      hasCustomPrompt: !!customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !!styleKey && !customPrompt
    });
  }

  return callGenerationEndpoint('nano-background-v2', imageUri, {
    style_key: styleKey,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Nano Outfit generation
export async function generateNanoOutfit(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('👔 Starting nano-outfit generation via webhook system');
    console.log('👔 NANO OUTFIT PARAMS:', {
      styleKey,
      customPrompt,
      hasCustomPrompt: !!customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !!styleKey && !customPrompt
    });
  }

  return callGenerationEndpoint('nano-outfit-v2', imageUri, {
    style_key: styleKey,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Nano-memorial generation
export async function generateNanoMemorial(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🕊️ Starting nano-memorial generation via webhook system');
    console.log('🕊️ NANO MEMORIAL PARAMS:', {
      styleKey,
      customPrompt,
      hasCustomPrompt: !!customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !!styleKey && !customPrompt
    });
  }

  return callGenerationEndpoint('nano-memorial-v2', imageUri, {
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

// Water damage generation (supports custom prompts)
export async function generateWaterDamage(
  imageUri: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('💧 Starting water damage restoration via webhook system');
  }

  return callGenerationEndpoint('photo-water-damage-v2', imageUri, {
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Nano-banana generation
export async function generateNanoBanana(
  imageUri: string,
  styleKey?: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🍌 Starting nano-banana generation via webhook system');
    console.log('🍌 NANO-BANANA GENERATION PARAMS:', {
      styleKey: styleKey,
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseStyleKey: !customPrompt && !!styleKey
    });
  }

  return callGenerationEndpoint('nano-banana-v2', imageUri, {
    style_key: styleKey,
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Nano-repair generation (replaces photo-repair-v2)
export async function generateNanoRepair(
  imageUri: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🔧 Starting nano-repair generation via webhook system');
    console.log('🔧 NANO-REPAIR GENERATION PARAMS:', {
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseDefaultPrompt: !customPrompt
    });
  }

  return callGenerationEndpoint('nano-repair-v2', imageUri, {
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Nano-restoration generation (replaces photo-restoration-v2)
export async function generateNanoRestoration(
  imageUri: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('🏛️ Starting nano-restoration generation via webhook system');
    console.log('🏛️ NANO-RESTORATION GENERATION PARAMS:', {
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseDefaultPrompt: !customPrompt
    });
  }

  return callGenerationEndpoint('nano-restoration-v2', imageUri, {
    custom_prompt: customPrompt,
    user_id: userId
  });
}

// Nano-water-damage generation (replaces photo-water-damage-v2)
export async function generateNanoWaterDamage(
  imageUri: string,
  customPrompt?: string,
  userId?: string
): Promise<GenerationResponse> {
  if (__DEV__) {
    console.log('💧 Starting nano-water-damage generation via webhook system');
    console.log('💧 NANO-WATER-DAMAGE GENERATION PARAMS:', {
      hasCustomPrompt: !!customPrompt,
      customPrompt: customPrompt,
      willUseCustomPrompt: !!customPrompt,
      willUseDefaultPrompt: !customPrompt
    });
  }

  return callGenerationEndpoint('nano-water-damage-v2', imageUri, {
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
  // The usePhotoRestoration hook handles clearing and storing prediction IDs
  // No need to clear here as it creates a gap where no prediction ID exists
  
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
      // NANO MIGRATION: Switch to generateNanoRestoration(imageUri, customPrompt, userId);
    
    case 'repair':
      return generateRepair(imageUri, customPrompt, userId);
      // NANO MIGRATION: Switch to generateNanoRepair(imageUri, customPrompt, userId);
    
    case 'restore_repair':
      return generateNanoBanana(imageUri, undefined, undefined, userId);
      // OLD KONTEXT: return generateRepair(imageUri, customPrompt, userId); // Used flux-kontext-apps/restore-image
      // NANO MIGRATION: Now using nano-banana for modern photo restoration
    
    case 'water_damage':
      return generateWaterDamage(imageUri, customPrompt, userId);
      // NANO MIGRATION: Switch to generateNanoWaterDamage(imageUri, customPrompt, userId);
    
    case 'nano_banana':
      return generateNanoBanana(imageUri, styleKey, customPrompt, userId);
    
    case 'nano_background':
      return generateNanoBackground(imageUri, styleKey, customPrompt, userId);

    case 'nano_outfit':
      return generateNanoOutfit(imageUri, styleKey, customPrompt, userId);

    case 'nano_memorial':
      return generateNanoMemorial(imageUri, styleKey, customPrompt, userId);

    default:
      throw new Error(`Unsupported function type: ${functionType}`);
  }
}

// Helper function to continue polling an existing prediction
async function continuePollingExisting(
  predictionId: string,
  timeoutMs: number,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > timeoutMs) {
          reject(new Error('Generation timed out. Please try again.'));
          return;
        }
        
        const status = await pollPhotoStatus(predictionId);
        
        if (onProgress) {
          onProgress(status.progress, status.status);
        }
        
        if (__DEV__) {
          console.log(`📊 Polling existing: ${status.status} (${status.progress}%) - ${elapsed}ms elapsed`);
        }
        
        if (status.is_complete) {
          if (status.is_successful && status.output) {
            // Clear storage on completion
            await AsyncStorage.removeItem('activePredictionId');
            await AsyncStorage.removeItem('predictionContext');
            if (__DEV__) {
              console.log(`🎉 Existing prediction completed: ${status.output}`);
            }
            resolve(status.output);
          } else {
            const error = status.error || 'Generation failed without error message';
            if (__DEV__) {
              console.error(`❌ Existing prediction failed: ${error}`);
            }
            reject(new Error(error));
          }
          return;
        }
        
        // Adaptive polling intervals
        let nextInterval: number;
        if (elapsed < 5000) {
          nextInterval = 1000;
        } else if (elapsed < 10000) {
          nextInterval = 1500;
        } else {
          nextInterval = 2000;
        }
        
        setTimeout(poll, nextInterval);
      } catch (error) {
        // Handle network errors from backgrounding gracefully
        if (error instanceof Error && error.message?.includes('Network request failed')) {
          if (__DEV__) {
            logWithTimestamp('📱 Network interrupted during existing prediction polling (likely backgrounded) - prediction still stored for recovery');
          }
          // Don't reject - the prediction is still processing on Replicate
          // Recovery will handle it when app resumes with network
          return;
        }
        
        if (__DEV__) {
          console.error('❌ Error polling existing prediction:', error);
        }
        reject(error);
      }
    };
    
    // Start polling immediately (no delay for existing)
    poll();
  });
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
    logWithTimestamp(`🚀 Starting ${functionType} generation with polling`);
  }

  // Check for existing prediction BEFORE creating new
  const existingPredictionId = await AsyncStorage.getItem('activePredictionId');
  const existingContext = await AsyncStorage.getItem('predictionContext');
  
  if (existingPredictionId && existingContext) {
    try {
      const context = JSON.parse(existingContext);
      
      // Check if same request (all params must match)
      const isSameRequest = 
        context.imageUri === imageUri && 
        context.functionType === functionType &&
        context.styleKey === (options.styleKey || null) &&
        context.customPrompt === (options.customPrompt || null);
      
      if (isSameRequest) {
        // Check actual status from Replicate
        const status = await pollPhotoStatus(existingPredictionId);
        
        if (status.status === 'processing' || status.status === 'starting') {
          // Continue polling existing - NO NEW API CALL
          if (__DEV__) {
            logWithTimestamp(`🔄 Found active prediction: ${existingPredictionId}, continuing to poll`, {
              status: status.status,
              progress: status.progress
            });
          }
          return continuePollingExisting(existingPredictionId, timeoutMs, onProgress);
        }
        
        if (status.status === 'succeeded' && status.output) {
          // Already done - return immediately
          if (__DEV__) {
            logWithTimestamp(`✅ Found completed prediction: ${existingPredictionId}`, {
              output_length: status.output.length
            });
          }
          await AsyncStorage.removeItem('activePredictionId');
          await AsyncStorage.removeItem('predictionContext');
          return status.output;
        }
        
        // Failed/canceled - clear and allow retry
        if (status.status === 'failed' || status.status === 'canceled') {
          if (__DEV__) {
            logWithTimestamp(`🧹 Clearing ${status.status} prediction: ${existingPredictionId}`, {
              error: status.error
            });
          }
          await AsyncStorage.removeItem('activePredictionId');
          await AsyncStorage.removeItem('predictionContext');
          // Falls through to create new
        }
      } else {
        // Different request - user wants something else
        if (__DEV__) {
          logWithTimestamp('🔄 Different request detected, clearing old prediction tracking', {
            existing_function: context.functionType,
            new_function: functionType,
            existing_image: context.imageUri?.substring(0, 30) + '...',
            new_image: imageUri?.substring(0, 30) + '...'
          });
        }
        await AsyncStorage.removeItem('activePredictionId');
        await AsyncStorage.removeItem('predictionContext');
      }
    } catch (error) {
      // If check fails, clear and continue
      if (__DEV__) {
        logWithTimestamp('⚠️ Error checking existing prediction:', error);
      }
      await AsyncStorage.removeItem('activePredictionId');
      await AsyncStorage.removeItem('predictionContext');
    }
  }

  // Only create new if no valid existing
  if (__DEV__) {
    logWithTimestamp(`🚀 Creating new ${functionType} generation`, {
      function_type: functionType,
      has_style_key: !!options.styleKey,
      has_custom_prompt: !!options.customPrompt
    });
  }
  const startResponse = await generatePhoto(imageUri, functionType, options);
  const predictionId = startResponse.prediction_id;
  
  // Store the prediction ID AND context for recovery
  await AsyncStorage.setItem('activePredictionId', predictionId);
  await AsyncStorage.setItem('predictionContext', JSON.stringify({
    imageUri,
    functionType,
    styleKey: options.styleKey || null,
    customPrompt: options.customPrompt || null,
    timestamp: Date.now()
  }));
  
  if (__DEV__) {
    logWithTimestamp(`✅ Generation started, prediction ID: ${predictionId}`);
    logWithTimestamp('💾 [RECOVERY] Stored prediction ID and context for recovery', {
      prediction_id: predictionId,
      image_uri: imageUri.substring(0, 30) + '...',
      function_type: functionType
    });
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
            // Clear storage on completion
            await AsyncStorage.removeItem('activePredictionId');
            await AsyncStorage.removeItem('predictionContext');
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
        // Handle network errors from backgrounding gracefully
        if (error instanceof Error && error.message?.includes('Network request failed')) {
          if (__DEV__) {
            logWithTimestamp('📱 Network interrupted during polling (likely backgrounded) - prediction still stored for recovery');
          }
          // Don't reject - the prediction is still processing on Replicate
          // Recovery will handle it when app resumes with network
          return;
        }
        
        if (__DEV__) {
          console.error('❌ Polling error:', error);
        }
        reject(error);
      }
    };

    // Wait 2.5 seconds before starting polling for better optimization
    if (__DEV__) {
      console.log('⏳ Waiting 2.5 seconds before first status check (optimization)');
    }
    
    setTimeout(() => {
      if (__DEV__) {
        console.log('🔍 Starting optimized status polling');
      }
      poll();
    }, 2500); // 2.5 second delay before first poll
  });
}