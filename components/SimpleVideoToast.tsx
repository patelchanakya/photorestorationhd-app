import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import ReAnimated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useSimpleVideoStore } from '../store/simpleVideoStore';
import { simpleVideoService } from '../services/simpleVideoService';
import { IconSymbol } from './ui/IconSymbol';

// Simplified loading spinner
const LoadingSpinner = () => {
  const rotation = useSharedValue(0);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;
    
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000 }),
      -1,
      false
    );
    
    // Cleanup animation on unmount
    return () => {
      isMountedRef.current = false;
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const spinnerStyle = useAnimatedStyle(() => {
    // Only animate if component is mounted
    if (!isMountedRef.current) {
      return { transform: [{ rotate: '0deg' }] };
    }
    return { transform: [{ rotate: `${rotation.value}deg` }] };
  });

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

export function SimpleVideoToast() {
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(-150)).current;
  const [toastMounted, setToastMounted] = React.useState(false);
  
  const { 
    currentGeneration,
    status,
    error,
    showToast,
    toastMessage,
    hasUnviewedVideo,
    lastCompletedVideoId,
    completedVideos,
    isCheckingStatus,
    hideToast,
    clearGeneration,
    markVideoAsViewed
  } = useSimpleVideoStore();

  // Determine if toast should be visible
  const shouldShowToast = (
    showToast || 
    hasUnviewedVideo || 
    (currentGeneration && status !== 'idle' && status !== 'expired')
  );
  
  // Only animate on initial show/hide
  React.useEffect(() => {
    if (shouldShowToast && !toastMounted) {
      setToastMounted(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else if (!shouldShowToast && toastMounted) {
      Animated.spring(translateY, {
        toValue: -150,
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
    // Stop any ongoing polling
    simpleVideoService.stopPolling();
    // Clear all state
    clearGeneration();
    hideToast();
  };

  const handleViewVideo = () => {
    if (hasUnviewedVideo && lastCompletedVideoId) {
      markVideoAsViewed();
      router.push(`/video-result/${lastCompletedVideoId}`);
    }
  };

  const getStatusContent = () => {
    // Priority 1: Unviewed completed video
    if (hasUnviewedVideo && !showToast) {
      return {
        title: 'Your video is ready!',
        subtitle: 'Tap to view',
        showProgress: false,
        showCancel: false,
        isClickable: true,
        statusType: 'success'
      };
    }

    // Priority 2: Current generation status
    if (currentGeneration && status !== 'idle') {
      const age = Date.now() - new Date(currentGeneration.startedAt).getTime();
      const ageMinutes = Math.floor(age / 60000);
      
      switch (status) {
        case 'starting':
          // Show different messages based on video age and checking status
          const elapsedSeconds = Math.floor(age / 1000);
          let startingSubtitle = 'Generation started successfully';
          
          if (elapsedSeconds < 45) {
            // First 45 seconds - silent period, don't show toast
            return null;
          } else if (elapsedSeconds < 60) {
            startingSubtitle = 'Preparing your video...';
          } else if (isCheckingStatus) {
            if (ageMinutes === 0) {
              startingSubtitle = 'Checking video status...';
            } else {
              startingSubtitle = `Reconnecting to your video... (${ageMinutes}m elapsed)`;
            }
          } else {
            startingSubtitle = 'This usually takes 2-3 minutes';
          }
          
          return {
            title: 'Your video is generating...',
            subtitle: startingSubtitle,
            showProgress: false,
            showCancel: true,
            isClickable: false,
            statusType: 'processing'
          };
          
        case 'processing':
          let processingSubtitle = 'This usually takes 2-3 minutes';
          
          if (ageMinutes === 0) {
            processingSubtitle = 'AI is bringing your photo to life...';
          } else if (ageMinutes === 1) {
            processingSubtitle = 'Almost there... 1 minute elapsed';
          } else if (ageMinutes === 2) {
            processingSubtitle = 'Finishing touches... 2 minutes elapsed';
          } else if (ageMinutes >= 3) {
            processingSubtitle = 'Taking longer than usual, but still working...';
          } else {
            processingSubtitle = `Processing... ${ageMinutes} minute${ageMinutes > 1 ? 's' : ''} elapsed`;
          }
          
          return {
            title: 'Creating your video...',
            subtitle: processingSubtitle,
            showProgress: false,
            showCancel: true,
            isClickable: false,
            statusType: 'processing'
          };
          
        case 'completed':
          return {
            title: 'Your video is ready!',
            subtitle: 'Tap to view',
            showProgress: false,
            showCancel: false,
            isClickable: true,
            statusType: 'success'
          };
          
        case 'failed':
          return {
            title: 'Generation failed',
            subtitle: error || 'Please try again',
            showProgress: false,
            showCancel: false,
            isClickable: false,
            statusType: 'error'
          };
          
        case 'expired':
          return {
            title: 'Video expired',
            subtitle: 'Videos expire after 59 minutes',
            showProgress: false,
            showCancel: false,
            isClickable: false,
            statusType: 'error'
          };
      }
    }

    // Fallback
    return {
      title: 'Processing...',
      subtitle: toastMessage || 'Please wait',
      showProgress: false,
      showCancel: false,
      isClickable: false,
      statusType: 'processing'
    };
  };

  const statusContent = getStatusContent();
  
  // If statusContent is null (e.g., silent period), don't show toast
  if (!statusContent) {
    return null;
  }
  
  // Get the appropriate image URI 
  const displayImageUri = currentGeneration?.imageUri || 
    (hasUnviewedVideo && lastCompletedVideoId ? completedVideos[lastCompletedVideoId]?.originalImage : null);

  return (
    <Animated.View 
      className="absolute left-0 right-0"
      style={{ 
        top: insets.top + 60,
        zIndex: 10,
        elevation: 10,
        transform: [{ translateY }],
        paddingHorizontal: 16,
      }}
    >
      <BlurView
        intensity={30}
        tint="dark"
        className="rounded-3xl overflow-hidden border border-white/20 relative"
        style={{
          backgroundColor: statusContent.statusType === 'success' 
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.12)',
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 }
        }}
      >
        {/* Close button */}
        {(statusContent.showCancel || statusContent.statusType === 'success' || statusContent.statusType === 'error') && (
          <TouchableOpacity
            onPress={statusContent.showCancel ? handleCancel : hideToast}
            className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center z-10"
            activeOpacity={0.7}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            style={{ backgroundColor: 'transparent' }}
          >
            <IconSymbol name="xmark" size={16} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>
        )}
        
        {/* Main content */}
        <TouchableOpacity
          onPress={statusContent.isClickable ? handleViewVideo : undefined}
          activeOpacity={statusContent.isClickable ? 0.8 : 1}
          className="p-3 flex-row items-center"
        >
          {/* Thumbnail */}
          {displayImageUri && (
            <View className="w-14 h-14 rounded-2xl overflow-hidden mr-3 border border-white/30"
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
            <View className="px-2 py-1 rounded-full border border-white/20 mb-2 self-start"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text className="text-white/90 text-xs font-medium tracking-wide">
                BACK TO LIFE
              </Text>
            </View>
            
            <Text className="text-white text-lg font-bold mb-0.5">
              {statusContent.title}
            </Text>
            <Text className="text-white/90 text-sm">
              {statusContent.subtitle}
            </Text>
            
            {/* Show prediction ID for debugging/confirmation */}
            {currentGeneration && __DEV__ && (
              <Text className="text-white/60 text-xs mt-1">
                ID: {currentGeneration.predictionId.substring(0, 8)}...
              </Text>
            )}
          </View>
          
          {/* Status indicator */}
          {statusContent.statusType === 'processing' && (
            <View className="mr-6">
              <LoadingSpinner />
            </View>
          )}
          
          {statusContent.statusType === 'success' && (
            <View className="mr-6 justify-center">
              <View className="px-3 py-1.5 rounded-full border border-white/40 items-center justify-center"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
                <Text className="text-white text-xs font-semibold">READY</Text>
              </View>
            </View>
          )}
          
          {statusContent.statusType === 'error' && (
            <View className="mr-6 justify-center">
              <View className="px-3 py-1.5 rounded-full border border-white/40 items-center justify-center"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                <Text className="text-white text-xs font-semibold">ERROR</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );
}