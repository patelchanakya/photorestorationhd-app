import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from '@/src/hooks/useTranslation';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { ONBOARDING_BORDER_RADIUS, ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY } from './shared/constants';

interface FeatureSelectionScreenProps {
  onContinue: (selectedFeature: string, customPrompt?: string) => void;
}

export const FeatureSelectionScreen = React.memo(function FeatureSelectionScreen({ onContinue }: FeatureSelectionScreenProps) {
  const { t } = useTranslation();
  const [selectedFeature, setSelectedFeature] = React.useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = React.useState<string>('');
  const customInputRef = React.useRef<any>(null);
  const insets = useSafeAreaInsets();

  // Helper function to get translated feature name and description
  const getTranslatedFeature = (feature: typeof ONBOARDING_FEATURES[0]) => {
    const translationKey = feature.id.replace(/_/g, '');
    const nameKey = `onboarding.features.${translationKey}`;
    const descKey = `onboarding.features.${translationKey}Desc`;
    
    return {
      ...feature,
      name: t(nameKey) || feature.name,
      description: t(descKey) || feature.description
    };
  };
  
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(100);
  const buttonScale = useSharedValue(0.9);
  const buttonGlow = useSharedValue(0);

  React.useEffect(() => {
    // Faster title animation
    titleOpacity.value = withDelay(50, withTiming(1, { duration: 300 }));
    titleTranslateY.value = withDelay(50, withSpring(0, { damping: 15, stiffness: 200 }));
    
    // Initialize button as visible immediately
    buttonOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
    buttonTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 200 }));
    buttonScale.value = withDelay(100, withSpring(0.98, { damping: 15, stiffness: 200 }));

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
    setSelectedFeature(featureId);
    
    // Auto-focus TextInput when custom_prompt is selected
    if (featureId === 'custom_prompt') {
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
      onContinue(selectedFeature, isCustom ? customPrompt.trim() : undefined);
    }
  };

  // Get descriptive button text based on selection
  const getButtonText = () => {
    if (!selectedFeature || (selectedFeature === 'custom_prompt' && customPrompt.trim().length === 0)) {
      const selectText = t('onboarding.features.selectOption');
      return selectText !== 'onboarding.features.selectOption' ? selectText : 'Choose your feature';
    }
    
    const feature = getTranslatedFeature(ONBOARDING_FEATURES.find(f => f.id === selectedFeature)!);
    const startWithText = t('onboarding.features.startWith');
    const startWith = startWithText !== 'onboarding.features.startWith' ? startWithText : 'Start with';
    
    if (selectedFeature === 'custom_prompt') {
      return `${startWith} Custom Prompt →`;
    }
    
    return `${startWith} ${feature.name} →`;
  };

  return (
    <OnboardingContainer showGradient={false} style={{ backgroundColor: '#000000' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1 }}>
        {/* Feature List - Full Screen */}
        <FlatList
          data={ONBOARDING_FEATURES}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <FeatureCard
              feature={getTranslatedFeature(item)}
              isSelected={selectedFeature === item.id}
              onSelect={() => handleFeatureSelect(item.id)}
              index={index}
              customPrompt={customPrompt}
              setCustomPrompt={setCustomPrompt}
              customInputRef={item.isCustomPrompt ? customInputRef : undefined}
              t={t}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: insets.top + 80, // Reduced spacing above list
            paddingBottom: 120, 
          }}
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
    </OnboardingContainer>
  );
});

