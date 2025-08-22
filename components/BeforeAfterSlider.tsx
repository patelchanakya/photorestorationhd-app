import { IconSymbol } from '@/components/ui/IconSymbol';
import React, { useState } from 'react';
import { Dimensions, Image as RNImage, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  style?: any;
  simpleSlider?: boolean;
}

const BeforeAfterSliderComponent = ({ beforeUri, afterUri, style, simpleSlider = false }: BeforeAfterSliderProps) => {
  const [containerWidth, setContainerWidth] = useState(300);
  const sliderPosition = useSharedValue(0.5);
  const [dragging, setDragging] = useState(false);
  
  // Reset slider position when component mounts
  React.useEffect(() => {
    sliderPosition.value = 0.5;
  }, [beforeUri, afterUri]);

  const updateSliderValue = (value: number) => {
    // Keep for percentage display
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      'worklet';
      context.startX = sliderPosition.value;
      runOnJS(setDragging)(true);
    },
    onActive: (event, context) => {
      'worklet';
      const newPosition = Math.max(0, Math.min(1, event.x / containerWidth));
      sliderPosition.value = newPosition;
    },
    onEnd: () => {
      'worklet';
      runOnJS(setDragging)(false);
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${sliderPosition.value * 100}%`,
    };
  });

  const lineStyle = useAnimatedStyle(() => {
    return {
      left: `${sliderPosition.value * 100}%`,
    };
  });

  const handleStyle = useAnimatedStyle(() => {
    const handleSize = isSmallDevice ? 28 : 32;
    return {
      left: `${sliderPosition.value * 100}%`,
      zIndex: 2,
      transform: [
        { translateX: -handleSize / 2 },
        { scale: dragging ? 1.18 : 1 },
      ],
      shadowColor: '#f97316',
      shadowOpacity: dragging ? 0.35 : 0.18,
      shadowRadius: dragging ? 16 : 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: dragging ? 8 : 4,
    };
  });

  return (
    <View style={[{ backgroundColor: 'rgba(0,0,0,0.01)' }, style]}>
      {/* Image container */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View 
          style={{ 
            height: SCREEN_WIDTH < 380 ? 280 : 320, 
            position: 'relative', 
            backgroundColor: '#ffffff',
            maxHeight: '100%'
          }}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            setContainerWidth(width);
          }}
        >
          {/* After image (base) */}
          <RNImage
            source={{ uri: afterUri }}
            style={{ 
              width: '100%', 
              height: '100%', 
              position: 'absolute',
            }}
            resizeMode="contain"
            onError={(error) => {
              console.error('After image error:', error);
            }}
          />
          
          {/* Before image (clipped overlay) */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                overflow: 'hidden',
              },
              animatedStyle,
            ]}
          >
            <RNImage
              source={{ uri: beforeUri }}
              style={{ 
                width: containerWidth, // Dynamic width based on container
                height: '100%',
              }}
              resizeMode="contain"
              onError={(error) => {
                console.error('Before image error:', error);
              }}
            />
          </Animated.View>
          {/* Single slider line */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                width: 1,
                height: '100%',
                backgroundColor: '#f97316',
                marginLeft: -1,
                borderRadius: 1,
              },
              lineStyle,
            ]}
          />
          {/* Small circle on line - only show if not simple slider */}
          {!simpleSlider && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: '50%',
                  width: 6,
                  height: 6,
                  backgroundColor: '#f97316',
                  borderRadius: 3,
                  marginTop: -3,
                  marginLeft: -3,
                },
                lineStyle,
              ]}
            />
          )}
          {/* Single slider handle - only show arrows if not simple slider */}
          {!simpleSlider && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: '50%',
                  width: isSmallDevice ? 28 : 32,
                  height: isSmallDevice ? 28 : 32,
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: isSmallDevice ? 14 : 16,
                  marginTop: isSmallDevice ? -14 : -16,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                handleStyle,
              ]}
            >
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: isSmallDevice ? 18 : 20, 
                height: isSmallDevice ? 18 : 20 
              }}>
                <IconSymbol name="chevron.left" size={isSmallDevice ? 11 : 12} color="#f97316" style={{ marginRight: -1 }} />
                <IconSymbol name="chevron.right" size={isSmallDevice ? 11 : 12} color="#f97316" style={{ marginLeft: -1 }} />
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </PanGestureHandler>
      
    </View>
  );
};

export const BeforeAfterSlider = React.memo(BeforeAfterSliderComponent);