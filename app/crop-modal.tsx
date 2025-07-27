import { CustomImageCropper } from '@/components/CustomImageCropper';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { analyticsService } from '@/services/analytics';
import { networkStateService } from '@/services/networkState';
import { presentPaywall, validatePremiumAccess } from '@/services/revenuecat';
import { useCropModalStore } from '@/store/cropModalStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
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
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = 60;
const BOTTOM_HEIGHT = 80;
const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - BOTTOM_HEIGHT;
const CROP_SIZE = Math.min(SCREEN_WIDTH, AVAILABLE_HEIGHT) * 0.7;

function CropModalScreen() {
  const router = useRouter();
  const { imageUri, functionType, imageSource } = useLocalSearchParams();
  const [error] = useState<string | null>(null);
  
  // Use Zustand store for state management
  const {
    currentImageUri,
    isProcessing,
    showCropTool,
    useImageLoading,
    buttonText,
    setIsProcessing,
    setShowCropTool,
    setUseImageLoading,
    setButtonText,
    resetForNewImage,
    reset,
  } = useCropModalStore();

  // Reset store state when imageUri changes (new image loaded)
  useEffect(() => {
    if (imageUri) {
      const newUri = decodeURIComponent(imageUri as string);
      resetForNewImage(newUri);
      
      // Reset animation values
      buttonScale.value = 1;
      buttonOpacity.value = 1;
    }
  }, [imageUri, resetForNewImage]);

  // Cleanup store on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);
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

  const handleCancel = () => {
    router.back();
  };

  const handleRestoration = async (imageUri: string) => {
    // Check internet connection first - before any UI changes
    try {
      const hasConnection = await networkStateService.testRealConnection();
      if (!hasConnection) {
        Alert.alert(
          'Turn On Internet',
          'Please turn on WiFi or cellular data to restore your photo.',
          [{ text: 'OK' }]
        );
        return;
      }
    } catch (error) {
      Alert.alert(
        'Connection Issue',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Start loading animation only after network check passes
    setUseImageLoading(true);
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15 })
    );
    runOnJS(setButtonText)('Processing...');
    
    // Reset any previous error state before starting new restoration
    photoRestoration.reset();
    
    // Validate premium access first - follows RevenueCat best practices
    const hasValidAccess = await validatePremiumAccess();
    if (__DEV__) {
      console.log('🔐 Premium access validation before restoration:', hasValidAccess);
    }
    
    // Check if user can restore (now async)
    const canRestoreResult = await canRestore();
    if (!canRestoreResult) {
      console.log('🚫 User cannot restore - showing paywall');
      
      // Track 48-hour limit reached
      analyticsService.track('48 Hour Limit Reached', {
        function_type: functionType,
        image_source: imageSource || 'gallery',
        timestamp: new Date().toISOString(),
      });
      
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
        router.replace(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(imageUri)}&functionType=${functionType}&imageSource=${imageSource || 'gallery'}`);
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
      router.replace(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(imageUri)}&functionType=${functionType}&imageSource=${imageSource || 'gallery'}`);
    }, 400);
  };



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
            {functionType === 'unblur' ? 'Unblur' : functionType === 'colorize' ? 'Colorize' : functionType === 'descratch' ? 'Descratch' : 'Restore'}
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
          <CustomImageCropper
            imageUri={currentImageUri}
            onEditingComplete={(result) => {
              console.log('🔍 CustomImageCropper onEditingComplete called with:', result);
              console.log('🔍 Cropped URI:', result?.uri);
              
              setShowCropTool(false);
              
              if (result?.uri) {
                console.log('✅ Cropped URI exists, updating current image');
                // Update the current image to the cropped version
                resetForNewImage(result.uri);
                console.log('✅ Image updated to cropped version, returning to main crop modal view');
              } else {
                console.log('❌ No valid cropped URI found, keeping original image');
                // Keep the original image if cropping failed
                // User stays in main view with original image
              }
              
              // Note: We don't call handleRestoration() here anymore
              // User can now see the cropped image and decide when to click "Restore"
            }}
            onEditingCancel={() => {
              console.log('🔍 CustomImageCropper onEditingCancel called');
              setShowCropTool(false);
              // Return to main crop modal view with original image (no changes)
            }}
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

              {/* Edit Button - Upper Row */}
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 140,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                paddingHorizontal: 16,
              }}>

                {/* Edit Button */}
                <TouchableOpacity
                  style={{
                    width: isSmallScreen ? 90 : 100,
                    height: isSmallScreen ? 48 : 52,
                    borderRadius: 18,
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
                  accessibilityLabel="Edit Image"
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
                        borderRadius: 18 
                      }} 
                    />
                  )}
                  <Ionicons name="create-outline" size={isSmallScreen ? 18 : 20} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: isSmallScreen ? 14 : 16, fontWeight: '600', marginLeft: 6 }}>
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Restore Button - Lower Row */}
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: insets.bottom + 40, // Moved lower (was 64)
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
                paddingHorizontal: 20, // Increased padding for bigger button
              }}>
                <AnimatedTouchableOpacity
                  style={[
                    {
                      width: '100%', // Full width like other buttons
                      height: isSmallScreen ? 56 : 64, // Bigger height to match other buttons
                      borderRadius: 16, // Match rounded corners of other buttons
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: useImageLoading ? '#10b981' : '#f97316', // Keep orange color
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
                  accessibilityLabel="Start Restoration"
                  activeOpacity={useImageLoading ? 1 : 0.85}
                  disabled={useImageLoading}
                >
                  {useImageLoading ? (
                    <ActivityIndicator size="small" color="rgba(255, 255, 255, 0.9)" />
                  ) : (
                    <Text style={{ 
                      color: '#ffffff', 
                      fontSize: isSmallScreen ? 18 : 20, // Bigger font size
                      fontWeight: 'bold', // Bold text
                      letterSpacing: 0.3
                    }}>
                      {functionType === 'restoration' ? 'Restore Photo' :
                       functionType === 'unblur' ? 'Unblur Photo' :
                       functionType === 'colorize' ? 'Colorize Photo' :
                       functionType === 'descratch' ? 'Descratch Photo' : 
                       'Fix Photo'}
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

