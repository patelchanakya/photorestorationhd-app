import React from 'react';
import { TouchableOpacity, View, AppState, AppStateStatus } from 'react-native';
import { IconSymbol } from './ui/IconSymbol';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface BottomCameraButtonProps {
  onPress: () => void;
}

export function BottomCameraButton({ onPress }: BottomCameraButtonProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const appStateRef = React.useRef(AppState.currentState);

  // Start glow animation
  const startGlowAnimation = React.useCallback(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  React.useEffect(() => {
    // Start initial animation
    startGlowAnimation();

    // AppState handling for battery optimization
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // Going to background - cancel animation
        cancelAnimation(glowOpacity);
        glowOpacity.value = 0;
      } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // Coming to foreground - restart animation
        startGlowAnimation();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      cancelAnimation(glowOpacity);
    };
  }, [startGlowAnimation]);

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <View className="absolute bottom-8 left-6">
      {/* Glow effect */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#10b981',
            transform: [{ scale: 1.2 }],
          },
          animatedGlowStyle,
        ]}
      />
      
      {/* Camera Button */}
      <AnimatedTouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#10b981',
            justifyContent: 'center',
            alignItems: 'center',
            margin: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          },
          animatedButtonStyle,
        ]}
      >
        <IconSymbol name="camera" size={24} color="#fff" />
      </AnimatedTouchableOpacity>
    </View>
  );
}