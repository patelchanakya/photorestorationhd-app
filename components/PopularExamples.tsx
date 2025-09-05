// Removed Pro gating - all popular examples are now free
import { analyticsService } from '@/services/analytics';
import { useT } from '@/src/hooks/useTranslation';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface PopularItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  prompt?: string; // The prompt to apply
}

// Popular photo restoration and editing requests
const DEFAULT_POPULAR_ITEMS: PopularItem[] = [
  { 
    id: 'popular-1', 
    titleKey: 'popular.addSmile', 
    type: 'video', 
    video: require('../assets/videos/popular/smile.mp4'), 
    prompt: "Add a natural, authentic smile while preserving facial identity and features." 
  },
  { 
    id: 'popular-2', 
    titleKey: 'popular.openEyes', 
    type: 'video', 
    video: require('../assets/videos/popular/open-eyes.mp4'), 
    prompt: "open my eyes" 
  },
  { 
    id: 'popular-3', 
    titleKey: 'popular.addHalo', 
    type: 'video', 
    video: require('../assets/videos/popular/halo.mp4'), 
    prompt: "Add a subtle glowing halo above the subject's head." 
  },
  { 
    id: 'popular-4', 
    titleKey: 'popular.slimmer', 
    type: 'video', 
    video: require('../assets/videos/popular/slimmer.mp4'), 
    prompt: "Reduce visible body and facial fat while keeping natural proportions, pose, and facial identity intact. Make changes realistic and balanced without distorting the subject." 
  },
  { 
    id: 'popular-5', 
    titleKey: 'popular.clearSkin', 
    type: 'video', 
    video: require('../assets/videos/popular/clear-skin.mp4'), 
    prompt: "Remove acne, blemishes, and skin imperfections while keeping natural skin texture, tone, and lighting unchanged." 
  },
  { 
    id: 'popular-6', 
    titleKey: 'popular.fixHair', 
    type: 'video', 
    video: require('../assets/videos/popular/fix-hair.mp4'), 
    prompt: "Clean up messy or stray hairs while preserving natural hair texture, style, volume, and keeping hair in place without altering its position on the face." 
  },
  { 
    id: 'popular-7', 
    titleKey: 'popular.angelWings', 
    type: 'video', 
    video: require('../assets/videos/popular/angel.mp4'), 
    prompt: "Add realistic wings that match pose, background, and lighting." 
  },
  { 
    id: 'popular-8', 
    titleKey: 'popular.younger', 
    type: 'video', 
    video: require('../assets/videos/popular/younger.mp4'), 
    prompt: "Make the subject look a bit younger while keeping their identity, facial features, and natural expression unchanged." 
  },
  { 
    id: 'popular-9', 
    titleKey: 'popular.older', 
    type: 'video', 
    video: require('../assets/videos/popular/older.mp4'), 
    prompt: "Make the subject appear slightly older in a natural, age-appropriate way. Preserve facial identity, proportions, and realistic features, adjusting age subtly without exaggeration." 
  },
  { 
    id: 'popular-10', 
    titleKey: 'popular.gardenBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/garden/garden.jpeg'), 
    prompt: "Replace background with a garden scene - greenery and foliage in natural daylight." 
  },
  { 
    id: 'popular-11', 
    titleKey: 'popular.studioBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/studio/studio.jpeg'), 
    prompt: "Replace background with a clean studio backdrop in white or light gray." 
  },
  { 
    id: 'popular-12', 
    titleKey: 'popular.softLightsBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/soft-lights/softer.jpg'), 
    prompt: "Replace background with soft bokeh lights for a cinematic look." 
  },
  { 
    id: 'popular-13', 
    titleKey: 'popular.heavenlyBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg'), 
    prompt: "Replace background with a bright heavenly sky of soft white clouds and gentle sunbeams." 
  }
];

