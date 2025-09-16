import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from 'react-i18next';
import { onboardingUtils } from '@/utils/onboarding';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef } from 'react';
import { Alert, AppState, Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface FeaturePreviewScreenProps {
  selectedFeatureId: string;
  onBack: () => void;
  onSkip: () => void;
  onPickPhoto: (photo: { uri: string; width: number; height: number }) => void;
}

export const FeaturePreviewScreen = React.memo(function FeaturePreviewScreen({ 
  selectedFeatureId, 
  onBack, 
  onSkip, 
  onPickPhoto 
}: FeaturePreviewScreenProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const selectedFeature = onboardingUtils.getFeatureById(selectedFeatureId);
  const isMountedRef = useRef(true);
  const shouldBePlayingRef = useRef(false);
  
  const headerOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const previewOpacity = useSharedValue(0);
  const previewScale = useSharedValue(0.9);
  const buttonsOpacity = useSharedValue(0);

  // Get preview media for the selected feature
  const previewMedia = getPreviewMedia(selectedFeatureId);
  const videoPlayer = useVideoPlayer(previewMedia.source, (player) => {
    try {
      if (previewMedia.type === 'video') {
        player.loop = true;
        player.muted = true;
        player.playbackRate = 1.0;
      }
    } catch (error) {
      console.error('FeaturePreview video player init error:', error);
    }
  });

  // Cleanup video player on unmount
  React.useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      
      try {
        if (videoPlayer) {
          const status = videoPlayer.status;
          if (status !== 'idle') {
            videoPlayer.pause();
          }
          videoPlayer.release();
        }
      } catch (error) {
        if (__DEV__) {
          console.log('FeaturePreview video cleanup handled');
        }
      }
    };
  }, []);

  // Initial playback setup
  React.useEffect(() => {
    if (!videoPlayer || previewMedia.type !== 'video') return;
    
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (videoPlayer.status !== 'idle') {
          videoPlayer.play();
          shouldBePlayingRef.current = true;
        }
      } catch (e) {
        // Ignore initial play errors
      }
    }, 300);
    
    return () => clearTimeout(playTimer);
  }, [videoPlayer, previewMedia.type]);

  React.useEffect(() => {
    // If "none_above" is selected, automatically skip to community screen
    if (selectedFeatureId === 'none_above') {
      // Immediate transition for faster flow
      setTimeout(() => {
        onSkip();
      }, 100);
      return;
    }

    // Faster header animation
    headerOpacity.value = withTiming(1, { duration: 200 });
    
    // Faster title animation
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 200 }));
    
    // Faster preview animation
    previewOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    previewScale.value = withDelay(200, withSpring(1, { damping: 15, stiffness: 200 }));
    
    // Faster buttons animation
    buttonsOpacity.value = withDelay(300, withTiming(1, { duration: 250 }));
  }, [selectedFeatureId, onSkip]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    if (!videoPlayer) return;
    
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isMountedRef.current) {
        // Resume video playback when app returns to foreground
        try {
          if (videoPlayer && !videoPlayer.playing && videoPlayer.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                videoPlayer.play();
              }
            }, 100);
          }
        } catch (error) {
          // Ignore resume errors
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
      try {
        if (videoPlayer && !videoPlayer.playing && videoPlayer.status !== 'idle' && isMountedRef.current) {
          setTimeout(() => {
            if (isMountedRef.current) {
              videoPlayer.play();
            }
          }, 100);
        }
      } catch (error) {
        // Ignore focus resume errors
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
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
        exif: false,
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
      Alert.alert(t('common.error'), t('onboarding.preview.pickPhotoError'));
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
              {t('onboarding.preview.skip')}
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
            {selectedFeatureId === 'custom_prompt' ? t('onboarding.preview.photoMagic') : selectedFeature.name}
          </Text>
          <Text style={{ 
            fontSize: 16, 
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: 22,
          }}>
            {selectedFeatureId === 'custom_prompt' ? t('onboarding.preview.photoMagicDesc') : selectedFeature.description}
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
                useExoShutter={false}
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
            title={t('onboarding.preview.pickPhoto')}
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
            {t('onboarding.preview.tryWithPhoto')}
          </Text>
        </Animated.View>
      </View>
    </OnboardingContainer>
  );
});

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
    'repair': { type: 'video', source: require('../../assets/videos/recreate.mp4') },
    'water_stain_damage': { type: 'image', source: require('../../assets/images/popular/stain/pop-7.png') },
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
    'candlelight_vigil': { type: 'video', source: require('../../assets/videos/candle.mp4') },
    
    // Core repair features
    'add_color_bw': { type: 'image', source: require('../../assets/images/popular/colorize/pop-1.png') },
    'unblur_sharpen': { type: 'image', source: require('../../assets/images/popular/enhance/pop-3.png') },
    'brighten_photos': { type: 'image', source: require('../../assets/images/popular/brighten/pop-4.png') },
    'beach_background': { type: 'image', source: require('../../assets/images/backgrounds/thumbnail/beach/beach.jpeg') },
  };

  // Return null if no media found
  return mediaMap[featureId] || null;
}