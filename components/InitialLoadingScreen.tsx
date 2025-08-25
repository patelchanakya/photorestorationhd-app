import { analyticsService } from '@/services/analytics';
// import { backToLifeService } from '@/services/backToLifeService'; // REMOVED - service deleted
import { networkStateService } from '@/services/networkState';
import { notificationService } from '@/services/notificationService';
import { permissionsService } from '@/services/permissions';
import { checkSubscriptionStatus, getCurrentSubscriptionTransactionInfo } from '@/services/revenuecat';
import { refreshProStatus } from '@/services/simpleSubscriptionService';
// Removed: No longer using stable IDs - RevenueCat handles anonymous IDs automatically
import { useRevenueCat } from '@/contexts/RevenueCatContext';
// import { useVideoToastStore } from '@/store/videoToastStore';
import { onboardingUtils } from '@/utils/onboarding';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
// Removed video imports - using simple loading state
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, Text, View } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Global initialization guards to prevent multiple initializations
let hasInitializedGlobally = false;
let initializationPromise: Promise<void> | null = null;


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InitialLoadingScreenProps {
  onLoadingComplete: () => void;
}

export default function InitialLoadingScreen({ onLoadingComplete }: InitialLoadingScreenProps) {
  const router = useRouter();
  const { isPro, isLoading, refreshCustomerInfo } = useRevenueCat();
  const insets = useSafeAreaInsets();

  // Helper function to navigate based on onboarding status
  const navigateToApp = async () => {
    try {
      // Pro users skip onboarding
      if (isPro) {
        if (__DEV__) {
          console.log('🎯 Pro user detected - skipping onboarding');
          // Log transaction info for Pro users
          getCurrentSubscriptionTransactionInfo().catch(() => {});
        }
        router.replace('/explore');
        return;
      }

      // Check if user has completed onboarding OR wants to always skip
      const [hasSeenOnboarding, alwaysSkip, alwaysShow] = await Promise.all([
        onboardingUtils.hasSeenOnboarding(),
        onboardingUtils.getAlwaysSkipOnboarding(),
        onboardingUtils.getAlwaysShowOnboarding(),
      ]);
      
      if (!alwaysShow && (hasSeenOnboarding || alwaysSkip)) {
        if (__DEV__) {
          console.log('🎯 User has seen onboarding - going to explore');
        }
        router.replace('/explore');
      } else {
        if (__DEV__) {
          console.log('🎯 New user - showing onboarding');
        }
        router.replace('/onboarding-v2');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Navigation error, defaulting to explore:', error);
      }
      router.replace('/explore');
    }
  };
  
  // Simple retry helper to harden startup against transient failures
  const retry = async <T,>(fn: () => Promise<T>, attempts: number = 2, delayMs: number = 700): Promise<T> => {
    let lastError: any;
    for (let i = 0; i <= attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        if (i < attempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
      }
    }
    throw lastError;
  };

  // Animation values
  const titleOpacity = useSharedValue(0); // Tagline opacity
  const titleTranslateY = useSharedValue(16); // Tagline translate
  const loadingOpacity = useSharedValue(0);
  const dotsOpacity = useSharedValue(1);
  const checkOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0.8);
  // Removed video opacity - no longer needed
  const dotScale1 = useSharedValue(1);
  const dotScale2 = useSharedValue(1);
  const dotScale3 = useSharedValue(1);
  const dotTY1 = useSharedValue(0);
  const dotTY2 = useSharedValue(0);
  const dotTY3 = useSharedValue(0);
  // Removed content and fade opacity - no longer needed
  // Per-letter animation values (avoid hooks in loops)
  const lOp1 = useSharedValue(0), lOp2 = useSharedValue(0), lOp3 = useSharedValue(0), lOp4 = useSharedValue(0), lOp5 = useSharedValue(0), lOp6 = useSharedValue(0);
  const lTy1 = useSharedValue(36), lTy2 = useSharedValue(36), lTy3 = useSharedValue(36), lTy4 = useSharedValue(36), lTy5 = useSharedValue(36), lTy6 = useSharedValue(36);
  const lSx1 = useSharedValue(1),  lSx2 = useSharedValue(1),  lSx3 = useSharedValue(1),  lSx4 = useSharedValue(1),  lSx5 = useSharedValue(1),  lSx6 = useSharedValue(1);
  const lSy1 = useSharedValue(1),  lSy2 = useSharedValue(1),  lSy3 = useSharedValue(1),  lSy4 = useSharedValue(1),  lSy5 = useSharedValue(1),  lSy6 = useSharedValue(1);
  const lSh1 = useSharedValue(0), lSh2 = useSharedValue(0), lSh3 = useSharedValue(0), lSh4 = useSharedValue(0), lSh5 = useSharedValue(0), lSh6 = useSharedValue(0);
  
  // State
  // Sleek mode: no dynamic loading text
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [minDotsElapsed, setMinDotsElapsed] = useState(false);
  // Simplified loading - no video
  
  // Refs for cleanup
  const initializationRef = useRef<any>(null);
  const customerInfoListenerRemoverRef = useRef<null | (() => void)>(null);
  const completionStartedRef = useRef(false);

  // Animation styles
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
  }));

  // Removed fade overlay style - no longer needed

  // Removed video animation styles


  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dotTY1.value }, { scale: dotScale1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dotTY2.value }, { scale: dotScale2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dotTY3.value }, { scale: dotScale3.value }],
  }));

  const dotRowStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }],
  }));

  // Letter animated styles
  const letterStyle1 = useAnimatedStyle(() => ({
    opacity: lOp1.value,
    transform: [{ translateY: lTy1.value }, { scaleX: lSx1.value }, { scaleY: lSy1.value }],
  }));

  // Whole word bounce container
  const wordScale = useSharedValue(1);
  const wordTranslateY = useSharedValue(0);
  const wordContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: wordTranslateY.value }, { scale: wordScale.value }],
  }));
  const letterStyle2 = useAnimatedStyle(() => ({
    opacity: lOp2.value,
    transform: [{ translateY: lTy2.value }, { scaleX: lSx2.value }, { scaleY: lSy2.value }],
  }));
  const letterStyle3 = useAnimatedStyle(() => ({
    opacity: lOp3.value,
    transform: [{ translateY: lTy3.value }, { scaleX: lSx3.value }, { scaleY: lSy3.value }],
  }));
  const letterStyle4 = useAnimatedStyle(() => ({
    opacity: lOp4.value,
    transform: [{ translateY: lTy4.value }, { scaleX: lSx4.value }, { scaleY: lSy4.value }],
  }));
  const letterStyle5 = useAnimatedStyle(() => ({
    opacity: lOp5.value,
    transform: [{ translateY: lTy5.value }, { scaleX: lSx5.value }, { scaleY: lSy5.value }],
  }));
  const letterStyle6 = useAnimatedStyle(() => ({
    opacity: lOp6.value,
    transform: [{ translateY: lTy6.value }, { scaleX: lSx6.value }, { scaleY: lSy6.value }],
  }));

  // Start animations
  useEffect(() => {
    // Reduced minimum time for faster app startup
    const dotsTimer = setTimeout(() => setMinDotsElapsed(true), 1500);
    // Removed video checking - using simple time-based completion
    // Letters sequential entrance + shine
    const kick = (op: any, ty: any, sx: any, sy: any, sh: any, delay: number) => {
      op.value = withDelay(delay, withTiming(1, { duration: 360 }));
      // Drop in from below, overshoot above slightly, then settle at 0
      ty.value = withDelay(
        delay,
        withSequence(
          withTiming(-8, { duration: 180 }),
          withSpring(0, { damping: 14, stiffness: 260 })
        )
      );
      // Squash and stretch
      sy.value = withDelay(delay + 220, withSequence(withTiming(0.88, { duration: 90 }), withSpring(1, { damping: 16, stiffness: 300 })));
      sx.value = withDelay(delay + 220, withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, { damping: 16, stiffness: 300 })));
      // Cadence keeper (no visible effect)
      sh.value = withDelay(delay + 160, withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 240 })));
    };
    kick(lOp1, lTy1, lSx1, lSy1, lSh1, 0);
    kick(lOp2, lTy2, lSx2, lSy2, lSh2, 180);
    kick(lOp3, lTy3, lSx3, lSy3, lSh3, 360);
    kick(lOp4, lTy4, lSx4, lSy4, lSh4, 540);
    kick(lOp5, lTy5, lSx5, lSy5, lSh5, 720);
    kick(lOp6, lTy6, lSx6, lSy6, lSh6, 900);

    // Tagline fade in
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 520 }));
    titleTranslateY.value = withDelay(400, withSpring(0, { damping: 12 }));
    
    // Loading text animation
    loadingOpacity.value = withDelay(900, withTiming(1, { duration: 420 }));
    
    // Loading dots animation - faster cadence, higher bounce, starts immediately
    const dotScaleAnim = withRepeat(
      withSequence(
        withTiming(1.28, { duration: 260 }),
        withTiming(1, { duration: 260 })
      ),
      -1,
      false
    );
    const makeTy = () => withRepeat(
      withSequence(
        withTiming(-10, { duration: 260 }),
        withTiming(0, { duration: 260 })
      ),
      -1,
      false
    );
    dotScale1.value = withDelay(0, dotScaleAnim);
    dotScale2.value = withDelay(120, dotScaleAnim);
    dotScale3.value = withDelay(240, dotScaleAnim);
    dotTY1.value = withDelay(0, makeTy());
    dotTY2.value = withDelay(120, makeTy());
    dotTY3.value = withDelay(240, makeTy());
    // Fade-in content
    // Removed content opacity animation
    return () => { clearTimeout(dotsTimer); };
  }, []);

  // Proceed when initialization is complete
  useEffect(() => {
    if (!isComplete || completionStartedRef.current) return;
    completionStartedRef.current = true;
    // Small delay for smooth transition
    const t = setTimeout(async () => {
      try { await navigateToApp(); } catch {}
      onLoadingComplete();
    }, 300);
    return () => clearTimeout(t);
  }, [isComplete, onLoadingComplete]);

  // Simplified fallback: after 8s, complete loading if not already done
  useEffect(() => {
    const failSafe = setTimeout(() => {
      if (completionStartedRef.current) return;
      setIsComplete(true);
    }, 8000); // Reduced from 10s to 8s
    return () => clearTimeout(failSafe);
  }, []);

  // No external sheen dependency

  // Initialize app - robust to StrictMode double-invocation
  useEffect(() => {
    if (initializationPromise) {
      // Someone already started initialization; wait for it, then exit loading
      initializationPromise.then(() => onLoadingComplete());
      return;
    }

    if (__DEV__) {
      console.log('🚀 InitialLoadingScreen: Starting initialization...');
    }
    hasInitializedGlobally = true;
    setHasStarted(true);

    // Create a shared one-time promise that completes after init + brief UI delay
    initializationPromise = new Promise<void>((resolve) => {
      const runInitialization = async () => {
        try {
          // Step 1: Permissions
          // We request photo library at startup (for gallery), and only check notifications.
          await initializePermissions();

          // Step 2: RevenueCat Configuration
          // RevenueCat is configured in _layout.tsx before this component loads
          // No additional configuration needed here

          // Step 2.5: Wait for RevenueCat Context to be ready with subscription data (non-blocking)
          try {
            await waitForRevenueCatContext();
          } catch (error) {
            if (__DEV__) {
              console.log('⚠️ RevenueCat context wait failed, continuing startup:', error);
            }
          }

          // Step 3: Device Services
          await initializeDeviceServices();

          // Step 4: Analytics
          await retry(initializeAnalytics, 2, 600);

          // Step 5: Notifications (initialize only; do not prompt yet)
          await retry(initializeNotifications, 1, 600);

          // Step 6: Check for completed videos
          await retry(checkAndRecoverVideos, 2, 800);

          // Step 7: Heavy component preloading (optional performance boost)
          try {
            // Preload heavy components that are likely to be needed next
            await Promise.all([
              import('@/app/onboarding-v2'),
              import('@/app/explore'),
              import('@/components/BeforeAfterSlider'),
              // import('@/components/ProcessingScreen'), // Skip if not available
            ]);
            if (__DEV__) {
              console.log('✅ Heavy components preloaded');
            }
          } catch (error) {
            if (__DEV__) {
              console.log('⚠️ Component preloading failed (non-fatal):', error);
            }
          }

          // Step 8: Final checks - skip redundant subscription check
          // RevenueCat Context already handles subscription status
          if (__DEV__) {
            console.log('✅ Initialization complete - RevenueCat Context manages subscription state');
          }
          // Ready
        } catch (error) {
          if (__DEV__) {
            console.error('❌ Initialization error:', error);
          }
        }
      };

      // Start initialization immediately
      (async () => {
        try {
          await runInitialization();
          setIsComplete(true);
        } finally {
          resolve();
        }
      })();
    });

    initializationPromise.then(() => {
      // Do nothing here; completion sequence handled when both init done and min time elapsed
    });

    return () => {
      const remove = customerInfoListenerRemoverRef.current;
      if (remove) {
        try { remove(); } catch {}
      }
    };
  }, [onLoadingComplete]);

  // RevenueCat initialization is handled in _layout.tsx
  // This function is kept for compatibility but does nothing
  const initializeRevenueCat = async () => {
    // No-op: RevenueCat is configured in _layout.tsx
  };

  const initializeVideoRecovery = async () => {
    // Auto-recover from any stuck video processing states on app launch
        try {
          const { isVideoProcessing, setIsVideoProcessing, setIsProcessing, setErrorMessage } = await import('@/store/cropModalStore').then(m => m.useCropModalStore.getState());
          
          if (isVideoProcessing) {
            console.log('🔧 [STARTUP] Detected stuck video processing state - auto-recovering...');
            
            // Check timestamps for ghost processing detection
            const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default);
            const lastProcessingTime = await AsyncStorage.getItem('lastVideoProcessingTime').catch(() => null);
            const pendingVideo = await AsyncStorage.getItem('pendingVideo').catch(() => null);
            
            let shouldClear = false;
            
            if (lastProcessingTime) {
              const timeSinceLastProcessing = Date.now() - parseInt(lastProcessingTime);
              const STARTUP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes for startup recovery
              
              if (timeSinceLastProcessing > STARTUP_TIMEOUT_MS) {
                console.log('🔧 [STARTUP] Processing timeout detected - clearing state');
                shouldClear = true;
              }
            } else {
              console.log('🔧 [STARTUP] No processing timestamp found - likely ghost state');
              shouldClear = true;
            }
            
            // Check for temp/ghost prediction IDs
            if (pendingVideo) {
              try {
                const pendingData = JSON.parse(pendingVideo);
                if (pendingData.predictionId?.startsWith('temp-')) {
                  console.log('🔧 [STARTUP] Ghost processing with temp ID detected - clearing');
                  shouldClear = true;
                }
              } catch (e) {
                console.log('🔧 [STARTUP] Invalid pending video data - clearing');
                shouldClear = true;
              }
            }
            
            if (shouldClear) {
              setIsVideoProcessing(false);
              setIsProcessing(false);
              setErrorMessage(null);
              
              // Clean up storage
              AsyncStorage.removeItem('lastVideoProcessingTime').catch(() => {});
              AsyncStorage.removeItem('pendingVideo').catch(() => {});
              
              console.log('✅ [STARTUP] Video processing state auto-recovered');
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.log('⚠️ [STARTUP] Failed to check video processing state:', error);
          }
        }
  };

  // Wait for RevenueCat Context Provider to finish loading subscription data
  const waitForRevenueCatContext = async () => {
    const startTime = Date.now();
    const timeout = 3000; // Reduced to 3 seconds for even faster startup
    
    if (__DEV__) {
      console.log('⏳ Waiting for RevenueCat Context to load subscription data...');
    }

    // Log transaction info if we have Pro status
    if (isPro && __DEV__) {
      console.log('✅ Pro status detected - logging transaction info');
      getCurrentSubscriptionTransactionInfo().catch(() => {});
    }

    // Wait for RevenueCat Context to finish loading
    while (isLoading && (Date.now() - startTime < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 250)); // Slightly increased for efficiency
    }

    if (__DEV__) {
      if (isLoading) {
        console.log('⚠️ RevenueCat Context loading timed out after 3s - continuing with app startup');
      } else {
        console.log('✅ RevenueCat Context ready with subscription data');
      }
    }
  };

  const initializeDeviceServices = async () => {
    try {
      // Set up network monitoring for future use
      networkStateService.subscribe(async (_isOnline) => {
        // Network monitoring setup for future use
      });
      
      if (__DEV__) {
        console.log('✅ Device services initialized');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize device services:', error);
      }
    }
  };

  const initializeAnalytics = async () => {
    try {
      await analyticsService.initialize();
      if (__DEV__) {
        console.log('✅ Analytics initialized');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize analytics:', error);
      }
    }
  };

  const initializePermissions = async () => {
    try {
      // Proactively request media library; check camera/notifications only
      await permissionsService.requestEssentialPermissions();
      if (__DEV__) {
        console.log('✅ Essential permissions initialized');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize permissions:', error);
      }
    }
  };

  const initializeNotifications = async () => {
    try {
      await notificationService.initialize();
      if (__DEV__) {
        console.log('✅ Notifications initialized');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize notifications:', error);
      }
    }
  };

  const checkAndRecoverVideos = async () => {
    try {
      if (__DEV__) {
        console.log('🎬 Starting video recovery check...');
      }
      
      // TODO: Re-implement video recovery when store is available
      // await useVideoToastStore.getState().checkForPendingVideo();
      
      if (__DEV__) {
        console.log('✅ Video recovery check completed');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check for completed videos:', error);
      }
      // Don't throw - initialization should continue even if video recovery fails
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient colors={["#0B0B0F", "#1a1a2e"]} style={{ flex: 1 }}>
        <View className="flex-1 justify-center items-center px-6">
          {/* App Title */}
          <Animated.View style={titleAnimatedStyle} className="items-center mb-12">
            <Text className="text-white text-4xl font-bold mb-2">Clever</Text>
            <Text className="text-gray-400 text-lg">AI Photo Restoration</Text>
          </Animated.View>

          {/* Loading Animation */}
          <Animated.View style={loadingAnimatedStyle} className="items-center">
            <Animated.View style={dotRowStyle} className="flex-row items-center justify-center gap-2">
              <Animated.View style={dot1Style} className="w-3 h-3 bg-blue-500 rounded-full" />
              <Animated.View style={dot2Style} className="w-3 h-3 bg-blue-500 rounded-full" />
              <Animated.View style={dot3Style} className="w-3 h-3 bg-blue-500 rounded-full" />
            </Animated.View>
            <Text className="text-gray-400 text-sm mt-4">Initializing...</Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}