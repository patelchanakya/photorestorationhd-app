import React from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ONBOARDING_FEATURES } from '@/utils/onboarding';
import * as ImagePicker from 'expo-image-picker';
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

const { width: screenWidth } = Dimensions.get('window');

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

  // Get preview video for the selected feature
  const previewVideo = getPreviewVideo(selectedFeatureId);
  const videoPlayer = useVideoPlayer(previewVideo, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

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
    buttonsOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
  }, [selectedFeatureId, onSkip]);

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
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.1)' 
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
              fontWeight: '500' 
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
            fontWeight: 'bold', 
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
          },
          previewAnimatedStyle
        ]}>
          <View style={{
            width: selectedFeatureId === 'custom_prompt' ? screenWidth * 0.7 : screenWidth - 48,
            aspectRatio: selectedFeatureId === 'custom_prompt' ? 9/16 : 4/3,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}>
            <VideoView
              player={videoPlayer}
              style={{ flex: 1 }}
              contentFit={selectedFeatureId === 'custom_prompt' ? 'contain' : 'cover'}
              nativeControls={false}
              allowsFullscreen={false}
            />
            
            {/* Play indicator overlay - only show for non-custom features */}
            {selectedFeatureId !== 'custom_prompt' && (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
              }}>
                <View style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: 'rgba(250, 204, 21, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FACC15',
                }}>
                  <IconSymbol name="play.fill" size={24} color="#FACC15" />
                </View>
              </View>
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
            See it in action with your own photo
          </Text>
        </Animated.View>
      </View>
    </OnboardingContainer>
  );
}

// Map features to their preview videos
function getPreviewVideo(featureId: string) {
  const videoMap: Record<string, any> = {
    'custom_prompt': require('../../assets/videos/text-edit.mp4'),
    'fix_old_damaged': require('../../assets/videos/popular/clear-skin.mp4'),
    'add_color_bw': require('../../assets/videos/popular/smile.mp4'),
    'create_videos': require('../../assets/videos/magic/backtolife/thumbnail/btl-0.mp4'),
    'restore_old_memories': require('../../assets/videos/popular/angel.mp4'),
    'change_outfits': require('../../assets/videos/magic/outfits/thumbnail/fix-clothes/niceclothes.mp4'),
    'remove_backgrounds': require('../../assets/videos/magic/outfits/thumbnail/change-color/colorchange.mp4'),
    'face_enhancement': require('../../assets/videos/popular/halo.mp4'),
    'photo_upscaling': require('../../assets/videos/popular/slimmer.mp4'),
  };

  // Fallback to a default video if specific one doesn't exist
  return videoMap[featureId] || require('../../assets/videos/magic/backtolife/thumbnail/btl-0.mp4');
}