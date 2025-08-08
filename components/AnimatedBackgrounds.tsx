import { IconSymbol } from '@/components/ui/IconSymbol';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { presentPaywall } from '@/services/revenuecat';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface BackgroundItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  title: string;
  type?: 'video' | 'image';
  backgroundPrompt?: string; // The prompt to apply this background
}

// Add your background transformation videos here
const DEFAULT_BACKGROUNDS: BackgroundItem[] = [
  // Example items - replace with your actual videos
  { id: 'bg-1', title: 'Beach', type: 'image', image: require('../assets/images/onboarding/after-3.png'), backgroundPrompt: 'tropical beach with palm trees' },
  { id: 'bg-2', title: 'City', type: 'image', image: require('../assets/images/onboarding/after-4.png'), backgroundPrompt: 'modern city skyline' },
  { id: 'bg-3', title: 'Nature', type: 'image', image: require('../assets/images/onboarding/after-3.png'), backgroundPrompt: 'forest nature scenery' },
  { id: 'bg-4', title: 'Studio', type: 'image', image: require('../assets/images/onboarding/after-4.png'), backgroundPrompt: 'professional photo studio' },
  { id: 'bg-5', title: 'Abstract', type: 'image', image: require('../assets/images/onboarding/after-3.png'), backgroundPrompt: 'abstract artistic background' },
  { id: 'bg-6', title: 'Sunset', type: 'image', image: require('../assets/images/onboarding/after-4.png'), backgroundPrompt: 'beautiful sunset sky' },
];

// VideoView component with player hook
const VideoViewWithPlayer = ({ video }: { video: any }) => {
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
};

export function AnimatedBackgrounds({ backgrounds = DEFAULT_BACKGROUNDS }: { backgrounds?: BackgroundItem[] }) {
  const router = useRouter();
  const isPro = useSubscriptionStore((state) => state.isPro);

  const handleBackgroundSelect = async (background: BackgroundItem) => {
    // Check current PRO status
    const currentIsPro = useSubscriptionStore.getState().isPro;
    
    // If not PRO, show paywall
    if (!currentIsPro) {
      const success = await presentPaywall();
      if (!success) return;
      
      // After successful purchase, check if status was updated
      const updatedIsPro = useSubscriptionStore.getState().isPro;
      if (!updatedIsPro) {
        // Wait a moment for the listener to update
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Launch image picker for user to select photo
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      // Debug: Show what prompt will be used
      if (__DEV__) {
        console.log('🌅 Background selected:', background.title);
        console.log('📝 Prompt to be used:', background.backgroundPrompt || background.title);
      }
      
      // Navigate to processing with background prompt
      router.push({
        pathname: '/text-edits',
        params: {
          imageUri: result.assets[0].uri,
          prompt: background.backgroundPrompt || background.title,
          mode: 'background'
        }
      });
    }
  };

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {backgrounds.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: 120, marginRight: index === backgrounds.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleBackgroundSelect(item)}
              style={{ 
                width: 120, 
                aspectRatio: 9/16, 
                borderRadius: 16, 
                overflow: 'hidden', 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.08)', 
                backgroundColor: '#0b0b0f' 
              }}
            >
              {/* Render video or image based on type */}
              {item.type === 'video' && item.video ? (
                <VideoViewWithPlayer video={item.video} />
              ) : (
                <ExpoImage 
                  source={item.image} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover" 
                  transition={0} 
                />
              )}
              
              {/* Gradient overlay */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
                start={{ x: 0.5, y: 0.3 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', inset: 0 as any }}
              />
              
              {/* PRO badge for non-pro users - minimal style */}
              {!isPro && (
                <View style={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  borderWidth: 0.5,
                  borderColor: 'rgba(249,115,22,0.5)'
                }}>
                  <IconSymbol name="crown" size={10} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: 9, fontWeight: '600', letterSpacing: 0.3 }}>PRO</Text>
                </View>
              )}
              
              {/* Bottom label */}
              <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontWeight: '600', 
                  fontSize: 14, 
                  textShadowColor: 'rgba(0,0,0,0.8)', 
                  textShadowOffset: { width: 0, height: 1 }, 
                  textShadowRadius: 3 
                }}>
                  {item.title}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
      
      {/* Right edge gradient */}
      <LinearGradient
        colors={['transparent', '#0B0B0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ 
          position: 'absolute', 
          right: 0, 
          top: 0, 
          bottom: 0, 
          width: 30, 
          pointerEvents: 'none' 
        }}
      />
    </View>
  );
}