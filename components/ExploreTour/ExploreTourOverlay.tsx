import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { IconSymbol } from '@/components/ui/IconSymbol';

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
  onComplete
}: ExploreTourOverlayProps) {
  const safeAreaInsets = useSafeAreaInsets();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const [isAutoAdvancing, setIsAutoAdvancing] = React.useState(false); // Disable auto-advance
  
  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const highlightTransition = useSharedValue(1);

  React.useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 300 });
      tooltipOpacity.value = withTiming(1, { duration: 400 });
      
      // Continuous subtle pulse for highlighted area
      const startPulse = () => {
        pulseScale.value = withSpring(1.08, { damping: 12 }, () => {
          pulseScale.value = withSpring(1, { damping: 12 }, () => {
            if (visible) {
              setTimeout(startPulse, 1500); // Repeat every 1.5s
            }
          });
        });
      };
      startPulse();
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      tooltipOpacity.value = withTiming(0, { duration: 200 });
      pulseScale.value = 1; // Reset pulse
    }
  }, [visible, currentStep]);

  // Animate highlight transitions
  React.useEffect(() => {
    if (highlightArea) {
      highlightTransition.value = withTiming(0, { duration: 150 }, () => {
        highlightTransition.value = withTiming(1, { duration: 300 });
      });
    }
  }, [highlightArea]);

  // Auto-advance to next step (disabled by default)
  React.useEffect(() => {
    if (visible && isAutoAdvancing && currentStep < steps.length) {
      const step = steps[currentStep];
      const timer = setTimeout(() => {
        if (currentStep === steps.length - 1) {
          runOnJS(onComplete)();
        } else {
          runOnJS(onNext)();
        }
      }, step.duration);

      return () => clearTimeout(timer);
    }
  }, [visible, currentStep, steps, isAutoAdvancing]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: highlightTransition.value,
  }));

  if (!visible || !steps[currentStep]) {
    return null;
  }

  const currentTourStep = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Calculate responsive tooltip position based on highlight area and device size
  const getTooltipPosition = () => {
    const isTablet = SCREEN_WIDTH >= 768;
    const horizontalPadding = isTablet ? SCREEN_WIDTH * 0.2 : 20; // 20% padding on tablets, 20px on phones
    
    if (!highlightArea) {
      return {
        top: SCREEN_HEIGHT * 0.3,
        left: horizontalPadding,
        right: horizontalPadding,
      };
    }

    const highlightCenterY = highlightArea.y + highlightArea.height / 2;
    const isHighlightInTopHalf = highlightCenterY < SCREEN_HEIGHT / 2;
    
    if (isHighlightInTopHalf) {
      // Show tooltip below highlight
      return {
        top: highlightArea.y + highlightArea.height + 20,
        left: horizontalPadding,
        right: horizontalPadding,
      };
    } else {
      // Show tooltip above highlight
      return {
        bottom: SCREEN_HEIGHT - highlightArea.y + 20,
        left: horizontalPadding,
        right: horizontalPadding,
      };
    }
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
    if (!showSheet) return null;

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
        borderColor: 'rgba(255,255,255,0.12)' 
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
                  borderColor: '#f97316',
                  shadowColor: '#f97316',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 12,
                },
                pulseStyle
              ]} />
              
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
                  runOnJS(onComplete)();
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
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        {renderHighlightCutout()}
        
        {/* Tour Sheet - render first so it appears behind tooltip */}
        {renderTourSheet()}
        
        {/* Tooltip - show in different positions based on showSheet */}
        {showSheet ? (
          /* Floating tooltip above sheet for step 3 */
          <Animated.View
            style={[
              styles.tooltip,
              {
                position: 'absolute',
                top: SCREEN_HEIGHT * 0.15,
                left: 20,
                right: 20,
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
                    onComplete();
                  }}
                  variant="primary"
                  size="medium"
                  style={styles.nextButton}
                />
              </View>
            </View>
          </Animated.View>
        ) : (
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
                      onComplete();
                    } else {
                      onNext();
                    }
                  }}
                  variant="primary"
                  size="medium"
                  style={styles.nextButton}
                />
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Lighter overlay
    position: 'relative',
  },
  cutoutContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  cutout: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Lighter cutout
  },
  highlightBorder: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#f97316',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10, // Android shadow
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(11, 11, 15, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  tooltipContent: {
    padding: 20,
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