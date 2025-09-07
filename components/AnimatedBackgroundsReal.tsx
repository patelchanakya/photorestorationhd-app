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

interface BackgroundItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  backgroundPrompt?: string; // The prompt to apply this background
}

// Background transformation options
const DEFAULT_BACKGROUNDS: BackgroundItem[] = [
  { 
    id: 'background-5', 
    titleKey: 'Clean Background', 
    type: 'video', 
    // video: require('../assets/videos/magic/backgrounds/remove.mp4'), 
    backgroundPrompt: "Remove the background completely, leaving only the subject on a transparent or clean white background." 
  },
  { 
    id: 'background-6', 
    titleKey: 'Blur Background', 
    type: 'video', 
    // video: require('../assets/videos/magic/backgrounds/blur.mp4'), 
    backgroundPrompt: "Blur the background to create a professional depth of field effect while keeping the subject in sharp focus." 
  },
  { 
    id: 'popular-10', 
    titleKey: 'popular.gardenBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/garden/garden.jpeg'), 
    backgroundPrompt: "Replace background with a garden scene - greenery and foliage in natural daylight." 
  },
  { 
    id: 'popular-11', 
    titleKey: 'popular.studioBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/studio/studio.jpeg'), 
    backgroundPrompt: "Replace background with a clean studio backdrop in white or light gray." 
  },
  { 
    id: 'popular-12', 
    titleKey: 'popular.softLightsBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/soft-lights/softer.jpg'), 
    backgroundPrompt: "Replace background with soft bokeh lights for a cinematic look." 
  },
  { 
    id: 'popular-13', 
    titleKey: 'popular.heavenlyBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg'), 
    backgroundPrompt: "Replace background with a bright heavenly sky of soft white clouds and gentle sunbeams." 
  },
  { 
    id: 'background-7', 
    titleKey: 'popular.beachBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/beach/beach.jpg'), 
    backgroundPrompt: "Replace background with a beautiful beach scene - ocean waves, sand, and clear blue sky." 
  },
  { 
    id: 'background-8', 
    titleKey: 'popular.officeBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/office/office.jpg'), 
    backgroundPrompt: "Replace background with a professional office setting - modern workspace with clean lines." 
  },
  { 
    id: 'background-9', 
    titleKey: 'popular.natureBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/nature/nature.jpg'), 
    backgroundPrompt: "Replace background with a natural outdoor scene - trees, forest, or park setting." 
  },
  { 
    id: 'background-10', 
    titleKey: 'popular.cityBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/city/city.jpg'), 
    backgroundPrompt: "Replace background with an urban cityscape - buildings, streets, and city atmosphere." 
  },
  { 
    id: 'background-11', 
    titleKey: 'popular.sunsetBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/sunset/sunset.jpg'), 
    backgroundPrompt: "Replace background with a beautiful sunset scene - warm colors and dramatic sky." 
  },
  { 
    id: 'background-12', 
    titleKey: 'popular.winterBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/winter/winter.jpg'), 
    backgroundPrompt: "Replace background with a winter scene - snow, ice, and cold weather atmosphere." 
  },
  { 
    id: 'background-13', 
    titleKey: 'popular.vintageBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/vintage/vintage.jpg'), 
    backgroundPrompt: "Replace background with a vintage or retro setting - aged, nostalgic atmosphere." 
  },
  { 
    id: 'background-14', 
    titleKey: 'popular.abstractBackground', 
    type: 'image', 
    // image: require('../assets/images/backgrounds/thumbnail/abstract/abstract.jpg'), 
    backgroundPrompt: "Replace background with an abstract artistic pattern - colorful and creative design." 
  },
  {
    id: 'background-15',
    titleKey: 'Vintage Sepia 📸',
    type: 'image',
    // image: require('../assets/images/backgrounds/thumbnail/vintage-sepia/sepia.jpg'),
    backgroundPrompt: "Classic sepia tone background"
  },
  {
    id: 'background-16',
    titleKey: 'Black & White ⚫⚪',
    type: 'image',
    // image: require('../assets/images/backgrounds/thumbnail/black-white/bw.jpg'),
    backgroundPrompt: "High-contrast black and white background"
  },
  {
    id: 'background-17',
    titleKey: 'Moody Dark',
    type: 'image',
    // image: require('../assets/images/backgrounds/thumbnail/moody-dark/dark.jpg'),
    backgroundPrompt: "Dramatic dark and moody background"
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
    const rates = [1.1, 1.0, 1.2, 1.1, 1.3, 1.2];
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
      console.error('AnimatedBackgroundsReal video player init error:', error);
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
          console.log('AnimatedBackgroundsReal video cleanup handled');
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

export function AnimatedBackgroundsReal({ backgrounds = DEFAULT_BACKGROUNDS }: { backgrounds?: BackgroundItem[] }) {
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
  const handleBackgroundSelect = async (background: BackgroundItem) => {
    // No Pro gating - all backgrounds are free
    const translatedTitle = background.titleKey.includes('.') ? t(background.titleKey) : background.titleKey;
    
    // PROMPT LOGGING: Track which background style is selected
    console.log('🖼️ BACKGROUND STYLE SELECTED:', {
      id: background.id,
      title: translatedTitle,
      prompt: background.backgroundPrompt
    });
    
    // Track background tile selection
    analyticsService.trackTileUsage({
      category: 'background',
      tileName: translatedTitle,
      tileId: background.id,
      functionType: 'background',
      customPrompt: background.backgroundPrompt,
      stage: 'selected'
    });
    
    // Launch image picker then open Quick Edit sheet in background mode
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsEditing: false, 
      quality: 1,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      exif: false
    });
    if (!result.canceled && result.assets[0]) {
      try {
        useQuickEditStore.getState().openWithImage({ 
          functionType: 'background', 
          imageUri: result.assets[0].uri, 
          styleName: translatedTitle, 
          customPrompt: background.backgroundPrompt || translatedTitle 
        });
      } catch {
        // fallback: existing flow
        router.push({ 
          pathname: '/text-edits', 
          params: { 
            imageUri: result.assets[0].uri, 
            prompt: background.backgroundPrompt || translatedTitle, 
            mode: 'background' 
          } 
        });
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
        {backgrounds.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: tileWidth, marginRight: index === backgrounds.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleBackgroundSelect(item)}
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
              ) : item.image ? (
                <ExpoImage 
                  source={item.image} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover" 
                  transition={0} 
                />
              ) : (
                <View style={{ 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: '#1a1a1a',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Text style={{ color: '#666', fontSize: 10 }}>BG {index + 1}</Text>
                </View>
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
                backgroundColor: 'transparent'
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
                  {item.titleKey.includes('.') ? t(item.titleKey) : item.titleKey}
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