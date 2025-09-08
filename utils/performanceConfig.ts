/**
 * Performance Configuration
 * Central configuration for all performance optimizations based on Birdie's learnings
 */

export const PERFORMANCE_CONFIG = {
  // Storage optimizations
  STORAGE: {
    DEBOUNCE_TIME_CRITICAL: 300, // For subscription updates
    DEBOUNCE_TIME_NORMAL: 500,   // For normal operations
    BATCH_SIZE: 10,              // Maximum batch size for writes
    RETRY_ATTEMPTS: 3,           // Retry failed storage operations
  },

  // Video player optimizations
  VIDEO: {
    MAX_POOL_SIZE: 4,           // Maximum concurrent video players
    CLEANUP_INTERVAL: 30000,    // Cleanup every 30 seconds
    MAX_IDLE_TIME: 300000,      // 5 minutes max idle time
    PLAYBACK_TIMEOUT: 5000,     // 5 second playback timeout
  },

  // Memory management
  MEMORY: {
    MAX_CACHE_SIZE: 50,         // Maximum cached items
    GC_INTERVAL: 60000,         // Garbage collection every minute
    LOW_MEMORY_THRESHOLD: 0.8,  // 80% memory usage threshold
  },

  // React optimizations
  REACT: {
    MEMO_EQUALITY_CHECK: true,   // Use custom equality checks
    DEBOUNCE_USER_INPUT: 300,    // Debounce user input
    THROTTLE_SCROLL: 16,         // 60fps scroll throttling
  },

  // Network optimizations
  NETWORK: {
    REQUEST_TIMEOUT: 30000,      // 30 second timeout
    RETRY_DELAY: 1000,           // 1 second retry delay
    MAX_CONCURRENT: 3,           // Max concurrent requests
  },

  // Logging optimizations
  LOGGING: {
    PRODUCTION_LOGS: false,      // Disable in production
    MAX_LOG_ENTRIES: 100,        // Maximum log entries to keep
    LOG_LEVEL: __DEV__ ? 'debug' : 'error',
  },
} as const;

/**
 * Performance monitoring thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  SLOW_OPERATION: 100,          // Operations slower than 100ms
  FRAME_DROP_THRESHOLD: 16,     // Frame drops (60fps = 16ms per frame)
  MEMORY_WARNING: 100 * 1024 * 1024, // 100MB memory warning
  EXCESSIVE_RENDERS: 5,         // More than 5 renders in 1 second
} as const;

/**
 * Feature flags for performance optimizations
 */
export const PERFORMANCE_FLAGS = {
  ENABLE_VIDEO_POOLING: true,
  ENABLE_STORAGE_BATCHING: true,
  ENABLE_REQUEST_DEDUPLICATION: true,
  ENABLE_MEMORY_MONITORING: __DEV__,
  ENABLE_INTERACTION_MANAGER: true,
} as const;

/**
 * Utility function to check if an operation is slow
 */
export const isSlowOperation = (duration: number): boolean => {
  return duration > PERFORMANCE_THRESHOLDS.SLOW_OPERATION;
};

/**
 * Utility function to format performance metrics
 */
export const formatPerformanceMetric = (value: number, unit: string): string => {
  if (unit === 'ms') {
    return `${value.toFixed(1)}ms`;
  }
  if (unit === 'bytes') {
    const mb = value / (1024 * 1024);
    return mb > 1 ? `${mb.toFixed(1)}MB` : `${(value / 1024).toFixed(1)}KB`;
  }
  return `${value} ${unit}`;
};

/**
 * Check if device is under performance pressure
 */
export const isUnderPerformancePressure = (metrics: {
  memoryUsage?: number;
  frameDrops?: number;
  slowOperations?: number;
}): boolean => {
  const { memoryUsage = 0, frameDrops = 0, slowOperations = 0 } = metrics;
  
  return (
    memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_WARNING ||
    frameDrops > 5 ||
    slowOperations > 3
  );
};