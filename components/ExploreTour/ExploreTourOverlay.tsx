import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Image as ExpoImage } from 'expo-image';
import { Image } from 'react-native';
import { useSavePhoto } from '@/hooks/useSavePhoto';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { SavingModal, type SavingModalRef } from '@/components/SavingModal';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { presentPaywall } from '@/services/revenuecat';

interface TourStep {
  id: string;
  title: string;
  description: string;
  duration: number;
}

interface HighlightArea {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

interface ExploreTourOverlayProps {
  visible: boolean;
  currentStep: number;
  steps: TourStep[];
  highlightArea: HighlightArea | null;
  showSheet?: boolean;
  generateButtonRef?: React.RefObject<TouchableOpacity>;
  insets?: { bottom: number };
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onCTAPress?: () => void;
}

export function ExploreTourOverlay({
  visible,
  currentStep,
  steps,
  highlightArea,
  showSheet = false,
  generateButtonRef,
  insets,
  onNext,
  onSkip,
  onComplete,
  onCTAPress
}: ExploreTourOverlayProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const savePhotoMutation = useSavePhoto();
  const router = useRouter();
  const [isAutoAdvancing, setIsAutoAdvancing] = React.useState(false); // Disable auto-advance
  const [showSuccess, setShowSuccess] = React.useState(false);
  const [tourLoading, setTourLoading] = React.useState(false);
  const [tourProgress, setTourProgress] = React.useState(0);
  const [tourResult, setTourResult] = React.useState(false);
  const [showSavingModal, setShowSavingModal] = React.useState(false);
  const savingModalRef = React.useRef<SavingModalRef>(null);
  
  // Progress-based loading messages (matching real QuickEditSheet)
  const getTourLoadingMessage = (p: number) => {
    if (p < 20) return 'Uploading photo…';
    if (p < 40) return 'Running magic…';
    if (p < 70) return 'Fixing damage…';
    if (p < 90) return 'Enhancing details…';
    return 'Almost done…';
  };

  // Centralized generate action for both buttons
  const handleGenerateAction = React.useCallback(() => {
    console.log('🎯 Generate action triggered');
    
    // Start loading simulation
    setTourLoading(true);
    setTourProgress(0);
    
    // 2-second loading timeline (400ms intervals)
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const totalDuration = 2000; // 2 seconds
      const progress = Math.min(95, Math.floor((elapsed / totalDuration) * 95));
      setTourProgress(progress);
      
      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setTourLoading(false);
        setTourResult(true);
        // Advance to step 3 but keep sheet visible
        console.log('🎯 Loading complete - advancing to step 3');
        setTimeout(() => onNext(), 200);
      }
    }, 400);
  }, [onNext]);

  // Create tour demo restoration data
  const createTourRestoration = React.useCallback(async () => {
    try {
      // Get image URIs from bundle using proper React Native Image API
      const originalUri = Image.resolveAssetSource(require('../../assets/images/bw.jpeg')).uri;
      const restoredUri = Image.resolveAssetSource(require('../../assets/images/clr.jpeg')).uri;
      
      // Store tour restoration data for the restoration screen
      const tourRestorationData = {
        id: 'tour-demo-colorize',
        originalImageUri: originalUri,
        restoredImageUri: restoredUri,
        functionType: 'colorize' as const,
        styleName: 'Colorize Photo',
        createdAt: new Date().toISOString(),
        isTourDemo: true
      };
      
      // Store in AsyncStorage for the restoration screen to access
      await AsyncStorage.setItem('tourRestorationData', JSON.stringify(tourRestorationData));
      console.log('🎯 Tour restoration data stored successfully', { originalUri, restoredUri });
      return tourRestorationData;
    } catch (error) {
      console.error('🎯 Failed to create tour restoration:', error);
    }
    return null;
  }, []);
  
  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const highlightTransition = useSharedValue(1);
  const stepTransition = useSharedValue(1);
  
  // Success animation values
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const buttonScale = useSharedValue(1);
  const exitOpacity = useSharedValue(1);

  React.useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 300 });
      tooltipOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
      stepTransition.value = withTiming(1, { duration: 300 });
      
      // Subtle continuous pulse
      const startPulse = () => {
        pulseScale.value = withTiming(1.03, { duration: 1800 }, () => {
          pulseScale.value = withTiming(1, { duration: 1800 }, () => {
            if (visible) runOnJS(startPulse)();
          });
        });
      };
      startPulse();
    } else {
      overlayOpacity.value = withTiming(0, { duration: 300 });
      tooltipOpacity.value = withTiming(0, { duration: 300 });
      stepTransition.value = withTiming(0, { duration: 300 });
      pulseScale.value = 1;
      
      setShowSuccess(false);
      setTourLoading(false);
      setTourProgress(0);
      setTourResult(false);
    }
  }, [visible]);

  // Smooth step transitions - single transition without double fade
  React.useEffect(() => {
    if (visible && currentStep >= 0) {
      stepTransition.value = withTiming(1, { duration: 300 });
    }
  }, [currentStep]);

  // Animate highlight transitions - simplified to single transition
  React.useEffect(() => {
    if (highlightArea) {
      highlightTransition.value = withTiming(1, { duration: 300 });
    }
  }, [highlightArea]);

  // Success animation sequence - smooth and premium
  const startSuccessAnimation = React.useCallback(() => {
    // Immediate feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Success);
    
    // Smooth button feedback
    buttonScale.value = withSpring(0.95, { damping: 20, stiffness: 300 });
    
    // Hide original content first
    tooltipOpacity.value = withTiming(0, { duration: 300 });
    
    // Show success state with coordinated delay
    setTimeout(() => {
      setShowSuccess(true);
    }, 300);
    
    // Smooth entrance animations with consistent timing
    successOpacity.value = withDelay(300, withSpring(1, { damping: 20, stiffness: 80 }));
    successScale.value = withDelay(300, withSpring(1, { damping: 18, stiffness: 100 }));
  }, [buttonScale, successOpacity, successScale, tooltipOpacity]);
  
  // Reset animation values when success state changes
  React.useEffect(() => {
    if (!showSuccess) {
      // Reset animation values for next time
      successOpacity.value = 0;
      successScale.value = 0.8;
      buttonScale.value = 1;
    }
  }, [showSuccess, successOpacity, successScale, buttonScale]);

  // Auto-advance disabled - removed to prevent crashes

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [
      { translateY: (1 - tooltipOpacity.value) * 20 },
      { scale: 0.95 + tooltipOpacity.value * 0.05 }
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: highlightTransition.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const successCardStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [
      { scale: successScale.value },
      { translateY: (1 - successOpacity.value) * 30 }
    ],
  }));

  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ scale: exitOpacity.value }]
  }));

  // Smooth exit animation function
  const handleSmoothExit = React.useCallback(() => {
    'worklet';
    exitOpacity.value = withTiming(0, { 
      duration: 600, 
      easing: Easing.in(Easing.cubic) 
    }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(onComplete)();
      }
    });
  }, [exitOpacity, onComplete]);


  if (!visible || !steps[currentStep]) {
    return null;
  }

  const currentTourStep = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Smart tooltip positioning to avoid blocking highlighted elements
  const getTooltipPosition = () => {
    const horizontalPadding = 20;
    const tooltipPadding = 20; // Space between tooltip and highlighted area
    const safeTopArea = (insets?.top || safeAreaInsets.top) + 60;
    const safeBottomArea = (insets?.bottom || safeAreaInsets.bottom) + 80;
    
    if (highlightArea) {
      const highlightBottom = highlightArea.y + highlightArea.height;
      const highlightTop = highlightArea.y;
      const screenCenter = SCREEN_HEIGHT / 2;
      
      // If highlight is in upper half, position tooltip below it
      if (highlightTop < screenCenter) {
        const topPosition = highlightBottom + tooltipPadding;
        // Ensure we don't go too close to bottom
        if (topPosition + 200 < SCREEN_HEIGHT - safeBottomArea) {
          return {
            top: topPosition,
            left: horizontalPadding,
            right: horizontalPadding,
          };
        }
      }
      
      // If highlight is in lower half, position tooltip above it
      if (highlightTop > screenCenter) {
        const bottomPosition = SCREEN_HEIGHT - highlightTop + tooltipPadding;
        // Ensure we don't go too close to top
        if (highlightTop - 200 > safeTopArea) {
          return {
            bottom: bottomPosition,
            left: horizontalPadding,
            right: horizontalPadding,
          };
        }
      }
    }
    
    // Fallback: position in bottom area
    return {
      bottom: safeBottomArea,
      left: horizontalPadding,
      right: horizontalPadding,
    };
  };

  const renderHighlightCutout = () => {
    if (!highlightArea) return null;

    return (
      <View style={styles.cutoutContainer}>
        {/* Top cutout */}
        <View
          style={[
            styles.cutout,
            {
              top: 0,
              left: 0,
              right: 0,
              height: highlightArea.y,
            },
          ]}
        />
        
        {/* Left cutout */}
        <View
          style={[
            styles.cutout,
            {
              top: highlightArea.y,
              left: 0,
              width: highlightArea.x,
              height: highlightArea.height,
            },
          ]}
        />
        
        {/* Right cutout */}
        <View
          style={[
            styles.cutout,
            {
              top: highlightArea.y,
              right: 0,
              left: highlightArea.x + highlightArea.width,
              height: highlightArea.height,
            },
          ]}
        />
        
        {/* Bottom cutout */}
        <View
          style={[
            styles.cutout,
            {
              bottom: 0,
              left: 0,
              right: 0,
              top: highlightArea.y + highlightArea.height,
            },
          ]}
        />

        {/* Highlight border */}
        <Animated.View
          style={[
            styles.highlightBorder,
            pulseStyle,
            {
              top: highlightArea.y - 2,
              left: highlightArea.x - 2,
              width: highlightArea.width + 4,
              height: highlightArea.height + 4,
              borderRadius: (highlightArea.borderRadius || 0) + 2,
            },
          ]}
        />
      </View>
    );
  };

  const renderTourSheet = () => {
    if (!showSheet || showSuccess) return null;

    const usedInsets = insets || safeAreaInsets;
    const MEDIA_HEIGHT = 240;

    return (
      <View style={{ 
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 20, 
        borderTopRightRadius: 20, 
        overflow: 'hidden', 
        backgroundColor: 'rgba(12,12,14,0.96)', 
        borderTopWidth: 1, 
        borderColor: 'rgba(255,255,255,0.12)',
        zIndex: 5,
        elevation: 5
      }}>
        <View style={{ 
          padding: 16, 
          paddingBottom: Math.max(12, usedInsets.bottom + 8) 
        }}>
          {/* Header - matching real QuickEditSheet exactly */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ width: 24, height: 24 }} />
            <Text style={{ color: '#EAEAEA', fontSize: 16, fontFamily: 'Lexend-Bold' }}>
              Colorize Photo
            </Text>
            <View style={{ width: 24, height: 24 }} />
          </View>

          {/* Photo Container - matching QuickEditSheet exactly */}
          <View style={{ 
            height: MEDIA_HEIGHT, 
            borderRadius: 16, 
            overflow: 'hidden', 
            borderWidth: 1, 
            borderColor: 'rgba(255,255,255,0.18)', 
            backgroundColor: 'rgba(255,255,255,0.06)', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 20
          }}>
            {/* Before/After Image */}
            <ExpoImage 
              source={tourResult ? require('../../assets/images/clr.jpeg') : require('../../assets/images/bw.jpeg')}
              style={{ width: '100%', height: '100%' }} 
              contentFit="contain" 
              cachePolicy="memory"
              transition={0}
            />
            
            {/* Loading Overlay - exact copy from real QuickEditSheet */}
            {tourLoading && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>Please wait a few seconds</Text>
                  <Text style={{ color: '#F59E0B', fontSize: 16, fontFamily: 'Lexend-Black', textAlign: 'center' }}>
                    {getTourLoadingMessage(tourProgress)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Buttons - Show different buttons based on tour state */}
          {!tourResult ? (
            /* Initial Crop/Generate Buttons */
            <View style={{ flexDirection: 'row', gap: 12, position: 'relative' }}>
              <TouchableOpacity 
                disabled={tourLoading}
                style={{
                  flex: 1, 
                  height: 56, 
                  borderRadius: 28, 
                  backgroundColor: 'rgba(255,255,255,0.1)', 
                  borderWidth: 1, 
                  borderColor: 'rgba(255,255,255,0.25)', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  opacity: tourLoading ? 0.5 : 1
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Crop</Text>
              </TouchableOpacity>
              
              {/* Generate Button Container with Highlight */}
              <View style={{ flex: 1, position: 'relative' }}>
                {/* Highlight Border - only show when not loading */}
                {!tourLoading && (
                  <Animated.View style={[
                    {
                      position: 'absolute',
                      top: -3,
                      left: -3,
                      right: -3,
                      bottom: -3,
                      borderRadius: 31,
                      borderWidth: 3,
                      borderColor: '#10B981'
                    },
                    pulseStyle
                  ]} />
                )}
                
                <Animated.View style={buttonAnimatedStyle}>
                  <TouchableOpacity
                    ref={generateButtonRef}
                    disabled={tourLoading}
                    style={{
                      flex: 1, 
                      height: 56, 
                      borderRadius: 28, 
                      overflow: 'hidden', 
                      borderWidth: 1, 
                      borderColor: 'rgba(255,255,255,0.25)',
                      opacity: tourLoading ? 0.7 : 1
                    }}
                    onPress={handleGenerateAction}
                  >
                    <View style={{ 
                      position: 'absolute', 
                      top: 0, 
                      left: 0, 
                      right: 0, 
                      bottom: 0,
                      backgroundColor: '#F59E0B'
                    }} />
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <IconSymbol name="checkmark" size={20} color="#0B0B0F" />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          ) : (
            /* Result Save/View Buttons - matching real QuickEditSheet done state */
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onPress={async () => {
                  console.log('🎯 View Result clicked in tour');
                  
                  try {
                    // Navigate to dedicated tour demo screen
                    router.push('/restoration/tour-demo?tourComplete=true');
                    
                    // Complete the tour overlay
                    onComplete();
                  } catch (error) {
                    console.error('🎯 Failed to navigate to tour demo:', error);
                    // Fallback to just completing the tour
                    onComplete();
                  }
                }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Lexend-Bold', fontSize: 16 }}>View Result</Text>
              </TouchableOpacity>
              
              <Animated.View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    height: 56,
                    borderRadius: 28,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.25)'
                  }}
                  onPress={async () => {
                    console.log('🎯 Save button clicked in tour');
                    try {
                      // Show saving modal first
                      setShowSavingModal(true);
                      
                      // Haptic feedback
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      
                      // Load the bundled asset using expo-asset for proper handling
                      const asset = Asset.fromModule(require('../../assets/images/clr.jpeg'));
                      await asset.downloadAsync();
                      
                      // Use MediaLibrary for direct saving (more reliable than useSavePhoto hook)
                      const { requestPermissionsAsync, createAssetAsync } = await import('expo-media-library');
                      const { status } = await requestPermissionsAsync();
                      
                      if (status !== 'granted') {
                        throw new Error('Photo library access denied');
                      }
                      
                      // Save to camera roll
                      const mediaAsset = await createAssetAsync(asset.localUri || asset.uri);
                      console.log('🎯 Demo image saved successfully:', mediaAsset.id);
                      
                      // Trigger success state in saving modal
                      savingModalRef.current?.showSuccess();
                      
                      // Show success feedback
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      
                      // After saving modal completes, show tour success modal
                      setTimeout(() => {
                        startSuccessAnimation();
                      }, 800); // Give saving modal time to complete
                      
                    } catch (error) {
                      console.error('🎯 Failed to save demo image:', error);
                      
                      // Hide saving modal on error
                      setShowSavingModal(false);
                      
                      // Show error feedback
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      
                      // Still show tour success even if save failed
                      setTimeout(() => {
                        startSuccessAnimation();
                      }, 500);
                    }
                  }}
                >
                  <View style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    bottom: 0,
                    backgroundColor: '#10B981'
                  }} />
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#0B0B0F', fontFamily: 'Lexend-Bold', fontSize: 16 }}>Save</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </View>
      </View>
    );
  };


  const renderSuccessCard = () => {
    if (!showSuccess) return null;

    const usedInsets = insets || safeAreaInsets;
    const horizontalPadding = 20;
    const cardPadding = 32; // More generous padding for premium feel

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: usedInsets.top + 40,
          paddingBottom: usedInsets.bottom + 40,
          paddingHorizontal: horizontalPadding,
          zIndex: 999,
        }}
      >
        <Animated.View 
          style={[
            {
              width: '100%',
              maxWidth: 400, // Maximum width for larger screens
              backgroundColor: '#0B0B0F', // Solid background for shadow optimization
              borderRadius: 32,
              padding: cardPadding,
              borderWidth: 1.5,
              borderColor: 'rgba(255, 255, 255, 0.12)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
              elevation: 10,
              // Add subtle backdrop blur effect
              backdropFilter: 'blur(20px)',
            },
            successCardStyle,
            exitStyle
          ]}
        >
        {/* Success Icon */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: '#10B981',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12
          }}>
            <IconSymbol name="checkmark" size={28} color="#FFFFFF" />
          </View>
          
          <Text style={{
            fontSize: 20,
            fontFamily: 'Lexend-SemiBold',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 8
          }}>
