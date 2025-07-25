import React, { useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CurtainRevealImageProps {
  beforeImage: any;
  afterImage: any;
  onRevealComplete?: () => void;
  glowColor?: string;
}

export interface CurtainRevealImageRef {
  startReveal: () => void;
}

const CurtainRevealImage = forwardRef<CurtainRevealImageRef, CurtainRevealImageProps>(
  ({ beforeImage, afterImage, onRevealComplete, glowColor = '#3b82f6' }, ref) => {
    const curtainHeight = useSharedValue(1); // 1 = full height, 0 = hidden
    const imageScale = useSharedValue(1);
    const glowOpacity = useSharedValue(0);
    const shake = useSharedValue(0);
    const imageOpacity = useSharedValue(1);

    const startReveal = () => {
      // Pre-reveal shake animation to build anticipation
      shake.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(-1, { duration: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 100 })
      );

      // Scale down slightly first, then scale up during reveal
      imageScale.value = withSequence(
        withTiming(0.95, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withDelay(200, withSpring(1.05, {
          damping: 15,
          stiffness: 120,
          mass: 1.2,
        })),
        withSpring(1, {
          damping: 20,
          stiffness: 150,
        })
      );

      // Subtle glow effect during transformation
      glowOpacity.value = withSequence(
        withDelay(300, withTiming(0.3, { duration: 400 })),
        withTiming(0, { duration: 800 })
      );

      // Dramatic curtain reveal with resistance effect
      curtainHeight.value = withDelay(400, withSpring(0, {
        damping: 25,
        stiffness: 45,
        mass: 2.5,
        velocity: -0.5,
        restDisplacementThreshold: 0.001,
        restSpeedThreshold: 0.001,
      }, (finished) => {
        if (finished && onRevealComplete) {
          runOnJS(onRevealComplete)();
        }
      }));
    };

    useImperativeHandle(ref, () => ({
      startReveal,
    }));

    const curtainAnimatedStyle = useAnimatedStyle(() => {
      return {
        height: `${curtainHeight.value * 100}%`,
      };
    });

    const containerAnimatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { scale: imageScale.value },
          { translateX: shake.value * 5 }
        ],
      };
    });

    const glowAnimatedStyle = useAnimatedStyle(() => {
      return {
        opacity: glowOpacity.value,
      };
    });

    const imageSize = SCREEN_WIDTH * 0.8;

    return (
      <Animated.View 
        className="items-center justify-center"
        style={[{ width: imageSize, height: imageSize }, containerAnimatedStyle]}
      >
        {/* Glow effect layer */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: imageSize * 1.15,
              height: imageSize * 1.15,
              borderRadius: 20,
              backgroundColor: glowColor,
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 20,
            },
            glowAnimatedStyle,
          ]}
        />
        
        {/* Restored image (background layer) */}
        <Image
          source={afterImage}
          style={{
            position: 'absolute',
            width: imageSize,
            height: imageSize,
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
          resizeMode="contain"
          fadeDuration={0}
        />
        
        {/* Damaged image (curtain layer) */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: imageSize,
              overflow: 'hidden',
              bottom: 0,
              borderRadius: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
            },
            curtainAnimatedStyle,
          ]}
        >
          <Image
            source={beforeImage}
            style={{
              position: 'absolute',
              bottom: 0,
              width: imageSize,
              height: imageSize,
            }}
            resizeMode="contain"
            fadeDuration={0}
          />
        </Animated.View>
      </Animated.View>
    );
  }
);

CurtainRevealImage.displayName = 'CurtainRevealImage';

export default CurtainRevealImage;