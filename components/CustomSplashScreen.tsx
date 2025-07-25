import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CustomSplashScreenProps {
  onAnimationComplete: () => void;
}

export default function CustomSplashScreen({ onAnimationComplete }: CustomSplashScreenProps) {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const glowOpacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  useEffect(() => {
    const startAnimation = () => {
      // Background fade in
      backgroundOpacity.value = withTiming(1, { duration: 500 });

      // Logo entrance animation
      logoOpacity.value = withTiming(1, { duration: 800 });
      logoScale.value = withSequence(
        withTiming(1.2, { duration: 600, easing: Easing.out(Easing.back(1.2)) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) })
      );

      // Glow effect
      setTimeout(() => {
        glowOpacity.value = withRepeat(
          withSequence(
            withTiming(0.8, { duration: 1000 }),
            withTiming(0.3, { duration: 1000 })
          ),
          -1,
          true
        );
      }, 800);

      // Title animation
      setTimeout(() => {
        titleOpacity.value = withTiming(1, { duration: 600 });
        titleTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      }, 1200);

      // Start fade out after 7 seconds, complete after 8 seconds
      setTimeout(() => {
        containerOpacity.value = withTiming(0, { duration: 1000 }, () => {
          'worklet';
          runOnJS(onAnimationComplete)();
        });
      }, 7000);
    };

    startAnimation();
  }, []);

  return (
    <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
      <Animated.View style={[{ flex: 1 }, backgroundAnimatedStyle]}>
        <LinearGradient
          colors={['#0a0a0a', '#1a0b2e', '#0d1421']}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Rich overlay for depth */}
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View className="flex-1 justify-center items-center px-8">
            {/* Orange glow effect */}
            <Animated.View
              style={[
                glowAnimatedStyle,
                {
                  position: 'absolute',
                  width: 400,
                  height: 400,
                  borderRadius: 200,
                  backgroundColor: '#f97316',
                  shadowColor: '#f97316',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 80,
                }
              ]}
            />

            {/* Secondary orange glow */}
            <Animated.View
              style={[
                glowAnimatedStyle,
                {
                  position: 'absolute',
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  backgroundColor: '#ea580c',
                  shadowColor: '#ea580c',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 60,
                }
              ]}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}