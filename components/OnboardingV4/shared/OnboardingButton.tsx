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
import { useResponsive } from '@/utils/responsive';

interface OnboardingButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'skip';
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
  const responsive = useResponsive();
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
    const borderRadius = responsive.borderRadius(28);

    // Skip buttons don't use responsive constraints - stay small
    const buttonConstraints = variant === 'skip' ? {} : responsive.buttonWidth();

    const baseStyle: ViewStyle = {
      borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: '#F97316',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
      ...buttonConstraints,
      alignSelf: 'center', // Center the button
    };

    const sizeStyles = {
      small: {
        paddingVertical: variant === 'skip' ? 8 : responsive.spacing(12), // Fixed size for skip
        paddingHorizontal: variant === 'skip' ? 16 : responsive.spacing(20), // Fixed size for skip
        minHeight: variant === 'skip' ? 36 : responsive.spacing(44) // Fixed size for skip
      },
      medium: {
        paddingVertical: responsive.spacing(16),
        paddingHorizontal: responsive.spacing(28),
        minHeight: responsive.spacing(50)
      },
      large: {
        paddingVertical: responsive.spacing(18),
        paddingHorizontal: responsive.spacing(responsive.isTablet ? 32 : 28),
        minHeight: responsive.spacing(56)
      },
    };

    const variantStyles = {
      primary: {
        shadowColor: ONBOARDING_COLORS.accent,
        shadowOpacity: 0.4,
      },
      secondary: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
      },
      ghost: {
        backgroundColor: 'transparent',
        shadowOpacity: 0,
        elevation: 0,
      },
      skip: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)', // Very subtle background
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)', // Subtle border
        shadowOpacity: 0,
        shadowRadius: 0,
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
      fontFamily: 'Lexend-Bold',
      textAlign: 'center',
      letterSpacing: 0.5,
    };

    const sizeStyles = {
      small: { fontSize: variant === 'skip' ? 14 : responsive.fontSize(16) }, // Fixed size for skip
      medium: { fontSize: responsive.fontSize(18) },
      large: { fontSize: responsive.fontSize(20) },
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
      skip: {
        color: 'rgba(255, 255, 255, 0.7)', // Muted text color
        fontFamily: 'Lexend-Medium', // Less bold than other buttons
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
  const borderRadius = responsive.borderRadius(28);

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
            borderRadius,
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
            borderRadius,
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