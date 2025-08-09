import { ModeSelector } from '@/components/ModeSelector';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useRestorationHistory } from '@/hooks/useRestorationHistory';
import { useTranslation } from '@/i18n/useTranslation';
import { presentPaywall, validatePremiumAccess } from '@/services/revenuecat';
import { localStorageHelpers } from '@/services/supabase';
import { useAnimationStore } from '@/store/animationStore';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Define available mode structure (names will be translated)
const MODE_CONFIG = [
  { id: 'restoration', translationKey: 'modes.restore', shortKey: 'modes.restoreShort', icon: 'arrow.clockwise' },
  { id: 'unblur', translationKey: 'modes.unblur', shortKey: 'modes.unblurShort', icon: 'eye' },
  { id: 'colorize', translationKey: 'modes.colorize', shortKey: 'modes.colorizeShort', icon: 'paintbrush' },
  { id: 'descratch', translationKey: 'modes.descratch', shortKey: 'modes.descratchShort', icon: 'bandage' }
] as const;

type ModeType = typeof MODE_CONFIG[number]['id'];

export default function MinimalCameraWithGalleryButton() {
  const { t } = useTranslation();
  const { showOnboarding } = useOnboarding();
  const [permission, requestPermission] = useCameraPermissions();
  const [enableTorch, setEnableTorch] = useState(false);
  const [facing] = useState<'front' | 'back'>('back');
  const [isAppReady, setIsAppReady] = useState(false);
  const [functionType, setFunctionType] = useState<ModeType>('restoration');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const appStateRef = useRef(AppState.currentState);
  
  // Generate translated modes
  const modes = useMemo(() => {
    try {
      return MODE_CONFIG.map(mode => ({
        id: mode.id,
        name: t(mode.translationKey),
        shortName: t(mode.shortKey),
        icon: mode.icon
      }));
    } catch (error) {
      // Fallback to English if translation fails
      return MODE_CONFIG.map(mode => ({
        id: mode.id,
        name: mode.translationKey.split('.')[1] || mode.id,
        shortName: mode.shortKey.split('.')[1] || mode.id,
        icon: mode.icon
      }));
    }
  }, [t]);
  
  // State persistence functions
  const persistCameraState = useCallback(async () => {
    if (__DEV__) {
      console.log(`💾 persistCameraState() called - saving torch: ${enableTorch}, mode: ${functionType}`);
    }
    try {
      await AsyncStorage.setItem('cameraState', JSON.stringify({
        enableTorch,
        functionType,
        isCapturing: false, // Always reset capturing state
      }));
      if (__DEV__) {
        console.log('💾 Camera state saved successfully');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to persist camera state:', error);
      }
    }
  }, [enableTorch, functionType]);

  const restoreCameraState = useCallback(async () => {
    if (__DEV__) {
      console.log('🔄 restoreCameraState() called');
    }
    try {
      const savedState = await AsyncStorage.getItem('cameraState');
      if (savedState) {
        const { enableTorch: savedTorch, functionType: savedMode } = JSON.parse(savedState);
        if (__DEV__) {
          console.log(`🔄 Restoring saved torch state: ${savedTorch}, mode: ${savedMode}`);
          console.log(`🔦 setEnableTorch: current → ${savedTorch || false} (STATE RESTORE)`);
        }
        setEnableTorch(savedTorch || false);
        setFunctionType(savedMode || 'restoration');
      } else {
        if (__DEV__) {
          console.log('🔄 No saved camera state found');
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to restore camera state:', error);
      }
    }
  }, []);
  
  // Only fetch and sync restoration history if not showing onboarding - DO THIS AFTER CAMERA IS READY
  const { refetch } = useRestorationHistory();
  useEffect(() => {
    // Skip loading completely if we're going to show onboarding
    if (showOnboarding === true) {
      return;
    }

    // PRIORITY: Wait until camera is ready before doing heavy operations
    if (!isAppReady || !permission?.granted) {
      return;
    }

    // Delay heavy operations to not block camera rendering
    const timer = setTimeout(() => {
      if (__DEV__) {
        console.log('📱 Camera is ready, now loading restoration history in background');
      }
      
      // Clean up orphaned records on app start (in background)
      localStorageHelpers.cleanupOrphanedRecords().then((cleanedCount) => {
        if (cleanedCount > 0) {
          if (__DEV__) {
            console.log(`🧹 Cleaned ${cleanedCount} orphaned records in background`);
          }
        }
        // Always refetch once after cleanup (whether records were cleaned or not)
        refetch({ cancelRefetch: false });
      }).catch(() => {
        // Fallback if cleanup fails
        refetch({ cancelRefetch: false });
      });
    }, 1000); // Wait 1 second after camera is ready
    
    return () => clearTimeout(timer);
  }, [refetch, showOnboarding, isAppReady, permission?.granted]);
  
  // Use Zustand store for restorationCount and flash button visibility
  const restorationCount = useRestorationStore((state) => state.restorationCount);
  const showFlashButton = useRestorationStore((state) => state.showFlashButton);
  
  // Use Zustand store for animation state
  const { proAnimationDuration, isProAnimationActive } = useAnimationStore();
  
  // Use Zustand store for subscription state
  const isPro = useSubscriptionStore((state) => state.isPro);
  
  // Debug logging for badge and force initial sync
  useEffect(() => {
    if (__DEV__) {
      console.log('📊 Badge State:', {
        restorationCount,
      });
    }
  }, [restorationCount]);
  
  // Force sync restoration count on mount
  useEffect(() => {
    if (__DEV__) {
      console.log('🚀 App mounted, forcing restoration history sync...');
    }
    refetch({ cancelRefetch: false });
  }, []);
  
  
  // Animation values
  const captureButtonScale = useSharedValue(1);
  const flashAnimation = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const badgeScale = useSharedValue(1);
  const badgeOpacity = useSharedValue(1);
  
  // PRO button animation values
  const proBorderProgress = useSharedValue(0);

  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission();
    }
  }, [permission, requestPermission]);
  
  useEffect(() => {
    // Set app ready immediately - no waiting for interactions
    if (__DEV__) {
      console.log('📱 Setting app ready immediately for camera functionality');
    }
    
    // RESET MECHANISM: Clean any leftover state from onboarding
    setIsCapturing(false);
    setShowModeSelector(false);
    if (__DEV__) {
      console.log('🔦 setEnableTorch: current → false (INITIAL RESET)');
    }
    setEnableTorch(false);
    
    // Set ready state immediately
    setIsAppReady(true);
    
    // Add aggressive fallback timeout just in case
    const fallbackTimeout = setTimeout(() => {
      if (__DEV__) {
        console.log('🚨 Fallback timeout - forcing app ready state');
      }
      setIsAppReady(true);
    }, 500);
    
    return () => clearTimeout(fallbackTimeout);
  }, []);
  
  // Separate effect for initial state restoration (runs only once on mount)
  useEffect(() => {
    if (__DEV__) {
      console.log('🔄 Initial state restoration on mount');
    }
    restoreCameraState();
  }, []); // Empty dependency array - runs only once

  // AppState handling for camera lifecycle
  useEffect(() => {
    if (__DEV__) {
      console.log('🔄 Setting up AppState listener');
    }
    
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // Going to background
        if (__DEV__) {
          console.log('📱 App going to background - saving state');
        }
        
        // Save state before backgrounding (inline to avoid dependency issues)
        if (__DEV__) {
          console.log(`💾 Saving state before background - torch: ${enableTorch}, mode: ${functionType}`);
        }
        try {
          await AsyncStorage.setItem('cameraState', JSON.stringify({
            enableTorch,
            functionType,
            isCapturing: false,
          }));
          if (__DEV__) {
            console.log('💾 State saved successfully before background');
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Failed to save state before background:', error);
          }
        }
        
        // Stop camera and animations
        setIsCameraActive(false);
        setIsCapturing(false); // Force reset capture state
        
        // Cancel all animations
        if (__DEV__) {
          console.log('🎨 Cancelling all animations for background (glow + PRO)');
        }
        cancelAnimation(glowOpacity);
        cancelAnimation(proBorderProgress);
        glowOpacity.value = 0;
        proBorderProgress.value = 0;
        
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // Coming to foreground
        if (__DEV__) {
          console.log('📱 App coming to foreground - restoring state');
        }
        
        // Restore saved state (inline to avoid dependency issues)
        if (__DEV__) {
          console.log('🔄 Restoring state after foreground');
        }
        try {
          const savedState = await AsyncStorage.getItem('cameraState');
          if (savedState) {
            const { enableTorch: savedTorch, functionType: savedMode } = JSON.parse(savedState);
            if (__DEV__) {
              console.log(`🔄 Restoring: torch=${savedTorch}, mode=${savedMode}`);
              console.log(`🔦 setEnableTorch: → ${savedTorch || false} (FOREGROUND RESTORE)`);
            }
            setEnableTorch(savedTorch || false);
            setFunctionType(savedMode || 'restoration');
          } else {
            if (__DEV__) {
              console.log('🔄 No saved state found after foreground');
            }
          }
        } catch (error) {
          if (__DEV__) {
            console.error('Failed to restore state after foreground:', error);
          }
        }
        
        // Re-initialize camera with delay
        setTimeout(() => {
          setIsCameraActive(true);
          
          // Restart animations
          glowOpacity.value = withRepeat(
            withSequence(
              withTiming(0.6, { duration: 1500 }),
              withTiming(0.3, { duration: 1500 })
            ),
            -1,
            true
          );
          
          // Restart Pro button animation if user is not Pro and animation should be active
          if (isProAnimationActive && !isPro) {
            if (__DEV__) {
              console.log('🎨 Restarting PRO animation after foreground');
              console.log(`🎨 Pro animation config: active=${isProAnimationActive}, isPro=${isPro}, duration=${proAnimationDuration}`);
            }
            proBorderProgress.value = 0;
            proBorderProgress.value = withRepeat(
              withTiming(1, { duration: proAnimationDuration }),
              -1,
              false
            );
          } else {
            if (__DEV__) {
              console.log('🎨 PRO animation NOT restarted after foreground');
              console.log(`🎨 Reason: active=${isProAnimationActive}, isPro=${isPro}`);
            }
            proBorderProgress.value = 0;
          }
        }, 300); // Give camera time to initialize
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [isProAnimationActive, isPro, proAnimationDuration]); // Removed persistCameraState and restoreCameraState
  
  useEffect(() => {
    // Subtle glow animation for capture button - only when camera is active
    if (isCameraActive) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1500 }),
          withTiming(0.3, { duration: 1500 })
        ),
        -1,
        true
      );
    }
  }, [isCameraActive]);
  
  // Initial PRO animation startup (runs once on mount)
  useEffect(() => {
    if (isProAnimationActive && !isPro) {
      if (__DEV__) {
        console.log('🎨 Starting initial PRO animation on mount');
      }
      proBorderProgress.value = 0;
      proBorderProgress.value = withRepeat(
        withTiming(1, { duration: proAnimationDuration }),
        -1,
        false
      );
    } else {
      if (__DEV__) {
        console.log('🎨 PRO animation disabled on mount - Pro user or animation inactive');
      }
      proBorderProgress.value = 0;
    }
  }, []); // Run once on mount only
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Save state when component unmounts
      persistCameraState();
      
      // Cancel all animations
      cancelAnimation(glowOpacity);
      cancelAnimation(proBorderProgress);
    };
  }, [persistCameraState]);
  
  // Animated styles
  const animatedCaptureStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: captureButtonScale.value }],
    };
  });

  const animatedFlashStyle = useAnimatedStyle(() => {
    return {
      opacity: flashAnimation.value,
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const animatedBadgeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: badgeScale.value }],
      opacity: badgeOpacity.value,
    };
  });
  
  const proRotatingGradientStyle = useAnimatedStyle(() => {
    'worklet';
    // Continuously increasing rotation without reset
    const rotation = proBorderProgress.value * 360;
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  });
  

    
  // Camera functions
  const handleCapture = useCallback(async () => {
    if (__DEV__) {
      console.log('📸 Camera capture requested');
      console.log('📸 Camera ref exists:', !!cameraRef.current);
      console.log('📸 Is capturing:', isCapturing);
      console.log('📸 Camera active:', isCameraActive);
    }
    
    // Add camera health check
    if (!isCameraActive || !cameraRef.current) {
      if (__DEV__) {
        console.log('📸 Camera not ready, attempting recovery');
      }
      setIsCameraActive(false);
      setTimeout(() => setIsCameraActive(true), 500);
      return;
    }
    
    if (isCapturing) {
      if (__DEV__) {
        console.log('🚫 Camera capture blocked - already capturing');
      }
      return;
    }
    
    setIsCapturing(true);
    
    try {
      if (__DEV__) {
        console.log('📸 Starting camera capture...');
      }
      
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Animate capture button
      captureButtonScale.value = withSequence(
        withSpring(0.8),
        withSpring(1)
      );

      // Flash animation
      flashAnimation.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 300 })
      );

      const photo = await cameraRef.current.takePictureAsync();
      
      if (__DEV__) {
        console.log('📸 Photo captured:', photo ? 'Success' : 'Failed');
        if (photo) {
          console.log('📸 Photo URI:', photo.uri);
        }
      }
      
      if (photo) {
        // Validate premium access before proceeding to crop - follows RevenueCat best practices
        const hasAccess = await validatePremiumAccess();
        if (__DEV__) {
          console.log('📸 Premium access validation after capture:', hasAccess);
        }
        
        router.push(`/crop-modal?imageUri=${encodeURIComponent(photo.uri)}&functionType=${functionType}&imageSource=camera`);
      } else {
        throw new Error('No photo returned from camera');
      }
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Camera capture failed:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
      }
      
      // Reset capturing state immediately on error
      setIsCapturing(false);
      
      // Show user-friendly error message
      Alert.alert(
        'Camera Error', 
        'Failed to take photo. Please try again.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Ensure capturing state is reset
              setIsCapturing(false);
            }
          }
        ]
      );
      return; // Exit early, don't wait for timeout
    }
    
    // Success - reset capturing state after short delay
    setTimeout(() => {
      setIsCapturing(false);
      if (__DEV__) {
        console.log('📸 Camera capture complete, state reset');
      }
    }, 500); // Reduced from 1000ms to 500ms
  }, [router, functionType, captureButtonScale, flashAnimation, isCapturing, isCameraActive]);

  const handleGalleryPress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        // Validate premium access before proceeding to crop - follows RevenueCat best practices
        const hasAccess = await validatePremiumAccess();
        if (__DEV__) {
          console.log('📱 Premium access validation after gallery selection:', hasAccess);
        }
        
        router.push(`/crop-modal?imageUri=${encodeURIComponent(result.assets[0].uri)}&functionType=${functionType}&imageSource=gallery`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Gallery error:', error);
      }
    }
  }, [router, functionType]);

  const toggleFlash = useCallback(() => {
    if (__DEV__) {
      console.log('🔦 Flash button clicked - USER INITIATED');
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnableTorch(current => {
      const newValue = !current;
      if (__DEV__) {
        console.log(`🔦 setEnableTorch: ${current} → ${newValue} (USER CLICK)`);
      }
      return newValue;
    });
  }, []);

  // Debug function to manually reset camera state (for testing)
  const resetCameraState = useCallback(() => {
    if (__DEV__) {
      console.log('🔧 Manually resetting camera state');
      setIsCapturing(false);
      Alert.alert('Camera Reset', 'Camera state has been reset.');
    }
  }, []);

  const handleModePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowModeSelector(true);
  }, []);

  // Use translated modes for ModeSelector
  const mutableModes = modes.map(mode => ({ ...mode }));

  // Update handleModeSelect to accept modeId: string
  const handleModeSelect = useCallback((modeId: string) => {
    // Animate badge transition
    badgeScale.value = withSequence(
      withSpring(1.1, { damping: 15 }),
      withSpring(1, { damping: 15 })
    );
    badgeOpacity.value = withSequence(
      withTiming(0.7, { duration: 150 }),
      withTiming(1, { duration: 150 })
    );
    setFunctionType(modeId as ModeType);
    setShowModeSelector(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const getCurrentMode = useCallback(() => {
    return modes.find(mode => mode.id === functionType) || modes[0];
  }, [functionType, modes]);


  // SIMPLIFIED: Only check permission - isAppReady is handled immediately
  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <IconSymbol name="camera" size={64} color="#f97316" />
        <Text style={{ color: 'white', fontSize: 18, marginTop: 16 }}>
          Checking camera permissions...
        </Text>
      </View>
    );
  }
  
  // Show loading only if app isn't ready AND we don't have permission yet
  if (!isAppReady && permission.status !== 'granted') {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
        <IconSymbol name="camera" size={64} color="#f97316" />
        <Text style={{ color: 'white', fontSize: 18, marginTop: 16 }}>
          Getting camera ready...
        </Text>
      </View>
    );
  }

  if (permission.status === 'denied') {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <IconSymbol name="camera" size={64} color="#fff" />
        <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 16, marginBottom: 8 }}>Camera Permission Denied</Text>
        <Text style={{ color: 'white', opacity: 0.7, textAlign: 'center', marginBottom: 24 }}>
          Please enable camera permission in your device settings.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ backgroundColor: '#f97316', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999 }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (permission.status === 'granted') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }} edges={['top', 'left', 'right']}>
        {isCameraActive ? (
          <CameraView 
            ref={cameraRef}
            style={{ flex: 1 }} 
            facing={facing}
            enableTorch={enableTorch}
            onCameraReady={() => {
              if (__DEV__) {
                console.log('📸 Camera ready after mount/resume');
              }
            }}
            onMountError={(error) => {
              if (__DEV__) {
                console.error('Camera mount error:', error);
              }
              // Retry camera initialization
              setIsCameraActive(false);
              setTimeout(() => setIsCameraActive(true), 1000);
            }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: 'black' }} />
        )}
          
          {/* Flash overlay animation */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'white',
                pointerEvents: 'none',
              },
              animatedFlashStyle,
            ]}
          />


          {/* Top Controls */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 12, paddingHorizontal: 16, zIndex: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Settings Button */}
              <TouchableOpacity
                onPress={() => router.push('/settings-modal')}
                style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', zIndex: 20 }}
              >
                <IconSymbol name="gear" size={28} color="#fff" />
              </TouchableOpacity>

              {/* Mode Selector Badge - Absolutely Centered */}
              <View style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity onPress={handleModePress} activeOpacity={0.8}>
                <Animated.View
                  style={[
                    { 
                      backgroundColor: 'rgba(249,115,22,0.9)', 
                      paddingHorizontal: 16, 
                      paddingVertical: 9, 
                      borderRadius: 22, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      gap: 7,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.2)',
                      minWidth: 110
                    },
                    animatedBadgeStyle
                  ]}
                >
                  <IconSymbol name={getCurrentMode().icon} size={16} color="white" />
                  <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>
                    {getCurrentMode().shortName}
                  </Text>
                  <IconSymbol name="chevron.down" size={14} color="white" />
                </Animated.View>
                </TouchableOpacity>
              </View>

              {/* Pro Button - Conditional Rendering */}
              <View style={{
                width: 80,
                height: 36, // Reduced from 42 to match mode selector height
                borderRadius: 18, // Adjusted radius to match new height
                overflow: 'hidden',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
              }}>
                {isPro ? (
                  // PRO Member Button - Static with checkmark
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        'Already Pro!',
                        'You have unlimited photo restorations!',
                        [{ text: 'Awesome!' }]
                      );
                    }}
                    style={{ 
                      width: 80, 
                      height: 36, // Reduced from 42
                      backgroundColor: '#1a1a1a', // Premium dark background
                      borderRadius: 18, // Reduced from 21
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 4,
                      borderWidth: 1.5,
                      borderColor: '#22c55e', // Green border instead of fill
                    }}
                  >
                    <IconSymbol name="checkmark.circle.fill" size={16} color="#22c55e" />
                    <Text style={{ 
                      color: '#22c55e', 
                      fontSize: 13, 
                      fontWeight: '800', 
                      letterSpacing: 0.3
                    }}>PRO</Text>
                  </TouchableOpacity>
                ) : (
                  // Non-PRO Button - Animated with crown
                  <>
                    {/* Rotating gradient background */}
                    <AnimatedLinearGradient
                      colors={['transparent', '#f97316', 'transparent', '#f97316', 'transparent']}
                      locations={[0, 0.2, 0.3, 0.8, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[
                        {
                          position: 'absolute',
                          width: 120,
                          height: 120,
                          borderRadius: 60,
                        },
                        proRotatingGradientStyle
                      ]}
                    />
                    
                    {/* Mask/Inner button */}
                    <AnimatedTouchableOpacity
                      onPress={async () => {
                        if (__DEV__) {
                          console.log('🎯 Pro button pressed - showing native paywall');
                        }
                        
                        // Check if we're in Expo Go
                        const isExpoGo = Constants.appOwnership === 'expo';
                        if (isExpoGo) {
                          Alert.alert(
                            'Demo Mode',
                            'Purchases are not available in Expo Go. Build a development client to test real purchases.',
                            [{ text: 'OK' }]
                          );
                          return;
                        }
                        
                        // Use native paywall in production builds
                        const success = await presentPaywall();
                        if (success) {
                          if (__DEV__) {
                            console.log('✅ Pro subscription activated via native paywall!');
                          }
                          Alert.alert(
                            'Welcome to Pro!',
                            'You now have unlimited photo restorations!',
                            [{ text: 'Awesome!' }]
                          );
                        }
                      }}
                      style={{ 
                        width: 76, 
                        height: 32, // Reduced from 38
                        backgroundColor: 'rgba(26, 26, 26, 0.95)', // Premium dark with slight transparency
                        borderRadius: 16, // Reduced from 19
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 4,
                        margin: 2, // Creates the border effect
                      }}
                    >
                      <IconSymbol name="crown" size={16} color="#f97316" />
                      <Text style={{ 
                        color: '#f97316', 
                        fontSize: 13, 
                        fontWeight: '700', 
                        letterSpacing: 0.3
                      }}>PRO</Text>
                    </AnimatedTouchableOpacity>
                  </>
                )}
              </View>
            </View>

          </View>

          {/* Bottom Controls */}
          <View style={{ position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              {/* Gallery Button with Count Badge */}
              <TouchableOpacity
                onPress={() => router.push('/gallery')}
                style={{ position: 'absolute', left: 32, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
              >
                <IconSymbol name="rectangle.stack" size={32} color="#fff" />
                {restorationCount > 0 && (
                  <View style={{ 
                    position: 'absolute', 
                    top: 4, 
                    right: 4, 
                    backgroundColor: '#f97316', 
                    borderRadius: 12, 
                    minWidth: 24, 
                    height: 24, 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderWidth: 2, 
                    borderColor: '#000',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 5
                  }}>
                    <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                      {restorationCount > 99 ? '99+' : restorationCount.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Capture Button with Glow and Flash */}
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {/* Small Flash Button Above Capture - Only show if enabled in settings */}
                {showFlashButton && (
                  <TouchableOpacity
                    onPress={toggleFlash}
                    style={{
                      position: 'absolute',
                      top: -60,
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: enableTorch ? 'rgba(249,115,22,0.15)' : 'rgba(0,0,0,0.4)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: enableTorch ? 'rgba(249,115,22,0.8)' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    <IconSymbol 
                      name={enableTorch ? 'bolt.fill' : 'bolt.slash'} 
                      size={20} 
                      color={enableTorch ? '#f97316' : '#fff'} 
                    />
                  </TouchableOpacity>
                )}
                {/* Glow Effect */}
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      width: 90,
                      height: 90,
                      borderRadius: 45,
                      backgroundColor: '#f97316',
                      shadowColor: '#f97316',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 20,
                      elevation: 20,
                    },
                    animatedGlowStyle,
                  ]}
                />
                <AnimatedTouchableOpacity
                  onPress={handleCapture}
                  disabled={isCapturing}
                  style={[
                    {
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: isCapturing ? '#9ca3af' : '#f97316',
                      borderWidth: 4,
                      borderColor: '#fff',
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: isCapturing ? 0.6 : 1,
                    },
                    animatedCaptureStyle,
                  ]}
                >
                  <View style={{ width: 64, height: 64, backgroundColor: 'white', borderRadius: 32 }} />
                </AnimatedTouchableOpacity>
              </View>

              {/* Upload Button */}
              <TouchableOpacity
                onPress={handleGalleryPress}
                style={{ position: 'absolute', right: 32, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <IconSymbol name="photo.stack" size={32} color="#fff" />
                </View>
              </TouchableOpacity>
            </View>
          </View>


          {/* Mode Selector Modal */}
          <ModeSelector
            visible={showModeSelector}
            modes={mutableModes}
            selectedMode={functionType}
            onSelect={handleModeSelect}
            onClose={() => setShowModeSelector(false)}
          />

      </SafeAreaView>
    );
  }

  return null;
}