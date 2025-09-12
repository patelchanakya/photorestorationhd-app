import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from 'react-i18next';
import { ONBOARDING_FEATURES, onboardingUtils } from '@/utils/onboarding';
import { analyticsService } from '@/services/analytics';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { FeatureTileGrid } from './FeatureTileGrid';
import { ONBOARDING_BORDER_RADIUS, ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY } from './shared/constants';

interface FeatureSelectionScreenProps {
  onContinue: (selectedFeature: string, customPrompt?: string) => void;
}

export const FeatureSelectionScreen = React.memo(function FeatureSelectionScreen({ onContinue }: FeatureSelectionScreenProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const [selectedFeature, setSelectedFeature] = React.useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = React.useState<string>('');
  const customInputRef = React.useRef<any>(null);
  const insets = useSafeAreaInsets();
  
  // Track feature selection timing
  const screenStartTime = React.useRef<number>(Date.now());
  const featureSelectionStartTime = React.useRef<number | null>(null);

  
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(100);
  const buttonScale = useSharedValue(0.9);
  const buttonGlow = useSharedValue(0);
  const containerOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Track screen view (fire and forget)
    analyticsService.trackScreenView('onboarding_feature_selection', {
      onboarding_version: 'v3',
      feature_count: ONBOARDING_FEATURES.length.toString()
    });

    // Container fade-in first
    containerOpacity.value = withTiming(1, { duration: 400 });
    
    // Smoother title animation
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 20, stiffness: 150 }));
    
    // Smoother button animation
    buttonOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    buttonTranslateY.value = withDelay(200, withSpring(0, { damping: 20, stiffness: 150 }));
    buttonScale.value = withDelay(200, withSpring(0.98, { damping: 20, stiffness: 150 }));

    // Preload preview media assets for faster navigation
    preloadPreviewAssets();
  }, []);

  const preloadPreviewAssets = () => {
    // Preload key image assets that are likely to be selected
    const priorityImages = [
      require('../../assets/images/popular/colorize/pop-1.png'),
      require('../../assets/images/popular/enhance/pop-3.png'),
      require('../../assets/images/backgrounds/thumbnail/beach/beach.jpeg'),
    ];

    priorityImages.forEach(imageSource => {
      Image.prefetch(imageSource).catch(() => {
        // Silent fail for preloading
      });
    });
  };

  React.useEffect(() => {
    const isCustomPromptSelected = selectedFeature === 'custom_prompt';
    
    // Clear prompt immediately when switching away from custom for cleaner UX
    if (!isCustomPromptSelected && customPrompt) {
      setCustomPrompt('');
    }
    
    // Button is always visible - animate between enabled/disabled states
    const canContinue = selectedFeature && (!isCustomPromptSelected || customPrompt.trim().length > 0);
    
    // Always keep button visible with full opacity
    buttonOpacity.value = withTiming(1, { duration: 250 });
    buttonTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    
    // Scale up with bounce when enabled, slight scale down when disabled
    if (canContinue) {
      buttonScale.value = withSpring(1.02, { damping: 12, stiffness: 250 });
      
      // Start pulsing glow animation when enabled
      buttonGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withTiming(0.3, { duration: 1200 })
        ),
        -1,
        false
      );
    } else {
      buttonScale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
      
      // Stop pulsing when disabled
      buttonGlow.value = withTiming(0, { duration: 300 });
    }
  }, [selectedFeature, customPrompt]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [
      { translateY: buttonTranslateY.value },
      { scale: buttonScale.value }
    ],
    shadowOpacity: 0.4 + (buttonGlow.value * 0.3), // Increase shadow opacity when glowing
    shadowRadius: 16 + (buttonGlow.value * 8), // Increase shadow radius when glowing
  }));


  const handleFeatureSelect = (featureId: string) => {
    try {
      // Stronger haptic feedback for better user awareness
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // Track feature selection with timing (fire and forget)
    const timeSpent = featureSelectionStartTime.current 
      ? Date.now() - featureSelectionStartTime.current 
      : Date.now() - screenStartTime.current;
    
    analyticsService.track('onboarding_feature_selected', {
      feature_id: featureId,
      feature_type: featureId === 'custom_prompt' ? 'custom' : 'preset',
      time_spent_ms: timeSpent.toString(),
      onboarding_version: 'v3'
    });

    // Track first selection timing
    if (!featureSelectionStartTime.current) {
      featureSelectionStartTime.current = Date.now();
      analyticsService.track('onboarding_first_feature_interaction', {
        time_to_first_interaction_ms: timeSpent.toString(),
        onboarding_version: 'v3'
      });
    }

    setSelectedFeature(featureId);
    
    // Auto-focus TextInput when custom_prompt is selected
    if (featureId === 'custom_prompt') {
      // Track custom prompt selection (fire and forget)
      analyticsService.track('onboarding_custom_prompt_selected', {
        onboarding_version: 'v3'
      });
      
      // Add a small delay to allow the expansion animation to start
      setTimeout(() => {
        if (customInputRef.current) {
          customInputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleContinue = () => {
    if (selectedFeature) {
      const isCustom = selectedFeature === 'custom_prompt';
      const totalTimeSpent = Date.now() - screenStartTime.current;
      
      // Track feature selection completion (fire and forget)
      analyticsService.track('onboarding_feature_selection_completed', {
        selected_feature: selectedFeature,
        feature_type: isCustom ? 'custom' : 'preset',
        has_custom_prompt: isCustom ? 'true' : 'false',
        custom_prompt_length: isCustom ? customPrompt.trim().length.toString() : '0',
        total_time_spent_ms: totalTimeSpent.toString(),
        onboarding_version: 'v3'
      });

      if (isCustom && customPrompt.trim()) {
        // Track custom prompt usage (fire and forget)
        analyticsService.track('onboarding_custom_prompt_used', {
          prompt_length: customPrompt.trim().length.toString(),
          onboarding_version: 'v3'
        });
      }

      onContinue(selectedFeature, isCustom ? customPrompt.trim() : undefined);
    }
  };

  // Get descriptive button text based on selection
  const getButtonText = () => {
    if (!selectedFeature || (selectedFeature === 'custom_prompt' && customPrompt.trim().length === 0)) {
      const selectText = t('onboarding.features.selectOption');
      return selectText !== 'onboarding.features.selectOption' ? selectText : 'Choose your feature';
    }
    
    const feature = onboardingUtils.getFeatureById(selectedFeature);
    
    // Special case for "none_above" - show "Explore App"
    if (selectedFeature === 'none_above') {
      return 'Explore App →';
    }
    
    const startWithText = t('onboarding.features.startWith');
    const startWith = startWithText !== 'onboarding.features.startWith' ? startWithText : 'Start with';
    
    if (selectedFeature === 'custom_prompt') {
      return `${startWith} Custom Prompt →`;
    }
    
    const translationKey = feature?.id.replace(/_/g, '');
    const nameKey = `onboarding.features.${translationKey}`;
    const featureName = t(nameKey) || feature?.name || 'Feature';
    
    return `${startWith} ${featureName} →`;
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  return (
    <OnboardingContainer showGradient={false} style={{ backgroundColor: '#000000' }}>
      <Animated.View style={[{ flex: 1 }, containerStyle]}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{ flex: 1, paddingTop: insets.top + 80, paddingBottom: 120 }}>
        {/* Feature Tile Grid */}
        <FeatureTileGrid
          selectedFeature={selectedFeature}
          onFeatureSelect={handleFeatureSelect}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          customInputRef={customInputRef}
        />

        {/* Fixed Blurred Header - Flush with Top */}
        <Animated.View style={[{ 
          position: 'absolute',
          top: -insets.top, // Pull header up to screen edge
          left: 0,
          right: 0,
          zIndex: 10,
        }, titleAnimatedStyle]}>
          <BlurView intensity={25} tint="dark" style={{ overflow: 'hidden' }}>
            <View style={{
              alignItems: 'center', 
              paddingTop: insets.top + ONBOARDING_SPACING.lg, // Reduced top padding
              paddingBottom: ONBOARDING_SPACING.sm, // Reduced bottom padding
              paddingHorizontal: ONBOARDING_SPACING.lg,
              backgroundColor: 'rgba(0, 0, 0, 0.75)', // More opacity for text visibility
            }}>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.huge, 
                fontFamily: 'Lexend-Bold', 
                color: ONBOARDING_COLORS.textPrimary,
                textAlign: 'center',
              }}>
                {t('onboarding.features.title')}
              </Text>
            </View>
          </BlurView>
        </Animated.View>


        {/* Continue Button - Always Visible */}
        <Animated.View style={[
          {
            position: 'absolute',
            bottom: ONBOARDING_SPACING.huge,
            left: ONBOARDING_SPACING.lg,
            right: ONBOARDING_SPACING.lg,
            transform: [{ translateY: 0 }],
          },
          buttonAnimatedStyle,
          {
            shadowColor: ONBOARDING_COLORS.accent,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
          }
        ]}>
          <OnboardingButton
            title={getButtonText()}
            onPress={handleContinue}
            variant="primary"
            size="large"
            disabled={!selectedFeature || (selectedFeature === 'custom_prompt' && customPrompt.trim().length === 0)}
            style={{ 
              width: '100%',
              transform: [{ scale: 1.02 }]
            }}
          />
        </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </OnboardingContainer>
  );
});
