// Removed Pro gating - all outfits are now free
import { analyticsService } from '@/services/analytics';
import { useTranslation } from 'react-i18next';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useVideoPlayer } from 'expo-video';
import React, { useRef, useState } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface OutfitItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  outfitPrompt?: string; // The prompt to apply this outfit
}

// Add your outfit transformation videos here
const DEFAULT_OUTFITS: OutfitItem[] = [
  { 
    id: 'outfit-1', 
    titleKey: 'outfits.fixClothes', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/fix-clothes/niceclothes.mp4'), 
    outfitPrompt: "Clean ALL clothing completely. Remove ALL stains and dirt from shirt, pants, dress, everything. Keep same colors. Keep same style. Only clean, nothing else changes." 
  },
  { 
    id: 'outfit-2', 
    titleKey: 'outfits.changeColor', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/change-color/colorchange.mp4'), 
    outfitPrompt: "Keep the subject's clothing design, texture, shape, and style exactly the same, but change the color to a random, attractive color that looks natural and flattering. Avoid overly bright or obnoxious colors - choose something stylish and wearable. Make sure the new color appears natural under the existing lighting and shadows. Do not alter the subject's face, hair, background, accessories, or any other aspect of the photo - only change the clothing color." 
  },
  { 
    id: 'outfit-3', 
    titleKey: 'outfits.casualDay', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/casual-day/outfit-0.mp4'), 
    outfitPrompt: "Change the subject's clothing to casual, comfortable wear such as a t-shirt and jeans or a relaxed summer outfit. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure the clothing appears soft, naturally worn, and fits realistically with natural fabric folds and textures." 
  },
  { 
    id: 'outfit-4', 
    titleKey: 'outfits.weddingOutfit', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/wedding-outfit/outfit-wedding.mp4'), 
    outfitPrompt: "Replace clothing with wedding attire. Preserve exact head position of all subjects, specifically keeping facial features and head positioning the same, along with pose, background, and lighting. Do not alter any other elements of the image." 
  },
  { 
    id: 'outfit-5', 
    titleKey: 'outfits.professional', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/formal-wear/professional.mp4'), 
    outfitPrompt: "Replace ALL of the subject's clothing with a complete professional outfit: a well-tailored black suit with white dress shirt and tie for men, or an elegant professional dress or suit for women. This includes replacing shirts, pants, shorts, dresses, skirts - EVERY piece of clothing. Keep the subject's facial features, hairstyle, pose, lighting, and background exactly the same. Ensure the entire outfit is cohesive, properly fitted, and has natural fabric folds and realistic texture under the existing lighting." 
  },
  { 
    id: 'outfit-6', 
    titleKey: 'outfits.jobInterview', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/job-interview/jobinterview.mp4'), 
    outfitPrompt: "Replace the subject's clothing with smart business casual attire suitable for a job interview: a nice blazer with dark jeans or smart trousers, or a professional dress that's approachable and friendly. Use neutral, professional colors that look confident but not intimidating. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure clothing appears realistic with natural fabric folds and texture." 
  },
  { 
    id: 'outfit-7', 
    titleKey: 'outfits.makeDoctor', 
    type: 'video', 
    video: require('../assets/videos/doctor.mp4'), 
    outfitPrompt: "Replace the subject's clothing with professional medical attire: a white doctor's coat over professional clothing, or medical scrubs. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure the medical attire looks professional and realistic." 
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
        if (__DEV__) console.log(`⏸️ Paused outfit video ${videoIndex} (scrolled away)`);
      } else if (isVisible && player && !player.playing && shouldBePlayingRef.current) {
        // Resume when scrolled back into view
        player.play();
        if (__DEV__) console.log(`▶️ Resumed outfit video ${videoIndex} (scrolled back)`);
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
      }
    };
  }, []);

  // Initial playback setup (only when player exists)
  React.useEffect(() => {
    if (!player) return;
    
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current || !player) return;
      
      try {
        if (player.status !== 'idle') {
          player.currentTime = initialSeek;
          player.play();
          shouldBePlayingRef.current = true;
        }
      } catch (e) {
        // Ignore initial play errors
      }
    }, videoIndex * 150);
    
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

// VideoView component with lazy loading and performance optimization
const VideoViewWithPlayer = ({ video, index, isVisible }: { video: any; index?: number; isVisible?: boolean }) => {
  const { t } = useTranslation();
  const videoIndex = index || 0;

  const player = useVideoPlayer(video, (player: any) => {
    player.loop = true;
    player.muted = true;
  }); // No artificial limit - viewport handles it

  if (!player) {
    return (
      <Animated.View 
        entering={FadeIn.delay(videoIndex * 100).duration(800)}
        style={{ width: '100%', height: '100%' }}
      >
        <View style={{ 
          width: '100%', 
          height: '100%', 
          backgroundColor: '#1a1a1a',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Text style={{ color: '#666', fontSize: 12 }}>{t('common.loading')}</Text>
        </View>
      </Animated.View>
    );
  }

  // Only render VideoContent when player exists - useEvent will always have valid player
  return <VideoContent player={player} videoIndex={videoIndex} isVisible={isVisible ?? true} />;
};

export function AnimatedOutfits({ outfits = DEFAULT_OUTFITS }: { outfits?: OutfitItem[] }) {
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
  
  const handleScroll = React.useCallback((event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const viewportWidth = width - 32; // Account for padding
    
    // Calculate which tiles are visible (with some buffer)
    const firstVisibleIndex = Math.max(0, Math.floor((scrollX - 50) / (tileWidth + 10))); 
    const lastVisibleIndex = Math.min(
      outfits.length - 1, 
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
        console.log('🎨 Outfits visible tiles:', [...newVisibleIndices]);
      }
    }
  }, [tileWidth, width, visibleIndices, outfits.length]);
  
  const router = useRouter();
  const handleOutfitSelect = async (outfit: OutfitItem) => {
    // No Pro gating - all outfits are now free
    const translatedTitle = t(outfit.titleKey);
    
    // PROMPT LOGGING: Track which outfit style is selected
    console.log('🎨 OUTFIT STYLE SELECTED:', {
      id: outfit.id,
      title: translatedTitle,
      prompt: outfit.outfitPrompt
    });
    
    // Track outfit tile selection
    analyticsService.trackTileUsage({
      category: 'outfit',
      tileName: translatedTitle,
      tileId: outfit.id,
      functionType: 'outfit',
      customPrompt: outfit.outfitPrompt,
      stage: 'selected'
    });
    
    // Launch image picker then open Quick Edit sheet in outfit mode
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
        useQuickEditStore.getState().openWithImage({ functionType: 'outfit' as any, imageUri: result.assets[0].uri, styleName: translatedTitle, customPrompt: outfit.outfitPrompt || translatedTitle });
      } catch {
        // fallback: existing flow
        router.push({ pathname: '/text-edits', params: { imageUri: result.assets[0].uri, prompt: outfit.outfitPrompt || translatedTitle, mode: 'outfit' } });
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
        {outfits.map((item, index) => {
          const isVisible = visibleIndices.has(index);
          return (
            <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: tileWidth, marginRight: index === outfits.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleOutfitSelect(item)}
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
              {/* Render video only when visible, otherwise show placeholder */}
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
                  <Text style={{ color: '#666', fontSize: 24 }}>👔</Text>
                </View>
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
}