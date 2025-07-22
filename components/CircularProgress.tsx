import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { IconSymbol } from './ui/IconSymbol';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  const glowOpacity = useSharedValue(0.4);
  const iconScale = useSharedValue(1);
  const containerFloat = useSharedValue(0);

  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Smooth progress animation with spring
    animatedProgress.value = withSpring(progress, {
      damping: 15,
      stiffness: 100,
    });

    // Subtle breathing glow
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000 }),
        withTiming(0.4, { duration: 2000 })
      ),
      -1,
      true
    );

    // Gentle icon pulse
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1800 }),
        withTiming(1, { duration: 1800 })
      ),
      -1,
      true
    );

    // Subtle floating animation
    containerFloat.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 3000 }),
        withTiming(2, { duration: 3000 })
      ),
      -1,
      true
    );
  }, [progress]);

  // Animated props for SVG circle
  const animatedCircleProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (animatedProgress.value / 100) * circumference;
    return {
      strokeDashoffset,
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: containerFloat.value }],
  }));

  const animatedProgressColor = useAnimatedStyle(() => {
    // Subtle color shift from orange to green as progress increases
    const colorProgress = animatedProgress.value / 100;
    const red = Math.round(249 - colorProgress * (249 - 34));
    const green = Math.round(115 + colorProgress * (197 - 115));
    const blue = Math.round(22 + colorProgress * (34 - 22));
    return {
      color: `rgb(${red}, ${green}, ${blue})`,
    };
  });

  return (
    <Animated.View style={[
      { width: size, height: size, justifyContent: 'center', alignItems: 'center' },
      containerStyle
    ]}>
      {/* Subtle glow effect (without shadow) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size + 16,
            height: size + 16,
            borderRadius: (size + 16) / 2,
            backgroundColor: color,
          },
          glowStyle,
        ]}
      />

      {/* SVG Progress Circle */}
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          animatedProps={animatedCircleProps}
        />
      </Svg>

      {/* Content */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {icon && (
          <Animated.View style={iconStyle}>
            <IconSymbol name={icon as any} size={iconSize} color={iconColor} />
          </Animated.View>
        )}
        {showPercentage && (
          <Animated.Text style={[
            { 
              fontSize: 16, 
              fontWeight: 'bold', 
              color: '#374151',
              marginTop: icon ? 4 : 0
            },
            animatedProgressColor
          ]}>
            {Math.round(progress)}%
          </Animated.Text>
        )}
      </View>
    </Animated.View>
  );
}