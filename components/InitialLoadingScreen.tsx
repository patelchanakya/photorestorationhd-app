import { analyticsService } from '@/services/analytics';
import { backToLifeService } from '@/services/backToLifeService';
import { deviceTrackingService } from '@/services/deviceTracking';
import { networkStateService } from '@/services/networkState';
import { notificationService } from '@/services/notificationService';
import { permissionsService } from '@/services/permissions';
import { checkSubscriptionStatus } from '@/services/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { checkForCompletedVideos } from '@/services/videoGenerationService';
import { useVideoToastStore } from '@/store/videoToastStore';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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
  
  // Animation values
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const loadingOpacity = useSharedValue(0);
  const dotScale1 = useSharedValue(1);
  const dotScale2 = useSharedValue(1);
  const dotScale3 = useSharedValue(1);
  
  // State
  const [loadingText, setLoadingText] = useState('Initializing...');
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Refs for cleanup
  const initializationRef = useRef<any>(null);
  const customerInfoListenerRemoverRef = useRef<null | (() => void)>(null);

  // Animation styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale3.value }],
  }));

  // Start animations
  useEffect(() => {
    // Logo animation
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, { damping: 8, stiffness: 100 });
    
    // Title animation
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(400, withSpring(0, { damping: 8 }));
    
    // Loading text animation
    loadingOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    
    // Loading dots animation
    const dotAnimation = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 400 }),
        withTiming(1, { duration: 400 })
      ),
      -1,
      false
    );
    
    dotScale1.value = withDelay(1000, dotAnimation);
    dotScale2.value = withDelay(1200, dotAnimation);
    dotScale3.value = withDelay(1400, dotAnimation);
  }, []);

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
          // Step 1: Permissions (First to avoid UI flash)
          setLoadingText('Requesting permissions...');
          await initializePermissions();

          // Step 2: RevenueCat Configuration
          setLoadingText('Configuring subscriptions...');
          await initializeRevenueCat();

          // Step 3: Device Services
          setLoadingText('Setting up device services...');
          await initializeDeviceServices();

          // Step 4: Analytics
          setLoadingText('Starting analytics...');
          await initializeAnalytics();

          // Step 5: Notifications
          setLoadingText('Setting up notifications...');
          await initializeNotifications();

          // Step 6: Check for completed videos
          setLoadingText('Checking for completed videos...');
          await checkAndRecoverVideos();

          // Step 7: Final checks
          setLoadingText('Finishing up...');
          await new Promise((r) => setTimeout(r, 500));

          setLoadingText('Ready!');
        } catch (error) {
          if (__DEV__) {
            console.error('❌ Initialization error:', error);
          }
          setLoadingText('Almost ready...');
        }
      };

      // Let animations play before heavy work
      const timeoutId = setTimeout(async () => {
        try {
          await runInitialization();
          setIsComplete(true);
          // Show completion briefly
          await new Promise((r) => setTimeout(r, 1000));
        } finally {
          resolve();
        }
      }, 1500);

      initializationRef.current = timeoutId;
    });

    initializationPromise.then(() => {
      onLoadingComplete();
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
        
        // CRITICAL: Establish correct subscription truth at app startup
        // Store starts with isPro = false, this call sets the correct value
        try {
          if (__DEV__) {
            console.log('🔍 App startup: Refreshing purchases + checking subscription status...');
          }
          
          // CRITICAL: Establish correct subscription truth at app startup (production-safe)
          try {
            if (__DEV__) {
              console.log('🔍 App startup: Syncing purchases + checking subscription status...');
            }
            
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
          const hasActiveSubscription = await checkSubscriptionStatus();
          
          if (__DEV__) {
            console.log('✅ App startup subscription truth established:', hasActiveSubscription);
            console.log('✅ Store isPro after startup check:', useSubscriptionStore.getState().isPro);
          }

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
      await deviceTrackingService.initialize();
      
      // Set up network monitoring
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
      // Check essential permissions upfront (only request notifications)
      // Media/camera permissions are requested on-demand to preserve native dialogs
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
      // First check for any persistent pending videos from storage
      await useVideoToastStore.getState().checkForPendingVideo();
      
      // Then check for newly completed videos from database
      const completedVideos = await checkForCompletedVideos();
      
      if (completedVideos.length > 0) {
        if (__DEV__) {
          console.log(`🎬 Found ${completedVideos.length} completed video(s) to recover`);
        }
        
        // Show modal for the first completed video if no pending modal is already visible
        const currentToastState = useVideoToastStore.getState();
        if (!currentToastState.showCompletionModal) {
          const firstVideo = completedVideos[0];
          await useVideoToastStore.getState().showVideoReady({
            id: firstVideo.prediction_id,
            localPath: firstVideo.local_video_path,
            imageUri: firstVideo.image_uri,
            message: completedVideos.length > 1 
              ? `${completedVideos.length} videos are ready! 🎬` 
              : 'Your video is ready! 🎬'
          });
        }
      }
      
      if (__DEV__) {
        console.log('✅ Video recovery check completed');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to check for completed videos:', error);
      }
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={{ flex: 1 }}
      >
        <View className="flex-1 justify-center items-center px-8">
          {/* Logo */}
          <Animated.View style={[logoAnimatedStyle]} className="mb-6">
            <View className="w-24 h-24 bg-blue-600 rounded-2xl justify-center items-center">
              <Text className="text-white text-3xl font-bold">C</Text>
            </View>
          </Animated.View>
          
          {/* Title */}
          <Animated.View style={[titleAnimatedStyle]} className="mb-12">
            <Text className="text-white text-4xl font-bold text-center mb-2">
              Clever
            </Text>
            <Text className="text-gray-300 text-lg text-center">
              AI Photo Restoration
            </Text>
          </Animated.View>
          
          {/* Loading Section */}
          <Animated.View style={[loadingAnimatedStyle]} className="items-center">
            <Text className="text-gray-400 text-base mb-4 text-center">
              {loadingText}
            </Text>
            
            {/* Loading Dots */}
            {!isComplete && (
              <View className="flex-row items-center space-x-2">
                <Animated.View 
                  style={[dot1Style]}
                  className="w-3 h-3 bg-blue-500 rounded-full"
                />
                <Animated.View 
                  style={[dot2Style]}
                  className="w-3 h-3 bg-blue-500 rounded-full"
                />
                <Animated.View 
                  style={[dot3Style]}
                  className="w-3 h-3 bg-blue-500 rounded-full"
                />
              </View>
            )}
            
            {/* Checkmark when complete */}
            {isComplete && (
              <View className="w-8 h-8 bg-green-500 rounded-full justify-center items-center">
                <Text className="text-white text-lg font-bold">✓</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}