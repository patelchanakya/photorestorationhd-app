import React from 'react';
import { View } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming 
} from 'react-native-reanimated';

interface ProgressDotsProps {
  totalSteps: number;
  currentStep: number;
  style?: any;
}

export function ProgressDots({ totalSteps, currentStep, style }: ProgressDotsProps) {
  const dots = Array.from({ length: totalSteps }, (_, index) => index);

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, style]}>
      {dots.map((_, index) => (
        <ProgressDot 
          key={index} 
          isActive={index <= currentStep}
          isNext={index === currentStep + 1}
          isLast={index === totalSteps - 1}
        />
      ))}
    </View>
  );
}

interface ProgressDotProps {
  isActive: boolean;
  isNext: boolean;
  isLast: boolean;
}

function ProgressDot({ isActive, isNext, isLast }: ProgressDotProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1.2, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 300 });
    } else if (isNext) {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(0.6, { duration: 300 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      opacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [isActive, isNext]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ marginHorizontal: 4, alignItems: 'center' }}>
      <Animated.View
        style={[
          {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isActive ? '#FACC15' : '#6B7280',
            shadowColor: isActive ? '#FACC15' : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 4,
            elevation: 2,
          },
          animatedStyle,
        ]}
      />
      {!isLast && (
        <View
          style={{
            position: 'absolute',
            left: 12,
            top: 3,
            width: 20,
            height: 2,
            backgroundColor: isActive ? '#FACC15' : '#6B7280',
            opacity: isActive ? 0.8 : 0.3,
          }}
        />
      )}
    </View>
  );
}