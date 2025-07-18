import { IconSymbol } from '@/components/ui/IconSymbol';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ImageEditor } from 'expo-dynamic-image-crop';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    Gesture
} from 'react-native-gesture-handler';
import {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { showPaywall } from '@/services/superwall';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 60;
const BOTTOM_HEIGHT = 80;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - BOTTOM_HEIGHT;
const CROP_SIZE = Math.min(SCREEN_WIDTH, AVAILABLE_HEIGHT) * 0.7;

export default function CropModalScreen() {
  const router = useRouter();
  const { imageUri, functionType } = useLocalSearchParams();
  const [currentImageUri, setCurrentImageUri] = useState(imageUri ? decodeURIComponent(imageUri as string) : '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCropTool, setShowCropTool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { canRestore, incrementFreeRestorations } = useSubscriptionStore();
  // We'll use Reanimated shared values for crop box in the next step
  
  const decodedUri = imageUri ? decodeURIComponent(imageUri as string) : '';
  
  // Animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Use shared values for crop box position
  const cropX = useSharedValue(0); // No longer needed
  const cropY = useSharedValue(0); // No longer needed

  // Update shared values when cropBox changes (e.g. on image load)
  useEffect(() => {
    // cropX.value = cropBox.x; // No longer needed
    // cropY.value = cropBox.y; // No longer needed
  }, []);

  // Debug: log crop box coordinates
  useEffect(() => {
    console.log('CropBox:', cropX.value, cropY.value);
  }, [cropX.value, cropY.value]);

  // Pan gesture for crop box
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Calculate new position
      let newX = cropX.value + e.translationX;
      let newY = cropY.value + e.translationY;
      // Constrain within image bounds
      newX = Math.max(0, Math.min(newX, SCREEN_WIDTH - CROP_SIZE)); // Constrain to image width
      newY = Math.max(0, Math.min(newY, SCREEN_HEIGHT - CROP_SIZE)); // Constrain to image height
      cropX.value = newX;
      cropY.value = newY;
    })
    .onEnd(() => {
      // Update React state at the end (optional, for future use)
      // runOnJS(setCropBox)({ ...cropBox, x: cropX.value, y: cropY.value }); // No longer needed
    });

  // Animated style for crop box
  const cropBoxStyle = useAnimatedStyle(() => ({
    left: cropX.value,
    top: cropY.value,
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderWidth: 3,
    borderColor: '#f97316',
    backgroundColor: 'rgba(255, 165, 0, 0.1)', // fallback color for visibility
    position: 'absolute',
    zIndex: 10,
    borderStyle: 'dashed', // debug border
  }));

  // We'll implement performant crop box logic here in the next step

  const handleCrop = async () => {
    if (!decodedUri) return;
    
    setIsProcessing(true);
    
    try {
      // Calculate the crop area in original image coordinates
      const scaleRatio = 1; // ImageEditor handles scaling
      
      // Calculate visible area in display coordinates
      const visibleWidth = CROP_SIZE / scale.value;
      const visibleHeight = CROP_SIZE / scale.value;
      
      // Calculate center point in display coordinates
      const centerX = SCREEN_WIDTH / 2 - translateX.value / scale.value;
      const centerY = SCREEN_HEIGHT / 2 - translateY.value / scale.value;
      
      // Calculate crop origin in display coordinates
      const cropX = centerX - visibleWidth / 2;
      const cropY = centerY - visibleHeight / 2;
      
      // Convert to original image coordinates
      const originX = Math.max(0, cropX * scaleRatio);
      const originY = Math.max(0, cropY * scaleRatio);
      const width = Math.min(visibleWidth * scaleRatio, 1); // Assuming imageSize.width is 1 for simplicity
      const height = Math.min(visibleHeight * scaleRatio, 1); // Assuming imageSize.height is 1 for simplicity
      
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
      await handleRestoration(result.uri);
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

  const handleRestoration = async (imageUri: string) => {
    // Check if user can restore
    if (!canRestore()) {
      // Show paywall if limit reached
      const result = await showPaywall('restoration_limit');
      if (!result || (result as any)?.type !== 'purchased' && (result as any)?.type !== 'restored') {
        // User didn't purchase, don't proceed
        Alert.alert(
          'Restoration Limit Reached',
          'You\'ve reached your daily limit of 3 free restorations. Upgrade to PRO for unlimited restorations!',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    // Increment usage counter (only for free users)
    incrementFreeRestorations();
    
    // Proceed with restoration
    router.replace(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(imageUri)}&functionType=${functionType}`);
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

  useEffect(() => {
    // Debug: log display size and crop box coordinates
    console.log('DisplaySize:', SCREEN_WIDTH, SCREEN_HEIGHT, 'CropBox:', cropX.value, cropY.value);
  }, [SCREEN_WIDTH, SCREEN_HEIGHT, cropX.value, cropY.value]);

  return (
    <SafeAreaView className="flex-1 bg-black justify-center items-center">
      <View
        className="flex-row justify-between items-center px-4 py-3 border-b border-white/10 bg-black/90"
        style={{ zIndex: 10 }}
      >
        <TouchableOpacity
          onPress={handleCancel}
          className="w-10 h-10 rounded-full bg-white/10 justify-center items-center"
        >
          <IconSymbol name="xmark" size={20} color="#fff" />
        </TouchableOpacity>
        <View className="flex-1 mx-4">
          <Text className="text-white text-lg font-semibold text-center">
            {functionType === 'unblur' ? 'Unblur' : functionType === 'colorize' ? 'Colorize' : 'Restore'}
          </Text>
          <Text className="text-white/60 text-sm text-center mt-1">
            Use image or crop
          </Text>
        </View>
        {/* Rotate button in header (top right) */}
        <TouchableOpacity
          style={{
            backgroundColor: '#222',
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 8,
          }}
          onPress={async () => {
            try {
              const result = await ImageManipulator.manipulateAsync(
                currentImageUri,
                [{ rotate: 90 }],
                { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
              );
              setCurrentImageUri(result.uri);
            } catch (e) {}
          }}
          accessibilityLabel="Rotate Image"
        >
          <Ionicons name="refresh" size={22} color="#f97316" />
        </TouchableOpacity>
      </View>
      {isProcessing ? (
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : showCropTool ? (
        <View style={{
          flex: 1,
          marginTop: 60,
          marginBottom: 80,
          borderRadius: 16,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'black',
        }}>
          <ImageEditor
            key={currentImageUri}
            isVisible={true}
            imageUri={currentImageUri}
            onEditingComplete={(cropped) => {
              setShowCropTool(false);
              if (cropped?.uri) {
                handleRestoration(cropped.uri);
              }
            }}
            onEditingCancel={() => {
              setShowCropTool(false);
            }}
            dynamicCrop={true}
            // If the package supports a confirm/save button text prop, set it here:
            // confirmButtonText="Crop"
            // saveButtonText="Crop"
            // doneButtonText="Crop"
          />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
          {currentImageUri ? (
            <>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                <ImagePreview imageUri={currentImageUri} />
              </View>
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 24,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                zIndex: 10,
                paddingHorizontal: 16,
              }}>
                {/* Crop button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#222',
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.12,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                  onPress={() => setShowCropTool(true)}
                  accessibilityLabel="Crop Image"
                >
                  <Ionicons name="crop" size={22} color="#f97316" />
                </TouchableOpacity>

                {/* Use Image button */}
                <View style={{
                  minWidth: 120,
                  maxWidth: 180,
                  height: 40,
                  borderRadius: 16,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#f97316',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 1,
                  elevation: 1,
                  backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255,255,255,0.18)',
                }}>
                  {Platform.OS === 'ios' ? (
                    <BlurView intensity={30} tint="light" style={{ ...StyleSheet.absoluteFillObject }} />
                  ) : null}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      width: '100%',
                      height: '100%',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(249,115,22,0.25)',
                      paddingHorizontal: 12,
                    }}
                    onPress={() => {
                      handleRestoration(currentImageUri);
                    }}
                    accessibilityLabel="Use Whole Image"
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: '#f97316', fontWeight: '500', fontSize: 15, letterSpacing: 0.1 }}>Use Image</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}
        </View>
      )}
      {error && (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500 text-lg mt-4">{error}</Text>
        </View>
      )}
    </SafeAreaView>
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

// Helper component for responsive image preview
function ImagePreview({ imageUri }: { imageUri: string }) {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    if (!imageUri) return;
    Image.getSize(imageUri, (w, h) => {
      const maxW = SCREEN_WIDTH * 0.98;
      const maxH = SCREEN_HEIGHT * 0.55;
      let width = maxW;
      let height = (h / w) * width;
      if (height > maxH) {
        height = maxH;
        width = (w / h) * height;
      }
      setSize({ width, height });
    });
  }, [imageUri]);

  if (!imageUri || !size.width || !size.height) return null;
  return (
    <Image
      source={{ uri: imageUri }}
      style={{
        width: size.width,
        height: size.height,
        resizeMode: 'contain',
        borderRadius: 16,
        backgroundColor: 'black',
        flexShrink: 1,
      }}
    />
  );
}

