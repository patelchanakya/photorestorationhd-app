import { analyticsService } from '@/services/analytics';
import { useTranslation } from 'react-i18next';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient as OriginalLinearGradient } from 'expo-linear-gradient';

// Debug wrapper to catch empty gradient arrays
const LinearGradient = (props: any) => {
  if (!props.colors || props.colors.length === 0) {
    console.warn('🚨 EMPTY GRADIENT DETECTED in AnimatedBackgrounds:', props);
    return <OriginalLinearGradient {...props} colors={['#000000', '#000000']} />;
  }
  return <OriginalLinearGradient {...props} />;
};
import { useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useVideoPlayer } from 'expo-video';
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

// Background transformation options - ordered by importance (most to least)
const DEFAULT_BACKGROUNDS: BackgroundItem[] = [
  { 
    id: 'background-5', 
    titleKey: 'memorial.cleanBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/cleanbkgd.jpeg'), 
    backgroundPrompt: "Remove the background completely, leaving only the subject on a transparent or clean white background." 
  },
  { 
    id: 'background-6', 
    titleKey: 'backgrounds.blurBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/blurbkgd.jpeg'), 
    backgroundPrompt: "Blur the background to create a professional depth of field effect while keeping the subject in sharp focus." 
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
    id: 'background-8', 
    titleKey: 'popular.officeBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/officebgd.jpeg'), 
    backgroundPrompt: "Replace background with a professional office setting - modern workspace with clean lines." 
  },
  { 
    id: 'background-9', 
    titleKey: 'popular.natureBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/naturebgd.jpeg'), 
    backgroundPrompt: "Replace background with a natural outdoor scene - trees, forest, or park setting." 
  },
  { 
    id: 'popular-10', 
    titleKey: 'popular.gardenBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/garden/garden.jpeg'), 
    backgroundPrompt: "Replace background with a garden scene - greenery and foliage in natural daylight." 
  },
  { 
    id: 'background-7', 
    titleKey: 'popular.beachBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/beachbgd.jpeg'), 
    backgroundPrompt: "Replace background with a beautiful beach scene - ocean waves, sand, and clear blue sky." 
  },
  { 
    id: 'background-11', 
    titleKey: 'popular.sunsetBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/sunsetbgd.jpeg'), 
    backgroundPrompt: "Replace background with a beautiful sunset scene - warm colors and dramatic sky." 
  },
  { 
    id: 'popular-13', 
    titleKey: 'popular.heavenlyBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg'), 
    backgroundPrompt: "Replace background with a bright heavenly sky of soft white clouds and gentle sunbeams." 
  },
  { 
    id: 'background-10', 
    titleKey: 'popular.cityBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/citybgd.jpeg'), 
    backgroundPrompt: "Replace background with an urban cityscape - buildings, streets, and city atmosphere." 
  },
  { 
    id: 'background-13', 
    titleKey: 'popular.vintageBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/vintagebgd.jpeg'), 
    backgroundPrompt: "Replace background with a vintage or retro setting - aged, nostalgic atmosphere." 
  },
  { 
    id: 'background-12', 
    titleKey: 'popular.winterBackground', 
    type: 'image', 
    image: require('../assets/images/backgrounds/winterbgd.jpeg'), 
    backgroundPrompt: "Replace background with a winter scene - snow, ice, and cold weather atmosphere." 
  },
];

