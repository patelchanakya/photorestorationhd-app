import React from 'react';
import { Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ONBOARDING_COLORS, ONBOARDING_BORDER_RADIUS, ONBOARDING_SHADOWS, ONBOARDING_TYPOGRAPHY } from './constants';

interface OnboardingButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export function OnboardingButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  size = 'large'
}: OnboardingButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.96, { damping: 20, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    onPress();
  };

  React.useEffect(() => {
    opacity.value = withTiming(disabled ? 0.5 : 1, { duration: 200 });
  }, [disabled]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: ONBOARDING_BORDER_RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ONBOARDING_COLORS.background, // Add solid background for shadows
    };

    const sizeStyles = {
      small: { paddingVertical: 12, paddingHorizontal: 20 },
      medium: { paddingVertical: 16, paddingHorizontal: 24 },
      large: { paddingVertical: 18, paddingHorizontal: 32 },
    };

    const variantStyles = {
      primary: {
        backgroundColor: ONBOARDING_COLORS.accent,
        // Remove shadow to prevent warnings - we'll add glow effect later if needed
      },
      secondary: {
        backgroundColor: ONBOARDING_COLORS.cardBackground,
        borderWidth: 1,
        borderColor: ONBOARDING_COLORS.border,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: ONBOARDING_TYPOGRAPHY.semibold,
      textAlign: 'center',
    };

    const sizeStyles = {
      small: { fontSize: ONBOARDING_TYPOGRAPHY.sm },
      medium: { fontSize: ONBOARDING_TYPOGRAPHY.base },
      large: { fontSize: ONBOARDING_TYPOGRAPHY.lg },
    };

    const variantStyles = {
      primary: { color: ONBOARDING_COLORS.background },
      secondary: { color: ONBOARDING_COLORS.textPrimary },
      ghost: { color: ONBOARDING_COLORS.textMuted },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  return (
    <AnimatedTouchableOpacity
      style={[getButtonStyle(), animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={1}
    >
      <Text style={[getTextStyle(), textStyle]}>
        {title}
      </Text>
    </AnimatedTouchableOpacity>
  );
}