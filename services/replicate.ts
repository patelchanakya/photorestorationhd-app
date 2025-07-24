import Replicate from 'replicate';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Validate API token
const apiToken = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;
if (!apiToken) {
  console.error('EXPO_PUBLIC_REPLICATE_API_TOKEN is not set in environment variables');
} else {
  if (__DEV__) {
    console.log('✅ Replicate API token loaded successfully');
  }
}

const replicate = new Replicate({
  auth: apiToken,
});

// Helper function to convert local image to base64
async function imageToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

// Helper function to get image info
async function getImageInfo(uri: string): Promise<{width: number, height: number, size: number}> {
  const info = await FileSystem.getInfoAsync(uri);
  const fileSize = info.size || 0;
  
  // Get image dimensions using ImageManipulator without modifying the image
  const result = await ImageManipulator.manipulateAsync(uri, [], {});
  
  return {
    width: result.width || 0,
    height: result.height || 0,
    size: fileSize
  };
}

// Helper function to process image only if absolutely necessary
async function processImageIfNeeded(uri: string): Promise<string> {
  try {
    const info = await getImageInfo(uri);
    const maxFileSize = 50 * 1024 * 1024; // 50MB reasonable limit
    const maxDimension = 8192; // Very high limit for dimensions
    
    if (__DEV__) {
      console.log(`📸 Image info: ${info.width}x${info.height}, ${(info.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Only process if image is extremely large
    if (info.size > maxFileSize || info.width > maxDimension || info.height > maxDimension) {
      if (__DEV__) {
        console.log('⚠️ Large image detected, applying minimal processing for API compatibility');
      }
      
      // Use minimal compression and smart resizing only for oversized images
      const transforms = [];
      if (info.width > maxDimension || info.height > maxDimension) {
        transforms.push({ resize: { width: maxDimension } });
      }
      
      const result = await ImageManipulator.manipulateAsync(
        uri,
        transforms,
        { 
          compress: 0.95, // Minimal compression
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      if (__DEV__) {
        console.log('✨ Processed large image with minimal quality loss');
      }
      
      return result.uri;
    }
    
    // For normal sized images, check if it's already JPEG
    if (uri.toLowerCase().includes('.jpg') || uri.toLowerCase().includes('.jpeg')) {
      if (__DEV__) {
        console.log('🎯 Sending original JPEG at full quality');
      }
      return uri; // Send original untouched
    }
    
    // Convert non-JPEG formats to JPEG with minimal compression
    if (__DEV__) {
      console.log('🔄 Converting to JPEG format with minimal compression');
    }
    
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [], // No resizing
      { 
        compress: 0.98, // Near-lossless compression
        format: ImageManipulator.SaveFormat.JPEG 
      }
    );
    
    return result.uri;
  } catch (error) {
    if (__DEV__) {
      console.warn('⚠️ Failed to analyze image, using original:', error);
    }
    return uri; // Fallback to original if analysis fails
  }
}

// Sleep helper for polling
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to detect content policy violations
function isContentPolicyViolation(error: string): boolean {
  const contentPolicyKeywords = [
    'sensitive',
    'inappropriate',
    'policy',
    'content',
    'blocked',
    'safety',
    'harmful',
    'violation',
    'flagged',
    'restricted',
    'not allowed',
    'prohibited'
  ];
  
  const errorLower = error.toLowerCase();
  return contentPolicyKeywords.some(keyword => errorLower.includes(keyword));
}

export async function restorePhoto(imageUri: string): Promise<string> {
  try {
    // Check if API token is available
    if (!apiToken) {
      throw new Error('Replicate API token is not configured. Please check your environment variables.');
    }

    // Process image only if absolutely necessary (preserve original quality)
    const processedUri = await processImageIfNeeded(imageUri);
    
    // Convert to base64
    const base64 = await imageToBase64(processedUri);
    
    // Create prediction
    const prediction = await replicate.predictions.create({
      model: "flux-kontext-apps/restore-image",
      input: {
        input_image: `data:image/jpeg;base64,${base64}`,
      }
    });

    // Poll for completion: 1s intervals for first 10 seconds, then exponential backoff
    let attempts = 0;
    let delay = 1000; // Start with 1 second
    const maxAttempts = 40; // Increased max attempts to accommodate new strategy
    
    while (attempts < maxAttempts) {
      await sleep(delay);
      
      const result = await replicate.predictions.get(prediction.id);
      if (__DEV__) {
        console.log(`🔄 Polling attempt ${attempts + 1}: status = ${result.status}`);
      }
      
      if (result.status === 'succeeded') {
        // The output is a URL to the restored image
        return result.output as string;
      } else if (result.status === 'failed') {
        // Check if it's a content policy violation
        const error = result.error || 'Processing failed';
        
        // Check for specific E005 error code (content flagged as sensitive)
        if (error.includes('(E005)') || error.includes('flagged as sensitive')) {
          if (__DEV__) {
            console.log('🚫 Content flagged as sensitive (E005)');
          }
          throw new Error('Image cannot be processed due to content policy restrictions. Please try with a different image.');
        }
        
        if (isContentPolicyViolation(error)) {
          throw new Error('Image cannot be processed due to content policy restrictions. Please try with a different image.');
        }
        throw new Error(error);
      } else if (result.status === 'canceled' || result.status === 'cancelled') {
        // Often indicates content was flagged/blocked
        throw new Error('Image processing was canceled due to content policy restrictions. Please try with a different image.');
      } else if (result.status === 'blocked' || result.status === 'rejected') {
        // Explicitly blocked content
        throw new Error('Image cannot be processed due to content safety restrictions. Please try with a different image.');
      } else if (result.status === 'processing' || result.status === 'starting') {
        // Continue polling for these expected statuses
        if (__DEV__) {
          console.log(`⏳ Processing... (${result.status})`);
        }
      } else {
        // Log unexpected status for debugging
        if (__DEV__) {
          console.warn(`⚠️ Unexpected status: ${result.status}`, result);
        }
        
        // If it's been more than 20 attempts with unexpected status, treat as error
        if (attempts > 20) {
          if (__DEV__) {
            console.error('🚫 Too many attempts with unexpected status, likely content issue');
          }
          throw new Error('Image processing encountered an unexpected issue. Please try with a different image.');
        }
      }
      
      attempts++;
      
      // First 10 attempts: keep 1 second intervals
      if (attempts <= 10) {
        delay = 1000;
      } else {
        // After 10 seconds, use exponential backoff with max 3 second intervals
        delay = Math.min(delay * 1.2, 3000);
      }
    }
    
    throw new Error('Processing took longer than expected. Please try again with a different image.');
  } catch (error) {
    if (__DEV__) {
      console.error('Replicate restoration error:', error);
    }
    
    // If it's already a content policy error, re-throw it
    if (error instanceof Error && error.message.includes('content policy')) {
      throw error;
    }
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthenticated')) {
        throw new Error('Authentication failed. Please contact support.');
      } else if (error.message.includes('402') || error.message.includes('Payment Required')) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        throw new Error('Too many requests. Please try again in a few minutes.');
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (isContentPolicyViolation(error.message)) {
        throw new Error('Image cannot be processed due to content policy restrictions. Please try with a different image.');
      }
    }
    
    throw error;
  }
}

// Cancel a prediction if needed
export async function cancelPrediction(predictionId: string): Promise<void> {
  try {
    await replicate.predictions.cancel(predictionId);
  } catch (error) {
    if (__DEV__) {
      console.error('Failed to cancel prediction:', error);
    }
  }
}