/**
 * Production Memory Manager for iOS/Android
 * Handles memory pressure and prevents app crashes
 */

import { AppState, Platform } from 'react-native';
import { devLog, devWarn, memoryDebug, FEATURES, BUILD_CONFIG } from '../utils/staticOptimizations';

class MemoryManager {
  private memoryPressureCallbacks: Set<() => void> = new Set();
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  private isInBackground = false;
  private lastMemoryWarning = 0;

  constructor() {
    this.setupMemoryPressureHandling();
    this.setupAppStateHandling();
  }

  private setupMemoryPressureHandling() {
    // iOS memory pressure handling
    if (Platform.OS === 'ios') {
      try {
        // Listen for memory warnings (requires native module in production)
        // For now, implement aggressive cleanup on app state changes
        this.registerMemoryPressureCallback(() => {
          if (__DEV__) {
            console.log('🧠 Memory pressure detected - triggering cleanup');
          }
          this.triggerMemoryCleanup();
        });
      } catch (error) {
        // Native memory warning not available
      }
    }

    // Android memory handling
    if (Platform.OS === 'android') {
      // Monitor app state more aggressively on Android
      this.registerMemoryPressureCallback(() => {
        this.triggerMemoryCleanup();
      });
    }
  }

  private setupAppStateHandling() {
    AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = this.isInBackground;
      this.isInBackground = nextAppState === 'background' || nextAppState === 'inactive';

      if (this.isInBackground && !wasBackground) {
        // App went to background - aggressive cleanup
        this.onAppBackground();
      } else if (!this.isInBackground && wasBackground) {
        // App came to foreground - delayed recovery
        this.onAppForeground();
      }
    });
  }

  private onAppBackground() {
    memoryDebug.log('📱 App backgrounded - starting memory cleanup');

    // Immediate cleanup
    this.triggerMemoryCleanup();

    // Aggressive cleanup after 5 seconds in background
    this.backgroundTimer = setTimeout(() => {
      if (this.isInBackground) {
        this.triggerAggressiveCleanup();
      }
    }, 5000);
  }

  private onAppForeground() {
    memoryDebug.log('📱 App foregrounded - clearing background cleanup');

    if (this.backgroundTimer) {
      clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
    }

    // Delayed recovery to avoid immediate resource contention
    setTimeout(() => {
      this.notifyForegroundRecovery();
    }, 500);
  }

  registerMemoryPressureCallback(callback: () => void) {
    this.memoryPressureCallbacks.add(callback);
    
    return () => {
      this.memoryPressureCallbacks.delete(callback);
    };
  }

  triggerMemoryCleanup() {
    const now = Date.now();
    
    // Prevent spam cleanup calls
    if (now - this.lastMemoryWarning < 1000) {
      return;
    }
    this.lastMemoryWarning = now;

    // Notify all registered components to clean up
    this.memoryPressureCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        devWarn('Memory cleanup callback error:', error);
      }
    });

    // Force garbage collection in development (will be completely removed in production)
    if (FEATURES.ENABLE_MEMORY_DEBUGGING && (global as any).gc) {
      (global as any).gc();
      memoryDebug.log('Forced garbage collection');
    }
  }

  private triggerAggressiveCleanup() {
    memoryDebug.warn('🧠 Aggressive memory cleanup - app backgrounded for 5+ seconds');
    
    // More aggressive cleanup for long background periods
    this.triggerMemoryCleanup();
    
    // Additional cleanup specific to video resources
    this.cleanupVideoResources();
  }

  private cleanupVideoResources() {
    // Global video cleanup - will be implemented by video components
    if (global.__videoCleanupCallbacks) {
      global.__videoCleanupCallbacks.forEach((cleanup: () => void) => {
        try {
          cleanup();
        } catch (error) {
          // Silent cleanup
        }
      });
    }
  }

  private notifyForegroundRecovery() {
    // Notify components they can recover resources
    if (global.__foregroundRecoveryCallbacks) {
      global.__foregroundRecoveryCallbacks.forEach((recovery: () => void) => {
        try {
          recovery();
        } catch (error) {
          // Silent recovery
        }
      });
    }
  }

  // Manual memory cleanup trigger for components
  requestMemoryCleanup() {
    this.triggerMemoryCleanup();
  }

  // Get current memory pressure state
  isUnderMemoryPressure(): boolean {
    return this.isInBackground || (Date.now() - this.lastMemoryWarning < 10000);
  }

  // Register global cleanup callbacks for video components
  registerVideoCleanup(cleanup: () => void) {
    if (!global.__videoCleanupCallbacks) {
      global.__videoCleanupCallbacks = new Set();
    }
    global.__videoCleanupCallbacks.add(cleanup);

    return () => {
      global.__videoCleanupCallbacks?.delete(cleanup);
    };
  }

  registerForegroundRecovery(recovery: () => void) {
    if (!global.__foregroundRecoveryCallbacks) {
      global.__foregroundRecoveryCallbacks = new Set();
    }
    global.__foregroundRecoveryCallbacks.add(recovery);

    return () => {
      global.__foregroundRecoveryCallbacks?.delete(recovery);
    };
  }
}

export const memoryManager = new MemoryManager();

import React from 'react';

// Global memory management hooks for components
export const useMemoryPressure = (onMemoryPressure: () => void) => {
  React.useEffect(() => {
    return memoryManager.registerMemoryPressureCallback(onMemoryPressure);
  }, [onMemoryPressure]);
};

export const useVideoCleanup = (cleanup: () => void) => {
  React.useEffect(() => {
    return memoryManager.registerVideoCleanup(cleanup);
  }, [cleanup]);
};

// Declare global types
declare global {
  var __videoCleanupCallbacks: Set<() => void>;
  var __foregroundRecoveryCallbacks: Set<() => void>;
}