import { CustomImageCropper } from '@/components/CustomImageCropper';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { analyticsService } from '@/services/analytics';
import { deviceTrackingService } from '@/services/deviceTracking';
import { networkStateService } from '@/services/networkState';
import { presentPaywall, validatePremiumAccess } from '@/services/revenuecat';
import { useCropModalStore } from '@/store/cropModalStore';
import { useRestorationStore } from '@/store/restorationStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
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

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function CropModalScreen() {
  const router = useRouter();
  const { imageUri, functionType, imageSource, customPrompt } = useLocalSearchParams();
  const [error] = useState<string | null>(null);
  
  // Use Zustand store for state management
  const {
    currentImageUri,
    isProcessing,
    showCropTool,
    useImageLoading,
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
  
  // Animation values for Use Image button
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(1);
  
  // Animated styles
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonOpacity.value,
  }));
  
  const { canRestore, incrementFreeRestorations, isPro, hasSeenUpgradePrompt, setHasSeenUpgradePrompt } = useSubscriptionStore();
  const { totalRestorations } = useRestorationStore();
  const photoRestoration = usePhotoRestoration();

  const handleCancel = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
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
    
    // Smart paywall logic - skip for Pro users (performance optimization)
    if (isPro) {
      if (__DEV__) {
        console.log('✨ Pro user - proceeding with restoration');
      }
    } else {
      // For free users only - check paywall triggers
      const canRestoreResult = await canRestore();
      
      // Show paywall after 1st restoration (once only)
      if (totalRestorations >= 1 && !hasSeenUpgradePrompt) {
        if (__DEV__) {
          console.log('🎯 Showing upgrade prompt after 1st restoration');
        }
        
        setHasSeenUpgradePrompt(true);
        
        // Track upgrade prompt after first restoration
        analyticsService.track('Upgrade Prompt After First Restoration', {
          function_type: functionType,
          image_source: imageSource || 'gallery',
          total_restorations: totalRestorations,
          timestamp: new Date().toISOString(),
        });
        
        const success = await presentPaywall();
        if (success) {
          if (__DEV__) {
            console.log('✅ Pro subscription activated via upgrade prompt!');
          }
          // User is now pro, proceed with restoration
        } else {
          // User declined upgrade, check if they can still restore
          if (!canRestoreResult) {
            // They're maxed out and declined upgrade
            setUseImageLoading(false);
            runOnJS(setButtonText)('Use Image');
            return;
          }
          // They can still restore with free credits
        }
      }
      
      // Always show paywall when maxed out (with timer context)
      if (!canRestoreResult) {
        if (__DEV__) {
          console.log('🚫 User maxed out - showing alert with timer and paywall');
        }
        
        // Get timer info for context
        const msRemaining = await deviceTrackingService.getTimeUntilNextFreeRestoration();
        const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
        
        // Track 48-hour limit reached
        analyticsService.track('48 Hour Limit Reached', {
          function_type: functionType,
          image_source: imageSource || 'gallery',
          hours_remaining: hoursRemaining,
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
          setUseImageLoading(false);
          runOnJS(setButtonText)('Use Image');
          return;
        }
        
        // Show alert with timer context first, then paywall
        Alert.alert(
          'Free Restorations Used',
          `You've used all 3 free restorations. Next free restoration in ${hoursRemaining}h ${minutesRemaining}m, or get unlimited restorations with Pro!`,
          [
            { text: 'Wait', style: 'cancel', onPress: () => {
              setUseImageLoading(false);
              runOnJS(setButtonText)('Use Image');
            }},
            { 
              text: 'Go Pro', 
              onPress: async () => {
                const success = await presentPaywall();
                if (success) {
                  if (__DEV__) {
                    console.log('✅ Pro subscription activated via maxed out paywall!');
                  }
                  // User is now pro, restart the restoration process
                  handleRestoration(imageUri);
                } else {
                  setUseImageLoading(false);
                  runOnJS(setButtonText)('Use Image');
                }
              }
            }
          ]
        );
        return;
      }
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
      const promptParam = customPrompt ? `&customPrompt=${encodeURIComponent(customPrompt as string)}` : '';
      router.replace(`/restoration/${Date.now()}?imageUri=${encodeURIComponent(imageUri)}&functionType=${functionType}&imageSource=${imageSource || 'gallery'}${promptParam}`);
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
          <IconSymbol name="xmark" size={20} color="rgba(255,255,255,0.2)" />
        </TouchableOpacity>
        <View className="flex-1 mx-4">
          <Text className="text-white text-lg font-semibold text-center">
            {functionType === 'repair' ? 'Repair' :
             functionType === 'unblur' ? 'Unblur' : 
             functionType === 'colorize' ? 'Colorize' : 
             functionType === 'descratch' ? 'Descratch' : 
             functionType === 'outfit' ? 'Change Outfit' :
             functionType === 'background' ? 'Change Background' :
             functionType === 'backtolife' ? 'Animate' :
             functionType === 'enlighten' ? 'Fix Lighting' :
             functionType === 'custom' ? 'Custom Edit' :
             'Restore'}
          </Text>
          <Text className="text-white/60 text-sm text-center mt-1">
            Use image or crop for better results
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
                paddingTop: 40, // Fixed padding always
                paddingBottom: 200, // Fixed padding always
                paddingHorizontal: 16,
              }}>
                <ImagePreview imageUri={currentImageUri} />
              </View>
            </>
          ) : null}
        </View>
      )}

      {/* Buttons positioned outside the image container */}
      {currentImageUri && (
        <>
          {/* Crop Button */}
          <View style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 140,
            height: 50,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}>
            <TouchableOpacity
              style={{
                width: '100%',
                height: 56,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                flexDirection: 'row',
              }}
              onPress={() => setShowCropTool(true)}
              accessibilityLabel="Crop Image"
              activeOpacity={0.7}
            >
              <IconSymbol name="crop" size={18} color="#fff" />
              <Text style={{ 
                color: '#ffffff', 
                fontSize: 16, 
                fontWeight: '600',
                marginLeft: 8,
                letterSpacing: 0.3,
              }}>
                Crop
              </Text>
            </TouchableOpacity>
          </View>

          {/* Restore Button - Lower Row */}
          <View style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: 60, // Fixed bottom position - completely independent
            height: 56, // Fixed container height
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
          }}>
            <AnimatedTouchableOpacity
              style={[
                {
                  width: '100%',
                  height: 56,
                  borderRadius: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: useImageLoading ? 'rgba(249,115,22,0.5)' : '#f97316',
                  flexDirection: 'row',
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
                  fontSize: 16,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}>
                  Upload
                </Text>
              )}
            </AnimatedTouchableOpacity>
          </View>
        </>
      )}
      {error && (
        <View className="flex-1 justify-center items-center">
          <Text className="text-red-500 text-lg mt-4">{error}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}


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