// Video content component - only rendered when player exists
const VideoContent = ({ player, videoIndex, isVisible }: { player: any; videoIndex: number; isVisible: boolean }) => {
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

  // Monitor playback status with expo's useEvent hook - player is ALWAYS valid here
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing || false });

  // Visibility-based pause/play - MAIN performance optimization
  React.useEffect(() => {
    if (!isMountedRef.current) return;
    
    try {
      if (!isVisible && player && player.playing) {
        // Pause when scrolled out of view
        player.pause();
        shouldBePlayingRef.current = false;
        if (__DEV__) console.log(`⏸️ Paused background video ${videoIndex} (scrolled away)`);
      } else if (isVisible && player && !player.playing && shouldBePlayingRef.current) {
        // Resume when scrolled back into view
        player.play();
        if (__DEV__) console.log(`▶️ Resumed background video ${videoIndex} (scrolled back)`);
      }
    } catch (error) {
      // Ignore visibility errors
    }
  }, [isVisible, player, videoIndex]);

  // Auto-recovery: restart video if it should be playing but isn't (with debounce)
  React.useEffect(() => {
    if (!isPlaying && shouldBePlayingRef.current && isMountedRef.current && isVisible) {
      const recoveryTimeout = setTimeout(() => {
        try {
          if (player && player.status !== 'idle' && isMountedRef.current) {
            player.play();
          }
        } catch (error) {
          // Ignore recovery errors - player may be released
        }
      }, 100);
      
      return () => clearTimeout(recoveryTimeout);
    }
  }, [isPlaying, player, isVisible]);

  // Cleanup video player on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      
      try {
        if (player && typeof player.status !== 'undefined') {
          const status = player.status;
          if (status !== 'idle') {
            player.pause();
          }
          player.release();
        }
      } catch (error) {
        if (__DEV__) {
          console.log('AnimatedBackgrounds video cleanup handled');
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

// Wrapper component that only renders VideoContent when player exists
const VideoViewWithPlayer = ({ video, index, isVisible }: { video: any; index?: number; isVisible?: boolean }) => {
  const videoIndex = index || 0;
  const player = useVideoPlayer(video, (player: any) => {
    player.loop = true;
    player.muted = true;
  }); // No artificial limit - viewport handles it

  if (!player) {
    // Show placeholder when video player limit is reached
    return (
      <Animated.View 
        entering={FadeIn.delay(videoIndex * 100).duration(800)}
        style={{ 
          width: '100%', 
          height: '100%', 
          backgroundColor: '#1a1a1a',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Text style={{ color: '#666', fontSize: 11 }}>Video Loading...</Text>
      </Animated.View>
    );
  }

  // Only render VideoContent when player exists - useEvent will always have valid player
  return <VideoContent player={player} videoIndex={videoIndex} isVisible={isVisible ?? true} />;
};

interface AnimatedBackgroundsProps {
  backgrounds?: BackgroundItem[];
  firstTileRef?: React.RefObject<View | null>;
}

export const AnimatedBackgrounds = React.forwardRef<View, AnimatedBackgroundsProps>(({ backgrounds = DEFAULT_BACKGROUNDS, firstTileRef }, ref) => {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  const { t } = useTranslation();
  
  // Responsive tile dimensions - optimized for text visibility and mobile/tablet experience
  const tileWidth = isTabletLike ? 105 : (isSmallPhone ? 90 : 105);
  const fontSize = isTabletLike ? 13 : (isSmallPhone ? 11 : 12);
  
  // Track visible tiles based on scroll position (mostly images, only a few videos)
  const [visibleIndices, setVisibleIndices] = React.useState<Set<number>>(new Set([0, 1, 2])); // Initially show first 3
  
  const handleScroll = React.useCallback((event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const viewportWidth = width - 32; // Account for padding
    
    // Calculate which tiles are visible (with some buffer)
    const firstVisibleIndex = Math.max(0, Math.floor((scrollX - 50) / (tileWidth + 10))); 
    const lastVisibleIndex = Math.min(
      backgrounds.length - 1, 
      Math.ceil((scrollX + viewportWidth + 50) / (tileWidth + 10))
    );
    
    const newVisibleIndices = new Set<number>();
    for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
      newVisibleIndices.add(i);
    }
    
    // Only update if changed to prevent unnecessary re-renders
    if (newVisibleIndices.size !== visibleIndices.size || 
        ![...newVisibleIndices].every(i => visibleIndices.has(i))) {
      setVisibleIndices(newVisibleIndices);
      
      if (__DEV__) {
        console.log('🖼️ Backgrounds visible tiles:', [...newVisibleIndices]);
      }
    }
  }, [tileWidth, width, visibleIndices, backgrounds.length]);
  
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
          functionType: 'nano_background', 
          imageUri: result.assets[0].uri, 
          styleName: translatedTitle, 
          styleKey: background.id
        });
      } catch {
        // fallback: existing flow
        router.push({ 
          pathname: '/text-edits', 
          params: { 
            imageUri: result.assets[0].uri, 
            style_key: background.id,
            mode: 'nano_background' 
          } 
        });
      }
    }
  };

  return (
    <View ref={ref} style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={100} // Throttle to reduce performance impact
      >
        {backgrounds.map((item, index) => {
          const isVisible = visibleIndices.has(index);
          return (
            <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: tileWidth, marginRight: index === backgrounds.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              ref={index === 0 ? firstTileRef : undefined}
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
              {/* Render video only when visible (backgrounds are mostly images anyway) */}
              {item.type === 'video' && item.video && isVisible ? (
                <VideoViewWithPlayer video={item.video} index={index} isVisible={isVisible} />
              ) : item.type === 'video' && item.video && !isVisible ? (
                // Show static placeholder when not visible
                <View style={{ 
                  width: '100%', 
                  height: '100%', 
                  backgroundColor: '#1a1a1a',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <Text style={{ color: '#666', fontSize: 24 }}>🖼️</Text>
                </View>
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
          );
        })}
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
});