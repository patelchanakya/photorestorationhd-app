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
import Animated, { 
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
    withSpring,
    runOnJS
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import Constants from 'expo-constants';
import { presentPaywall } from '@/services/revenuecat';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 60;
const BOTTOM_HEIGHT = 80;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - BOTTOM_HEIGHT;
const CROP_SIZE = Math.min(SCREEN_WIDTH, AVAILABLE_HEIGHT) * 0.7;

function CropModalScreen() {
  const router = useRouter();
  const { imageUri, functionType } = useLocalSearchParams();
  const [currentImageUri, setCurrentImageUri] = useState(imageUri ? decodeURIComponent(imageUri as string) : '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCropTool, setShowCropTool] = useState(false);
  const [error] = useState<string | null>(null);
  const [useImageLoading, setUseImageLoading] = useState(false);
  const [buttonText, setButtonText] = useState('Use Image');
  const insets = useSafeAreaInsets();
  
  // Get screen dimensions for responsive design
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenHeight < 700;
  const isTinyScreen = screenHeight < 600;
  
  // Calculate responsive spacing - increased to prevent overlap
  const buttonAreaHeight = isSmallScreen ? 200 : 240;
  const toolbarSpacing = isSmallScreen ? 140 : 180;
  
  // Animation values for Use Image button
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);
  
  // Animated styles
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));
  
  const { canRestore, incrementFreeRestorations } = useSubscriptionStore();
  const photoRestoration = usePhotoRestoration();
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
    // Start loading animation
    setUseImageLoading(true);
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15 })
    );
    runOnJS(setButtonText)('Processing...');
    
    // Reset any previous error state before starting new restoration
    photoRestoration.reset();
    
    // Check if user can restore (now async)
    const canRestoreResult = await canRestore();
    if (!canRestoreResult) {
      console.log('🚫 User cannot restore - showing paywall');
      
      // Check if we're in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        Alert.alert(
          'Demo Mode',
          'Purchases are not available in Expo Go. Build a development client to test real purchases.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Use native paywall in production builds
      const success = await presentPaywall();
      if (success) {
        console.log('✅ Pro subscription activated via native paywall!');
        // Now that user is pro, proceed with restoration
        router.replace(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(imageUri)}&functionType=${functionType}`);
      } else {
        // Reset button state if paywall was dismissed
        setUseImageLoading(false);
        runOnJS(setButtonText)('Use Image');
      }
      return;
    }
    
    console.log('✅ User can restore - proceeding with restoration');
    
    // Increment usage counter (only for free users) - now async
    await incrementFreeRestorations();
    
    // Success feedback
    runOnJS(setButtonText)('Starting...');
    buttonScale.value = withSequence(
      withTiming(1.05, { duration: 100 }),
      withSpring(1, { damping: 10 })
    );
    
    // Small delay to show success state
    setTimeout(() => {
      // Proceed with restoration
      router.replace(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(imageUri)}&functionType=${functionType}`);
    }, 400);
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
          className="w-10 h-10 rounded-full justify-center items-center"
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
        {/* Placeholder to balance X button for perfect center alignment */}
        <View className="w-10 h-10" />
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
            onEditingComplete={async (cropped) => {
              console.log('🔍 ImageEditor onEditingComplete called with:', cropped);
              console.log('🔍 Cropped URI:', cropped?.uri);
              console.log('🔍 Cropped object keys:', cropped ? Object.keys(cropped) : 'cropped is null/undefined');
              
              setShowCropTool(false);
              // Check for different possible URI properties
              const croppedUri = cropped?.uri || cropped?.path || cropped?.url || cropped;
              console.log('🔍 Final cropped URI to use:', croppedUri);
              
              if (croppedUri && typeof croppedUri === 'string') {
                console.log('✅ Cropped URI exists, calling handleRestoration');
                try {
                  await handleRestoration(croppedUri);
                  console.log('✅ handleRestoration completed successfully');
                } catch (error) {
                  console.error('❌ handleRestoration failed:', error);
                  Alert.alert('Error', 'Failed to process cropped image. Please try again.');
                }
              } else {
                console.log('❌ No valid cropped URI found');
                console.log('🔍 Falling back to original image');
                // Fallback: use original image if cropping failed
                try {
                  await handleRestoration(currentImageUri);
                  console.log('✅ Fallback to original image successful');
                } catch (error) {
                  console.error('❌ Fallback also failed:', error);
                  Alert.alert('Error', 'Failed to process image. Please try again.');
                }
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
              <View style={{ 
                flex: 1, 
                justifyContent: 'flex-start', 
                alignItems: 'center', 
                width: '100%', 
                paddingTop: isSmallScreen ? 20 : 40,
                paddingBottom: buttonAreaHeight, // Dynamic based on screen size
                paddingHorizontal: 16,
              }}>
                <ImagePreview imageUri={currentImageUri} />
              </View>

              {/* Crop/Rotate Buttons - Upper Row */}
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 140,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isSmallScreen ? 16 : 20,
                zIndex: 10,
                paddingHorizontal: 16,
              }}>

                {/* Crop Button */}
                <TouchableOpacity
                  style={{
                    width: isSmallScreen ? 70 : 80,
                    height: isSmallScreen ? 40 : 44,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    flexDirection: 'row',
                  }}
                  onPress={() => setShowCropTool(true)}
                  accessibilityLabel="Crop Image"
                  activeOpacity={0.7}
                >
                  {Platform.OS === 'ios' && (
                    <BlurView 
                      intensity={20} 
                      tint="dark" 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        borderRadius: 16 
                      }} 
                    />
                  )}
                  <Ionicons name="crop" size={isSmallScreen ? 16 : 18} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: isSmallScreen ? 12 : 14, fontWeight: '600', marginLeft: 4 }}>
                    Crop
                  </Text>
                </TouchableOpacity>

                {/* Rotate Button */}
                <TouchableOpacity
                  style={{
                    width: isSmallScreen ? 80 : 90,
                    height: isSmallScreen ? 40 : 44,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 6,
                    flexDirection: 'row',
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
                  activeOpacity={0.7}
                >
                  {Platform.OS === 'ios' && (
                    <BlurView 
                      intensity={20} 
                      tint="dark" 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        borderRadius: 16 
                      }} 
                    />
                  )}
                  <Ionicons name="refresh" size={isSmallScreen ? 16 : 18} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: isSmallScreen ? 12 : 14, fontWeight: '600', marginLeft: 4 }}>
                    Rotate
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Restore Button - Lower Row */}
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 64,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                paddingHorizontal: 16,
              }}>
                <AnimatedTouchableOpacity
                  style={[
                    {
                      width: isSmallScreen ? 140 : 160,
                      height: isSmallScreen ? 48 : 54,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: useImageLoading ? '#10b981' : '#f97316',
                      shadowColor: useImageLoading ? '#10b981' : '#f97316',
                      shadowOffset: { width: 0, height: 12 },
                      shadowOpacity: 0.3,
                      shadowRadius: 20,
                      elevation: 12,
                      flexDirection: 'row',
                      borderWidth: 0.5,
                      borderColor: useImageLoading ? 'rgba(16, 185, 129, 0.3)' : 'rgba(249, 115, 22, 0.3)',
                    },
                    animatedButtonStyle
                  ]}
                  onPress={() => {
                    if (!useImageLoading) {
                      handleRestoration(currentImageUri);
                    }
                  }}
                  accessibilityLabel="Use Whole Image"
                  activeOpacity={useImageLoading ? 1 : 0.85}
                  disabled={useImageLoading}
                >
                  {useImageLoading ? (
                    <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.9)" />
                  ) : (
                    <Text style={{ 
                      color: 'rgba(255, 255, 255, 0.95)', 
                      fontSize: isSmallScreen ? 16 : 18, 
                      fontWeight: '600',
                      letterSpacing: 0.3
                    }}>
                      Restore
                    </Text>
                  )}
                </AnimatedTouchableOpacity>
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
        marginBottom: 40, // Add margin to prevent button overlap
      }}
    />
  );
}

export default CropModalScreen;

