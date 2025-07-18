import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    Image as RNImage,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { IconSymbol } from './ui/IconSymbol';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface ProcessingAnimationProps {
  selectedImage: string;
  functionType: 'restoration' | 'unblur';
  isComplete?: boolean;
  onComplete?: () => void;
}

function ProcessingAnimation({ selectedImage, functionType, isComplete = false, onComplete }: ProcessingAnimationProps) {
  const { height, width } = Dimensions.get('window');
  
  // Animation values
  const progress = useSharedValue(0);
  const imageScale = useSharedValue(1);
  const blurIntensity = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.3);
  const spinnerRotation = useSharedValue(0);
  const successScale = useSharedValue(0);
  
  useEffect(() => {
    // Subtle breathing animation for image
    imageScale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 3000 }),
        withTiming(1, { duration: 3000 })
      ),
      -1,
      true
    );
    
    // Gentle pulse for overlay
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000 }),
        withTiming(0.3, { duration: 2000 })
      ),
      -1,
      true
    );
    
    // Loading spinner rotation
    spinnerRotation.value = withRepeat(
      withTiming(360, { duration: 1000 }),
      -1,
      false
    );
    
    // Blur effect that intensifies during processing
    blurIntensity.value = withTiming(100, { duration: 1000 });
    
    // Progress animation - slower initial progress, speeds up when complete
    if (!isComplete) {
      progress.value = withTiming(0.8, { duration: 6000 }); // Slow to 80%
    }
  }, [isComplete]);

  // React to completion
  useEffect(() => {
    if (isComplete) {
      // Complete progress quickly
      progress.value = withTiming(1, { duration: 500 });
      
      // Wait a moment then trigger success
      setTimeout(() => {
        // Remove blur effect
        blurIntensity.value = withTiming(0, { duration: 800 });
        
        // Show success animation
        successScale.value = withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1, { duration: 200 })
        );
        
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onComplete?.();
        }, 1000);
      }, 600);
    }
  }, [isComplete, onComplete]);
  
  const animatedImageStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: imageScale.value }],
    };
  });
  
  const animatedBlurStyle = useAnimatedStyle(() => {
    return {
      opacity: blurIntensity.value > 0 ? 1 : 0,
    };
  });
  
  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });
  
  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });
  
  const animatedSpinnerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinnerRotation.value}deg` }],
    };
  });
  
  const animatedSuccessStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: successScale.value }],
      opacity: successScale.value > 0 ? 1 : 0,
    };
  });
  
  return (
    <View className="flex-1 bg-black/90">
      {/* Content */}
      <View className="flex-1 justify-center items-center px-6">
        {/* Image Container */}
        <View className="relative mb-8">
          {/* Main Image */}
          <Animated.View
            style={[
              {
                borderRadius: 20,
                overflow: 'hidden',
                shadowColor: '#ffffff',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 20,
              },
              animatedImageStyle,
            ]}
          >
            <RNImage
              source={{ uri: selectedImage }}
              style={{ 
                width: Math.min(width * 0.7, 300),
                height: Math.min(width * 0.7, 300),
              }}
              resizeMode="cover"
            />
          </Animated.View>
          
          {/* Blur Overlay - Creates the processing effect */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 20,
                overflow: 'hidden',
              },
              animatedBlurStyle,
            ]}
          >
            <BlurView
              intensity={blurIntensity.value}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            />
          </Animated.View>
          
          {/* Pulse Overlay */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                borderRadius: 20,
              },
              animatedPulseStyle,
            ]}
          />
          
          {/* Loading Spinner - Centered on image */}
          <View className="absolute inset-0 justify-center items-center">
            <Animated.View
              style={[
                {
                  width: 40,
                  height: 40,
                  borderWidth: 3,
                  borderColor: 'transparent',
                  borderTopColor: '#ffffff',
                  borderRadius: 20,
                },
                animatedSpinnerStyle,
              ]}
            />
          </View>
          
          {/* Success Checkmark */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
              },
              animatedSuccessStyle,
            ]}
          >
            <View
              style={{
                width: 40,
                height: 40,
                backgroundColor: '#10b981',
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <IconSymbol name="checkmark" size={24} color="#ffffff" />
            </View>
          </Animated.View>
        </View>
        
        {/* Processing Text */}
        <View className="items-center mb-8">
          <Text className="text-white text-2xl font-light text-center mb-2">
            Restoring your photo
          </Text>
          <Text className="text-white/70 text-base text-center">
            {functionType === 'restoration' ? 'Bringing back lost details' : 'Removing blur'}
          </Text>
        </View>
        
        {/* Progress Bar */}
        <View className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
          <Animated.View
            style={[
              {
                height: '100%',
                backgroundColor: '#f97316',
                borderRadius: 4,
              },
              animatedProgressStyle,
            ]}
          />
        </View>
      </View>
    </View>
  );
}

interface CameraButtonProps {
  onPress: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}

function CameraButton({ onPress, icon, label, disabled }: CameraButtonProps) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <AnimatedTouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        {
          flex: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          paddingVertical: 24,
          borderRadius: 16,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.3)',
        },
        animatedStyle,
        disabled && { opacity: 0.7, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
      ]}
      disabled={disabled}
    >
      <IconSymbol name={icon === 'camera' ? 'camera' : 'photo'} size={32} color="#fff" />
      <Text 
        className="text-white text-lg font-semibold mt-2"
        style={{ 
          textShadowColor: 'rgba(0, 0, 0, 0.75)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3
        }}
      >
        {label}
      </Text>
    </AnimatedTouchableOpacity>
  );
}

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoSelected: (uri: string) => void;
  isProcessing?: boolean;
  isComplete?: boolean;
  functionType?: 'restoration' | 'unblur';
}

export function CameraModal({ visible, onClose, onPhotoSelected, isProcessing = false, isComplete = false, functionType = 'restoration' }: CameraModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { height } = Dimensions.get('window');
  const router = useRouter();

  const requestPermissions = async (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    }
  };

  const pickImage = async (source: 'camera' | 'gallery') => {
    const hasPermission = await requestPermissions(source);
    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        `Please grant ${source} permission to use this feature.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsCapturing(true);
    let result;
    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1,
      });
    }
    setIsCapturing(false);

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      // For both camera and gallery images, use crop modal for consistent UX
      router.push(`/crop-modal?imageUri=${encodeURIComponent(uri)}&functionType=${functionType}`);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={['#f97316', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center pt-12 pb-6 px-6">
          <Text 
            className="text-white text-2xl font-bold"
            style={{ 
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4
            }}
          >
            {functionType === 'restoration' ? 'Restore Photo' : 'Unblur Photo'}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <IconSymbol name="xmark" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isCapturing ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-white text-lg mb-4">Capturing photo...</Text>
            <Animated.View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' }}>
              <IconSymbol name="camera" size={32} color="#fff" />
            </Animated.View>
          </View>
        ) : isProcessing && selectedImage ? (
          <ProcessingAnimation
            selectedImage={selectedImage}
            functionType={functionType}
            isComplete={isComplete}
            onComplete={() => {
              // This will be called when the animation completes
              // The actual photo processing should already be done by then
            }}
          />
        ) : (
          <View className="flex-1 px-6">
            {selectedImage ? (
              <View className="flex-1 relative">
                <View className="bg-white/10 rounded-3xl p-4 mb-6">
                  <RNImage
                    source={{ uri: selectedImage }}
                    style={{ 
                      width: '100%', 
                      height: Math.min(height * 0.5, 400),
                      borderRadius: 20
                    }}
                    resizeMode="contain"
                  />
                </View>
                
                <View className="flex-row gap-4">
                  <TouchableOpacity
                    className="flex-1 bg-white/20 py-4 rounded-2xl items-center"
                    onPress={() => setSelectedImage(null)}
                  >
                    <Text className="text-white text-lg font-semibold drop-shadow-md">Change Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-orange-500 py-4 rounded-2xl items-center"
                    onPress={handleClose}
                  >
                    <Text className="text-white text-lg font-semibold drop-shadow-md">
                      {functionType === 'restoration' ? 'Start Restoration' : 'Start Unblur'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="flex-1 justify-center items-center">
                <View className="bg-white/10 rounded-3xl p-8 mb-8 w-full max-w-sm">
                  <View className="self-center mb-4">
                    <IconSymbol name="camera" size={64} color="#fff" />
                  </View>
                  <Text className="text-white text-xl font-bold text-center mb-2 drop-shadow-md">
                    {functionType === 'restoration' ? 'Select a photo to restore' : 'Select a photo to unblur'}
                  </Text>
                  <Text className="text-white/90 text-center mb-6 drop-shadow-sm">
                    Choose from your camera or photo library
                  </Text>
                </View>
                
                <View className="flex-row gap-4 w-full max-w-sm">
                  <CameraButton 
                    onPress={() => { if (!isCapturing) pickImage('camera'); }}
                    icon="camera"
                    label="Camera"
                    disabled={isCapturing}
                  />
                  
                  <CameraButton 
                    onPress={() => { if (!isCapturing) pickImage('gallery'); }}
                    icon="photo"
                    label="Gallery"
                    disabled={isCapturing}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}