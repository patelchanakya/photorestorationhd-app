// Memorial-focused features for passed loved ones and remembrance photos
import { analyticsService } from '@/services/analytics';
import { useTranslation } from 'react-i18next';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef, useState } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, runOnUI, useSharedValue, useAnimatedReaction } from 'react-native-reanimated';

interface MemorialItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  memorialPrompt?: string; // The prompt to apply this memorial effect
}

// Memorial features specifically designed for passed loved ones and remembrance photos
const DEFAULT_MEMORIAL_ITEMS: MemorialItem[] = [
  {
    id: 'memorial-3',
    titleKey: 'memorial.whiteBackground',
    type: 'video',
    video: require('../assets/videos/memorial/remback.mp4'),
    memorialPrompt:
      "Remove or clean up the background for a clean, professional memorial display that focuses attention on your loved one. Perfect for memorial services and displays."
  },
  { 
    id: 'popular-3', 
    titleKey: 'popular.addHalo', 
    type: 'video', 
    video: require('../assets/videos/popular/halo.mp4'), 
    memorialPrompt: "Add a subtle glowing halo above the subject's head." 
  },
  {
    id: 'memorial-4',
    titleKey: 'memorial.lightRays',
    type: 'video',
    video: require('../assets/videos/memorial/light.mp4'),
    memorialPrompt:
      "Add divine light rays shining down from above, creating a heavenly and spiritual atmosphere perfect for memorial photos. The rays should emanate from above and create a peaceful, uplifting effect."
  },
  { 
    id: 'popular-7', 
    titleKey: 'popular.angelWings', 
    type: 'video', 
    video: require('../assets/videos/popular/angel.mp4'), 
    memorialPrompt: "Add realistic wings that match pose, background, and lighting." 
  },
  {
    id: 'memorial-1',
    titleKey: 'memorial.memorialFlowers',
    type: 'video',
    video: require('../assets/videos/memorial/flowers.mp4'),
    memorialPrompt:
      "Add beautiful memorial flowers like lilies, roses, or white flowers around the photo border or background, symbolizing love, remembrance, and peace."
  },
  {
    id: 'memorial-6',
    titleKey: 'memorial.etherealGlow',
    type: 'video',
    video: require('../assets/videos/memorial/glow.mp4'),
    memorialPrompt:
      "Add a soft, ethereal glow around the subject creating a peaceful and spiritual memorial atmosphere. The glow should be gentle and respectful, not overwhelming."
  },
  {
    id: 'memorial-8',
    titleKey: 'memorial.candlelightVigil',
    type: 'video',
    video: require('../assets/videos/candle.mp4'),
    memorialPrompt:
      "Transform this photo into a warm candlelit memorial-style portrait. Keep the person's face and features unchanged. Add soft golden candlelight in front of the subject, casting a gentle warm glow across the image without darkening the background too much. Place several realistic candles at the bottom, making the scene feel peaceful, emotional, and respectful."
  },
  {
    id: 'memorial-11',
    titleKey: 'memorial.heavenly',
    type: 'video',
    video: require('../assets/videos/clouders.mp4'),
    memorialPrompt:
      "Add soft, peaceful clouds in the background creating a serene heavenly atmosphere perfect for memorial photos."
  },
  {
    id: 'memorial-5',
    titleKey: 'memorial.doveOfPeace',
    type: 'video',
    video: require('../assets/videos/memorial/dove.mp4'),
    memorialPrompt:
      "Add a white dove symbolizing peace, hope, and the Holy Spirit. Position it gracefully in the background or near the subject, perfect for memorial and remembrance photos."
  },
  {
    id: 'memorial-2',
    titleKey: 'memorial.heavenGates',
    type: 'video',
    video: require('../assets/videos/memorial/gates.mp4'),
    memorialPrompt:
      "Add subtle heavenly gate elements in the background for a spiritual and comforting memorial effect. The gates should be elegant and not dominate the photo."
  },
  {
    id: 'memorial-9',
    titleKey: 'memorial.restInPeace',
    type: 'video',
    video: require('../assets/videos/ripvid.mp4'),
    memorialPrompt:
      "Add elegant 'Rest in Peace' text overlay to the image in a respectful, tasteful font that complements the memorial photo."
  }
];

