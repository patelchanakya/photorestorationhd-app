import React, { useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CurtainRevealImageProps {
  beforeImage: any;
  afterImage: any;
  onRevealComplete?: () => void;
}

export interface CurtainRevealImageRef {
  startReveal: () => void;
}

const CurtainRevealImage = forwardRef<CurtainRevealImageRef, CurtainRevealImageProps>(
  ({ beforeImage, afterImage, onRevealComplete }, ref) => {
    const curtainHeight = useSharedValue(1); // 1 = full height, 0 = hidden

    const startReveal = () => {
      curtainHeight.value = withSpring(0, {
        damping: 35,
        stiffness: 65,
        mass: 1.8,
        velocity: 0.5,
      }, (finished) => {
        if (finished && onRevealComplete) {
          runOnJS(onRevealComplete)();
        }
      });
    };

    useImperativeHandle(ref, () => ({
      startReveal,
    }));

    const curtainAnimatedStyle = useAnimatedStyle(() => {
      return {
        height: `${curtainHeight.value * 100}%`,
      };
    });

    const imageSize = SCREEN_WIDTH * 0.8;

    return (
      <View 
        className="items-center justify-center"
        style={{ width: imageSize, height: imageSize }}
      >
        {/* Restored image (background layer) */}
        <Image
          source={afterImage}
          style={{
            position: 'absolute',
            width: imageSize,
            height: imageSize,
            borderRadius: 16,
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
      </View>
    );
  }
);

CurtainRevealImage.displayName = 'CurtainRevealImage';

export default CurtainRevealImage;