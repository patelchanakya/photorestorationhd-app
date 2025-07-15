import React, { useState } from 'react';
import { View, Text, Image as RNImage } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedGestureHandler, useAnimatedStyle, runOnJS } from 'react-native-reanimated';

interface BeforeAfterSliderProps {
  beforeUri: string;
  afterUri: string;
  style?: any;
}

export function BeforeAfterSlider({ beforeUri, afterUri, style }: BeforeAfterSliderProps) {
  const [containerWidth, setContainerWidth] = useState(300);
  const sliderPosition = useSharedValue(0.5);
  
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
    },
    onActive: (event, context) => {
      const newPosition = Math.max(0, Math.min(1, event.x / containerWidth));
      sliderPosition.value = newPosition;
    },
    onEnd: () => {
      // Optional: Add any end handling here
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
    };
  });

  return (
    <View style={style}>
      <View className="bg-black rounded-2xl shadow-lg overflow-hidden">
        {/* Image container */}
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View 
            style={{ height: 300, position: 'relative' }}
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
                  height: '100%' 
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
                  backgroundColor: '#f97316',
                  marginLeft: -1,
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
                  width: 20,
                  height: 20,
                  backgroundColor: '#f97316',
                  borderRadius: 10,
                  marginLeft: -10,
                  marginTop: -10,
                  borderWidth: 2,
                  borderColor: '#ffffff',
                },
                handleStyle,
              ]}
            />
          </Animated.View>
        </PanGestureHandler>
        
      </View>
    </View>
  );
}