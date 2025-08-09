import React from 'react';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import ReAnimated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

interface VideoProcessingToastProps {
  visible: boolean;
  imageUri?: string;
  progress?: number;
  timeRemaining?: number; // in seconds
  jobType?: 'video' | 'photo';
  status?: 'loading' | 'completed' | 'error';
  onPress?: () => void;
}

// Simple spinning loader
const LoadingSpinner = () => {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000 }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="ml-3 w-6 h-6 items-center justify-center">
      <ReAnimated.View style={animatedStyle}>
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
  onPress 
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
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        className={`backdrop-blur rounded-2xl p-4 flex-row items-center shadow-lg ${
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
          <LoadingSpinner />
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
    </Animated.View>
  );
}