import { IconSymbol } from '@/components/ui/IconSymbol';
import React, { useState } from 'react';
import { Image as RNImage, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  style?: any;
}

export function BeforeAfterSlider({ beforeUri, afterUri, style }: BeforeAfterSliderProps) {
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
      context.startX = sliderPosition.value;
      runOnJS(setDragging)(true);
    },
    onActive: (event, context) => {
      const newPosition = Math.max(0, Math.min(1, event.x / containerWidth));
      sliderPosition.value = newPosition;
    },
    onEnd: () => {
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
    return {
      left: `${sliderPosition.value * 100}%`,
      zIndex: 2,
      transform: [
        { translateX: -16 },
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
    <View style={[{ backgroundColor: 'transparent' }, style]}>
      {/* Image container */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View 
          style={{ height: 320, position: 'relative', backgroundColor: 'transparent' }}
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
            resizeMode="cover"
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
              resizeMode="cover"
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
                width: 2,
                height: '100%',
                backgroundColor: '#aaa',
                marginLeft: -1,
                borderRadius: 1,
              },
              lineStyle,
            ]}
          />
          {/* Single slider handle */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: '50%',
                width: 32,
                height: 32,
                backgroundColor: 'transparent',
                borderRadius: 16,
                marginTop: -16,
                justifyContent: 'center',
                alignItems: 'center',
              },
              handleStyle,
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
              <IconSymbol name="chevron.left" size={16} color="#fff" style={{ marginRight: 0 }} />
              <IconSymbol name="chevron.right" size={16} color="#fff" style={{ marginLeft: 0 }} />
            </View>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
      
    </View>
  );
}