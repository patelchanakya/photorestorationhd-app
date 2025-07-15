import Replicate from 'replicate';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Validate API token
const apiToken = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;
if (!apiToken) {
  console.error('EXPO_PUBLIC_REPLICATE_API_TOKEN is not set in environment variables');
} else {
  console.log('✅ Replicate API token loaded successfully');
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

// Helper function to resize image if needed
async function resizeImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 2048 } }], // Max width 2048px, height will scale proportionally
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

// Sleep helper for polling
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function restorePhoto(imageUri: string): Promise<string> {
  try {
    // Check if API token is available
    if (!apiToken) {
      throw new Error('Replicate API token is not configured. Please check your environment variables.');
    }

    // Resize image if needed
    const resizedUri = await resizeImage(imageUri);
    
    // Convert to base64
    const base64 = await imageToBase64(resizedUri);
    
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
      
      if (result.status === 'succeeded') {
        // The output is a URL to the restored image
        return result.output as string;
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Processing failed');
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
    
    throw new Error('Processing timeout - took longer than expected');
  } catch (error) {
    console.error('Replicate restoration error:', error);
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('Unauthenticated')) {
        throw new Error('Authentication failed. Please check your Replicate API token.');
      } else if (error.message.includes('402') || error.message.includes('Payment Required')) {
        throw new Error('Insufficient credits. Please check your Replicate account balance.');
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.');
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
    console.error('Failed to cancel prediction:', error);
  }
}