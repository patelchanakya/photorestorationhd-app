import React from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from './constants';

interface OnboardingContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  showGradient?: boolean;
}

export function OnboardingContainer({ 
  children, 
  style, 
  showGradient = true 
}: OnboardingContainerProps) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  
  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (showGradient) {
    return (
      <LinearGradient 
        colors={[ONBOARDING_COLORS.backgroundGradientStart, ONBOARDING_COLORS.backgroundGradientEnd]} 
        style={{ flex: 1 }}
      >
        <Animated.View 
          style={[
            { 
              flex: 1, 
              paddingTop: insets.top,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            }, 
            animatedStyle,
            style
          ]}
        >
          {children}
        </Animated.View>
      </LinearGradient>
    );
  }

  return (
    <Animated.View 
      style={[
        { 
          flex: 1, 
          backgroundColor: ONBOARDING_COLORS.background,
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }, 
        animatedStyle,
        style
      ]}
    >
      {children}
    </Animated.View>
  );
}