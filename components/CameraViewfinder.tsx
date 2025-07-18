import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface CameraViewfinderProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  cornerLength?: number;
}

export function CameraViewfinder({
  size = 120,
  color = '#f97316',
  strokeWidth = 2,
  cornerLength = 20,
}: CameraViewfinderProps) {
  const opacity = useSharedValue(0.7);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Subtle pulsing animation
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1500 }),
        withTiming(0.7, { duration: 1500 })
      ),
      -1,
      true
    );

    // Subtle scale animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const containerStyle = {
    width: size,
    height: size,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const cornerStyle = {
    position: 'absolute' as const,
    width: cornerLength,
    height: cornerLength,
    borderColor: color,
    borderWidth: strokeWidth,
  };

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      {/* Top-left corner */}
      <View
        style={[
          cornerStyle,
          {
            top: 0,
            left: 0,
            borderRightWidth: 0,
            borderBottomWidth: 0,
          },
        ]}
      />
      
      {/* Top-right corner */}
      <View
        style={[
          cornerStyle,
          {
            top: 0,
            right: 0,
            borderLeftWidth: 0,
            borderBottomWidth: 0,
          },
        ]}
      />
      
      {/* Bottom-left corner */}
      <View
        style={[
          cornerStyle,
          {
            bottom: 0,
            left: 0,
            borderRightWidth: 0,
            borderTopWidth: 0,
          },
        ]}
      />
      
      {/* Bottom-right corner */}
      <View
        style={[
          cornerStyle,
          {
            bottom: 0,
            right: 0,
            borderLeftWidth: 0,
            borderTopWidth: 0,
          },
        ]}
      />

      {/* Center crosshair */}
      <View
        style={{
          position: 'absolute',
          width: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Horizontal line */}
        <View
          style={{
            position: 'absolute',
            width: 12,
            height: strokeWidth,
            backgroundColor: color,
          }}
        />
        {/* Vertical line */}
        <View
          style={{
            position: 'absolute',
            width: strokeWidth,
            height: 12,
            backgroundColor: color,
          }}
        />
      </View>
    </Animated.View>
  );
}