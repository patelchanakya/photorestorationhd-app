import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import React from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import ReAnimated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
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
  const translateY = React.useRef(new Animated.Value(-150)).current;
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
    clearGeneration,
    isRecovering,
    pendingGeneration,
    allowNewGeneration,
    shouldTreatAsProcessing
  } = useVideoGenerationStore();

  // Determine if toast should be visible (showing, has unviewed video, or has pending generation)
  const shouldShowToast = showToast || hasUnviewedVideo || (pendingGeneration && !hasUnviewedVideo);
  
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
      // Hiding toast - animate completely off-screen to prevent pause
      Animated.spring(translateY, {
        toValue: -150, // Go further off-screen to avoid visible pause
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
  
  const handleDismissRecovery = () => {
    hideToast();
    // Keep recovery running in background but hide toast
  };
  
  const handleGenerateNew = () => {
    // Clear current generation and allow new one
    clearGeneration();
    hideToast();
    // Navigate back to camera/generation screen
    router.push('/');
  };

  const getStatusContent = () => {
    // If we have an unviewed video, prioritize that
    if (hasUnviewedVideo && !showToast) {
      return {
        title: 'Your video is ready!',
        subtitle: 'Tap to view',
        showProgress: false,
        showCancel: false,
        isPersistent: true,
        showRecovery: false
      };
    }
    
    // Show recovery state if we're recovering or have pending generation
    if ((isRecovering || pendingGeneration) && !hasUnviewedVideo) {
      const attempts = pendingGeneration?.recoveryAttempts || 0;
      const treatAsProcessing = shouldTreatAsProcessing();
      
      // For recent generations (< 3 min old, < 3 attempts), show processing messages
      if (treatAsProcessing) {
        return {
          title: 'Your video is still processing...',
          subtitle: 'This usually takes 2-3 minutes',
          showProgress: true,
          showCancel: false,
          isPersistent: false,
          showRecovery: false,
          attempts: 0
        };
      }
      
      // Show immediate feedback even before first attempt
      if (attempts === 0) {
        return {
          title: 'Checking your video...',
          subtitle: 'Getting the latest status',
          showProgress: false,
          showCancel: true,
          isPersistent: false,
          showRecovery: true,
          attempts: 0
        };
      }
      
      // Show recovery messages based on attempt count
      let title = 'Recovering your video...';
      let subtitle = 'Checking video status';
      
      if (attempts <= 3) {
        subtitle = 'Reconnecting...';
      } else if (attempts <= 6) {
        subtitle = `Retrying (attempt ${attempts})`;
      } else {
        subtitle = `Still trying (attempt ${attempts})`;
      }
      
      return {
        title,
        subtitle,
        showProgress: false,
        showCancel: attempts <= 3,
        isPersistent: false,
        showRecovery: true,
        attempts
      };
    }
    
    switch (toastType) {
      case 'processing':
        return {
          title: 'Generating your video...',
          subtitle: `${Math.round(progress)}% complete`,
          showProgress: true,
          showCancel: true,
          isPersistent: false,
          showRecovery: false
        };
      case 'success':
        return {
          title: 'Your video is ready!',
          subtitle: 'Tap to view',
          showProgress: false,
          showCancel: false,
          isPersistent: false,
          showRecovery: false
        };
      case 'error':
        // Check if this might be a recoverable error
        const isRecoverableError = pendingGeneration && toastMessage.includes('network');
        return {
          title: isRecoverableError ? 'Connection issue' : 'Generation failed',
          subtitle: isRecoverableError ? 'Will retry automatically' : toastMessage,
          showProgress: false,
          showCancel: !isRecoverableError,
          isPersistent: false,
          showRecovery: isRecoverableError
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
          backgroundColor: toastType === 'success' 
            ? 'rgba(255, 255, 255, 0.18)'
            : 'rgba(255, 255, 255, 0.12)',
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 }
        }}
      >
        {/* Close button - show for processing, success, error, and persistent states */}
        {(toastType === 'processing' || toastType === 'success' || toastType === 'error' || statusContent?.isPersistent) && (
          <TouchableOpacity
            onPress={toastType === 'processing' ? handleCancel : hideToast}
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
          onPress={statusContent.isPersistent || toastType === 'success' ? handleViewVideo : undefined}
          activeOpacity={statusContent.isPersistent || toastType === 'success' ? 0.8 : 1}
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
          </View>
          
          {/* Status indicator */}
          {(toastType === 'processing' || statusContent.showRecovery) && (
            <View className="mr-6">
              <LoadingSpinner />
            </View>
          )}
          
          {statusContent.showRecovery && (
            <View className="mr-6 justify-center">
              <View className="px-3 py-1.5 rounded-full border border-white/40 items-center justify-center"
                    style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)' }}>
                <Text className="text-white text-xs font-semibold">RETRY</Text>
              </View>
            </View>
          )}
          
          {toastType === 'success' && (
            <View className="mr-6 justify-center">
              <View className="px-3 py-1.5 rounded-full border border-white/40 items-center justify-center"
                    style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
                <Text className="text-white text-xs font-semibold">READY</Text>
              </View>
            </View>
          )}
          
          {toastType === 'error' && (
            <View className="mr-6 justify-center">
              <View className="px-3 py-1.5 rounded-full border border-white/40 items-center justify-center"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}>
                <Text className="text-white text-xs font-semibold">ERROR</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Generate New button - show after 5+ attempts */}
        {allowNewGeneration && statusContent.showRecovery && (statusContent as any).attempts >= 5 && (
          <View className="px-3 pb-2">
            <TouchableOpacity
              onPress={handleGenerateNew}
              className="bg-blue-500 px-4 py-2 rounded-full flex-row items-center justify-center"
              activeOpacity={0.8}
            >
              <IconSymbol name="plus" size={14} color="white" />
              <Text className="text-white text-sm font-semibold ml-1">Generate New</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Dismiss button - show after 3+ attempts but before 5 */}
        {statusContent.showRecovery && (statusContent as any).attempts >= 3 && (statusContent as any).attempts < 5 && (
          <View className="px-3 pb-2">
            <TouchableOpacity
              onPress={handleDismissRecovery}
              className="border border-white/30 px-4 py-2 rounded-full flex-row items-center justify-center"
              activeOpacity={0.8}
            >
              <Text className="text-white/80 text-sm font-medium">Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}
        
      </BlurView>
    </Animated.View>
  );
}