// VideoView component with reliable playback recovery
const VideoViewWithPlayer = ({ video, index }: { video: any; index?: number }) => {
  // Deterministic values based on index for visual variety
  const videoIndex = index || 0;
  const isMountedRef = useRef(true);
  const shouldBePlayingRef = useRef(false);
  
  const playbackRate = React.useMemo(() => {
    // Faster playback speeds for better looping
    const rates = [1.2, 1.0, 1.1, 1.3, 1.1, 1.2, 1.0, 1.2, 1.1, 1.3, 1.0, 1.1, 1.2];
    return rates[videoIndex % rates.length];
  }, [videoIndex]);
  
  const initialSeek = React.useMemo(() => {
    // Start at different points in the video (0-2 seconds)
    return (videoIndex * 0.3) % 2;
  }, [videoIndex]);
  
  const player = useVideoPlayer(video, (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = playbackRate;
    } catch (error) {
      console.error('PopularExamples video player init error:', error);
    }
  });

  // Monitor playback status with expo's useEvent hook
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Auto-recovery: restart video if it should be playing but isn't
  React.useEffect(() => {
    if (!isPlaying && shouldBePlayingRef.current && isMountedRef.current) {
      try {
        if (player && player.status !== 'idle') {
          player.play();
        }
      } catch (error) {
        // Ignore recovery errors
      }
    }
  }, [isPlaying, player]);

  // Cleanup video player on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      
      try {
        if (player) {
          const status = player.status;
          if (status !== 'idle') {
            player.pause();
          }
          player.release();
        }
      } catch (error) {
        if (__DEV__) {
          console.log('PopularExamples video cleanup handled');
        }
      }
    };
  }, []);

  // Initial playback setup with consistent timing
  React.useEffect(() => {
    if (!player) return;
    
    // Consistent staggered timing without random offset
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (player.status !== 'idle') {
          player.currentTime = initialSeek;
          player.play();
          shouldBePlayingRef.current = true;
        }
      } catch (e) {
        // Ignore initial play errors
      }
    }, videoIndex * 150); // Consistent 150ms delay per video
    
    return () => clearTimeout(playTimer);
  }, [player, videoIndex, initialSeek]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                player.play();
              }
            }, 100 + videoIndex * 50);
          }
        } catch (error) {
          // Ignore resume errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [player, videoIndex]);

  // Handle navigation focus (returning to screen)
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                player.play();
              }
            }, 100 + videoIndex * 50);
          }
        } catch (error) {
          // Ignore focus resume errors
        }
      }
    }, [player, videoIndex])
  );

  return (
    <Animated.View 
      entering={FadeIn.delay(videoIndex * 100).duration(800)}
      style={{ width: '100%', height: '100%' }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%', opacity: 0.95 }}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
    </Animated.View>
  );
};

export function PopularExamples({ items = DEFAULT_POPULAR_ITEMS }: { items?: PopularItem[] }) {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  const t = useT();
  
  // Responsive tile dimensions - optimized for text visibility and mobile/tablet experience
  const tileWidth = isTabletLike ? 105 : (isSmallPhone ? 90 : 105);
  const fontSize = isTabletLike ? 13 : (isSmallPhone ? 11 : 12);
  
  const router = useRouter();
  const handlePopularSelect = async (item: PopularItem) => {
    // No Pro gating - all popular examples are now free
    
    const translatedTitle = t(item.titleKey);
    
    // PROMPT LOGGING: Track which popular example is selected
    console.log('⭐ POPULAR EXAMPLE SELECTED:', {
      id: item.id,
      title: translatedTitle,
      prompt: item.prompt
    });
    
    // Track popular tile selection
    analyticsService.trackTileUsage({
      category: 'popular',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: 'custom',
      customPrompt: item.prompt,
      stage: 'selected'
    });
    
    // Launch image picker then open Quick Edit sheet in custom mode
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsEditing: false, 
      quality: 1,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
      exif: false
    });
    if (!result.canceled && result.assets[0]) {
      try {
        useQuickEditStore.getState().openWithImage({ 
          functionType: 'custom' as any, 
          imageUri: result.assets[0].uri, 
          styleName: translatedTitle, 
          customPrompt: item.prompt || translatedTitle 
        });
      } catch {
        // fallback: existing flow
        router.push({ pathname: '/text-edits', params: { imageUri: result.assets[0].uri, prompt: item.prompt || translatedTitle, mode: 'custom' } });
      }
    }
  };

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {items.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: tileWidth, marginRight: index === items.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePopularSelect(item)}
              style={{ 
                width: tileWidth, 
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
                <VideoViewWithPlayer video={item.video} index={index} />
              ) : (
                <ExpoImage 
                  source={item.image} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover" 
                  transition={0} 
                />
              )}
              
              {/* Enhanced gradient overlay for better text contrast */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
                locations={[0, 0.6, 1]}
                start={{ x: 0.5, y: 0.2 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', inset: 0 as any }}
              />
              
              {/* Enhanced bottom label with text shadows */}
              <View style={{ 
                position: 'absolute', 
                left: 8, 
                right: 8, 
                bottom: 8, 
                minHeight: 38, 
                justifyContent: 'flex-end',
                backgroundColor: 'transparent' // Add solid background for shadow efficiency
              }}>
                <Text 
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.7}
                  style={{ 
                    color: '#FFFFFF', 
                    fontFamily: 'Lexend-Bold', 
                    fontSize: fontSize + 1,
                    lineHeight: (fontSize + 1) * 1.3,
                    textAlign: 'center',
                    textShadowColor: 'rgba(0,0,0,0.8)',
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                    letterSpacing: -0.2
                  }}
                >
                  {t(item.titleKey)}
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