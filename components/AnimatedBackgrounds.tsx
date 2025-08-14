import { checkSubscriptionStatus, presentPaywall } from '@/services/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
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
      "Replace only the background with a clear garden scene: visible greenery and foliage with natural daylight. Keep the background mostly in focus (minimal blur) so leaves and shapes are recognizable; avoid heavy bokeh. Maintain balanced exposure and natural colors. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No insects, flowers touching the subject, or added props."
  },
  {
    id: 'bg-2',
    title: 'Heavenly',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg'),
    backgroundPrompt:
      "Replace only the background with a bright, heavenly sky of soft white clouds and gentle sunbeams. Keep the cloud forms clearly visible (minimal blur) so the sky reads cleanly; avoid heavy bokeh. Use an airy pastel blue‑to‑white gradient with a subtle, tasteful glow—no halos. Maintain balanced exposure and natural color. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No wings, text, or added objects; do not retouch or brighten the subject."
  },
  {
    id: 'bg-3',
    title: 'Passport',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/passport/passport.jpg'),
    backgroundPrompt:
      "Replace only the background with a perfectly uniform pure white background (#FFFFFF), evenly lit. Absolutely no texture, edges, gradients, color casts, or shadows in the background. Keep the person exactly the same—face, skin tone, hair, clothing, pose, and lighting unchanged. Do not retouch the subject or add anything."
  },
  {
    id: 'bg-4',
    title: 'Studio',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/studio/studio.jpeg'),
    backgroundPrompt:
      "Replace only the background with a seamless studio backdrop in white or light gray, evenly lit and perfectly smooth with no texture or banding. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. Do not retouch or brighten the subject."
  },
  {
    id: 'bg-5',
    title: 'Blur',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/blur/blurred.jpeg'),
    backgroundPrompt:
      "Do not change the location. Keep the same background but apply a soft, natural blur and brighten the background slightly (~25%) while preserving its original color balance. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No added glow or light spill on the subject."
  },
  {
    id: 'bg-6',
    title: 'Beach',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/beach/beach.jpeg'),
    backgroundPrompt:
      "Replace only the background with a clear, bright beach scene: visible ocean horizon, soft blue sky, and light sand. Keep the background mostly in focus (minimal blur) so details are recognizable; avoid heavy bokeh. Maintain balanced daylight exposure and natural colors. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No umbrellas, text, or added props."
  },
  {
    id: 'bg-7',
    title: 'City',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/city/city.jpeg'),
    backgroundPrompt:
      "Replace only the background with a clear modern city scene in daylight—street or skyline—with recognizable buildings and structure. Keep the background mostly in focus (minimal blur); avoid heavy bokeh. Maintain balanced exposure and natural colors. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No text, logos, or legible signage; no added props."
  },
  {
    id: 'bg-8',
    title: 'Wedding',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/wedding/wedding.jpeg'),
    backgroundPrompt:
      "Replace only the background with a clearly visible, elegant wedding venue interior (aisle or reception hall) with warm ambient lighting. Show tasteful decor—soft florals, candles, or string lights—in a refined setting. Keep the background mostly in focus (minimal blur) so details are recognizable; avoid heavy bokeh. Maintain balanced exposure and natural warm tones. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. Do not add veils, bouquets, or accessories to the subject; no text or logos."
  },
  {
    id: 'bg-10',
    title: 'Soft Lights',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/soft-lights/softer.jpg'),
    backgroundPrompt:
      "Replace only the background with a premium, cinematic bokeh of soft lights. Use neutral‑to‑warm white/golden highlights, large soft discs, and shallow depth‑of‑field. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. No light spill on the subject, no text, shapes, or props. Background should feel elegant and luminous without overexposure or harsh edges."
  },
  {
    id: 'bg-11',
    title: 'Christmas',
    type: 'image',
    image: require('../assets/images/backgrounds/thumbnail/christmas/christmas.jpg'),
    backgroundPrompt:
      "Replace only the background with a clearly visible, elegant Christmas interior scene. Show a decorated Christmas tree, warm ambient string lights, and tasteful holiday decor in a living‑room setting. Keep the background mostly in focus (minimal blur) so details are recognizable; avoid heavy bokeh. Maintain balanced exposure, natural colors, and realistic depth‑of‑field behind the subject. Keep the person exactly the same—face, skin tone, hair, clothing, pose, lighting, and shadows unchanged. Do not place any objects on the subject; no text, logos, snow overlays, or lens effects."
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
  const isPro = useSubscriptionStore((state) => state.isPro);

  const handleBackgroundSelect = async (background: BackgroundItem) => {
    // Check current PRO status
    const currentIsPro = useSubscriptionStore.getState().isPro;
    
    // If not PRO, show paywall
    if (!currentIsPro) {
      const success = await presentPaywall();
      if (!success) return;
      await checkSubscriptionStatus();
    }
    
    // Launch image picker then open Quick Edit sheet in background mode
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      try {
        const { useQuickEditStore } = await import('@/store/quickEditStore');
        useQuickEditStore.getState().openWithImage({ functionType: 'background' as any, imageUri: result.assets[0].uri, customPrompt: background.backgroundPrompt || background.title });
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
        extraData={isPro}
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
              
              {/* Bottom label + PRO for non-pro users */}
              <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                {!isPro && (
                  <View style={{ 
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 3,
                    borderWidth: 0.5,
                    borderColor: 'rgba(249,115,22,0.5)',
                    alignSelf: 'flex-start',
                    marginBottom: 4
                  }}>
                    <Text style={{ color: '#f97316', fontSize: 9, fontWeight: '600', letterSpacing: 0.3 }}>PRO</Text>
                  </View>
                )}
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