// VideoView component with visibility-based playback control
const VideoViewWithPlayer = ({ video, index, isVisible = true }: { video: any; index?: number; isVisible?: boolean }) => {
  const videoIndex = index || 0;

  const playbackRate = React.useMemo(() => {
    // Faster playback speeds for better looping
    const rates = [1.1, 1.2, 1.0, 1.3, 1.1, 1.2];
    return rates[videoIndex % rates.length];
  }, [videoIndex]);

  const initialSeek = React.useMemo(() => {
    // Start at different points in the video (0-2 seconds)
    return (videoIndex * 0.3) % 2;
  }, [videoIndex]);

  // Always create player but control playback based on visibility
  const player = useVideoPlayer(video, (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = playbackRate;
      player.currentTime = initialSeek;
      console.log(`🎬 Created memorial video player ${videoIndex}`);
    } catch (error) {
      console.error('AnimatedMemorial video player init error:', error);
    }
  });

  // Control playback based on visibility
  React.useEffect(() => {
    if (!player) return;

    try {
      if (isVisible && !player.playing) {
        player.play();
        console.log(`▶️ Playing memorial video ${videoIndex}`);
      } else if (!isVisible && player.playing) {
        player.pause();
        console.log(`⏸️ Pausing memorial video ${videoIndex}`);
      }
    } catch (error) {
      console.error('Memorial video visibility control error:', error);
    }
  }, [isVisible, player, videoIndex]);

  // Monitor playback status
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Handle app state changes for background/foreground
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && player && !player.playing) {
        try {
          player.play();
        } catch (error) {
          // Ignore resume errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [player]);

  // Handle navigation focus
  useFocusEffect(
    React.useCallback(() => {
      if (player && !player.playing) {
        try {
          player.play();
        } catch (error) {
          // Ignore focus resume errors
        }
      }
    }, [player])
  );

  return (
    <Animated.View
      entering={FadeIn.delay(videoIndex * 100).duration(600)}
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

export function MemorialFeatures({ memorialItems = DEFAULT_MEMORIAL_ITEMS }: { memorialItems?: MemorialItem[] }) {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  const { t } = useTranslation();
  
  // Responsive tile dimensions - optimized for text visibility and mobile/tablet experience
  const tileWidth = isTabletLike ? 105 : (isSmallPhone ? 90 : 105);
  const fontSize = isTabletLike ? 13 : (isSmallPhone ? 11 : 12);
  
  // Track visible tiles based on scroll position
  const [visibleIndices, setVisibleIndices] = React.useState<Set<number>>(new Set([0, 1, 2])); // Initially show first 3
  
  // Handle scroll for performance optimization
  const handleScroll = React.useCallback((event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const viewportWidth = width - 32; // Account for padding
    
    // Calculate which tiles are visible (with some buffer)
    const firstVisibleIndex = Math.max(0, Math.floor((scrollX - 50) / (tileWidth + 10)));
    const lastVisibleIndex = Math.min(
      memorialItems.length - 1,
      Math.ceil((scrollX + viewportWidth + 50) / (tileWidth + 10))
    );
    
    const newVisibleIndices = new Set<number>();
    for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
      newVisibleIndices.add(i);
    }
    
    // Only update if changed (performance)
    if (newVisibleIndices.size !== visibleIndices.size || 
        ![...newVisibleIndices].every(i => visibleIndices.has(i))) {
      setVisibleIndices(newVisibleIndices);
      
      if (__DEV__) {
        console.log('🕊️ Memorial visible tiles:', [...newVisibleIndices]);
      }
    }
  }, [tileWidth, width, visibleIndices, memorialItems.length]);
  
  const router = useRouter();
  const handleMemorialSelect = async (memorialItem: MemorialItem) => {
    // No Pro gating - all memorial features are now free
    const translatedTitle = t(memorialItem.titleKey);
    
    // PROMPT LOGGING: Track which memorial feature is selected
    console.log('🕊️ MEMORIAL FEATURE SELECTED:', {
      id: memorialItem.id,
      title: translatedTitle,
      prompt: memorialItem.memorialPrompt
    });
    
    // Track memorial tile selection
    analyticsService.trackTileUsage({
      category: 'memorial',
      tileName: translatedTitle,
      tileId: memorialItem.id,
      functionType: 'nano_memorial',
      customPrompt: memorialItem.memorialPrompt,
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
        useQuickEditStore.getState().openWithImage({ functionType: 'nano_memorial' as any, imageUri: result.assets[0].uri, styleKey: memorialItem.id, styleName: translatedTitle });
      } catch {
        // fallback: existing flow
        router.push({ pathname: '/text-edits', params: { imageUri: result.assets[0].uri, prompt: memorialItem.memorialPrompt || translatedTitle, mode: 'nano_memorial' } });
      }
    }
  };

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={100} // Throttle to reduce performance impact
      >
        {memorialItems.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: tileWidth, marginRight: index === memorialItems.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleMemorialSelect(item)}
              style={{ 
                width: tileWidth, 
                aspectRatio: 9/16, 
                borderRadius: 16, 
                overflow: 'hidden', 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.08)', 
                backgroundColor: '#000000' 
              }}
            >
              {/* Render video with conditional player creation */}
              {item.type === 'video' && item.video ? (
                <VideoViewWithPlayer
                  video={item.video}
                  index={index}
                  isVisible={visibleIndices.has(index)}
                />
              ) : item.image ? (
                <ExpoImage 
                  source={item.image} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover" 
                  transition={0} 
                />
              ) : (
                // Black background for items without images
                <View style={{ width: '100%', height: '100%', backgroundColor: '#000000' }} />
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