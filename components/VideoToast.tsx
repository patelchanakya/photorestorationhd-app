import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import ReAnimated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useVideoGenerationStore } from '../store/videoGenerationStore';
import { IconSymbol } from './ui/IconSymbol';

// Simplified loading spinner
const LoadingSpinner = () => {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000 }),
      -1,
      false
    );
    
    // Cleanup animation on unmount
    return () => {
      cancelAnimation(rotation);
    };
  }, []);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View className="w-6 h-6 items-center justify-center">
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
            strokeDasharray="31.416"
            strokeDashoffset="15.708"
          />
        </Svg>
      </ReAnimated.View>
    </View>
  );
};

export function VideoToast() {
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(-100)).current;
  const [toastMounted, setToastMounted] = React.useState(false);
  
  const { 
    showToast, 
    toastType, 
    toastMessage, 
    currentImageUri, 
    progress,
    currentPredictionId,
    hasUnviewedVideo,
    lastCompletedVideoId,
    videos,
    hideToast,
    clearGeneration 
  } = useVideoGenerationStore();

  // Determine if toast should be visible (either showing or has unviewed video)
  const shouldShowToast = showToast || hasUnviewedVideo;
  
  // Only animate on initial show/hide, not on content changes
  React.useEffect(() => {
    if (shouldShowToast && !toastMounted) {
      // First time showing
      setToastMounted(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else if (!shouldShowToast && toastMounted) {
      // Hiding toast
      Animated.spring(translateY, {
        toValue: -100,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start(() => {
        setToastMounted(false);
      });
    }
  }, [shouldShowToast, toastMounted, translateY]);

  // Don't render if never been shown
  if (!toastMounted) return null;

  const handleCancel = () => {
    clearGeneration();
    hideToast();
  };

  const handleViewVideo = () => {
    if (hasUnviewedVideo && lastCompletedVideoId) {
      router.push(`/video-result/${lastCompletedVideoId}`);
    }
  };

  const getStatusContent = () => {
    // If we have an unviewed video, prioritize that
    if (hasUnviewedVideo && !showToast) {
      return {
        title: 'Your video is ready!',
        subtitle: 'Tap to view',
        showProgress: false,
        showCancel: false,
        isPersistent: true
      };
    }
    
    switch (toastType) {
      case 'processing':
        return {
          title: 'Generating your video...',
          subtitle: `${Math.round(progress)}% complete`,
          showProgress: true,
          showCancel: true,
          isPersistent: false
        };
      case 'success':
        return {
          title: 'Your video is ready!',
          subtitle: 'Tap to view',
          showProgress: false,
          showCancel: false,
          isPersistent: false
        };
      case 'error':
        return {
          title: 'Generation failed',
          subtitle: toastMessage,
          showProgress: false,
          showCancel: false,
          isPersistent: false
        };
    }
  };

  const statusContent = getStatusContent();
  
  // Get the appropriate image URI 
  const displayImageUri = currentImageUri || (hasUnviewedVideo && lastCompletedVideoId ? videos[lastCompletedVideoId]?.originalImage : null);

  return (
    <Animated.View 
      key={`toast-${currentPredictionId || 'main'}`} // Stable key prevents remounting
      className="absolute left-0 right-0"
      style={{ 
        top: insets.top + 60,
        zIndex: 1000,
        elevation: 2,
        transform: [{ translateY }],
        paddingHorizontal: 16,
      }}
    >
      <BlurView
        intensity={30}
        tint="dark"
        className="rounded-3xl overflow-hidden border border-white/20 relative"
        style={{
          backgroundColor: toastType === 'success' 
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.12)',
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 }
        }}
      >
        {/* Cancel button - always show for processing */}
        {toastType === 'processing' && (
          <TouchableOpacity
            onPress={handleCancel}
            className="absolute top-3 right-3 w-8 h-8 rounded-full items-center justify-center z-10 border border-white/20"
            activeOpacity={0.7}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
          >
            <IconSymbol name="xmark" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        
        {/* Main content */}
        <TouchableOpacity
          onPress={statusContent.isPersistent || toastType === 'success' ? handleViewVideo : undefined}
          activeOpacity={statusContent.isPersistent || toastType === 'success' ? 0.8 : 1}
          className="p-5 flex-row items-center"
        >
          {/* Thumbnail */}
          {displayImageUri && (
            <View className="w-16 h-16 rounded-2xl overflow-hidden mr-4 border border-white/30"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Image 
                source={{ uri: displayImageUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          )}
          
          {/* Content */}
          <View className="flex-1">
            <View className="px-3 py-1.5 rounded-full border border-white/20 mb-3 self-start"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text className="text-white/90 text-xs font-medium tracking-wide">
                BACK TO LIFE
              </Text>
            </View>
            
            <Text className="text-white text-base font-bold mb-1">
              {statusContent.title}
            </Text>
            <Text className="text-white/90 text-sm">
              {statusContent.subtitle}
            </Text>
          </View>
          
          {/* Status indicator */}
          {toastType === 'processing' && (
            <View className="ml-4">
              <LoadingSpinner />
            </View>
          )}
          
          {toastType === 'success' && (
            <View className="ml-4">
              <View className="w-12 h-12 rounded-full items-center justify-center border-2 border-white/40"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
                <IconSymbol name="checkmark" size={20} color="#22C55E" />
              </View>
            </View>
          )}
          
          {toastType === 'error' && (
            <View className="ml-4">
              <View className="w-12 h-12 rounded-full items-center justify-center border-2 border-white/40"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                <IconSymbol name="exclamationmark.triangle" size={20} color="#EF4444" />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );
}