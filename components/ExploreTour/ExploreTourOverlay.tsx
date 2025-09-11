import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as Haptics from 'expo-haptics';

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
  const [isAutoAdvancing, setIsAutoAdvancing] = React.useState(false); // Disable auto-advance
  const [showSuccess, setShowSuccess] = React.useState(false);
  
  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const highlightTransition = useSharedValue(1);
  const stepTransition = useSharedValue(1);
  
  // Success animation values
  const successOpacity = useSharedValue(0);
  const successScale = useSharedValue(0.8);
  const buttonScale = useSharedValue(1);

  React.useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 400 });
      tooltipOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
      stepTransition.value = withTiming(1, { duration: 400 });
      
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
      tooltipOpacity.value = withTiming(0, { duration: 200 });
      stepTransition.value = withTiming(0, { duration: 200 });
      pulseScale.value = 1;
      
      setShowSuccess(false);
    }
  }, [visible]);

  // Smooth step transitions
  React.useEffect(() => {
    if (visible && currentStep >= 0) {
      stepTransition.value = withTiming(0, { duration: 200 }, () => {
        stepTransition.value = withTiming(1, { duration: 400 });
      });
    }
  }, [currentStep]);

  // Animate highlight transitions
  React.useEffect(() => {
    if (highlightArea) {
      highlightTransition.value = withTiming(0, { duration: 150 }, () => {
        highlightTransition.value = withTiming(1, { duration: 400 });
      });
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
    
    // Show success state with delay
    setTimeout(() => {
      setShowSuccess(true);
    }, 200);
    
    // Smooth entrance animations
    successOpacity.value = withDelay(250, withSpring(1, { damping: 20, stiffness: 80 }));
    successScale.value = withDelay(250, withSpring(1, { damping: 18, stiffness: 100 }));
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
    opacity: tooltipOpacity.value * stepTransition.value,
    transform: [
      { translateY: (1 - tooltipOpacity.value) * 30 + (1 - stepTransition.value) * 20 },
      { scale: (0.92 + tooltipOpacity.value * 0.08) * (0.95 + stepTransition.value * 0.05) }
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
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontFamily: 'Lexend-SemiBold' }}>
              Photo Restoration
            </Text>
            <View style={{ width: 24, height: 24 }} />
          </View>

          {/* Demo Photo - matching QuickEditSheet exactly */}
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
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Demo Photo</Text>
          </View>

          {/* Buttons - matching QuickEditSheet exactly */}
          <View style={{ flexDirection: 'row', gap: 12, position: 'relative' }}>
            <TouchableOpacity style={{
              flex: 1, 
              height: 56, 
              borderRadius: 28, 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              borderWidth: 1, 
              borderColor: 'rgba(255,255,255,0.25)', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Crop</Text>
            </TouchableOpacity>
            
            {/* Generate Button Container with Highlight */}
            <View style={{ flex: 1, position: 'relative' }}>
              {/* Highlight Border */}
              <Animated.View style={[
                {
                  position: 'absolute',
                  top: -3,
                  left: -3,
                  right: -3,
                  bottom: -3,
                  borderRadius: 31,
                  borderWidth: 3,
                  borderColor: '#f97316'
                },
                pulseStyle
              ]} />
              
              <Animated.View style={buttonAnimatedStyle}>
                <TouchableOpacity
                  ref={generateButtonRef}
                  style={{
                    flex: 1, 
                    height: 56, 
                    borderRadius: 28, 
                    overflow: 'hidden', 
                    borderWidth: 1, 
                    borderColor: 'rgba(255,255,255,0.25)'
                  }}
                  onPress={() => {
                    console.log('🎯 Tour generate button clicked');
                    setTimeout(() => startSuccessAnimation(), 100);
                  }}
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
            successCardStyle
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
              <IconSymbol name="sparkles" size={18} color="#f97316" />
              <Text style={{
                fontSize: 16,
                fontFamily: 'Lexend-SemiBold',
                color: '#f97316',
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
              backgroundColor: '#f97316',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onPress={async () => {
              console.log('CTA clicked');
              if (onCTAPress) {
                try {
                  await onCTAPress();
                } catch (error) {
                  console.log('CTA error:', error);
                }
              }
              // Don't call onComplete immediately - let the paywall handle it
            }}
          >
            <Text style={{
              color: '#0B0B0F',
              fontSize: 15,
              fontFamily: 'Lexend-Bold'
            }}>
              Save & Continue
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip option */}
        <TouchableOpacity
          onPress={() => onComplete()}
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
        {/* Backdrop touchable to handle dismissal - disabled when showing success modal */}
        {!showSuccess && (
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
          /* Floating tooltip above sheet for step 3 */
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
                    onSkip();
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
                
                <OnboardingButton
                  title="Got it!"
                  onPress={() => {
                    setIsAutoAdvancing(false);
                    setTimeout(() => startSuccessAnimation(), 100);
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
                    onSkip();
                  }}
                >
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
                
                <OnboardingButton
                  title={isLastStep ? "Got it!" : "Next"}
                  onPress={() => {
                    setIsAutoAdvancing(false);
                    if (isLastStep) {
                      setTimeout(() => startSuccessAnimation(), 100);
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
    borderColor: '#f97316',
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
    backgroundColor: '#f97316',
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