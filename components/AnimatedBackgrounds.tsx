// Removed Pro gating - all backgrounds are now free
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface BackgroundItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  title: string;
  type?: 'video' | 'image';
  backgroundPrompt?: string; // The prompt to apply this background
}

// Background presets aligned with user requests/research
const DEFAULT_BACKGROUNDS: BackgroundItem[] = [
  {
    id: 'bg-1',
    title: 'Garden',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/garden/garden.jpeg'),
    backgroundPrompt:
      "Replace the background with a clear garden scene of greenery and foliage in natural daylight. Keep leaves and shapes recognizable without heavy blur. Maintain balanced exposure and natural colors. Keep the subject exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No insects, flowers touching the subject, or props."
  },
  {
    id: 'bg-2',
    title: 'Heavenly',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg'),
    backgroundPrompt:
      "Replace the background with a bright heavenly sky of soft white clouds and gentle sunbeams. Keep clouds clear and recognizable, using a soft pastel blue-to-white gradient with a subtle glow. Maintain balanced exposure and natural colors. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No halos, wings, text, or added objects."
  },
  {
    id: 'bg-3',
    title: 'Passport',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/passport/passport.jpg'),
    backgroundPrompt:
      "Replace the background with a perfectly uniform pure white (#FFFFFF), evenly lit and seamless. No texture, gradients, shadows, or color cast. Keep the subject unchanged—face, skin tone, hair, clothing, pose, and lighting. No retouching or added elements."
  },
  {
    id: 'bg-4',
    title: 'Studio',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/studio/studio.jpeg'),
    backgroundPrompt:
      "Replace the background with a seamless studio backdrop in white or light gray, evenly lit and smooth. No texture, gradients, or banding. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No retouching."
  },
  {
    id: 'bg-5',
    title: 'Blur',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/blur/blurred.jpeg'),
    backgroundPrompt:
      "Keep the original background but apply a soft natural blur and brighten it slightly (~25%) while preserving color balance. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No added glow or light spill."
  },
  {
    id: 'bg-6',
    title: 'Beach',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/beach/beach.jpeg'),
    backgroundPrompt:
      "Replace the background with a clear beach scene: visible ocean horizon, soft blue sky, and light sand. Keep details recognizable without heavy blur. Maintain daylight exposure and natural colors. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No umbrellas, props, or text."
  },
  {
    id: 'bg-7',
    title: 'City',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/city/city.jpeg'),
    backgroundPrompt:
      "Replace the background with a modern city scene in daylight—street or skyline—with recognizable buildings. Keep details clear without heavy blur. Maintain balanced exposure and natural colors. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No text, logos, or props."
  },
  {
    id: 'bg-8',
    title: 'Wedding',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/wedding/wedding.jpeg'),
    backgroundPrompt:
      "Replace the background with an elegant wedding venue interior (aisle or reception hall) lit warmly. Include tasteful decor such as soft florals, candles, or string lights. Keep details recognizable without heavy blur. Maintain warm balanced tones. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No veils, bouquets, text, or props on the subject."
  },
  {
    id: 'bg-10',
    title: 'Soft Lights',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/soft-lights/softer.jpg'),
    backgroundPrompt:
      "Replace the background with a cinematic bokeh of soft neutral-to-warm lights. Use large, smooth discs with shallow depth-of-field. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No light spill, text, or props."
  },
  {
    id: 'bg-11',
    title: 'Christmas',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/christmas/christmas.jpg'),
    backgroundPrompt:
      "Replace the background with an elegant Christmas interior scene: decorated tree, warm string lights, and tasteful holiday decor in a living-room setting. Keep details recognizable without heavy blur. Maintain balanced exposure, natural colors, and realistic depth-of-field. Keep the subject unchanged—face, skin tone, hair, clothing, pose, lighting, and shadows. No objects on the subject, no text, logos, snow overlays, or effects."
  },
];

// VideoView component with player hook - optimized for performance
const VideoViewWithPlayer = ({ video, isVisible = true }: { video: any; isVisible?: boolean }) => {
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = true;
    // Don't auto-play, wait for visibility
  });

  React.useEffect(() => {
    if (!player) return;
    
    let playTimer: any;
    
    if (isVisible) {
      // Small delay to prevent all videos starting at once
      playTimer = setTimeout(() => {
        if (!player.playing) player.play();
      }, Math.random() * 300);
    } else {
      // Pause when not visible
      if (player.playing) player.pause();
    }
    
    return () => {
      if (playTimer) clearTimeout(playTimer);
    };
  }, [player, isVisible]);

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
  const handleBackgroundSelect = async (background: BackgroundItem) => {
    // No Pro gating - all backgrounds are now free
    
    // Launch image picker then open Quick Edit sheet in background mode
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      try {
        const { useQuickEditStore } = await import('@/store/quickEditStore');
        useQuickEditStore.getState().openWithImage({ functionType: 'background' as any, imageUri: result.assets[0].uri, styleName: background.title, customPrompt: background.backgroundPrompt || background.title });
      } catch {
        // fallback: existing flow
        router.push({ pathname: '/text-edits', params: { imageUri: result.assets[0].uri, prompt: background.backgroundPrompt || background.title, mode: 'background' } });
      }
    }
  };

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        // Removed extraData as Pro gating is removed
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
              
              {/* Bottom label - removed PRO badge */}
              <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontFamily: 'Lexend-SemiBold', 
                  fontSize: 14 
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