import { useVideoToastStore } from '@/store/videoToastStore';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { IconSymbol } from './ui/IconSymbol';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VideoCompletionModalProps {
  visible: boolean;
  imageUri?: string;
  videoPath?: string;
  predictionId?: string;
  onMaybeLater: () => void;
  onClose?: () => void;
}

export function VideoCompletionModal({
  visible,
  imageUri,
  videoPath,
  predictionId,
  onMaybeLater,
  onClose
}: VideoCompletionModalProps) {
  const scale = useSharedValue(0.96);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 260 });
      scale.value = withSpring(1, { damping: 16, stiffness: 220 });
      translateY.value = withSpring(0, { damping: 16, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.96, { duration: 180 });
      translateY.value = withTiming(16, { duration: 180 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
  }));

  const handleViewVideo = () => {
    // Mark video as viewed and navigate to video page
    runOnJS(() => {
      useVideoToastStore.getState().viewVideo();
      if (predictionId) {
        router.push(`/video-result/${predictionId}`);
      }
    })();
  };

  const handleMaybeLater = () => {
    runOnJS(onMaybeLater)();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <BlurView intensity={50} tint="dark" style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <Animated.View style={[animatedStyle]} className="w-full max-w-sm">
            {/* Glass Card */}
            <View 
              className="rounded-3xl overflow-hidden border border-white/20"
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                shadowColor: '#000', 
                shadowOpacity: 0.3, 
                shadowRadius: 24, 
                shadowOffset: { width: 0, height: 12 } 
              }}
            >
              {/* Glass Header */}
              <View className="px-6 pt-8 pb-6 items-center">
                {/* Subtle checkmark */}
                <View className="w-14 h-14 rounded-full items-center justify-center mb-5" 
                      style={{ backgroundColor: 'rgba(34,197,94,0.2)' }}>
                  <IconSymbol name="checkmark" size={28} color="#22C55E" />
                </View>
                <Text className="text-white text-2xl font-bold text-center mb-3">
                  Video Ready!
                </Text>
                <Text className="text-white/80 text-base text-center leading-relaxed">
                  Your photo has been brought to life
                </Text>
              </View>

              {/* Glass Preview with Centered Play */}
              <TouchableOpacity 
                onPress={handleViewVideo}
                activeOpacity={0.85}
                className="mx-6 mb-6"
              >
                <View className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/30"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full" 
                          style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }} />
                  )}

                  {/* Darker overlay for better contrast */}
                  <View className="absolute inset-0" 
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }} />

                  {/* Blurred Glass Play Button */}
                  <BlurView
                    intensity={20}
                    tint="light"
                    className="absolute items-center justify-center border-2 border-white/60 w-20 h-20 rounded-full overflow-hidden"
                    style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      shadowColor: '#000', 
                      shadowOpacity: 0.5, 
                      shadowRadius: 16, 
                      shadowOffset: { width: 0, height: 6 },
                      top: '50%',
                      left: '50%',
                      transform: [{ translateX: -40 }, { translateY: -40 }]
                    }}
                  >
                    <View style={{ marginLeft: 2 }}>
                      <IconSymbol name="play.fill" size={32} color="#FFFFFF" />
                    </View>
                  </BlurView>

                  {/* Tap to play hint */}
                  <View className="absolute bottom-4 left-4">
                    <View className="px-3 py-1.5 rounded-full border border-white/30"
                          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
                      <Text className="text-white text-xs font-medium">Tap to watch</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Glass Actions */}
              <View className="px-6 pb-8">
                {/* Maybe Later - Glass Button */}
                <TouchableOpacity
                  onPress={handleMaybeLater}
                  activeOpacity={0.7}
                  className="py-4 px-6 items-center rounded-2xl border border-white/20"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <Text className="text-white/90 font-medium text-base">
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
}