import { useEffect } from 'react';
import { appLifecycleService } from '@/services/appLifecycleService';

/**
 * Hook to register a store's reset function with the app lifecycle service
 * This ensures the store is properly reset when the app restarts after extended backgrounding
 */
export function useStoreReset(resetFunction: () => void) {
  useEffect(() => {
    const unregister = appLifecycleService.registerStoreReset(resetFunction);
    return unregister;
  }, [resetFunction]);
}

/**
 * Hook to access lifecycle service methods for testing and debugging
 */
export function useAppLifecycleDebug() {
  return {
    forceRestart: () => appLifecycleService.forceRestart(),
    getBackgroundDuration: () => appLifecycleService.getBackgroundDuration(),
    setTestThreshold: (ms: number) => appLifecycleService.setThresholdForTesting(ms),
  };
}