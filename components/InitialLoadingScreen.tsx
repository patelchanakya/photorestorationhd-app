import { analyticsService } from '@/services/analytics';
import { backToLifeService } from '@/services/backToLifeService';
import { networkStateService } from '@/services/networkState';
import { notificationService } from '@/services/notificationService';
import { permissionsService } from '@/services/permissions';
import { checkSubscriptionStatus } from '@/services/revenuecat';
import { getOrCreateStableUserId } from '@/services/stableUserId';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useVideoToastStore } from '@/store/videoToastStore';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Global initialization guards to prevent multiple initializations
let hasInitializedGlobally = false;
let initializationPromise: Promise<void> | null = null;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InitialLoadingScreenProps {
  onLoadingComplete: () => void;
}

export default function InitialLoadingScreen({ onLoadingComplete }: InitialLoadingScreenProps) {
  const router = useRouter();
  const { setIsPro } = useSubscriptionStore();
  const insets = useSafeAreaInsets();
  
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
  const dotScale1 = useSharedValue(1);
  const dotScale2 = useSharedValue(1);
  const dotScale3 = useSharedValue(1);
  const dotTY1 = useSharedValue(0);
  const dotTY2 = useSharedValue(0);
  const dotTY3 = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const fadeOpacity = useSharedValue(0); // fade-to-black overlay
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
  const [videoDone, setVideoDone] = useState(false);
  const splashPlayer = useVideoPlayer(require('../assets/videos/newww.mp4'), (player) => {
    player.muted = true;
    player.loop = false;
    // Autoplay immediately
    try { player.play(); } catch {}
  });
  
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

  const fadeOverlayStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));


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
    // Minimum time to show bouncing dots before showing check
    const dotsTimer = setTimeout(() => setMinDotsElapsed(true), 3200);
    // Listen to video finish
    const interval = setInterval(() => {
      try {
        const status = splashPlayer.getStatus();
        if (status?.isLoaded && (status?.didJustFinish || (status?.durationMillis && status?.positionMillis >= status.durationMillis))) {
          setVideoDone(true);
        }
      } catch {}
    }, 200);
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
    contentOpacity.value = withTiming(1, { duration: 500 });
    return () => { clearTimeout(dotsTimer); clearInterval(interval); };
  }, []);

  // Proceed when ready (video finished). Backend init continues in background.
  useEffect(() => {
    if (!videoDone || completionStartedRef.current) return;
    completionStartedRef.current = true;
    // Fade to black, then navigate
    fadeOpacity.value = withTiming(1, { duration: 400 });
    const t = setTimeout(() => {
      try { router.replace('/explore'); } catch {}
      onLoadingComplete();
    }, 450);
    return () => clearTimeout(t);
  }, [videoDone, router, onLoadingComplete]);

  // Absolute fallback: force progression after ~7s to avoid any stuck states
  useEffect(() => {
    const failSafe = setTimeout(() => {
      if (completionStartedRef.current) return;
      completionStartedRef.current = true;
      try { fadeOpacity.value = withTiming(1, { duration: 250 }); } catch {}
      setTimeout(() => {
        try { router.replace('/explore'); } catch {}
        onLoadingComplete();
      }, 280);
    }, 7000);
    return () => clearTimeout(failSafe);
  }, [router, onLoadingComplete]);

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
          await retry(initializeRevenueCat, 2, 800);

          // Step 3: Device Services
          await initializeDeviceServices();

          // Step 4: Analytics
          await retry(initializeAnalytics, 2, 600);

          // Step 5: Notifications (initialize only; do not prompt yet)
          await retry(initializeNotifications, 1, 600);

          // Step 6: Check for completed videos
          await retry(checkAndRecoverVideos, 2, 800);

          // Step 7: Final checks
          await new Promise((r) => setTimeout(r, 500));
          // Extra subscription sanity check
          try { await retry(checkSubscriptionStatus, 2, 700); } catch {}
          // Ready
        } catch (error) {
          if (__DEV__) {
            console.error('❌ Initialization error:', error);
          }
        }
      };

      // Even shorter pre-init delay for faster start
      const timeoutId = setTimeout(async () => {
        try {
          await runInitialization();
          setIsComplete(true);
          // Post-animation hold for polish
          await new Promise((r) => setTimeout(r, 1500));
        } finally {
          resolve();
        }
      }, 300);

      initializationRef.current = timeoutId;
    });

    initializationPromise.then(() => {
      // Do nothing here; completion sequence handled when both init done and min time elapsed
    });

    return () => {
      const timeoutId = initializationRef.current;
      if (timeoutId) clearTimeout(timeoutId);
      const remove = customerInfoListenerRemoverRef.current;
      if (remove) {
        try { remove(); } catch {}
      }
    };
  }, [onLoadingComplete]);

  const initializeRevenueCat = async () => {
    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      
      if (isExpoGo) {
        if (__DEV__) {
          console.log('⚠️ RevenueCat is not available in Expo Go. Using mock data.');
        }
        setIsPro(false);
        return;
      }
      
      // Configure log levels
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.INFO); // Reduced from VERBOSE to avoid JWS token spam
        Purchases.setDebugLogsEnabled(true);   // Keep debug logs enabled for troubleshooting
      } else {
        Purchases.setLogLevel(LOG_LEVEL.ERROR);
        Purchases.setDebugLogsEnabled(false);
      }
      
      // Configure RevenueCat with Apple API key
      if (Platform.OS === 'ios') {
        const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
        
        if (!apiKey) {
          if (__DEV__) {
            console.error('❌ RevenueCat Apple API key not found');
          }
          setIsPro(false);
          return;
        }
        
        // Check if already configured
        try {
          const isConfigured = await Purchases.isConfigured();
          if (isConfigured) {
            if (__DEV__) {
              console.log('✅ RevenueCat already configured');
            }
          } else {
            if (__DEV__) {
              console.log('🔧 Configuring RevenueCat...');
            }
            
            await Purchases.configure({ 
              apiKey: apiKey,
              useAmazon: false,
            });
            
  // Final Pixar-like bounce once all initialization is complete
  useEffect(() => {
    if (!initComplete) return;
    // Bounce up slightly and scale with squash/stretch effect
    wordTranslateY.value = withSequence(
      withTiming(-10, { duration: 160 }),
      withSpring(0, { damping: 14, stiffness: 260 })
    );
    wordScale.value = withSequence(
      withTiming(1.08, { duration: 160 }),
      withSpring(1, { damping: 16, stiffness: 300 })
    );
    // After bounce completes, leave the screen and navigate
    const t = setTimeout(() => {
      try { router.replace('/explore'); } catch {}
      onLoadingComplete();
    }, 700);
    return () => clearTimeout(t);
  }, [initComplete, onLoadingComplete, router, wordScale, wordTranslateY]);

            if (__DEV__) {
              console.log('✅ RevenueCat configured successfully');
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.error('❌ RevenueCat configuration failed:', error);
          }
          setIsPro(false);
          return;
        }

        // CRITICAL: Set stable user ID for RevenueCat tracking
        // This enables consistent user identification for video limits
        try {
          if (__DEV__) {
            console.log('🔑 Setting up stable user ID for RevenueCat...');
          }
          
          const stableId = await getOrCreateStableUserId();
          await Purchases.logIn(stableId);
          
          if (__DEV__) {
            console.log('✅ Logged into RevenueCat with stable ID:', stableId);
          }
          
          // CRITICAL: Sync purchases to preserve Pro status for existing users
          // This ensures that existing Pro subscribers maintain their access
          await Purchases.syncPurchases();
          
          if (__DEV__) {
            console.log('✅ Purchases synced - existing Pro status preserved');
          }
        } catch (stableIdError) {
          if (__DEV__) {
            console.error('❌ Failed to set stable user ID:', stableIdError);
          }
          // Continue with initialization even if stable ID setup fails
          // RevenueCat will fall back to anonymous ID
        }
        
        // CRITICAL: Establish correct subscription truth at app startup
        // Store starts with isPro = false, this call sets the correct value
        try {
          if (__DEV__) {
            console.log('🔍 App startup: Refreshing purchases + checking subscription status...');
          }
          
          // CRITICAL: Establish correct subscription truth at app startup (production-safe)
          try {
            console.log('🔍 [TEST] App startup: Syncing purchases + checking subscription status...');
            
            // Step 1: Clear stale cache to get fresh data
            await Purchases.invalidateCustomerInfoCache();
            
            // Step 2: Sync purchases with current Apple ID (no UI prompt)
            // Safe on iOS; no-op on Android. Gets entitlements for current Apple ID.
            // @ts-ignore - method available at runtime
            await (Purchases as any).syncPurchases?.();
            
            if (__DEV__) {
              console.log('✅ RevenueCat sync complete - ready for subscription check');
            }
          } catch (syncErr) {
            if (__DEV__) {
              console.log('⚠️ RevenueCat sync failed (non-fatal):', (syncErr as any)?.message);
            }
          }

          // Attach live listener to keep store in sync after purchases/restores/expiry
          try {
            if (__DEV__) console.log('🎧 Setting up RevenueCat customer info listener');
            const removeListener = Purchases.addCustomerInfoUpdateListener(async () => {
              try {
                await checkSubscriptionStatus();
              } catch (e) {
                if (__DEV__) console.log('⚠️ Customer info listener update failed:', (e as any)?.message);
              }
            });
            customerInfoListenerRemoverRef.current = removeListener;
            if (__DEV__) console.log('✅ RevenueCat customer info listener set up successfully');
          } catch (e) {
            if (__DEV__) console.log('❌ Failed to set customer info listener:', (e as any)?.message);
          }

          // This single call establishes the correct subscription state at startup
          console.log('🔍 [TEST] Calling checkSubscriptionStatus to establish truth...');
          const hasActiveSubscription = await checkSubscriptionStatus();
          
          console.log('✅ [TEST] App startup subscription truth established:', {
            hasActiveSubscription,
            storeIsPro: useSubscriptionStore.getState().isPro,
            timestamp: new Date().toISOString()
          });

          // For Pro users, sync usage data to ensure billing cycle resets are applied
          if (hasActiveSubscription) {
            try {
              if (__DEV__) {
                console.log('🎬 App startup: Syncing Pro user Back to Life usage...');
              }
              await backToLifeService.checkUsage();
              if (__DEV__) {
                console.log('✅ App startup: Back to Life usage synced successfully');
              }
            } catch (usageError: any) {
              if (__DEV__) {
                console.warn('⚠️ App startup: Back to Life usage sync failed:', usageError?.message);
              }
              // Continue with app initialization even if usage sync fails
            }
          }
        } catch (autoCheckError: any) {
          if (__DEV__) {
            console.warn('⚠️ Startup subscription check failed - user remains non-Pro:', autoCheckError?.message);
          }
          // Ensure non-Pro state on any failure - fail safe
          setIsPro(false);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to initialize RevenueCat:', error);
      }
      setIsPro(false);
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
        console.log('🎬 Starting comprehensive video recovery...');
      }
      
      // Use the enhanced recovery function that handles ALL video states
      await useVideoToastStore.getState().checkForPendingVideo();
      
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
      <LinearGradient colors={["#0B0B0F", "#0B0B0F"]} style={{ flex: 1 }}>
        <View className="flex-1 justify-center items-center px-6">
          {/* Background video splash (muted, plays once) */}
          <VideoView
            player={splashPlayer}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            nativeControls={false}
            contentFit="cover"
          />
          {/* Fade-to-black overlay */}
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }, fadeOverlayStyle]}
          />
          {/* Minimal overlay content removed to avoid overlap with video */}
          <Animated.View style={{ opacity: contentOpacity.value }} />
        </View>
        {/* Loading dots/Ready overlay removed to let video take focus */}
      </LinearGradient>
    </View>
  );
}