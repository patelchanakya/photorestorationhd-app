import React, { useEffect, useState } from 'react';
import { View, Dimensions, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface CameraFrameOverlayProps {
  aspectRatio?: [number, number];
  color?: string;
  borderWidth?: number;
  cornerLength?: number;
  showGrid?: boolean;
}

export function CameraFrameOverlay({
  aspectRatio = [4, 3],
  color = '#f97316',
  borderWidth = 3,
  cornerLength = 30,
  showGrid = false,
}: CameraFrameOverlayProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const opacity = useSharedValue(0.9);
  const cornerOpacity = useSharedValue(1);

  // Calculate frame dimensions maintaining aspect ratio
  const frameAspectRatio = aspectRatio[0] / aspectRatio[1];
  const screenAspectRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
  
  let frameWidth: number;
  let frameHeight: number;
  
  // Account for UI controls
  const TOP_CONTROLS_HEIGHT = 112; // 60px padding + 52px controls
  const BOTTOM_CONTROLS_HEIGHT = 128; // 32px padding + 64px button + 32px margin
  const SIDE_PADDING = 20;
  
  // Calculate available area for frame
  const availableHeight = SCREEN_HEIGHT - TOP_CONTROLS_HEIGHT - BOTTOM_CONTROLS_HEIGHT;
  const availableWidth = SCREEN_WIDTH - (SIDE_PADDING * 2);
  
  // Calculate frame size to fill available area while maintaining aspect ratio
  const heightBasedWidth = availableHeight * frameAspectRatio;
  const widthBasedHeight = availableWidth / frameAspectRatio;
  
  // Use the smaller dimension to ensure frame fits
  if (heightBasedWidth <= availableWidth) {
    // Height constrained
    frameHeight = availableHeight;
    frameWidth = heightBasedWidth;
  } else {
    // Width constrained
    frameWidth = availableWidth;
    frameHeight = widthBasedHeight;
  }
  
  // Add a small margin to prevent touching edges
  frameHeight = frameHeight * 0.95;
  frameWidth = frameWidth * 0.95;
  
  // Debug logging
  console.log('📐 Frame Dimensions:', {
    screenHeight: SCREEN_HEIGHT,
    screenWidth: SCREEN_WIDTH,
    availableHeight,
    availableWidth,
    frameHeight,
    frameWidth,
    aspectRatio: frameAspectRatio
  });

  useEffect(() => {
    // Subtle pulsing animation for corners
    cornerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [cornerOpacity]);

  const animatedCornerStyle = useAnimatedStyle(() => {
    return {
      opacity: cornerOpacity.value,
    };
  });

  const cornerStyle = {
    position: 'absolute' as const,
    width: cornerLength,
    height: cornerLength,
    borderColor: color,
    borderWidth: borderWidth,
  };

  const gridLineStyle = {
    position: 'absolute' as const,
    backgroundColor: color,
    opacity: 0.3,
  };

  return (
    <View
        style={{
          width: frameWidth,
          height: frameHeight,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Frame border */}
        <View
          style={{
            position: 'absolute',
            width: frameWidth,
            height: frameHeight,
            borderWidth: borderWidth,
            borderColor: color,
            opacity: 0.8,
          }}
        />

        {/* Corner indicators */}
        <Animated.View style={animatedCornerStyle}>
          {/* Top-left corner */}
          <View
            style={[
              cornerStyle,
              {
                top: -borderWidth / 2,
                left: -borderWidth / 2,
                borderRightWidth: 0,
                borderBottomWidth: 0,
              },
            ]}
          />
          
          {/* Top-right corner */}
          <View
            style={[
              cornerStyle,
              {
                top: -borderWidth / 2,
                right: -borderWidth / 2,
                borderLeftWidth: 0,
                borderBottomWidth: 0,
              },
            ]}
          />
          
          {/* Bottom-left corner */}
          <View
            style={[
              cornerStyle,
              {
                bottom: -borderWidth / 2,
                left: -borderWidth / 2,
                borderRightWidth: 0,
                borderTopWidth: 0,
              },
            ]}
          />
          
          {/* Bottom-right corner */}
          <View
            style={[
              cornerStyle,
              {
                bottom: -borderWidth / 2,
                right: -borderWidth / 2,
                borderLeftWidth: 0,
                borderTopWidth: 0,
              },
            ]}
          />
        </Animated.View>

        {/* Optional grid lines for composition */}
        {showGrid && (
          <>
            {/* Vertical grid lines */}
            <View
              style={[
                gridLineStyle,
                {
                  left: frameWidth / 3,
                  top: 0,
                  width: 1,
                  height: frameHeight,
                },
              ]}
            />
            <View
              style={[
                gridLineStyle,
                {
                  left: (frameWidth * 2) / 3,
                  top: 0,
                  width: 1,
                  height: frameHeight,
                },
              ]}
            />
            
            {/* Horizontal grid lines */}
            <View
              style={[
                gridLineStyle,
                {
                  top: frameHeight / 3,
                  left: 0,
                  height: 1,
                  width: frameWidth,
                },
              ]}
            />
            <View
              style={[
                gridLineStyle,
                {
                  top: (frameHeight * 2) / 3,
                  left: 0,
                  height: 1,
                  width: frameWidth,
                },
              ]}
            />
          </>
        )}
      </View>
  );
}