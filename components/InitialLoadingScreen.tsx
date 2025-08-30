import { analyticsService } from '@/services/analytics';
import { networkStateService } from '@/services/networkState';
import { notificationService } from '@/services/notificationService';
import { permissionsService } from '@/services/permissions';
import { checkSubscriptionStatus, getCurrentSubscriptionTransactionInfo } from '@/services/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { onboardingUtils } from '@/utils/onboarding';
import { useCropModalStore } from '@/store/cropModalStore';
import { useAppInitStore } from '@/store/appInitStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, Text, View } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Module-level flag to prevent duplicate initialization across component re-mounts
let hasShownIntro = false;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InitialLoadingScreenProps {
  onLoadingComplete: () => void;
}

export default function InitialLoadingScreen({ onLoadingComplete }: InitialLoadingScreenProps) {
  const { isPro, isLoading, refreshCustomerInfo } = useRevenueCat();
  const { setInitialRoute, markInitialized } = useAppInitStore();
  const insets = useSafeAreaInsets();

  // Simple state
  const [currentVideo, setCurrentVideo] = useState<'loading' | 'onboarding' | 'done'>('loading');

  // Main loading video player - play once only
  const videoPlayer = useVideoPlayer(require('../assets/videos/loading.mp4'), (player) => {
    player.loop = false;  // Play once only
    player.muted = true;
    // Don't auto-play - will be triggered when needed
  });

  // Onboarding intro video player
  const onloadingVideoPlayer = useVideoPlayer(require('../assets/videos/onloading.mp4'), (player) => {
    player.loop = false;  // Play once only
    player.muted = true;
    // Don't auto-play - will be triggered after main video
  });

  // Single initialization flow
  useEffect(() => {
    // Prevent duplicate initialization using module flag
    if (hasShownIntro) {
      if (__DEV__) {
        console.log('⚠️ Skipping duplicate initialization - intro already shown');
      }
      return;
    }
    hasShownIntro = true;
    markInitialized();
    
    const handleAppInitialization = async () => {
      try {
        if (__DEV__) {
          console.log('🚀 Starting app initialization...');
        }

        // Start loading video
        videoPlayer.play();
        
        // Wait minimum time (5.8s) and initialize services in parallel
        const [_] = await Promise.all([
          new Promise(resolve => setTimeout(resolve, 5800)), // Loading video duration
          initializeServices()
        ]);

        if (__DEV__) {
          console.log('✅ Loading video and services complete');
        }

        // Check pro status after loading video (RevenueCat should be ready by now)
        let isProUser = false;
        try {
          if (Constants.appOwnership !== 'expo') {
            const isConfigured = await Purchases.isConfigured();
            if (isConfigured) {
              const info = await Purchases.getCustomerInfo();
              isProUser = Object.keys(info.entitlements.active).length > 0;
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.log('⚠️ Pro status check failed, treating as free user');
          }
        }
        
        // Check onboarding status
        const hasSeenOnboarding = await onboardingUtils.hasSeenOnboarding();
        
        // Make routing decision
        if (isProUser) {
          if (__DEV__) {
            console.log('🎯 Pro user - going directly to app');
          }
          setInitialRoute('explore');
          onLoadingComplete();
          return;
        }
        
        if (hasSeenOnboarding) {
          if (__DEV__) {
            console.log('🎯 Free user completed onboarding - going to app');
          }
          setInitialRoute('explore');
          onLoadingComplete();
          return;
        }
        
        // New user - show onboarding video then go to onboarding
        if (__DEV__) {
          console.log('🎯 New user - showing onboarding video');
        }
        setCurrentVideo('onboarding');
        
        // Play onboarding video
        setTimeout(() => {
          onloadingVideoPlayer.play();
        }, 300);
        
        // Wait for video to complete
        await new Promise(resolve => {
          const subscription = onloadingVideoPlayer.addListener('statusChange', ({ status }) => {
            if (status === 'idle') {
              subscription?.remove();
              resolve(void 0);
            }
          });
          
          setTimeout(() => {
            subscription?.remove();
            resolve(void 0);
          }, 12500);
        });
        
        if (__DEV__) {
          console.log('🎬 Onboarding video complete - going to onboarding');
        }
        setInitialRoute('onboarding-v3');
        onLoadingComplete();

      } catch (error) {
        if (__DEV__) {
          console.error('❌ Initialization error:', error);
        }
        // Fallback to explore
        if (__DEV__) {
          console.log('❌ Error fallback - going to explore');
        }
        setInitialRoute('explore');
        onLoadingComplete();
      }
    };

    handleAppInitialization();
  }, []);

  // Initialize all services
  const initializeServices = async () => {
    try {
      await Promise.allSettled([
        waitForRevenueCatContext(),
        initializeVideoRecovery(),
        initializeDeviceServices(), 
        initializeAnalytics(),
        initializePermissions(),
        initializeNotifications(),
        checkAndRecoverVideos()
      ]);
      
      if (__DEV__) {
        console.log('✅ All services initialized');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Service initialization error:', error);
      }
    }
  };

  // RevenueCat initialization is handled in _layout.tsx
  const initializeRevenueCat = async () => {
    // No-op: RevenueCat is configured in _layout.tsx
  };

  const initializeVideoRecovery = async () => {
    // Auto-recover from any stuck video processing states on app launch
        try {
          const { isVideoProcessing, setIsVideoProcessing, setIsProcessing, setErrorMessage } = useCropModalStore.getState();
          
          if (isVideoProcessing) {
            console.log('🔧 [STARTUP] Detected stuck video processing state - auto-recovering...');
            
            // Check timestamps for ghost processing detection
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
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Main loading video - shows initially */}
      {currentVideo === 'loading' && (
        <VideoView
          player={videoPlayer}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
          }}
          contentFit="contain"
          nativeControls={false}
          allowsFullscreen={false}
        />
      )}

      {/* Onboarding intro video - shows after main video */}
      {currentVideo === 'onboarding' && (
        <VideoView
          player={onloadingVideoPlayer}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
          }}
          contentFit="contain"
          nativeControls={false}
          allowsFullscreen={false}
        />
      )}
    </View>
  );
}