/**
 * Static JavaScript optimizations for Expo/React Native
 * Leveraging ESM features for better tree shaking and bundling
 */

// ✅ Static feature flags for tree shaking
export const FEATURES = {
  // These will be completely removed from production bundles when false
  ENABLE_DEBUG_LOGS: __DEV__,
  ENABLE_PERFORMANCE_MONITORING: __DEV__,
  ENABLE_MEMORY_DEBUGGING: __DEV__,
  ENABLE_VIDEO_DEBUGGING: __DEV__,
  ENABLE_ANALYTICS_LOGGING: __DEV__,
} as const;

// ✅ Environment-based constants for static optimization
export const BUILD_CONFIG = {
  IS_DEV: __DEV__,
  IS_PROD: !__DEV__,
  NODE_ENV: process.env.NODE_ENV || 'development',
  EXPO_ENV: process.env.EXPO_PUBLIC_ENV || 'development',
} as const;

// ✅ Static logging utilities that get tree-shaken in production
export const devLog = FEATURES.ENABLE_DEBUG_LOGS ? 
  (...args: any[]) => console.log(...args) : 
  () => {}; // This entire function will be removed in production

export const devWarn = FEATURES.ENABLE_DEBUG_LOGS ? 
  (...args: any[]) => console.warn(...args) : 
  () => {};

export const devError = FEATURES.ENABLE_DEBUG_LOGS ? 
  (...args: any[]) => console.error(...args) : 
  () => {};

// ✅ Performance monitoring that gets completely removed in production
export const perfMonitor = {
  start: FEATURES.ENABLE_PERFORMANCE_MONITORING ? 
    (label: string) => console.time(label) : 
    () => {},
  
  end: FEATURES.ENABLE_PERFORMANCE_MONITORING ? 
    (label: string) => console.timeEnd(label) : 
    () => {},
    
  log: FEATURES.ENABLE_PERFORMANCE_MONITORING ?
    (label: string, data: any) => console.log(`🔍 ${label}:`, data) :
    () => {},
};

// ✅ Memory debugging utilities
export const memoryDebug = {
  log: FEATURES.ENABLE_MEMORY_DEBUGGING ? 
    (...args: any[]) => console.log('🧠 Memory:', ...args) : 
    () => {},
    
  warn: FEATURES.ENABLE_MEMORY_DEBUGGING ? 
    (...args: any[]) => console.warn('🧠⚠️  Memory Warning:', ...args) : 
    () => {},
};

// ✅ Video debugging utilities  
export const videoDebug = {
  log: FEATURES.ENABLE_VIDEO_DEBUGGING ? 
    (...args: any[]) => console.log('🎬 Video:', ...args) : 
    () => {},
    
  error: FEATURES.ENABLE_VIDEO_DEBUGGING ? 
    (...args: any[]) => console.error('🎬❌ Video Error:', ...args) : 
    () => {},
};

// ✅ Analytics logging (only in dev)
export const analyticsDebug = {
  track: FEATURES.ENABLE_ANALYTICS_LOGGING ?
    (event: string, data?: any) => console.log('📊 Analytics:', event, data) :
    () => {},
};

// ✅ Static assertion helpers that get removed in production
export const devAssert = FEATURES.ENABLE_DEBUG_LOGS ?
  (condition: boolean, message: string) => {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  } :
  () => {};

// ✅ Development-only object freeze for immutability checking
export const devFreeze = <T>(obj: T): T => {
  if (FEATURES.ENABLE_DEBUG_LOGS) {
    return Object.freeze(obj);
  }
  return obj;
};

// ✅ Static feature detection for platform-specific optimizations
export const PLATFORM_FEATURES = {
  IS_IOS: process.env.EXPO_OS === 'ios',
  IS_ANDROID: process.env.EXPO_OS === 'android',
  IS_WEB: process.env.EXPO_OS === 'web',
  SUPPORTS_HAPTICS: process.env.EXPO_OS !== 'web',
  SUPPORTS_NATIVE_VIDEO: process.env.EXPO_OS !== 'web',
} as const;

// ✅ Conditional imports that will be tree-shaken when not used
export const conditionalUtils = {
  // This import will be completely removed if not used on the platform
  getHaptics: PLATFORM_FEATURES.SUPPORTS_HAPTICS ? 
    () => import('expo-haptics') : 
    () => Promise.resolve(null),
    
  // Platform-specific optimizations
  getPlatformOptimizations: PLATFORM_FEATURES.IS_IOS ?
    () => import('../services/memoryManager') :
    () => Promise.resolve({ memoryManager: null }),
};

// ✅ Static bundle size optimization helpers
export const bundleOptimizations = {
  // These will be completely inlined and optimized away
  shouldLoadFeature: (featureName: keyof typeof FEATURES): boolean => {
    return FEATURES[featureName];
  },
  
  // Platform-specific feature loading
  shouldLoadPlatformFeature: (platform: keyof typeof PLATFORM_FEATURES): boolean => {
    return PLATFORM_FEATURES[platform];
  },
};

// ✅ Export types for static analysis
export type FeatureFlag = keyof typeof FEATURES;
export type PlatformFeature = keyof typeof PLATFORM_FEATURES;
export type BuildEnv = typeof BUILD_CONFIG;