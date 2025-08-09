import React from 'react';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ReAnimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { IconSymbol } from './ui/IconSymbol';

interface VideoProcessingToastProps {
  visible: boolean;
  imageUri?: string;
  progress?: number;
  timeRemaining?: number; // in seconds
  jobType?: 'video' | 'photo';
  status?: 'loading' | 'completed' | 'error';
  onPress?: () => void;
  onCancel?: () => void;
}

// Psychologically engaging multi-layer loading spinner
const LoadingSpinner = () => {
  // Multiple animation values for layered effects
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);
  const colorIntensity = useSharedValue(0);

  React.useEffect(() => {
    // Variable speed rotation (psychological engagement through unpredictability)
    const rotateWithVariableSpeed = () => {
      rotation.value = withRepeat(
        withSequence(
          withTiming(120, { duration: 800 }), // Fast start
          withTiming(240, { duration: 1200 }), // Slow middle  
          withTiming(360, { duration: 900 })   // Medium end
        ),
        -1,
        false
      );
    };

    // Breathing scale effect (organic, life-like motion)
    const breathingScale = () => {
      scale.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 1500 }),
          withTiming(1.05, { duration: 1500 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1,
        true
      );
    };

    // Pulsing opacity (subtle attention-grabbing)
    const pulsingOpacity = () => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1800 }),
          withTiming(1.0, { duration: 1200 }),
          withTiming(0.8, { duration: 1000 })
        ),
        -1,
        true
      );
    };

    // Color intensity shifting (creates visual interest)
    const colorShifting = () => {
      colorIntensity.value = withRepeat(
        withTiming(1, { duration: 2500 }),
        -1,
        true
      );
    };

    rotateWithVariableSpeed();
    breathingScale();
    pulsingOpacity();
    colorShifting();
  }, []);

  // Primary spinner style with all effects combined
  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  // Background glow effect
  const glowStyle = useAnimatedStyle(() => ({
    opacity: colorIntensity.value * 0.3,
    transform: [{ scale: 1.2 + (colorIntensity.value * 0.1) }],
  }));

  return (
    <View className="w-6 h-6 items-center justify-center">
      {/* Background glow layer */}
      <ReAnimated.View 
        style={[glowStyle, { position: 'absolute' }]}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="11"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
        </Svg>
      </ReAnimated.View>

      {/* Main animated spinner */}
      <ReAnimated.View style={spinnerStyle}>
        <Svg width="20" height="20" viewBox="0 0 24 24">
          <Circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="31.416" // 2 * π * 10 ≈ 62.83, so half is ~31.4
            strokeDashoffset="15.708"
          />
        </Svg>
      </ReAnimated.View>
    </View>
  );
};

export function VideoProcessingToast({ 
  visible, 
  imageUri, 
  progress = 0,
  timeRemaining = 120, // default 2 minutes
  jobType = 'video',
  status = 'loading',
  onPress,
  onCancel
}: VideoProcessingToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(-100)).current;

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    return `${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}`;
  };

  // Animation effect
  React.useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -100,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  const getStatusContent = () => {
    const isVideo = jobType === 'video';
    
    switch (status) {
      case 'loading':
        return {
          title: isVideo ? 'We are generating your video...' : 'Enhancing your photo...',
          subtitle: `Ready in: ${formatTime(timeRemaining)}`,
          label: isVideo ? 'BACK TO LIFE' : 'PHOTO RESTORE'
        };
      case 'completed':
        return {
          title: isVideo ? 'Your video is ready!' : 'Your photo is ready!',
          subtitle: 'Tap to view',
          label: isVideo ? 'BACK TO LIFE' : 'PHOTO RESTORE'
        };
      case 'error':
        return {
          title: 'Something went wrong',
          subtitle: 'Tap to try again',
          label: isVideo ? 'BACK TO LIFE' : 'PHOTO RESTORE'
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <Animated.View 
      className="absolute left-0 right-0"
      style={{ 
        top: insets.top + 60, // Below nav header
        transform: [{ translateY }],
        paddingHorizontal: 16,
      }}
    >
      <View
        className={`backdrop-blur rounded-2xl shadow-lg relative ${
          status === 'completed' 
            ? 'bg-gray-800/90 border border-blue-500/20 shadow-2xl' 
            : 'bg-gray-900/95'
        }`}
        style={status === 'completed' ? {
          shadowColor: '#3B82F6',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        } : undefined}
      >
        {/* Cancel button */}
        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center z-10"
            activeOpacity={0.7}
          >
            <IconSymbol name="xmark" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        
        {/* Main content - now wrapped in TouchableOpacity */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.9}
          className="p-4 flex-row items-center"
        >
        {/* Thumbnail */}
        {imageUri && (
          <View className="w-14 h-14 rounded-xl overflow-hidden mr-4">
            <Image 
              source={{ uri: imageUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
        )}
        
        {/* Content */}
        <View className="flex-1">
          <Text className="text-gray-400 text-xs font-semibold mb-1 tracking-wider">
            {statusContent.label}
          </Text>
          <Text className="text-white font-semibold text-base mb-1">
            {statusContent.title}
          </Text>
          <Text className="text-gray-300 text-sm">
            {statusContent.subtitle}
          </Text>
        </View>
        
        {/* Loading indicator - spinning circle */}
        {status === 'loading' && (
          <View className="mr-2">
            <LoadingSpinner />
          </View>
        )}
        
        {/* Success indicator - arrow icon */}
        {status === 'completed' && (
          <View className="ml-3">
            <View className="w-8 h-8 bg-blue-500/20 rounded-full items-center justify-center border border-blue-500/30">
              <Text className="text-white text-lg font-semibold">›</Text>
            </View>
          </View>
        )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}