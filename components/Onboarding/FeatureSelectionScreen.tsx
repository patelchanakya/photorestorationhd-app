import React from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { OnboardingButton } from './shared/OnboardingButton';
import { ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY, ONBOARDING_BORDER_RADIUS } from './shared/constants';

interface FeatureSelectionScreenProps {
  onContinue: (selectedFeature: string, customPrompt?: string) => void;
}

export function FeatureSelectionScreen({ onContinue }: FeatureSelectionScreenProps) {
  const [selectedFeature, setSelectedFeature] = React.useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = React.useState<string>('');
  const insets = useSafeAreaInsets();
  
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
              feature={item}
              isSelected={selectedFeature === item.id}
              onSelect={() => handleFeatureSelect(item.id)}
              index={index}
              customPrompt={customPrompt}
              setCustomPrompt={setCustomPrompt}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingTop: insets.top + 120, // Safe area + header height
            paddingBottom: 120, 
            paddingHorizontal: ONBOARDING_SPACING.lg 
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
              backgroundColor: 'rgba(0, 0, 0, 0.8)', // Black background
            }}>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.huge, 
                fontWeight: ONBOARDING_TYPOGRAPHY.bold, 
                color: ONBOARDING_COLORS.textPrimary,
                textAlign: 'center',
              }}>
                What would you like to do today?
              </Text>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.base, 
                color: ONBOARDING_COLORS.textMuted,
                textAlign: 'center',
                marginTop: ONBOARDING_SPACING.xs,
              }}>
                What brought you here today?
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
              title="Continue"
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
}

const FeatureCard = React.memo<FeatureCardProps>(({ feature, isSelected, onSelect, index, customPrompt, setCustomPrompt }) => {
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
      backgroundColor: isSelected 
        ? ONBOARDING_COLORS.accentBackground
        : ONBOARDING_COLORS.cardBackground,
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
        marginBottom: ONBOARDING_SPACING.xs, 
        marginHorizontal: ONBOARDING_SPACING.xs,
        shadowColor: isSelected ? ONBOARDING_COLORS.accent : '#000',
        shadowOffset: { width: 0, height: isSelected ? 3 : 1 },
        shadowOpacity: isSelected ? 0.2 : 0.05,
        shadowRadius: isSelected ? 6 : 2,
        elevation: isSelected ? 4 : 1,
      }}
    >
      <Animated.View 
        style={[
          {
            padding: ONBOARDING_SPACING.lg,
            borderRadius: ONBOARDING_BORDER_RADIUS.xl,
          },
          animatedStyle
        ]}
      >
        {/* Main Content Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Icon */}
          <Animated.View style={[{ 
            width: 50, 
            height: 50, 
            borderRadius: 25,
            backgroundColor: isSelected ? ONBOARDING_COLORS.accent : ONBOARDING_COLORS.cardBackgroundHover,
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: ONBOARDING_SPACING.lg
          }, {
            transform: [{ scale: isSelected ? 1.1 : 1 }]
          }]}>
            <IconSymbol 
              name={feature.icon as any} 
              size={24} 
              color={isSelected ? ONBOARDING_COLORS.background : ONBOARDING_COLORS.textMuted}
            />
          </Animated.View>
          
          {/* Text Content */}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.base, 
              fontWeight: ONBOARDING_TYPOGRAPHY.semibold, 
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
          
          {/* Selection Indicator - All cards */}
          <Animated.View style={[{ 
            width: 24, 
            height: 24, 
            borderRadius: 12,
            backgroundColor: isSelected ? ONBOARDING_COLORS.accent : 'transparent',
            borderWidth: 2,
            borderColor: isSelected ? ONBOARDING_COLORS.accent : ONBOARDING_COLORS.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: ONBOARDING_SPACING.sm,
            transform: [{ scale: isSelected ? 1 : 0.8 }]
          }]}>
            {isSelected && (
              <Text style={{ color: ONBOARDING_COLORS.background, fontSize: 14, fontWeight: 'bold' }}>
                ✓
              </Text>
            )}
          </Animated.View>
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
                value={customPrompt}
                onChangeText={setCustomPrompt}
                placeholder="What would you like to do with your photo?"
                placeholderTextColor={ONBOARDING_COLORS.textMuted}
                multiline
                maxLength={200}
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
                {customPrompt.length}/200
              </Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

