import React from 'react';
import Animated, { useAnimatedProps, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface LockIconProps {
  state: 'locked' | 'unlocking' | 'unlocked';
  size?: number;
  color?: string;
}

export function LockIcon({ state, size = 120, color = '#F97316' }: LockIconProps) {
  const lockOpacity = useSharedValue(state === 'locked' ? 1 : 0);
  const checkmarkOpacity = useSharedValue(state === 'unlocked' ? 1 : 0);
  const glowOpacity = useSharedValue(0);

  React.useEffect(() => {
    switch (state) {
      case 'locked':
        lockOpacity.value = withSpring(1);
        checkmarkOpacity.value = withSpring(0);
        glowOpacity.value = withTiming(0.3, { duration: 300 });
        break;
      case 'unlocking':
        lockOpacity.value = withSpring(0.5);
        glowOpacity.value = withTiming(0.8, { duration: 300 });
        break;
      case 'unlocked':
        lockOpacity.value = withSpring(0);
        checkmarkOpacity.value = withSpring(1);
        glowOpacity.value = withTiming(0.6, { duration: 300 });
        break;
    }
  }, [state]);

  const lockAnimatedProps = useAnimatedProps(() => ({
    opacity: lockOpacity.value,
  }));

  const checkmarkAnimatedProps = useAnimatedProps(() => ({
    opacity: checkmarkOpacity.value,
  }));

  const glowAnimatedProps = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* Glow effect */}
      <AnimatedCircle
        cx="60"
        cy="60" 
        r="50"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeOpacity="0.3"
        animatedProps={glowAnimatedProps}
      />
      
      {/* Lock icon */}
      <AnimatedPath
        d="M40 50V40C40 28.954 48.954 20 60 20C71.046 20 80 28.954 80 40V50M35 50H85C88.314 50 91 52.686 91 56V90C91 93.314 88.314 96 85 96H35C31.686 96 29 93.314 29 90V56C29 52.686 31.686 50 35 50Z"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        animatedProps={lockAnimatedProps}
      />
      
      {/* Lock keyhole */}
      <AnimatedPath
        d="M60 65V75M60 65C62.761 65 65 62.761 65 60C65 57.239 62.761 55 60 55C57.239 55 55 57.239 55 60C55 62.761 57.239 65 60 65Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        animatedProps={lockAnimatedProps}
      />
      
      {/* Checkmark */}
      <AnimatedPath
        d="M45 60L55 70L75 50"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        animatedProps={checkmarkAnimatedProps}
      />
    </Svg>
  );
}