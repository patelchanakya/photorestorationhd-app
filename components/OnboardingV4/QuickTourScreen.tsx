import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  runOnJS
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';

interface QuickTourScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Mock navigation sections for demo
const TOUR_NAVIGATION_SECTIONS = [
  { id: 'magic', title: 'Photo Magic', isActive: false },
  { id: 'repair', title: 'Fix My Photo', isActive: true },
  { id: 'backgrounds', title: 'Backgrounds', isActive: false },
  { id: 'outfits', title: 'Outfits', isActive: false },
];

// Mock style tiles for demo
const TOUR_STYLE_TILES = [
  { id: 'restoration', title: 'Restore', image: '🔧' },
  { id: 'colorize', title: 'Colorize', image: '🎨' },
  { id: 'unblur', title: 'Unblur', image: '✨' },
  { id: 'enlighten', title: 'Brighten', image: '☀️' },
];

const TOUR_STEPS = [
  {
    id: 'navigation',
    title: 'Jump between sections instantly',
    description: 'Navigation pills pulse',
    duration: 2000,
  },
  {
    id: 'selection',
    title: 'Tap any style to start',
    description: 'One tile bounces',
    duration: 3000,
  },
  {
    id: 'preview',
    title: 'Your photo appears here → Tap to create',
    description: 'Quick sheet demo',
    duration: 5000,
  },
];

