import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSimpleVideoStore } from '../store/simpleVideoStore';
import { simpleVideoService } from '../services/simpleVideoService';

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 1000; // 1 second

// Helper function for exponential backoff retry
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = MAX_RETRY_ATTEMPTS,
  baseDelay: number = BASE_RETRY_DELAY
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`⏳ Retry attempt ${attempt}/${maxAttempts} failed, waiting ${delay}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Simplified video recovery hook - just handles app foreground scenarios
export function useSimpleVideoRecovery() {
  const { currentGeneration, checkExpiration, clearGeneration } = useSimpleVideoStore();
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecoveringRef = useRef(false);

  const checkAndRecover = useCallback(async () => {
    if (!currentGeneration) {
      console.log('🔍 No pending video generation to recover');
      return;
    }

    // Prevent concurrent recovery operations
    if (isRecoveringRef.current) {
      console.log('🔒 Recovery already in progress, skipping');
      return;
    }

    isRecoveringRef.current = true;

    const { predictionId, startedAt, imageUri, prompt } = currentGeneration;
    
    const elapsedMs = Date.now() - new Date(startedAt).getTime();
    const ageMinutes = Math.floor(elapsedMs / 60000);
    
    console.log('🔄 Immediate recovery check for:', { 
      predictionId, 
      ageMinutes,
      ageSeconds: Math.floor(elapsedMs / 1000)
    });

    // Simple rule: If expired (>59 minutes), clear it. Otherwise, check status immediately
    if (checkExpiration()) {
      console.log('⏰ Video expired - clearing generation');
      clearGeneration();
      return;
    }

    // IMMEDIATELY show "Calculating ETA..." state
    const store = useSimpleVideoStore.getState();
    store.setCheckingStatus(true);
    
    console.log('🔍 Checking video status immediately on recovery...');
    
    try {
      // Use retry logic for recovery check
      const result = await retryWithBackoff(async () => {
        const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/video-check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            predictionId,
            startedAt
          })
        });

        if (!response.ok) {
          throw new Error(`Recovery check failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      });

      // Clear checking status after successful check
      store.setCheckingStatus(false);
      
      console.log('📊 Recovery check result (after retries):', result.status);
      
      if (result.isExpired || result.status === 'expired') {
        // Expired - clear everything silently and don't resume polling
        console.log('⏰ Video expired during recovery - clearing silently');
        return;
      }
      
      if (result.status === 'completed' && result.videoUrl) {
        // Completed - update state and don't resume polling
        console.log('✅ Video completed during recovery');
        store.completeGeneration(result.videoUrl);
        return;
      }
      
      if (result.status === 'failed') {
        // Failed - update state and don't resume polling
        console.log('❌ Video failed during recovery');
        store.failGeneration(result.error || 'Video generation failed');
        return;
      }
      
      // Still processing - update status and resume polling
      console.log('🔄 Video still processing - updating status and resuming polling');
      store.updateStatus(result.status === 'starting' ? 'starting' : 'processing', result.progress || 0);
      await simpleVideoService.resumePolling(predictionId, startedAt);
      
    } catch (error) {
      console.error(`❌ Recovery check failed after ${MAX_RETRY_ATTEMPTS} attempts:`, error);
      // Clear checking status
      store.setCheckingStatus(false);
      store.showErrorToast('Connection issue - falling back to polling...');
      
      // Fall back to resuming polling after all retries failed
      console.log('🔄 All retries failed, falling back to resume polling');
      await simpleVideoService.resumePolling(predictionId, startedAt);
    } finally {
      // Always clear recovery flag
      isRecoveringRef.current = false;
    }

  }, [currentGeneration, checkExpiration, clearGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  return { checkAndRecover };
}

// Auto recovery hook for app lifecycle
export function useAutoSimpleVideoRecovery() {
  const { checkAndRecover } = useSimpleVideoRecovery();
  const { currentGeneration } = useSimpleVideoStore();

  useEffect(() => {
    // Check for recovery on mount (app startup)
    console.log('📱 App started - checking for video recovery');
    checkAndRecover();
  }, [checkAndRecover]);

  useEffect(() => {
    // Check for recovery when app comes to foreground and pause timers on background
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        // Pause all timers when backgrounding to save battery
        console.log('📱 App backgrounding - pausing timers');
        simpleVideoService.pausePolling();
        
        // Store the background time for progress calculation
        if (currentGeneration) {
          const store = useSimpleVideoStore.getState();
          // We'll add this method next
          if (store.setLastBackgroundTime) {
            store.setLastBackgroundTime(Date.now());
          }
        }
        
      } else if (nextAppState === 'active') {
        console.log('📱 App foregrounded - checking for video recovery');
        // Small delay to let the app settle
        setTimeout(() => {
          checkAndRecover();
        }, 1000);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [checkAndRecover, currentGeneration]);

  return { checkAndRecover };
}