It's that easy!
          </Text>
          
          <Text style={{
            fontSize: 14,
            color: '#A1A1AA',
            textAlign: 'center',
            lineHeight: 20
          }}>
Now you know how to use all our tools.
          </Text>
        </View>

        {/* Simplified progress */}
        <View style={{ 
          alignItems: 'center', 
          marginBottom: 20,
          paddingHorizontal: 20 
        }}>
          <View style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.2)'
          }}>
            <Text style={{
              fontSize: 13,
              color: '#10B981',
              textAlign: 'center',
              fontFamily: 'Lexend-Medium'
            }}>
              ✓ Tutorial Complete
            </Text>
          </View>
        </View>

        {/* Pro upgrade section */}
        <View style={{
          backgroundColor: 'rgba(249, 115, 22, 0.08)',
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: 'rgba(249, 115, 22, 0.15)'
        }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconSymbol name="sparkles" size={18} color="#10B981" />
              <Text style={{
                fontSize: 16,
                fontFamily: 'Lexend-SemiBold',
                color: '#10B981',
                marginLeft: 6
              }}>
                Unlock Pro Features
              </Text>
            </View>
          </View>
          
          <Text style={{
            fontSize: 13,
            color: '#A1A1AA',
            lineHeight: 19,
            marginBottom: 16,
            textAlign: 'center'
          }}>
            Unlimited restorations • Premium styles • Priority processing
          </Text>
          
          <TouchableOpacity
            style={{
              height: 50,
              borderRadius: 25,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onPress={async () => {
              console.log('CTA clicked');
              try {
                // Show paywall
                await presentPaywall();
                // After paywall, complete the tour
                onComplete();
              } catch (error) {
                console.error('Paywall error:', error);
                // If paywall fails, still complete the tour
                onComplete();
              }
            }}
          >
            <LinearGradient
              colors={['#FF7A00', '#FFB54D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              }}
            />
            <Text style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontFamily: 'Lexend-Bold'
            }}>
              Get Unlimited
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip option */}
        <TouchableOpacity
          onPress={handleSmoothExit}
          style={{ paddingVertical: 12 }}
        >
          <Text style={{
            color: '#6B7280',
            fontSize: 14,
            textAlign: 'center',
            fontFamily: 'Lexend-Medium'
          }}>
            Maybe Later
          </Text>
        </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onSkip}
      hardwareAccelerated
      supportedOrientations={['portrait']}
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {/* Backdrop touchable to handle dismissal - only allow on step 1 */}
        {currentStep === 0 && !showSuccess && (
          <Pressable 
            style={StyleSheet.absoluteFillObject}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tour"
          />
        )}
        {renderHighlightCutout()}
        
        {/* Tour Sheet - render first so it appears behind tooltip */}
        {renderTourSheet()}
        
        {/* Tooltip - show in different positions based on showSheet */}
        {showSheet && !showSuccess ? (
          /* Floating tooltip above sheet for step 2/3 */
          <Animated.View
            style={[
              styles.tooltip,
              {
                position: 'absolute',
                top: SCREEN_HEIGHT * 0.12,
                left: 24,
                right: 24,
              },
              tooltipStyle,
            ]}
          >
            <View style={styles.tooltipContent}>
              <Text style={styles.tooltipTitle}>{currentTourStep.title}</Text>
              <Text style={styles.tooltipDescription}>{currentTourStep.description}</Text>
              
              {/* Progress indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  {steps.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.progressDot,
                        index <= currentStep ? styles.progressDotActive : styles.progressDotInactive
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.progressText}>
                  {currentStep + 1} of {steps.length}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => {
                    setIsAutoAdvancing(false);
                    // Show success modal instead of immediately skipping
                    startSuccessAnimation();
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
                
                <OnboardingButton
                  title={isLastStep ? "Got it!" : "Next"}
                  onPress={() => {
                    setIsAutoAdvancing(false);
                    if (isLastStep) {
                      // For result step (step 3), don't auto-trigger success modal
                      // Let user interact with save/view buttons instead
                      const currentTourStep = steps[currentStep];
                      if (currentTourStep?.id === 'result') {
                        // Stay on result step, user will manually exit via save/view
                        console.log('🎯 Result step - staying active for user interaction');
                        return;
                      } else {
                        setTimeout(() => startSuccessAnimation(), 100);
                      }
                    } else {
                      // User is in generate step, trigger the generate action
                      console.log('🎯 Step 2 Next button - triggering generate action');
                      handleGenerateAction();
                    }
                  }}
                  variant="primary"
                  size="medium"
                  style={styles.nextButton}
                />
              </View>
            </View>
          </Animated.View>
        ) : !showSuccess ? (
          <Animated.View
            style={[
              styles.tooltip,
              getTooltipPosition(),
              tooltipStyle,
            ]}
          >
            <View style={styles.tooltipContent}>
              <Text style={styles.tooltipTitle}>{currentTourStep.title}</Text>
              <Text style={styles.tooltipDescription}>{currentTourStep.description}</Text>
              
              {/* Progress indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  {steps.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.progressDot,
                        index <= currentStep ? styles.progressDotActive : styles.progressDotInactive
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.progressText}>
                  {currentStep + 1} of {steps.length}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={() => {
                    setIsAutoAdvancing(false);
                    // Show success modal instead of immediately skipping
                    startSuccessAnimation();
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
                
                <OnboardingButton
                  title={isLastStep ? "Got it!" : "Next"}
                  onPress={() => {
                    setIsAutoAdvancing(false);
                    if (isLastStep) {
                      // For result step, don't auto-trigger success modal
                      // Let user interact with save/view buttons instead
                      const currentTourStep = steps[currentStep];
                      if (currentTourStep?.id === 'result') {
                        // Stay on result step, user will manually exit via save/view
                        console.log('🎯 Result step - staying active for user interaction');
                        return;
                      } else {
                        setTimeout(() => startSuccessAnimation(), 100);
                      }
                    } else {
                      setTimeout(() => onNext(), 100);
                    }
                  }}
                  variant="primary"
                  size="medium"
                  style={styles.nextButton}
                />
              </View>
            </View>
          </Animated.View>
        ) : null}
        
        {/* Success card - render last to appear on top of everything */}
        {renderSuccessCard()}
        
        {/* Saving Modal */}
        <SavingModal 
          ref={savingModalRef}
          visible={showSavingModal} 
          onComplete={() => setShowSavingModal(false)}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Even lighter overlay for premium feel
    position: 'relative',
  },
  cutoutContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  cutout: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Slightly darker for better contrast
  },
  highlightBorder: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: 'transparent',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#0B0B0F', // Solid background for shadow optimization
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
  },
  tooltipContent: {
    padding: 24,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  tooltipDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#10B981',
  },
  progressDotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    marginLeft: 16,
  },
});