import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from '@/src/hooks/useTranslation';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
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

export function FeatureSelectionScreen({ onContinue }: FeatureSelectionScreenProps) {
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

  React.useEffect(() => {
    // Title animation
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 200 }));
  }, []);

  React.useEffect(() => {
    const isCustomPromptSelected = selectedFeature === 'custom_prompt';
    
    // Clear prompt immediately when switching away from custom for cleaner UX
    if (!isCustomPromptSelected && customPrompt) {
      setCustomPrompt('');
    }
    
    // Button slides up with bounce when feature is selected
    const canContinue = selectedFeature && (!isCustomPromptSelected || customPrompt.trim().length > 0);
    if (canContinue) {
      buttonOpacity.value = withTiming(1, { duration: 250 });
      buttonTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      buttonScale.value = withSpring(1, { damping: 12, stiffness: 250 });
    } else {
      buttonOpacity.value = withTiming(0, { duration: 150 });
      buttonTranslateY.value = withTiming(100, { duration: 150 });
      buttonScale.value = withTiming(0.9, { duration: 150 });
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
  }));


  const handleFeatureSelect = (featureId: string) => {
    try {
      Haptics.selectionAsync();
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
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: insets.top + 120, // Safe area + header height
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
              paddingTop: insets.top + ONBOARDING_SPACING.xxxl, // Safe area + content padding
              paddingBottom: ONBOARDING_SPACING.lg,
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
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.base, 
                color: ONBOARDING_COLORS.textMuted,
                textAlign: 'center',
                marginTop: ONBOARDING_SPACING.xs,
              }}>
                {t('onboarding.features.subtitle')}
              </Text>
            </View>
          </BlurView>
        </Animated.View>


        {/* Continue Button - Floating Action Style */}
        {selectedFeature && (selectedFeature !== 'custom_prompt' || customPrompt.trim().length > 0) && (
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
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 12,
            }
          ]}>
            <OnboardingButton
              title={t('onboarding.features.continue')}
              onPress={handleContinue}
              variant="primary"
              size="large"
              style={{ 
                width: '100%',
                transform: [{ scale: 1.02 }]
              }}
            />
          </Animated.View>
        )}
        </View>
      </KeyboardAvoidingView>
    </OnboardingContainer>
  );
}

interface FeatureCardProps {
  feature: typeof ONBOARDING_FEATURES[0];
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  customInputRef?: React.RefObject<any>;
}

const FeatureCard = React.memo<FeatureCardProps>(({ feature, isSelected, onSelect, index, customPrompt, setCustomPrompt, customInputRef }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const backgroundColor = useSharedValue(0);
  
  // Only create input animation values for custom prompt cards
  const inputHeight = feature.isCustomPrompt ? useSharedValue(0) : null;
  const inputOpacity = feature.isCustomPrompt ? useSharedValue(0) : null;

  React.useEffect(() => {
    // Wave entrance animation - alternating from sides
    const delay = index * 25;
    const fromLeft = index % 2 === 0;
    opacity.value = withDelay(delay + 150, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(delay + 150, withSpring(0, { damping: 12, stiffness: 250 }));
  }, [index]);

  React.useEffect(() => {
    backgroundColor.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
    
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
      backgroundColor: ONBOARDING_COLORS.cardBackground,
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
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
            borderLeftWidth: isSelected ? 3 : 0,
            borderLeftColor: isSelected ? ONBOARDING_COLORS.accent : 'transparent',
            paddingLeft: isSelected ? ONBOARDING_SPACING.lg - 3 : ONBOARDING_SPACING.lg,
          },
          animatedStyle
        ]}
      >
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

