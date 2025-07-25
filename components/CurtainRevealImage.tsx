import React, { useImperativeHandle, forwardRef, useState, useRef, useEffect } from 'react';
import { View, Image, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

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
    const [isRevealed, setIsRevealed] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const lastTapTime = useRef(0);
    const isMounted = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        isMounted.current = false;
        cancelAnimation(curtainHeight);
        // Immediate state reset to prevent any pending updates
        try {
          setIsAnimating(false);
          setIsRevealed(false);
        } catch (error) {
          // Ignore errors if component is already unmounted
        }
      };
    }, [curtainHeight]);

    const safeCallback = (callback: () => void) => {
      if (isMounted.current) {
        try {
          callback();
        } catch (error) {
          console.warn('CurtainRevealImage callback error:', error);
        }
      }
    };

    const startReveal = () => {
      if (!isMounted.current) return;
      cancelAnimation(curtainHeight);
      setIsAnimating(true);
      curtainHeight.value = withSpring(0, {
        damping: 25,
        stiffness: 80,
        mass: 1.2,
        velocity: 2,
      }, (finished) => {
        if (finished) {
          runOnJS(safeCallback)(() => {
            setIsRevealed(true);
            setIsAnimating(false);
            if (onRevealComplete && isMounted.current) {
              try {
                onRevealComplete();
              } catch (error) {
                console.warn('onRevealComplete callback error:', error);
              }
            }
          });
        }
      });
    };

    const toggleReveal = () => {
      if (!isMounted.current) return;
      
      const now = Date.now();
      
      // Debouncing: prevent rapid taps
      if (now - lastTapTime.current < 300 || isAnimating) {
        return;
      }
      
      lastTapTime.current = now;
      cancelAnimation(curtainHeight);
      setIsAnimating(true);
      
      // Haptic feedback (only if component is still mounted)
      if (isMounted.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          // Ignore haptic errors
        });
      }
      
      const targetValue = isRevealed ? 1 : 0;
      const newRevealedState = !isRevealed;
      
      curtainHeight.value = withSpring(targetValue, {
        damping: 25,
        stiffness: 80,
        mass: 1.2,
      }, (finished) => {
        if (finished) {
          runOnJS(safeCallback)(() => {
            setIsRevealed(newRevealedState);
            setIsAnimating(false);
          });
        }
      });
    };

    useImperativeHandle(ref, () => ({
      startReveal,
    }));

    const curtainAnimatedStyle = useAnimatedStyle(() => {
      try {
        return {
          height: `${curtainHeight.value * 100}%`,
        };
      } catch (error) {
        // Fallback if animation value is corrupted
        return {
          height: '100%',
        };
      }
    });

    const imageSize = SCREEN_WIDTH * 0.8;

    // Don't render if component is unmounting
    if (!isMounted.current) {
      return null;
    }

    return (
      <Pressable 
        onPress={toggleReveal} 
        disabled={isAnimating || !isMounted.current}
      >
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
          onError={() => {
            // Handle image loading errors gracefully
            console.warn('After image failed to load');
          }}
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
            onError={() => {
              // Handle image loading errors gracefully
              console.warn('Before image failed to load');
            }}
          />
        </Animated.View>
        </View>
      </Pressable>
    );
  }
);

CurtainRevealImage.displayName = 'CurtainRevealImage';

export default CurtainRevealImage;