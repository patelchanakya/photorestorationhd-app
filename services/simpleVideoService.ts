import { canAccessFeature } from '@/services/simpleSubscriptionService';
import { getVideoTrackingId } from '@/services/trackingIds';
import { getOrCreateStableUserId } from '@/services/stableUserId';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSimpleVideoStore } from '@/store/simpleVideoStore';

// Simple video generation service - direct polling approach
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

// Helper function to process image if needed
async function processImageIfNeeded(uri: string): Promise<string> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const fileSize = 'size' in info ? (info as any).size || 0 : 0;
    
    // Get image dimensions
    const result = await ImageManipulator.manipulateAsync(uri, [], {});
    // Only limit dimensions for extreme mobile performance cases (>16K)
    const maxDimension = 16384; // Very high limit - only for mobile memory protection
    
    if (__DEV__) {
      console.log(`📸 Video image info: ${result.width}x${result.height}, ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Only process if image is extremely large (only for mobile memory protection)
    if ((result.width || 0) > maxDimension || (result.height || 0) > maxDimension) {
      if (__DEV__) {
        console.log('⚠️ Extremely large image detected (>16K), resizing for mobile memory protection');
      }
      
      const processed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxDimension } }],
        { 
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      if (__DEV__) {
        console.log('✨ Resized extremely large image for mobile memory protection');
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

interface VideoStartResponse {
  predictionId: string;
  startedAt: string;
  status: 'starting';
  etaSeconds: number;
}

interface VideoCheckResponse {
  status: 'starting' | 'processing' | 'completed' | 'failed' | 'expired';
  videoUrl?: string;
  error?: string;
  progress?: number;
  isExpired: boolean;
}

export class SimpleVideoService {
  private pollInterval: NodeJS.Timeout | null = null;
  private pendingDelayTimer: NodeJS.Timeout | null = null;
  private currentPollingSession: string | null = null;
  private pollCount = 0;
  
  // Service-level mutex to prevent concurrent operations
  private _isOperating = false;
  private _operationQueue: Array<() => Promise<void>> = [];
  
  private generateSessionId(): string {
    return `poll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Service-level mutex helpers
  private async _acquireOperationLock(): Promise<boolean> {
    if (this._isOperating) {
      console.log('🔒 Service operation blocked - already operating');
      return false;
    }
    this._isOperating = true;
    return true;
  }
  
  private _releaseOperationLock(): void {
    this._isOperating = false;
    // Process any queued operations
    if (this._operationQueue.length > 0) {
      const nextOperation = this._operationQueue.shift();
      if (nextOperation) {
        setTimeout(() => nextOperation(), 0);
      }
    }
  }
  
  private async _executeWithLock<T>(operation: () => Promise<T>): Promise<T | null> {
    if (!await this._acquireOperationLock()) {
      return null;
    }
    
    try {
      return await operation();
    } finally {
      this._releaseOperationLock();
    }
  }
  
  async startVideo(imageUri: string, prompt: string): Promise<void> {
    if (!SUPABASE_URL) {
      throw new Error('Supabase URL not configured');
    }

    console.log('🎬 Starting simple video generation...');

    // Check subscription access first
    const canAccess = await canAccessFeature('video_generation');
    if (!canAccess) {
      throw new Error('PRO subscription required for video generation');
    }

    // Get user ID for server-side validation
    let userId: string | null = null;
    try {
      userId = (await getVideoTrackingId()) || (await getOrCreateStableUserId());
    } catch (error) {
      console.warn('Failed to get user ID, using fallback');
      userId = await getOrCreateStableUserId();
    }

    // Process image
    const processedUri = await processImageIfNeeded(imageUri);
    const base64 = await imageToBase64(processedUri);
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    // Start video generation via edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/video-start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        dataUrl,
        prompt,
        modeTag: 'Life', // Simple default
        duration: 5,
        user_id: userId,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Video generation failed: ${errorText}`);
    }

    const data: VideoStartResponse = await response.json();
    
    if (!data.predictionId || !data.startedAt) {
      throw new Error('Invalid response from video generation service');
    }

    console.log('🚀 Video generation started:', { predictionId: data.predictionId });

    // Generate new session ID for this generation
    this.currentPollingSession = this.generateSessionId();
    const sessionId = this.currentPollingSession;

    // Update store state - show toast and prediction ID immediately
    const store = useSimpleVideoStore.getState();
    store.startGeneration(data.predictionId, data.startedAt, imageUri, prompt);
    
    console.log('✅ Video generation started, toast visible with prediction ID');
    console.log('⏳ Will start polling in 60 seconds (videos take 2-3 minutes anyway)');
    console.log('🎯 Session ID:', sessionId);
    
    // Start polling after 60 seconds with session validation
    this.startPollingWithDelay(data.predictionId, data.startedAt, 60000, sessionId);
  }

  private startPollingWithDelay(predictionId: string, startedAt: string, delayMs: number, sessionId: string): void {
    console.log(`🔄 Will start polling for ${predictionId} in ${delayMs/1000} seconds with session ${sessionId}`);
    
    // Cancel any existing delay timer
    if (this.pendingDelayTimer) {
      clearTimeout(this.pendingDelayTimer);
      this.pendingDelayTimer = null;
    }
    
    // Start polling after the specified delay
    this.pendingDelayTimer = setTimeout(() => {
      // Validate session is still current
      if (this.currentPollingSession !== sessionId) {
        console.log('🚫 Polling session cancelled (newer session started):', sessionId);
        return;
      }
      this.startPolling(predictionId, startedAt, sessionId);
    }, delayMs);
  }

  private startPolling(predictionId: string, startedAt: string, sessionId: string): void {
    console.log('🔄 Starting simple polling for:', predictionId);
    
    // Clear any existing polling timers
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    this.pollCount = 0;
    
    // Start first poll immediately (since we already waited)
    this.poll(predictionId, startedAt, sessionId);
  }

  private async poll(predictionId: string, startedAt: string, sessionId: string): Promise<void> {
    // Use service-level mutex for polling operations
    const result = await this._executeWithLock(async () => {
      try {
        // Validate session before doing anything
        if (this.currentPollingSession !== sessionId) {
          console.log('🚫 Poll cancelled (session changed):', sessionId);
          return;
        }
        
        const store = useSimpleVideoStore.getState();
        
        // Check expiration first (client-side safety check)
        if (store.checkExpiration()) {
          this.stopPolling();
          return;
        }

        this.pollCount++;
        
        if (__DEV__) {
          console.log(`🔍 Polling attempt ${this.pollCount} for:`, predictionId);
        }

        // Call video-check edge function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/video-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            predictionId,
            startedAt
          })
        });

        if (!response.ok) {
          throw new Error(`Video check failed: ${response.statusText}`);
        }

        const checkResult: VideoCheckResponse = await response.json();
        
        if (__DEV__) {
          console.log('📊 Poll result:', { status: checkResult.status, progress: checkResult.progress, hasVideoUrl: !!checkResult.videoUrl });
        }

        // Handle expired videos
        if (checkResult.isExpired || checkResult.status === 'expired') {
          // Clear expired videos silently (no toast)
          store.clearGeneration();
          this.stopPolling();
          return;
        }

        // Handle completed videos
        if (checkResult.status === 'completed' && checkResult.videoUrl) {
          store.completeGeneration(checkResult.videoUrl);
          this.stopPolling();
          return;
        }

        // Handle failed videos
        if (checkResult.status === 'failed') {
          store.failGeneration(checkResult.error || 'Video generation failed');
          this.stopPolling();
          return;
        }

        // Update progress for ongoing generation
        if (checkResult.status === 'processing' || checkResult.status === 'starting') {
          store.updateStatus(checkResult.status, checkResult.progress || 0);
        }

        // Continue polling with adaptive intervals
        this.scheduleNextPoll(predictionId, startedAt, sessionId);

      } catch (error: any) {
        console.error('❌ Polling error:', error);
        
        // For network errors, try a few more times with backoff
        if (this.pollCount < 10 && this.isNetworkError(error)) {
          if (__DEV__) {
            console.log(`⚠️ Network error, will retry in ${this.getRetryDelay()}ms`);
          }
          this.scheduleNextPoll(predictionId, startedAt, sessionId);
        } else {
          // Give up after too many failures
          const store = useSimpleVideoStore.getState();
          store.failGeneration(`Network error: ${error.message}`);
          this.stopPolling();
        }
      }
    });
    
    // If mutex was blocked, the operation was skipped
    if (result === null) {
      console.log('🔒 Poll operation skipped due to mutex lock');
    }
  }

  private scheduleNextPoll(predictionId: string, startedAt: string, sessionId: string): void {
    const delay = this.getPollingInterval();
    
    this.pollInterval = setTimeout(() => {
      // Validate session before polling
      if (this.currentPollingSession === sessionId) {
        this.poll(predictionId, startedAt, sessionId);
      } else {
        console.log('🚫 Scheduled poll cancelled (session changed):', sessionId);
      }
    }, delay);
  }

  private getPollingInterval(): number {
    // Adaptive polling intervals
    if (this.pollCount < 3) {
      return 3000;  // First 3 polls: 3s
    } else if (this.pollCount < 10) {
      return 5000;  // Next 7 polls: 5s
    } else {
      return 7000;  // After that: 7s
    }
  }

  private getRetryDelay(): number {
    // Exponential backoff for retries
    return Math.min(3000 * Math.pow(1.5, this.pollCount - 5), 15000);
  }

  private isNetworkError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('network') || 
           message.includes('fetch') || 
           message.includes('timeout') ||
           message.includes('connection');
  }

  stopPolling(): void {
    // Clear all timers
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.pendingDelayTimer) {
      clearTimeout(this.pendingDelayTimer);
      this.pendingDelayTimer = null;
    }
    
    // Invalidate session
    this.currentPollingSession = null;
    this.pollCount = 0;
    
    if (__DEV__) {
      console.log('🛑 All timers and sessions cleared');
    }
  }

  pausePolling(): void {
    // NEW METHOD - keeps session but stops timers (for background)
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }
    
    if (this.pendingDelayTimer) {
      clearTimeout(this.pendingDelayTimer);
      this.pendingDelayTimer = null;
    }
    
    if (__DEV__) {
      console.log('⏸️ Polling paused (session preserved)');
    }
  }

  // Resume polling for recovery scenarios (app start/foreground)
  async resumePolling(predictionId: string, startedAt: string): Promise<void> {
    console.log('🔄 Resuming polling for:', predictionId);
    
    // Use service-level mutex for resume operations
    const result = await this._executeWithLock(async () => {
      // Check if it's expired first
      const store = useSimpleVideoStore.getState();
      if (store.checkExpiration()) {
        return;
      }
      
      // Check if already polling
      if (this.currentPollingSession) {
        console.log('🚫 Resume blocked - already polling with session:', this.currentPollingSession);
        return;
      }
      
      // Generate new session for recovery
      this.currentPollingSession = this.generateSessionId();
      const sessionId = this.currentPollingSession;
      
      console.log('🎯 Recovery session ID:', sessionId);
      
      // Calculate elapsed time
      const elapsedMs = Date.now() - new Date(startedAt).getTime();
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      
      console.log(`📊 Video age: ${elapsedMinutes} minutes`);
      
      // If less than 1 minute old, wait the remaining time before polling
      if (elapsedMs < 60000) {
        const remainingDelay = 60000 - elapsedMs;
        console.log(`⏳ Video is ${Math.floor(elapsedMs/1000)}s old, waiting ${Math.floor(remainingDelay/1000)}s more before polling`);
        this.startPollingWithDelay(predictionId, startedAt, remainingDelay, sessionId);
      } else {
        // Video is old enough, start polling immediately on recovery
        console.log('🔍 Video is old enough, starting polling immediately on recovery');
        this.pollCount = Math.floor(elapsedMs / 5000); // Estimate poll count based on elapsed time
        this.startPolling(predictionId, startedAt, sessionId);
      }
    });
    
    if (result === null) {
      console.log('🔒 Resume polling skipped due to mutex lock');
    }
  }
}

// Export a singleton instance
export const simpleVideoService = new SimpleVideoService();