export function QuickTourScreen({ onComplete, onSkip }: QuickTourScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isAutoAdvancing, setIsAutoAdvancing] = React.useState(true);

  const titleOpacity = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const progressOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  
  // Animation values for different demo elements
  const navigationPulse = useSharedValue(1);
  const tilesBounce = useSharedValue(1);
  const sheetSlide = useSharedValue(100);

  React.useEffect(() => {
    // Initial entrance
    titleOpacity.value = withTiming(1, { duration: 400 });
    setTimeout(() => {
      progressOpacity.value = withTiming(1, { duration: 300 });
      buttonsOpacity.value = withTiming(1, { duration: 400 });
    }, 200);

    startTourStep(0);
  }, []);

  const startTourStep = (stepIndex: number) => {
    if (stepIndex >= TOUR_STEPS.length) {
      // Tour complete
      runOnJS(onComplete)();
      return;
    }

    runOnJS(setCurrentStep)(stepIndex);
    
    // Animate step entrance
    stepOpacity.value = withTiming(0, { duration: 200 }, () => {
      stepOpacity.value = withTiming(1, { duration: 400 });
    });

    // Trigger specific animations based on step
    const step = TOUR_STEPS[stepIndex];
    switch (step.id) {
      case 'navigation':
        // Pulse navigation pills
        navigationPulse.value = withRepeat(
          withSequence(
            withSpring(1.1, { damping: 8 }),
            withSpring(1, { damping: 8 })
          ),
          3,
          false
        );
        break;
      
      case 'selection':
        // Bounce style tiles (staggered)
        tilesBounce.value = withRepeat(
          withSequence(
            withSpring(1.15, { damping: 6 }),
            withSpring(1, { damping: 6 })
          ),
          2,
          false
        );
        break;
      
      case 'preview':
        // Slide up Quick Edit sheet demo
        sheetSlide.value = withSpring(0, { damping: 12 });
        setTimeout(() => {
          sheetSlide.value = withSpring(100, { damping: 12 });
        }, 3000);
        break;
    }

    // Auto-advance to next step
    if (isAutoAdvancing) {
      setTimeout(() => {
        startTourStep(stepIndex + 1);
      }, step.duration);
    }
  };

  const handleSkip = () => {
    setIsAutoAdvancing(false);
    onSkip();
  };

  const handleComplete = () => {
    setIsAutoAdvancing(false);
    onComplete();
  };

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const stepStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  const navigationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: navigationPulse.value }],
  }));

  const tilesStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tilesBounce.value }],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetSlide.value }],
  }));

  const currentTourStep = TOUR_STEPS[currentStep];

  return (
    <LinearGradient
      colors={['#0B0B0F', '#1a1a2e']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Skip Button */}
        <View style={styles.header}>
          <Animated.View style={buttonsStyle}>
            <OnboardingButton
              title="Skip"
              onPress={handleSkip}
              variant="ghost"
              size="small"
              style={styles.skipButton}
            />
          </Animated.View>
        </View>

        {/* Tour Content */}
        <View style={styles.tourContent}>
          <Animated.View style={titleStyle}>
            <Text style={styles.mainTitle}>Quick Tour</Text>
            <Text style={styles.subtitle}>Learn the basics in 10 seconds</Text>
          </Animated.View>

          {/* Current Step */}
          <Animated.View style={[styles.stepContainer, stepStyle]}>
            <Text style={styles.stepTitle}>{currentTourStep?.title}</Text>
            
            {/* Interactive Demo Area */}
            <View style={styles.demoArea}>
              {currentStep === 0 && (
                <Animated.View style={navigationStyle}>
                  <View style={styles.navigationDemo}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.navigationPills}>
                        {TOUR_NAVIGATION_SECTIONS.map((section) => (
                          <TouchableOpacity
                            key={section.id}
                            style={[
                              styles.navigationPill,
                              section.isActive && styles.navigationPillActive
                            ]}
                            disabled={true}
                          >
                            <Text style={[
                              styles.navigationPillText,
                              section.isActive && styles.navigationPillTextActive
                            ]}>
                              {section.title}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </Animated.View>
              )}

              {currentStep === 1 && (
                <Animated.View style={tilesStyle}>
                  <View style={styles.tilesDemo}>
                    <View style={styles.tilesGrid}>
                      {TOUR_STYLE_TILES.map((tile, index) => (
                        <TouchableOpacity
                          key={tile.id}
                          style={[
                            styles.styleTile,
                            index === 0 && styles.styleTileHighlight
                          ]}
                          disabled={true}
                        >
                          <Text style={styles.styleTileIcon}>{tile.image}</Text>
                          <Text style={styles.styleTileTitle}>{tile.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </Animated.View>
              )}

              {currentStep === 2 && (
                <View style={styles.previewDemo}>
                  <View style={styles.mockPhoto}>
                    <Text style={styles.mockPhotoText}>Your Photo</Text>
                  </View>
                  <Animated.View style={[styles.quickSheet, sheetStyle]}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>Quick Edit</Text>
                    <Text style={styles.sheetSubtitle}>Tap to create</Text>
                  </Animated.View>
                </View>
              )}
            </View>

            <Text style={styles.stepDescription}>
              {currentTourStep?.description}
            </Text>
          </Animated.View>

          {/* Progress Indicator */}
          <Animated.View style={[styles.progressContainer, progressStyle]}>
            <View style={styles.progressBar}>
              {TOUR_STEPS.map((_, index) => (
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
              {currentStep + 1} of {TOUR_STEPS.length}
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonsStyle}>
            <OnboardingButton
              title="Got it!"
              onPress={handleComplete}
              variant="primary"
              size="large"
            />
          </Animated.View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tourContent: {
    flex: 1,
    justifyContent: 'center',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 40,
  },
  stepContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  demoArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
    padding: 20,
    marginBottom: 20,
    width: '100%',
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Navigation Demo Styles
  navigationDemo: {
    width: '100%',
  },
  navigationPills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  navigationPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navigationPillActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  navigationPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  navigationPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Tiles Demo Styles
  tilesDemo: {
    width: '100%',
  },
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  styleTile: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  styleTileHighlight: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#f97316',
  },
  styleTileIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  styleTileTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Preview Demo Styles
  previewDemo: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    height: 120,
  },
  mockPhoto: {
    width: 80,
    height: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  mockPhotoText: {
    color: '#9CA3AF',
    fontSize: 10,
    textAlign: 'center',
  },
  quickSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 30,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  sheetSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  progressContainer: {
    alignItems: 'center',
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
  bottomContent: {
    paddingHorizontal: 8,
  },
});