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
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-CONTAINER] Component mounting...');
    console.log('🔥 [ONBOARDING-CONTAINER] Props:', { 
      children: !!children, 
      style, 
      showGradient 
    });
  }

  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  
  if (__DEV__) {
    console.log('🔥 [ONBOARDING-CONTAINER] SafeArea insets:', insets);
  }
  
  React.useEffect(() => {
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-CONTAINER] Starting opacity animation');
    }
    opacity.value = withTiming(1, { duration: 400 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (__DEV__) {
    console.log('🔥 [ONBOARDING-CONTAINER] Rendering with showGradient:', showGradient);
  }

  if (showGradient) {
    if (__DEV__) {
      console.log('🔥 [ONBOARDING-CONTAINER] Rendering LinearGradient version');
    }
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
          {(() => {
            if (__DEV__) {
              console.log('🔥 [ONBOARDING-CONTAINER] Rendering children in gradient');
            }
            return children;
          })()}
        </Animated.View>
      </LinearGradient>
    );
  }

  if (__DEV__) {
    console.log('🔥 [ONBOARDING-CONTAINER] Rendering non-gradient version');
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
      {(() => {
        if (__DEV__) {
          console.log('🔥 [ONBOARDING-CONTAINER] Rendering children in non-gradient');
        }
        return children;
      })()}
    </Animated.View>
  );
}