interface FeatureCardProps {
  feature: typeof ONBOARDING_FEATURES[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  customInputRef?: React.RefObject<any>;
  t: (key: string) => string;
}

const FeatureCard = React.memo<FeatureCardProps>(({ feature, isSelected, onSelect, index, customPrompt, setCustomPrompt, customInputRef, t }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const backgroundColor = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  
  // Only create input animation values for custom prompt cards
  const inputHeight = feature.isCustomPrompt ? useSharedValue(0) : null;
  const inputOpacity = feature.isCustomPrompt ? useSharedValue(0) : null;

  React.useEffect(() => {
    // Faster wave entrance animation
    const delay = index * 10; // Reduced from 25ms to 10ms
    opacity.value = withDelay(delay + 50, withTiming(1, { duration: 250 })); // Reduced from 150ms to 50ms
    translateY.value = withDelay(delay + 50, withSpring(0, { damping: 12, stiffness: 250 }));
  }, [index]);

  React.useEffect(() => {
    backgroundColor.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
    
    // Scale up slightly when selected for better visual feedback
    if (isSelected) {
      scale.value = withSpring(1.02, { damping: 15, stiffness: 200 });
      
      // Flash effect when first selected
      flashOpacity.value = withSequence(
        withTiming(0.4, { duration: 100 }),
        withTiming(0, { duration: 300 })
      );
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      flashOpacity.value = withTiming(0, { duration: 100 });
    }
    
    // Only handle expansion animations if this is actually a custom prompt card
    if (feature.isCustomPrompt && inputHeight && inputOpacity) {
      if (isSelected) {
        // Smooth expansion with consistent timing
        inputOpacity.value = withTiming(1, { duration: 200 });
        inputHeight.value = withTiming(90, { duration: 200 });
      } else {
        // Fast, smooth collapse to prevent jumping
        inputOpacity.value = withTiming(0, { duration: 100 });
        inputHeight.value = withTiming(0, { duration: 100 });
      }
    }
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
      backgroundColor: isSelected ? ONBOARDING_COLORS.accentBackground : ONBOARDING_COLORS.cardBackground,
      shadowColor: ONBOARDING_COLORS.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isSelected ? 0.3 : 0,
      shadowRadius: isSelected ? 8 : 0,
      elevation: isSelected ? 4 : 0,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
  };

  const inputAnimatedStyle = feature.isCustomPrompt && inputHeight && inputOpacity 
    ? useAnimatedStyle(() => ({
        height: inputHeight.value,
        opacity: inputOpacity.value,
      }))
    : null;

  const flashAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onSelect}
      activeOpacity={1}
      style={{ 
        marginBottom: 1, 
        marginHorizontal: ONBOARDING_SPACING.lg,
      }}
    >
      <Animated.View 
        style={[
          {
            padding: ONBOARDING_SPACING.lg,
            borderLeftWidth: isSelected ? 4 : 0,
            borderLeftColor: isSelected ? ONBOARDING_COLORS.accent : 'transparent',
            borderRightWidth: isSelected ? 1 : 0,
            borderTopWidth: isSelected ? 1 : 0,
            borderBottomWidth: isSelected ? 1 : 1,
            borderRightColor: isSelected ? ONBOARDING_COLORS.borderActive : 'transparent',
            borderTopColor: isSelected ? ONBOARDING_COLORS.borderActive : 'transparent',
            borderBottomColor: isSelected ? ONBOARDING_COLORS.borderActive : 'rgba(255, 255, 255, 0.08)',
            borderRadius: isSelected ? ONBOARDING_BORDER_RADIUS.md : 0,
            marginHorizontal: isSelected ? ONBOARDING_SPACING.xs : 0,
            paddingLeft: isSelected ? ONBOARDING_SPACING.lg - 4 : ONBOARDING_SPACING.lg,
            position: 'relative',
          },
          animatedStyle
        ]}
      >
        {/* Flash overlay for selection feedback */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: ONBOARDING_COLORS.accent,
              borderRadius: isSelected ? ONBOARDING_BORDER_RADIUS.md : 0,
              pointerEvents: 'none',
            },
            flashAnimatedStyle
          ]}
        />
        {/* Main Content Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Icon */}
          <View style={{
            width: 40,
            alignItems: 'center',
            marginRight: ONBOARDING_SPACING.lg
          }}>
            <IconSymbol 
              name={feature.icon as any} 
              size={24} 
              color={isSelected ? ONBOARDING_COLORS.accent : ONBOARDING_COLORS.textMuted}
            />
          </View>
          
          {/* Text Content */}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.base, 
              fontFamily: 'Lexend-SemiBold', 
              color: isSelected ? ONBOARDING_COLORS.textPrimary : ONBOARDING_COLORS.textSecondary,
              marginBottom: ONBOARDING_SPACING.xs,
            }}>
              {feature.name}
            </Text>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.sm, 
              color: isSelected ? ONBOARDING_COLORS.accent : ONBOARDING_COLORS.textMuted,
              lineHeight: 18,
            }}>
              {feature.description}
            </Text>
          </View>
          
          {/* Selection Indicator - Always reserve space */}
          <View style={{
            marginLeft: ONBOARDING_SPACING.sm,
            width: 20,
            alignItems: 'center'
          }}>
            {isSelected && (
              <IconSymbol 
                name="checkmark" 
                size={20} 
                color={ONBOARDING_COLORS.accent}
              />
            )}
          </View>
        </View>
        
        {/* Expandable Custom Prompt Input */}
        {feature.isCustomPrompt && (
          <Animated.View style={[
            {
              marginTop: ONBOARDING_SPACING.sm,
              overflow: 'hidden',
            },
            inputAnimatedStyle || {}
          ]}>
            <View style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: ONBOARDING_BORDER_RADIUS.md,
              padding: ONBOARDING_SPACING.sm,
              borderWidth: 1,
              borderColor: 'rgba(250, 204, 21, 0.2)',
            }}>
              <TextInput
                ref={customInputRef}
                value={customPrompt}
                onChangeText={setCustomPrompt}
                placeholder={t('onboarding.features.customPromptPlaceholder')}
                placeholderTextColor={ONBOARDING_COLORS.textMuted}
                multiline
                maxLength={150}
                style={{
                  color: ONBOARDING_COLORS.textPrimary,
                  fontSize: ONBOARDING_TYPOGRAPHY.sm,
                  minHeight: 40,
                  textAlignVertical: 'top',
                }}
                returnKeyType="done"
                blurOnSubmit={true}
              />
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.xs,
                color: ONBOARDING_COLORS.textDisabled,
                textAlign: 'right',
                marginTop: ONBOARDING_SPACING.xs,
              }}>
                {customPrompt.length}/150
              </Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

