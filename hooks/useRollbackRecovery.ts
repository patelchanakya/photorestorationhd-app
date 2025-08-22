import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { rollbackService } from '../services/rollbackService';
import NetInfo from '@react-native-community/netinfo';

/**
 * Background rollback recovery hook
 * Processes pending rollbacks that failed due to network issues or app crashes
 * Runs on app launch, foreground, and periodically when network is available
 */
export function useRollbackRecovery() {
  const processRollbacks = useCallback(async () => {
    try {
      // Check network connectivity first
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        if (__DEV__) {
          console.log('🌐 [ROLLBACK] No network connection, skipping rollback recovery');
        }
        return;
      }

      const pendingCount = await rollbackService.getPendingCount();
      if (pendingCount === 0) {
        return; // Nothing to process
      }

      if (__DEV__) {
        console.log(`🔄 [ROLLBACK] Starting recovery for ${pendingCount} pending rollbacks`);
      }

      await rollbackService.processPendingRollbacks();

      // Log completion
      const remainingCount = await rollbackService.getPendingCount();
      if (__DEV__) {
        console.log(`✅ [ROLLBACK] Recovery completed. Remaining pending: ${remainingCount}`);
      }

    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error during rollback recovery:', error);
      }
    }
  }, []);

  return { processRollbacks };
}

/**
 * Auto rollback recovery hook
 * Automatically triggers rollback recovery on app events
 */
export function useAutoRollbackRecovery() {
  const { processRollbacks } = useRollbackRecovery();

  useEffect(() => {
    // Run rollback recovery on mount (app launch)
    if (__DEV__) {
      console.log('🚀 [ROLLBACK] Starting rollback recovery on app launch');
    }
    processRollbacks();
  }, [processRollbacks]);

  useEffect(() => {
    // Run rollback recovery when app comes to foreground
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        if (__DEV__) {
          console.log('📱 [ROLLBACK] App foregrounded - checking for pending rollbacks');
        }
        setTimeout(() => {
          processRollbacks();
        }, 1500); // Delay to let app settle
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [processRollbacks]);

  useEffect(() => {
    // Set up periodic rollback processing when network becomes available
    let intervalId: NodeJS.Timeout | null = null;

    const setupPeriodicRecovery = () => {
      // Check for pending rollbacks every 5 minutes when app is active
      intervalId = setInterval(async () => {
        const appState = AppState.currentState;
        if (appState === 'active') {
          const pendingCount = await rollbackService.getPendingCount();
          if (pendingCount > 0) {
            if (__DEV__) {
              console.log(`⏰ [ROLLBACK] Periodic check found ${pendingCount} pending rollbacks`);
            }
            processRollbacks();
          }
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    // Listen for network state changes to trigger recovery when network becomes available
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        if (__DEV__) {
          console.log('🌐 [ROLLBACK] Network available - triggering rollback recovery');
        }
        
        // Process immediately when network becomes available
        setTimeout(() => {
          processRollbacks();
        }, 1000);

        // Set up periodic processing if not already active
        if (!intervalId) {
          setupPeriodicRecovery();
        }
      } else {
        // Clear periodic processing when network is unavailable
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    });

    // Initial setup if we have network
    NetInfo.fetch().then(state => {
      if (state.isConnected && state.isInternetReachable) {
        setupPeriodicRecovery();
      }
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      unsubscribeNetInfo();
    };
  }, [processRollbacks]);

  return { processRollbacks };
}

/**
 * Hook to get rollback metrics for debugging/monitoring
 */
export function useRollbackMetrics() {
  const getMetrics = useCallback(async () => {
    try {
      const metrics = await rollbackService.getMetrics();
      const pendingCount = await rollbackService.getPendingCount();
      
      return {
        ...metrics,
        currentPendingCount: pendingCount
      };
    } catch (error) {
      if (__DEV__) {
        console.error('❌ [ROLLBACK] Error getting metrics:', error);
      }
      return {
        totalAttempts: 0,
        successfulRollbacks: 0,
        failedRollbacks: 0,
        pendingRollbacks: 0,
        currentPendingCount: 0
      };
    }
  }, []);

  return { getMetrics };
}