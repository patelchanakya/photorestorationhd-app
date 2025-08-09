import { useState, useEffect, useCallback } from 'react';
import { 
  getVideoGenerationProgress, 
  cancelVideoGeneration, 
  resumeVideoGenerationIfExists,
  type VideoGenerationOptions 
} from '../services/videoServiceProxy';

export interface VideoGenerationState {
  isGenerating: boolean;
  progressPhase: string;
  elapsedSeconds: number;
  estimatedTimeRemaining?: number;
  canCancel: boolean;
  showTimeWarning: boolean;
}

export function useVideoGeneration() {
  const [state, setState] = useState<VideoGenerationState>({
    isGenerating: false,
    progressPhase: '',
    elapsedSeconds: 0,
    canCancel: false,
    showTimeWarning: false,
  });

  const [intervalId, setIntervalId] = useState<number | null>(null);

  // Update progress state
  const updateProgress = useCallback(() => {
    const progress = getVideoGenerationProgress();
    
    setState(prevState => ({
      ...prevState,
      isGenerating: progress.isGenerating,
      progressPhase: progress.progressPhase || '',
      elapsedSeconds: progress.elapsedSeconds || 0,
      canCancel: progress.isGenerating,
      showTimeWarning: progress.isGenerating, // Show warning while generating
    }));
  }, []);

  // Start monitoring progress
  const startMonitoring = useCallback(() => {
    if (intervalId) return; // Already monitoring

    const id = setInterval(updateProgress, 1000); // Update every second
    setIntervalId(id);
    updateProgress(); // Initial update
  }, [updateProgress, intervalId]);

  // Stop monitoring progress
  const stopMonitoring = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    
    setState({
      isGenerating: false,
      progressPhase: '',
      elapsedSeconds: 0,
      canCancel: false,
      showTimeWarning: false,
    });
  }, [intervalId]);

  // Cancel video generation
  const cancelGeneration = useCallback(async () => {
    try {
      await cancelVideoGeneration();
      stopMonitoring();
    } catch (error) {
      console.error('Failed to cancel video generation:', error);
      // Still stop monitoring even if cancel fails
      stopMonitoring();
    }
  }, [stopMonitoring]);

  // Check for resumable generation on mount
  useEffect(() => {
    let mounted = true;

    const checkResumable = async () => {
      try {
        const resume = await resumeVideoGenerationIfExists();
        if (mounted && resume.isResuming) {
          setState(prevState => ({
            ...prevState,
            isGenerating: true,
            estimatedTimeRemaining: resume.estimatedTimeRemaining,
            canCancel: true,
            showTimeWarning: true,
          }));
          startMonitoring();
        }
      } catch (error) {
        console.error('Failed to check resumable generation:', error);
      }
    };

    checkResumable();

    return () => {
      mounted = false;
    };
  }, [startMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  return {
    state,
    startMonitoring,
    stopMonitoring,
    cancelGeneration,
    updateProgress,
  };
}

// Helper hook for showing time warning before starting generation
export function useVideoGenerationWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const showTimeWarning = useCallback(() => {
    setShowWarning(true);
    setAcknowledged(false);
  }, []);

  const acknowledgeWarning = useCallback(() => {
    setAcknowledged(true);
    setShowWarning(false);
  }, []);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    setAcknowledged(false);
  }, []);

  return {
    showWarning,
    acknowledged,
    showTimeWarning,
    acknowledgeWarning,
    dismissWarning,
  };
}

// Generate user-friendly time messages
export function getTimeMessage(elapsedSeconds: number, phase: string): string {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  
  if (phase.includes('Starting')) {
    return `Starting... (${elapsedSeconds}s)`;
  } else if (phase.includes('Processing')) {
    if (minutes === 0) {
      return `Processing... (${seconds}s elapsed)`;
    } else {
      return `Processing... (${minutes}m ${seconds}s elapsed)`;
    }
  } else if (phase.includes('Finalizing')) {
    return `Almost ready! (${minutes}m ${seconds}s)`;
  }
  
  return phase;
}