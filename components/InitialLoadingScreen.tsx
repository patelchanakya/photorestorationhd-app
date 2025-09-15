import { analyticsService } from '@/services/analytics';
import { networkStateService } from '@/services/networkState';
import { notificationService } from '@/services/notificationService';
import { permissionsService } from '@/services/permissions';
import { checkSubscriptionStatus, getCurrentSubscriptionTransactionInfo } from '@/services/revenuecat';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { onboardingUtils } from '@/utils/onboarding';
import { useCropModalStore } from '@/store/cropModalStore';
import { useAppInitStore } from '@/store/appInitStore';
import { useQuickEditStore } from '@/store/quickEditStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, Text, View, AppState } from 'react-native';
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
  const { setInitialRoute, markInitialized, setRecoveryState } = useAppInitStore();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);

  // Simple state
  const [currentVideo, setCurrentVideo] = useState<'loading' | 'done'>('loading');
  const [isNavigating, setIsNavigating] = useState(false);

  // Background handling
  const wasBackgroundedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  // Fade animation for smooth transition
  const fadeOpacity = useSharedValue(1);

  // Restart loading process after backgrounding
  const restartLoadingProcess = () => {
    if (!isMountedRef.current) return;

    // Reset flags
    wasBackgroundedRef.current = false;
    setIsNavigating(false);

    // Reset fade
    fadeOpacity.value = 1;

    // Restart video from beginning
    try {
      videoPlayer.currentTime = 0;
      videoPlayer.play();
    } catch (error) {
      console.log('Video restart handled');
    }

    // Reset start time
    startTimeRef.current = Date.now();

    if (__DEV__) {
      console.log('🔄 Loading process restarted after backgrounding');
    }
  };

  // Main loading video player - play once only
  const videoPlayer = useVideoPlayer(require('../assets/videos/loading.mp4'), (player) => {
    try {
      player.loop = false;  // Play once only
      player.muted = true;
      // Note: playingChange event is unreliable, using timer-based approach instead
    } catch (error) {
      console.error('Loading video player init error:', error);
    }
  });


  // Handle app state changes for backgrounding
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        wasBackgroundedRef.current = true;
        // Pause video when app goes to background
        try {
          if (videoPlayer && videoPlayer.playing) {
            videoPlayer.pause();
          }
        } catch (error) {
          console.log('Video pause handled');
        }
      } else if (nextState === 'active' && wasBackgroundedRef.current) {
        // App came back - restart the loading process
        restartLoadingProcess();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Cleanup video players on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Cleanup both video players
      try {
        if (videoPlayer) {
          const status = videoPlayer.status;
          if (status !== 'idle') {
            videoPlayer.pause();
          }
          videoPlayer.release();
        }
      } catch (error) {
        if (__DEV__) {
          console.log('Loading video cleanup handled');
        }
      }

    };
  }, []);

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
    
    const handleAppInitialization = async () => {
      try {
        if (__DEV__) {
          console.log('🚀 Starting app initialization...');
        }

        // Start loading video
        try {
          if (isMountedRef.current) {
            videoPlayer.play();
          }
        } catch (error) {
          if (__DEV__) {
            console.log('Loading video play error handled');
          }
        }

        // Initialize services (no artificial timer needed - video is our timer)
        await initializeServices();

        if (__DEV__) {
          console.log('✅ Services initialization complete');
        }

        // Since video end event is unreliable, use a timer that matches video duration
        const videoEndTime = 4000; // Video is exactly 4 seconds
        const elapsed = Date.now() - startTimeRef.current;
        const remainingTime = Math.max(0, videoEndTime - elapsed);

        setTimeout(() => {
          if (!isNavigating && isMountedRef.current) {
            if (__DEV__) {
              console.log('🎬 4-second video timer complete, navigating...');
            }
            setIsNavigating(true);
            fadeOpacity.value = withTiming(0, { duration: 300 });
            setTimeout(() => {
              if (isMountedRef.current) {
                onLoadingComplete();
              }
            }, 400);
          }
        }, remainingTime);

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
        
        // Check for recovery state after initialization
        const { recoveryState } = useAppInitStore.getState();
        
        // Handle recovery navigation first (highest priority)
        if (recoveryState.hasRecovery) {
          if (recoveryState.recoveryType === 'textEdit' && recoveryState.recoveryData?.route) {
            if (__DEV__) {
              console.log('🔄 [RECOVERY] Text-edit recovery detected - navigating to restoration screen');
            }
            markInitialized();
            // Navigation will be handled by the explore screen checking recovery state
            setInitialRoute('explore');
            return;
          }
        }
        
        // Make normal routing decision
        if (isProUser) {
          if (__DEV__) {
            console.log('🎯 Pro user - going directly to app');
          }
          setInitialRoute('explore');
          markInitialized();
          // Let video end trigger navigation
          return;
        }

        // TEMP: Always show OnboardingV4 for development/testing
        if (__DEV__) {
          console.log('🎯 DEVELOPMENT MODE - Always showing OnboardingV4');
        } else if (hasSeenOnboarding) {
          if (__DEV__) {
            console.log('🎯 Free user completed onboarding - going to app');
          }
          setInitialRoute('explore');
          markInitialized();
          // Let video end trigger navigation
          return;
        }

        // Go to OnboardingV4 (always in dev, new users in prod)
        if (__DEV__) {
          console.log('🎯 Going to OnboardingV4');
        }
        setInitialRoute('onboarding-v4');
        markInitialized();
        // Let video end trigger navigation

      } catch (error) {
        if (__DEV__) {
          console.error('❌ Initialization error:', error);
        }
        // Fallback to explore
        if (__DEV__) {
          console.log('❌ Error fallback - going to explore');
        }
        setInitialRoute('explore');
        markInitialized();
        // Let video end trigger navigation (or timeout)
      }
    };

    handleAppInitialization();

    // Safety timeout in case video fails completely
    const safetyTimeout = setTimeout(() => {
      if (!isNavigating && isMountedRef.current) {
        if (__DEV__) {
          console.warn('⚠️ Safety timeout triggered - forcing navigation');
        }
        setIsNavigating(true);
        // Don't use withTiming callback - just navigate directly
        fadeOpacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => {
          if (isMountedRef.current) {
            onLoadingComplete();
          }
        }, 400); // After fade duration
      }
    }, 10000); // 10 seconds safety net (should never be needed)

    return () => {
      clearTimeout(safetyTimeout);
    };
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
        checkAndRecoverVideos(),
        performRecoveryCheck() // Add recovery check during initialization
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
    const maxWaitTime = 2000; // Maximum 2 seconds - never block app indefinitely
    
    if (__DEV__) {
      console.log('⏳ Waiting for RevenueCat Context to load subscription data...');
    }

    // Log transaction info if we have Pro status
    if (isPro && __DEV__) {
      console.log('✅ Pro status detected - logging transaction info');
      getCurrentSubscriptionTransactionInfo().catch(() => {});
    }

    // Deterministic wait with safety fallback - best practice for production apps
    while (isLoading && (Date.now() - startTime < maxWaitTime)) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Check every 100ms
    }

    if (__DEV__) {
      if (isLoading) {
        console.log('⚠️ RevenueCat Context loading timed out after 2s - continuing app startup (safe fallback)');
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

  // Recovery check function - adapted from _layout.tsx
  const performRecoveryCheck = async () => {
    const startTime = Date.now();
    try {
      const activePredictionId = await AsyncStorage.getItem('activePredictionId');
      if (!activePredictionId) {
        console.log('🔍 [RECOVERY] No active prediction found - recovery skipped');
        setRecoveryState({ hasRecovery: false });
        return;
      }
      
      console.log('🔍 [RECOVERY] Starting recovery check for prediction:', activePredictionId);
      
      // Get Supabase environment variables
      const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('⚠️ [RECOVERY] CRITICAL: Missing Supabase configuration');
        await AsyncStorage.removeItem('activePredictionId');
        setRecoveryState({ hasRecovery: false });
        return;
      }
      
      console.log('📡 [RECOVERY] Calling secure photo-status endpoint for prediction:', activePredictionId);
      
      // Check prediction status using secure photo-status endpoint
      const response = await fetch(`${SUPABASE_URL}/functions/v1/photo-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ prediction_id: activePredictionId })
      });
      
      const responseTime = Date.now() - startTime;
      
      if (!response.ok) {
        console.error('🚨 [RECOVERY] photo-status endpoint error:', {
          prediction_id: activePredictionId,
          status: response.status,
          response_time_ms: responseTime
        });
        await AsyncStorage.removeItem('activePredictionId');
        setRecoveryState({ hasRecovery: false });
        return;
      }
      
      const result = await response.json();
      
      if (!result.success) {
        console.warn('🧹 [RECOVERY] Prediction not found in database, clearing state:', {
          prediction_id: activePredictionId,
          error: result.error || 'Unknown database error',
          response_time_ms: responseTime
        });
        await AsyncStorage.removeItem('activePredictionId');
        setRecoveryState({ hasRecovery: false });
        return;
      }
      
      const prediction = result;
      
      console.log('📊 [RECOVERY] Prediction retrieved from database:', {
        prediction_id: activePredictionId,
        status: prediction.status,
        mode: prediction.mode,
        has_output: prediction.has_output,
        is_complete: prediction.is_complete,
        is_successful: prediction.is_successful,
        progress: prediction.progress,
        response_time_ms: responseTime
      });
      
      if (!prediction.has_output && prediction.is_complete) {
        console.warn('🧹 [RECOVERY] Prediction completed but no output available - likely expired');
        await AsyncStorage.removeItem('activePredictionId');
        setRecoveryState({ hasRecovery: false });
        return;
      }
      
      // Valid prediction with output available
      if (prediction.status === 'succeeded' && prediction.output) {
        console.log('🎉 [RECOVERY] SUCCESS: Found completed generation, checking recovery context');
        
        // Check if this prediction came from text-edits using multiple detection methods
        let isTextEditsFlow = false;
        
        try {
          const storedContext = await AsyncStorage.getItem(`textEditContext_${activePredictionId}`);
          if (storedContext) {
            const textEditContext = JSON.parse(storedContext);
            isTextEditsFlow = textEditContext?.mode === 'text-edits';
          }
        } catch (error) {
          console.warn('⚠️ [RECOVERY] Failed to parse text-edit context:', error);
        }
        
        if (!isTextEditsFlow) {
          try {
            const flowFlag = await AsyncStorage.getItem('isTextEditsFlow');
            isTextEditsFlow = flowFlag === 'true';
          } catch (error) {
            console.warn('⚠️ [RECOVERY] Failed to check text-edits flow flag:', error);
          }
        }
        
        if (isTextEditsFlow) {
          console.log('📝 [RECOVERY] Text-edit prediction detected, will navigate to restoration screen');
          
          // Update local restoration record with completed output URL for recovery
          try {
            const { localStorageHelpers } = require('@/services/supabase');
            await localStorageHelpers.updateRestoration(activePredictionId, {
              status: 'completed',
              replicate_url: prediction.output,
              progress: 100
            });
          } catch (error) {
            console.warn('⚠️ [RECOVERY] Failed to update local restoration record:', error);
          }
          
          // Store text-edit recovery state for navigation after initialization
          setRecoveryState({
            hasRecovery: true,
            recoveryType: 'textEdit',
            recoveryData: {
              predictionId: activePredictionId,
              route: `/restoration/${activePredictionId}`
            }
          });
          
          return;
        }
        
        // Quick Edit Sheet recovery for non-text-edit predictions
        console.log('📱 [RECOVERY] Quick Edit prediction detected, will show sheet with result');
        
        // Store recovery data - let the UI handle any URL loading issues
        setRecoveryState({
          hasRecovery: true,
          recoveryType: 'quickEdit',
          recoveryData: {
            predictionId: activePredictionId,
            restoredUri: prediction.output
          }
        });
        console.log('✅ [RECOVERY] Quick Edit recovery data stored for later display');
      } else if (prediction.status === 'processing') {
        console.log('⏳ [RECOVERY] Generation still processing, no recovery UI needed');
        setRecoveryState({ hasRecovery: false });
      } else if (prediction.status === 'failed') {
        console.error('❌ [RECOVERY] Previous generation failed, clearing state');
        await AsyncStorage.removeItem('activePredictionId');
        setRecoveryState({ hasRecovery: false });
      }
      
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('🚨 [RECOVERY] CRITICAL ERROR: Recovery check failed:', {
        error: error instanceof Error ? error.message : String(error),
        total_time_ms: totalTime
      });
      await AsyncStorage.removeItem('activePredictionId');
      setRecoveryState({ hasRecovery: false });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Main loading video with fade animation */}
      {currentVideo === 'loading' && (
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>
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
            useExoShutter={false}
          />
        </Animated.View>
      )}

    </View>
  );
}