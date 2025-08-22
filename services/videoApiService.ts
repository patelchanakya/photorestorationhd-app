/**
 * Video API Service - Calls backend endpoints for secure video generation
 * 
 * This service replaces direct Replicate API calls with server-side endpoints
 * for better security, reliability, and ID consistency.
 */

import * as FileSystem from 'expo-file-system';
import { supabase } from './supabaseClient';
import { getPromptDisplayName } from '../constants/videoPrompts';
import Purchases from 'react-native-purchases';
import { VideoGenerationOptions } from '@/types/video';

// Base URL for video API endpoints
const getVideoApiBaseUrl = () => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is not configured');
  }
  return `${supabaseUrl}/functions/v1`;
};

export interface VideoStartResponse {
  predictionId: string;
  status: 'starting';
  etaSeconds: number;
}

export interface VideoStatusResponse {
  predictionId: string;
  status: 'starting' | 'processing' | 'completed' | 'downloaded' | 'failed' | 'canceled' | 'expired';
  videoUrl?: string;
  localVideoPath?: string;
  imageUri: string;
  prompt: string;
  modeTag: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  progress?: {
    elapsedSeconds: number;
    phase: string;
  };
}

export interface VideoCancelResponse {
  success: boolean;
  predictionId: string;
  status: 'canceled';
  message: string;
}

// Helper function to get auth header (disabled for now)
async function getAuthHeader(): Promise<string> {
  // For now, return empty string since JWT is disabled
  // TODO: Re-enable when proper authentication is needed
  return '';
}

// Helper function to convert image URI to data URL
async function convertImageToDataUrl(imageUri: string): Promise<string> {
  try {
    // Check if it's already a data URL
    if (imageUri.startsWith('data:')) {
      return imageUri;
    }

    // Validate the image URI exists
    const imageInfo = await FileSystem.getInfoAsync(imageUri);
    if (!imageInfo.exists) {
      throw new Error('Selected image file not found');
    }
    
    // Check file size (10MB limit)
    if (imageInfo.size && imageInfo.size > 10 * 1024 * 1024) {
      throw new Error('Image is too large. Please select an image smaller than 10MB.');
    }
    
    
    // Read the image as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Validate base64 content
    if (!base64 || base64.length < 100) {
      throw new Error('Invalid image content');
    }
    
    // Convert to data URL format
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    
    
    return dataUrl;
  } catch (error) {
    
    if (error instanceof Error) {
      throw error; // Re-throw our custom errors
    }
    
    throw new Error('Failed to process image for video generation. Please try with a different image.');
  }
}

// Helper function to extract mode tag from prompt
function extractModeTag(animationPrompt: string): string {
  return getPromptDisplayName(animationPrompt);
}

/**
 * Start video generation on the server
 */
export async function startVideoGeneration(
  imageUri: string,
  animationPrompt: string,
  options: VideoGenerationOptions = {}
): Promise<VideoStartResponse> {
  try {

    // Convert image to data URL for server processing
    const dataUrl = await convertImageToDataUrl(imageUri);
    
    // Extract mode tag for UI display
    const modeTag = extractModeTag(animationPrompt);
    
    // Get authentication header
    const authHeader = await getAuthHeader();
    
    // Prepare request payload
    const payload = {
      dataUrl,
      prompt: animationPrompt,
      modeTag,
      duration: options.duration || 5,
    };

    // Call server endpoint
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add auth header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${getVideoApiBaseUrl()}/video-start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error || `Server error: ${response.status}`;
      
      
      // Handle specific error types
      if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      } else if (response.status === 403) {
        throw new Error(errorMessage); // Usage limit or permission error
      } else if (response.status === 413) {
        throw new Error('Image is too large. Please select a smaller image.');
      }
      
      throw new Error(errorMessage);
    }

    const result: VideoStartResponse = await response.json();
    
    
    return result;
    
  } catch (error) {
    
    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to start video generation. Please try again.');
  }
}

/**
 * Get video generation status from server
 */
export async function getVideoStatus(predictionId: string): Promise<VideoStatusResponse> {
  try {
    if (!predictionId || predictionId.length < 10) {
      throw new Error('Invalid prediction ID');
    }

    // Get authentication header
    const authHeader = await getAuthHeader();
    
    // Call server endpoint  
    const headers: Record<string, string> = {};
    
    // Only add auth header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${getVideoApiBaseUrl()}/video-status/${predictionId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error || `Server error: ${response.status}`;
      
      if (response.status === 404) {
        throw new Error('Video not found');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      }
      
      throw new Error(errorMessage);
    }

    const result: VideoStatusResponse = await response.json();
    
    
    return result;
    
  } catch (error) {
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to get video status. Please try again.');
  }
}

/**
 * Cancel video generation on the server
 */
export async function cancelVideoGeneration(predictionId: string): Promise<VideoCancelResponse> {
  try {
    if (!predictionId || predictionId.length < 10) {
      throw new Error('Invalid prediction ID');
    }


    // Get authentication header
    const authHeader = await getAuthHeader();
    
    // Call server endpoint
    const headers: Record<string, string> = {};
    
    // Only add auth header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const response = await fetch(`${getVideoApiBaseUrl()}/video-cancel/${predictionId}`, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error || `Server error: ${response.status}`;
      
      if (response.status === 404) {
        throw new Error('Video not found or already completed');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please sign in again.');
      } else if (response.status === 400) {
        throw new Error(errorMessage); // Cannot cancel in current state
      }
      
      throw new Error(errorMessage);
    }

    const result: VideoCancelResponse = await response.json();
    
    
    return result;
    
  } catch (error) {
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to cancel video generation. Please try again.');
  }
}

/**
 * Poll video status until completion
 */
export async function pollVideoGeneration(
  predictionId: string,
  onProgress?: (status: VideoStatusResponse) => void,
  maxAttempts: number = 80 // 8-10 minutes with 5-7s intervals
): Promise<string> {
  let attempts = 0;
  let delay = 5000; // Start with 5 seconds
  
  while (attempts < maxAttempts) {
    try {
      const status = await getVideoStatus(predictionId);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(status);
      }
      
      // Check for completion
      if (status.status === 'completed' && status.videoUrl) {
        return status.videoUrl;
      }
      
      // Check for failure
      if (['failed', 'canceled', 'expired'].includes(status.status)) {
        const errorMessage = status.errorMessage || `Video generation ${status.status}`;
        throw new Error(errorMessage);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempts++;
      
      // Gradual backoff: 5s -> 7s max for consistent UX
      delay = Math.min(delay * 1.1, 7000);
      
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('failed') || 
        error.message.includes('canceled') ||
        error.message.includes('expired')
      )) {
        // These are final states, stop polling
        throw error;
      }
      
      // For network errors, continue polling with backoff
      attempts++;
      delay = Math.min(delay * 1.2, 10000);
      
      
      if (attempts >= maxAttempts) {
        throw new Error('Video generation timed out. Please try again.');
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Video generation took longer than expected. Please try again.');
}

// Test connectivity to video API endpoints
export async function testVideoApiConnection(): Promise<boolean> {
  try {
    const authHeader = await getAuthHeader();
    
    // Try a simple endpoint that should always work
    const response = await fetch(`${getVideoApiBaseUrl()}/video-status/test-connection`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });
    
    // Accept any response that's not a complete network failure
    return response.status !== 0;
  } catch (error) {
    return false;
  }
}

