import React from 'react';
import { Text, TouchableOpacity, ViewStyle, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    scale.value = withSpring(0.94, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(0.85, { duration: 100 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 100 });
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
      borderRadius: 28, // Much more rounded (pill shape)
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden', // For gradient backgrounds
      backgroundColor: '#F97316', // Solid background for shadow optimization
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    };

    const sizeStyles = {
      small: { paddingVertical: 14, paddingHorizontal: 24, minHeight: 44 },
      medium: { paddingVertical: 18, paddingHorizontal: 32, minHeight: 50 },
      large: { paddingVertical: 20, paddingHorizontal: 40, minHeight: 56 },
    };

    const variantStyles = {
      primary: {
        // Primary buttons will use gradient background
        shadowColor: ONBOARDING_COLORS.accent,
        shadowOpacity: 0.4,
      },
      secondary: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
      },
      ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
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
      fontFamily: 'Lexend-Bold', // Bolder text for better visibility
      textAlign: 'center',
      letterSpacing: 0.5,
    };

    const sizeStyles = {
      small: { fontSize: ONBOARDING_TYPOGRAPHY.base },
      medium: { fontSize: ONBOARDING_TYPOGRAPHY.lg },
      large: { fontSize: ONBOARDING_TYPOGRAPHY.xl },
    };

    const variantStyles = {
      primary: { 
        color: '#FFFFFF',
        textShadowColor: 'rgba(0, 0, 0, 0.25)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
      secondary: { 
        color: ONBOARDING_COLORS.textPrimary,
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
      ghost: { 
        color: ONBOARDING_COLORS.textSecondary,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const renderButtonContent = () => (
    <Text style={[getTextStyle(), textStyle]}>
      {title}
    </Text>
  );

  const buttonStyle = getButtonStyle();

  if (variant === 'primary') {
    return (
      <AnimatedTouchableOpacity
        style={[buttonStyle, animatedStyle, style]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={1}
      >
        <LinearGradient
          colors={disabled ? ['#666666', '#555555'] : ['#F97316', '#FB923C', '#EA580C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 28,
          }}
        />
        {/* Subtle overlay for extra depth */}
        <LinearGradient
          colors={['rgba(255,255,255,0.2)', 'transparent', 'rgba(0,0,0,0.1)']}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 28,
          }}
        />
        {renderButtonContent()}
      </AnimatedTouchableOpacity>
    );
  }

  return (
    <AnimatedTouchableOpacity
      style={[buttonStyle, animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={1}
    >
      {renderButtonContent()}
    </AnimatedTouchableOpacity>
  );
}