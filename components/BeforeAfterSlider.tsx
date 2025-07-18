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

  // Animated style for the slider handle below the image
  const sliderHandleStyle = useAnimatedStyle(() => {
    return {
      left: sliderPosition.value * containerWidth - 24,
      transform: [{ scale: dragging ? 1.12 : 1 }],
    };
  });

  return (
    <View style={[{ backgroundColor: 'transparent' }, style]}>
      {/* Image container (no gesture handler) */}
      <Animated.View 
        style={{ height: 320, position: 'relative', backgroundColor: '#f5f5f5' }}
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
      </Animated.View>
      {/* Slider below the image */}
      <View style={{ width: containerWidth, alignSelf: 'center', marginTop: 24 }}>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={{ width: '100%', height: 44, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {/* Modern slider track */}
            <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 6, backgroundColor: '#bbb', borderRadius: 3, transform: [{ translateY: -3 }] }} />
            {/* Minimal slider handle */}
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 7,
                  width: 32,
                  height: 28,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 2,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 2,
                  // No border
                },
                sliderHandleStyle,
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 32, height: 28 }}>
                <IconSymbol name="chevron.left" size={14} color="#f97316" style={{ marginRight: 0 }} />
                <View style={{ width: 4, height: 16, backgroundColor: '#f97316', borderRadius: 2, marginHorizontal: 1 }} />
                <IconSymbol name="chevron.right" size={14} color="#f97316" style={{ marginLeft: 0 }} />
              </View>
            </Animated.View>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </View>
  );
}