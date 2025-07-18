import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
  StyleSheet,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import Animated, { 
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { 
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_SIZE = SCREEN_WIDTH >= 768 ? Math.min(SCREEN_WIDTH * 0.7, 500) : Math.min(SCREEN_WIDTH * 0.9, 400);

export default function CropModalScreen() {
  const router = useRouter();
  const { imageUri, functionType } = useLocalSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  
  const decodedUri = imageUri ? decodeURIComponent(imageUri as string) : '';
  
  // Animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (decodedUri) {
      Image.getSize(decodedUri, (width, height) => {
        setImageSize({ width, height });
        
        // Calculate display size to fit screen
        const aspectRatio = width / height;
        let displayWidth = SCREEN_WIDTH;
        let displayHeight = displayWidth / aspectRatio;
        
        if (displayHeight > SCREEN_HEIGHT * 0.7) {
          displayHeight = SCREEN_HEIGHT * 0.7;
          displayWidth = displayHeight * aspectRatio;
        }
        
        setDisplaySize({ width: displayWidth, height: displayHeight });
        
        // Set initial scale to fill the crop area
        const initialScale = Math.max(CROP_SIZE / displayWidth, CROP_SIZE / displayHeight) * 1.2;
        scale.value = initialScale;
        savedScale.value = initialScale;
      });
    }
  }, [decodedUri]);

  const handleCrop = async () => {
    if (!decodedUri || imageSize.width === 0) return;
    
    setIsProcessing(true);
    
    try {
      // Calculate the crop area in original image coordinates
      const scaleRatio = imageSize.width / displaySize.width;
      
      // Calculate visible area in display coordinates
      const visibleWidth = CROP_SIZE / scale.value;
      const visibleHeight = CROP_SIZE / scale.value;
      
      // Calculate center point in display coordinates
      const centerX = displaySize.width / 2 - translateX.value / scale.value;
      const centerY = displaySize.height / 2 - translateY.value / scale.value;
      
      // Calculate crop origin in display coordinates
      const cropX = centerX - visibleWidth / 2;
      const cropY = centerY - visibleHeight / 2;
      
      // Convert to original image coordinates
      const originX = Math.max(0, cropX * scaleRatio);
      const originY = Math.max(0, cropY * scaleRatio);
      const width = Math.min(visibleWidth * scaleRatio, imageSize.width - originX);
      const height = Math.min(visibleHeight * scaleRatio, imageSize.height - originY);
      
      const result = await ImageManipulator.manipulateAsync(
        decodedUri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.round(width),
              height: Math.round(height),
            },
          },
        ],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Navigate to restoration screen with cropped image
      router.push(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(result.uri)}&functionType=${functionType}`);
    } catch (error) {
      console.error('Error cropping image:', error);
      Alert.alert('Error', 'Failed to crop the image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  // Pan gesture
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Pinch gesture
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      scale.value = withSpring(Math.max(0.5, Math.min(scale.value, 5)));
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  if (!imageUri) {
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        <Text className="text-white text-lg">No image selected</Text>
        <TouchableOpacity
          className="mt-4 px-6 py-3 bg-orange-500 rounded-full"
          onPress={handleCancel}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-1">
          {/* Header */}
          <View className="flex-row justify-between items-center px-4 py-3 border-b border-white/10 bg-black/90" style={{ zIndex: 10 }}>
            <TouchableOpacity
              onPress={handleCancel}
              className="w-10 h-10 rounded-full bg-white/10 justify-center items-center"
              disabled={isProcessing}
            >
              <IconSymbol name="xmark" size={20} color="#fff" />
            </TouchableOpacity>
            
            <View className="flex-1 mx-4">
              <Text className="text-white text-lg font-semibold text-center">
                {functionType === 'unblur' ? 'Unblur Photo' : functionType === 'colorize' ? 'Colorize Photo' : 'Restore Photo'}
              </Text>
              <Text className="text-white/60 text-sm text-center mt-1">
                Position and crop your image
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={handleCrop}
              className="px-4 py-2 rounded-full bg-orange-500 flex-row items-center"
              disabled={isProcessing || imageSize.width === 0}
            >
              <IconSymbol name="sparkles" size={16} color="#fff" />
              <Text className="text-white font-semibold ml-1">
                {functionType === 'unblur' ? 'Unblur' : functionType === 'colorize' ? 'Colorize' : 'Restore'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Image Container */}
          <View className="flex-1 justify-center items-center">
            {isProcessing ? (
              <View className="justify-center items-center">
                <ActivityIndicator size="large" color="#f97316" />
                <Text className="text-white text-lg mt-4">Processing...</Text>
              </View>
            ) : displaySize.width > 0 ? (
              <View style={styles.cropContainer}>
                {/* Full screen image */}
                <GestureDetector gesture={composed}>
                  <Animated.View style={animatedStyle}>
                    <Image
                      source={{ uri: decodedUri }}
                      style={{
                        width: displaySize.width,
                        height: displaySize.height,
                      }}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </GestureDetector>
                
                {/* Dark overlay with transparent crop area */}
                <View style={styles.overlayContainer} pointerEvents="none">
                  {/* Top overlay */}
                  <View style={[styles.overlay, { 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    height: (SCREEN_HEIGHT * 0.7 - CROP_SIZE) / 2 
                  }]} />
                  
                  {/* Bottom overlay */}
                  <View style={[styles.overlay, { 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    height: (SCREEN_HEIGHT * 0.7 - CROP_SIZE) / 2 
                  }]} />
                  
                  {/* Left overlay */}
                  <View style={[styles.overlay, { 
                    top: (SCREEN_HEIGHT * 0.7 - CROP_SIZE) / 2,
                    left: 0, 
                    width: (SCREEN_WIDTH - CROP_SIZE) / 2,
                    height: CROP_SIZE
                  }]} />
                  
                  {/* Right overlay */}
                  <View style={[styles.overlay, { 
                    top: (SCREEN_HEIGHT * 0.7 - CROP_SIZE) / 2,
                    right: 0, 
                    width: (SCREEN_WIDTH - CROP_SIZE) / 2,
                    height: CROP_SIZE
                  }]} />
                  
                  {/* Crop frame */}
                  <View style={styles.cropArea}>
                    {/* Corner indicators */}
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </View>
                </View>
              </View>
            ) : (
              <ActivityIndicator size="large" color="#f97316" />
            )}
          </View>

        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  cropContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  cropArea: {
    position: 'absolute',
    width: CROP_SIZE,
    height: CROP_SIZE,
    left: (SCREEN_WIDTH - CROP_SIZE) / 2,
    top: (SCREEN_HEIGHT * 0.7 - CROP_SIZE) / 2,
    borderWidth: 3,
    borderColor: '#f97316',
    backgroundColor: 'transparent',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#f97316',
    borderRadius: 2,
  },
  topLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 5,
    borderLeftWidth: 5,
  },
  topRight: {
    top: -3,
    right: -3,
    borderTopWidth: 5,
    borderRightWidth: 5,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 5,
    borderRightWidth: 5,
  },
});