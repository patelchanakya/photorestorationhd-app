import React from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions, AppState } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Image as ExpoImage } from 'expo-image';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { OnboardingButton } from './shared/OnboardingButton';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FeaturePreviewScreenProps {
  selectedFeatureId: string;
  onBack: () => void;
  onSkip: () => void;
  onPickPhoto: (photo: { uri: string; width: number; height: number }) => void;
}

export function FeaturePreviewScreen({ 
  selectedFeatureId, 
  onBack, 
  onSkip, 
  onPickPhoto 
}: FeaturePreviewScreenProps) {
  const selectedFeature = ONBOARDING_FEATURES.find(f => f.id === selectedFeatureId);
  
  const headerOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const previewOpacity = useSharedValue(0);
  const previewScale = useSharedValue(0.9);
  const buttonsOpacity = useSharedValue(0);

  // Get preview media for the selected feature
  const previewMedia = getPreviewMedia(selectedFeatureId);
  const videoPlayer = previewMedia.type === 'video' ? useVideoPlayer(previewMedia.source, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  }) : null;

  React.useEffect(() => {
    // If "none_above" is selected, automatically skip to community screen
    if (selectedFeatureId === 'none_above') {
      // Small delay to show the selection briefly
      setTimeout(() => {
        onSkip();
      }, 800);
      return;
    }

    // Header animation
    headerOpacity.value = withTiming(1, { duration: 300 });
    
    // Title animation
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 200 }));
    
    // Preview animation
    previewOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    previewScale.value = withDelay(400, withSpring(1, { damping: 15, stiffness: 200 }));
    
    // Buttons animation
    buttonsOpacity.value = withDelay(500, withTiming(1, { duration: 400 }));
  }, [selectedFeatureId, onSkip]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    if (!videoPlayer) return;
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Resume video playback when app returns to foreground
        if (videoPlayer && !videoPlayer.playing) {
          setTimeout(() => {
            videoPlayer.play();
          }, 100);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [videoPlayer]);

  // Handle navigation focus (returning to screen)
  useFocusEffect(
    React.useCallback(() => {
      // Resume playback when screen comes into focus
      if (videoPlayer && !videoPlayer.playing) {
        setTimeout(() => {
          videoPlayer.play();
        }, 100);
      }
    }, [videoPlayer])
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const previewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: previewOpacity.value,
    transform: [{ scale: previewScale.value }],
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  const handlePickPhoto = async () => {
    try {
      // Launch image picker - no permission check needed on iOS 11+
      // PHPickerViewController runs in separate process and handles privacy
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        onPickPhoto({
          uri: asset.uri,
          width: asset.width,
          height: asset.height
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
      console.error('Photo picker error:', error);
    }
  };

  if (!selectedFeature) {
    return null;
  }

  return (
    <OnboardingContainer>
      <View style={{ flex: 1 }}>
        {/* Header with Back and Skip buttons */}
        <Animated.View style={[
          { 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          }, 
          headerAnimatedStyle
        ]}>
          <TouchableOpacity 
            onPress={onBack}
            style={{ 
              padding: 8, 
            }}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={onSkip}
            style={{ padding: 8 }}
          >
            <Text style={{ 
              fontSize: 16, 
              color: '#9CA3AF',
              fontFamily: 'Lexend-Medium' 
            }}>
              Skip
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Feature Title */}
        <Animated.View style={[
          { alignItems: 'center', paddingHorizontal: 24, marginBottom: 32 }, 
          titleAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: 28, 
            fontFamily: 'Lexend-Bold', 
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            {selectedFeatureId === 'custom_prompt' ? 'Photo Magic' : selectedFeature.name}
          </Text>
          <Text style={{ 
            fontSize: 16, 
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: 22,
          }}>
            {selectedFeatureId === 'custom_prompt' ? 'Type what you want to edit and watch it happen' : selectedFeature.description}
          </Text>
        </Animated.View>

        {/* Preview Video */}
        <Animated.View style={[
          {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          },
          previewAnimatedStyle
        ]}>
          <View style={{
            width: screenWidth * 0.6,
            aspectRatio: 9/16,
            maxWidth: 280,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}>
            {previewMedia.type === 'video' && videoPlayer ? (
              <VideoView
                player={videoPlayer}
                style={{ flex: 1 }}
                contentFit='cover'
                nativeControls={false}
                allowsFullscreen={false}
              />
            ) : (
              <ExpoImage
                source={previewMedia.source}
                style={{ flex: 1 }}
                contentFit='cover'
              />
            )}
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[
          { 
            paddingHorizontal: 24, 
            paddingVertical: 32,
            gap: 16,
          }, 
          buttonsAnimatedStyle
        ]}>
          <OnboardingButton
            title="Pick Photo"
            onPress={handlePickPhoto}
            variant="primary"
            size="large"
            style={{ width: '100%' }}
          />
          
          <Text style={{ 
            fontSize: 14, 
            color: '#6B7280',
            textAlign: 'center',
            marginTop: 8,
          }}>
            Try it with one of your photos
          </Text>
        </Animated.View>
      </View>
    </OnboardingContainer>
  );
}

// Map features to their preview media (video or image)
interface PreviewMedia {
  type: 'video' | 'image';
  source: any;
}

function getPreviewMedia(featureId: string): PreviewMedia {
  const mediaMap: Record<string, PreviewMedia> = {
    // Custom prompt
    'custom_prompt': { type: 'video', source: require('../../assets/videos/text-edit.mp4') },
    
    // Magic sections (top priority)
    'recreate': { type: 'video', source: require('../../assets/videos/recreate.mp4') },
    'water_stain_damage': { type: 'image', source: require('../../assets/images/popular/descratch/pop-2.png') },
    'restore_repair': { type: 'image', source: require('../../assets/images/popular/descratch/pop-2.png') },
    'professional_outfit': { type: 'video', source: require('../../assets/videos/magic/outfits/thumbnail/formal-wear/professional.mp4') },
    'blur_background': { type: 'image', source: require('../../assets/images/backgrounds/thumbnail/blur/blurred.jpeg') },
    
    // Popular creative features
    'clear_skin': { type: 'video', source: require('../../assets/videos/popular/clear-skin.mp4') },
    'add_smile': { type: 'video', source: require('../../assets/videos/popular/smile.mp4') },
    'fix_hair': { type: 'video', source: require('../../assets/videos/popular/fix-hair.mp4') },
    'make_younger': { type: 'video', source: require('../../assets/videos/popular/younger.mp4') },
    'add_wings': { type: 'video', source: require('../../assets/videos/popular/angel.mp4') },
    'add_halo': { type: 'video', source: require('../../assets/videos/popular/halo.mp4') },
    'make_slimmer': { type: 'video', source: require('../../assets/videos/popular/slimmer.mp4') },
    
    // Memorial features
    'light_rays': { type: 'video', source: require('../../assets/videos/memorial/light.mp4') },
    'memorial_flowers': { type: 'video', source: require('../../assets/videos/memorial/flowers.mp4') },
    
    // Core repair features
    'add_color_bw': { type: 'image', source: require('../../assets/images/popular/colorize/pop-1.png') },
    'unblur_sharpen': { type: 'image', source: require('../../assets/images/popular/enhance/pop-3.png') },
    'brighten_photos': { type: 'image', source: require('../../assets/images/popular/brighten/pop-4.png') },
    'beach_background': { type: 'image', source: require('../../assets/images/backgrounds/thumbnail/beach/beach.jpeg') },
  };

  // Fallback to default video
  return mediaMap[featureId] || { type: 'video', source: require('../../assets/videos/magic/backtolife/thumbnail/btl-0.mp4') };
}