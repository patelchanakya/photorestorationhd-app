import React from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import ReAnimated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { IconSymbol } from './ui/IconSymbol';

interface VideoProcessingToastProps {
  visible: boolean;
  imageUri?: string;
  progress?: number;
  timeRemaining?: number; // in seconds
  jobType?: 'video' | 'photo';
  status?: 'loading' | 'completed' | 'error';
  errorMessage?: string | null;
  mode?: string; // Animation mode like "hug", "group", "fun"
  onPress?: () => void;
  onCancel?: () => void;
  onViewVideo?: () => void; // "View Video" action
  onMaybeLater?: () => void; // "Maybe Later" action
  stackLevel?: number; // z-index stacking for overlay ordering
  interactable?: boolean; // disable touches when under content
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

  return (
    <View className="w-6 h-6 items-center justify-center">
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
  errorMessage = null,
  mode,
  onPress,
  onCancel,
  stackLevel = 1000,
  interactable = true
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
          title: isVideo ? 'Can’t generate video' : 'Can’t generate photo',
          subtitle: errorMessage || 'Tap to try again',
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
        zIndex: stackLevel,
        // On Android, zIndex has limited effect without elevation
        // keep elevation small to avoid drawing above modals
        elevation: Math.min(stackLevel, 2),
        transform: [{ translateY }],
        paddingHorizontal: 16,
      }}
      pointerEvents={interactable ? 'auto' : 'none'}
    >
      <BlurView
        intensity={30}
        tint="dark"
        className="rounded-3xl overflow-hidden border border-white/20 relative"
        style={{
          backgroundColor: status === 'completed' 
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.12)',
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 }
        }}
      >
        {/* Glass Cancel button (hidden when completed) */}
        {onCancel && status !== 'completed' && (
          <TouchableOpacity
            onPress={onCancel}
            className="absolute top-3 right-3 w-7 h-7 rounded-full items-center justify-center z-10 border border-white/20"
            activeOpacity={0.7}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
          >
            <IconSymbol name="xmark" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        
        {/* Glass Main content */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          className="p-5 flex-row items-center"
        >
          {/* Glass Thumbnail */}
          {imageUri && (
            <View className="w-16 h-16 rounded-2xl overflow-hidden mr-4 border border-white/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Image 
                source={{ uri: imageUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          )}
          
          {/* Glass Content */}
          <View className="flex-1">
            {/* Glass Tags */}
            <View className="flex-row mb-2 space-x-2">
              <View className="px-2.5 py-1 rounded-full border border-white/20"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                <Text className="text-white/80 text-xs font-medium tracking-wide">
                  {statusContent.label}
                </Text>
              </View>
              {/* Mode tag - only show for videos and when mode exists */}
              {mode && jobType === 'video' && (
                <View className="px-2.5 py-1 rounded-full border border-white/20"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <Text className="text-white/80 text-xs font-medium tracking-wide">
                    {mode.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-white text-lg font-bold mb-1">
              {statusContent.title}
            </Text>
            <Text className="text-white/80 text-base">
              {statusContent.subtitle}
            </Text>
          </View>
          
          {/* Glass Loading indicator */}
          {status === 'loading' && (
            <View className="ml-4">
              <LoadingSpinner />
            </View>
          )}
          
          {/* Glass Success indicator */}
          {status === 'completed' && (
            <View className="ml-4">
              <View className="w-12 h-12 rounded-full items-center justify-center border-2 border-white/40"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
                <IconSymbol name="checkmark" size={20} color="#22C55E" />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );
}