import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { IconSymbol } from './ui/IconSymbol';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  icon?: string;
  iconSize?: number;
  iconColor?: string;
}

export function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#f97316',
  backgroundColor = '#f3f4f6',
  showPercentage = true,
  icon,
  iconSize = 32,
  iconColor = '#f97316',
}: CircularProgressProps) {
  const animatedProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const iconScale = useSharedValue(1);

  useEffect(() => {
    // Animate progress
    animatedProgress.value = withTiming(progress, {
      duration: 800,
    });

    // Glow effect
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );

    // Icon pulse
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => {
    const angle = interpolate(animatedProgress.value, [0, 100], [0, 360]);
    return {
      transform: [{ rotate: `${angle}deg` }],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {/* Glow effect */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size + 20,
            height: size + 20,
            borderRadius: (size + 20) / 2,
            backgroundColor: color,
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 20,
            elevation: 20,
          },
          glowStyle,
        ]}
      />

      {/* Background circle */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: backgroundColor,
        }}
      />

      {/* Progress circle using conic gradient approach */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: progress > 25 ? color : 'transparent',
            borderBottomColor: progress > 50 ? color : 'transparent',
            borderLeftColor: progress > 75 ? color : 'transparent',
          },
          progressStyle,
        ]}
      />

      {/* Content */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {icon && (
          <Animated.View style={iconStyle}>
            <IconSymbol name={icon as any} size={iconSize} color={iconColor} />
          </Animated.View>
        )}
        {showPercentage && (
          <Text style={{ 
            fontSize: 16, 
            fontWeight: 'bold', 
            color: '#374151',
            marginTop: icon ? 4 : 0
          }}>
            {Math.round(progress)}%
          </Text>
        )}
      </View>
    </View>
  );
}