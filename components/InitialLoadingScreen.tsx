import { analyticsService } from '@/services/analytics';
// import { backToLifeService } from '@/services/backToLifeService'; // REMOVED - service deleted
import { networkStateService } from '@/services/networkState';
import { notificationService } from '@/services/notificationService';
import { permissionsService } from '@/services/permissions';
import { checkSubscriptionStatus, getCurrentSubscriptionTransactionInfo } from '@/services/revenuecat';
// Removed: No longer using stable IDs - RevenueCat handles anonymous IDs automatically
import { useRevenueCat } from '@/contexts/RevenueCatContext';
// import { useVideoToastStore } from '@/store/videoToastStore';
import { onboardingUtils } from '@/utils/onboarding';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
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
      // Pro users skip onboarding completely
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
      
      // TEMPORARY: Always show onboarding v3 during testing
      if (__DEV__) {
        console.log('🎯 [TESTING] Always showing onboarding v3 for testing');
        router.replace('/onboarding-v3');
        // Show paywall for free users after onboarding completion (longer delay for new users)
        setTimeout(() => {
          import('@/services/revenuecat').then(({ presentPaywall }) => {
            presentPaywall().catch(() => {});
          });
        }, 1800); // Allow time for "System's all set" message to sink in
        return;
      }

      if (!alwaysShow && (hasSeenOnboarding || alwaysSkip)) {
        if (__DEV__) {
          console.log('🎯 User has seen onboarding - going to explore');
        }
        router.replace('/explore');
        // Show paywall for free users who completed onboarding
        setTimeout(() => {
          import('@/services/revenuecat').then(({ presentPaywall }) => {
            presentPaywall().catch(() => {});
          });
        }, 300);
      } else {
        if (__DEV__) {
          console.log('🎯 New user - showing onboarding v3');
        }
        router.replace('/onboarding-v3');
        // Show paywall for free users after onboarding completion (longer delay for new users)
        setTimeout(() => {
          import('@/services/revenuecat').then(({ presentPaywall }) => {
            presentPaywall().catch(() => {});
          });
        }, 1800); // Allow time for "System's all set" message to sink in
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Navigation error, defaulting to explore:', error);
      }
      router.replace('/explore');
      // Show paywall even on error for free users
      if (!isPro) {
        setTimeout(() => {
          import('@/services/revenuecat').then(({ presentPaywall }) => {
            presentPaywall().catch(() => {});
          });
        }, 300);
      }
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

  
  // State
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [showOnloadingVideo, setShowOnloadingVideo] = useState(false);
  const [onloadingComplete, setOnloadingComplete] = useState(false);

  // Main loading video player - play once only
  const videoPlayer = useVideoPlayer(require('../assets/videos/loading.mp4'), (player) => {
    player.loop = false;  // Play once only
    player.muted = true;
    player.play(); // Auto-play immediately
  });

  // Onboarding intro video player
  const onloadingVideoPlayer = useVideoPlayer(require('../assets/videos/onloading.mp4'), (player) => {
    player.loop = false;  // Play once only
    player.muted = true;
    // Don't auto-play - will be triggered after main video
  });
  
  // Refs for cleanup
  const initializationRef = useRef<any>(null);
  const customerInfoListenerRemoverRef = useRef<null | (() => void)>(null);
  const completionStartedRef = useRef(false);

  // Simple minimum time timer - 5.8s (one full video play)
  useEffect(() => {
    const minTimeTimer = setTimeout(() => {
      if (__DEV__) {
        console.log('⏱️ Minimum display time elapsed (5.8s)');
      }
      setMinTimeElapsed(true);
    }, 5800); // 5.8 seconds for one full video play
    
    return () => clearTimeout(minTimeTimer);
  }, []);

  // Simple video ready check - just ensure it plays
  useEffect(() => {
    const subscription = videoPlayer.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && !videoPlayer.playing) {
        if (__DEV__) {
          console.log('📹 Video ready - starting playback');
        }
        videoPlayer.play();
      }
    });
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // Handle transition to onboarding video
  useEffect(() => {
    if (minTimeElapsed && isComplete && !showOnloadingVideo && !completionStartedRef.current) {
      completionStartedRef.current = true;
      
      // Pro users skip onboarding intro video
      if (isPro) {
        if (__DEV__) {
          console.log('🎯 Pro user - skipping onboarding intro video, going directly to app');
        }
        navigateToApp();
        onLoadingComplete();
        return;
      }
      
      // Check if free user has already completed onboarding
      onboardingUtils.hasSeenOnboarding().then(hasSeenOnboarding => {
        if (hasSeenOnboarding && !__DEV__) {
          if (__DEV__) {
            console.log('🎯 Free user completed onboarding - skipping intro video, going to app with paywall');
          }
          navigateToApp();
          onLoadingComplete();
          return;
        }
        
        // Show onboarding intro video for new users or dev mode
        if (__DEV__) {
          console.log('🎬 Starting onboarding intro video');
        }
        setShowOnloadingVideo(true);
        // Start the onboarding video
        setTimeout(() => {
          onloadingVideoPlayer.play();
        }, 300);
      });
    }
  }, [minTimeElapsed, isComplete, showOnloadingVideo, isPro]);

  // Track onboarding video completion
  useEffect(() => {
    if (!showOnloadingVideo) return;
    
    const subscription = onloadingVideoPlayer.addListener('statusChange', ({ status }) => {
      if (status === 'idle' && !onloadingComplete) {
        if (__DEV__) {
          console.log('🎬 Onboarding video completed');
        }
        setOnloadingComplete(true);
      }
    });
    
    // Fallback timer for onboarding video (12.5s)
    const timer = setTimeout(() => {
      if (!onloadingComplete) {
        setOnloadingComplete(true);
      }
    }, 12500);
    
    return () => {
      subscription?.remove();
      clearTimeout(timer);
    };
  }, [showOnloadingVideo, onloadingComplete]);

  // Final exit logic - after onboarding video completes
  useEffect(() => {
    if (onloadingComplete && !completionStartedRef.current) {
      completionStartedRef.current = true;
      if (__DEV__) {
        console.log('✅ All videos complete - navigating to onboarding');
      }
      
      // Small delay for smooth transition
      setTimeout(async () => {
        try { await navigateToApp(); } catch {}
        onLoadingComplete();
      }, 300);
    }
  }, [onloadingComplete]);


  // Ultimate failsafe: after 10s, force completion
  useEffect(() => {
    const failSafe = setTimeout(() => {
      if (completionStartedRef.current) return;
      if (__DEV__) {
        console.log('⚠️ Ultimate failsafe triggered - forcing exit after 10s');
      }
      setMinTimeElapsed(true);
      setIsComplete(true);
    }, 10000); // 10 second ultimate failsafe
    return () => clearTimeout(failSafe);
  }, []); // No dependencies - start timer immediately

  // No external sheen dependency

  // Initialize app - start immediately in parallel with video
  useEffect(() => {
    if (initializationPromise) {
      // Someone already started initialization; wait for it, then exit loading
      initializationPromise.then(() => onLoadingComplete());
      return;
    }

    if (__DEV__) {
      console.log('🚀 InitialLoadingScreen: Starting initialization immediately...');
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
  }, []); // Start immediately on mount, no dependencies

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
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Main loading video - shows initially */}
      {!showOnloadingVideo && (
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

      {/* Onboarding intro video - shows after main video and init complete */}
      {showOnloadingVideo && (
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
      
      {/* Loading indicator overlay - shows after main video if initialization not done yet */}
      {minTimeElapsed && !isComplete && !showOnloadingVideo && (
        <View 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000000',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#ffffff" style={{ transform: [{ scale: 0.8 }] }} />
        </View>
      )}
    </View>
  );
}