// Removed Pro gating - all outfits are now free
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
    titleKey: 'Make Doctor', 
    type: 'video', 
    // video: require('../assets/videos/magic/outfits/thumbnail/doctor/doctor.mp4'), 
    outfitPrompt: "Replace the subject's clothing with professional medical attire: a white doctor's coat over professional clothing, or medical scrubs. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure the medical attire looks professional and realistic." 
  },
  { 
    id: 'outfit-8', 
    titleKey: 'Make Business CEO', 
    type: 'video', 
    // video: require('../assets/videos/magic/outfits/thumbnail/ceo/ceo.mp4'), 
    outfitPrompt: "Replace the subject's clothing with high-end executive business attire: an expensive, well-tailored suit, luxury dress shirt, premium tie, and polished appearance fitting a CEO or top executive. Keep the subject's face, hairstyle, pose, lighting, and background unchanged." 
  },
  { 
    id: 'outfit-9', 
    titleKey: 'Make Soccer Player', 
    type: 'video', 
    // video: require('../assets/videos/magic/outfits/thumbnail/soccer/soccer.mp4'), 
    outfitPrompt: "Replace the subject's clothing with professional soccer uniform: team jersey, shorts, and soccer cleats. Choose a popular team's colors and design. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Make the uniform look authentic and professional." 
  },
  { 
    id: 'outfit-10', 
    titleKey: 'Make Football Player', 
    type: 'video', 
    // video: require('../assets/videos/magic/outfits/thumbnail/football/football.mp4'), 
    outfitPrompt: "Replace the subject's clothing with American football uniform: team jersey with shoulder pads, football pants, and cleats. Choose professional team colors. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Make the uniform look authentic and professional." 
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
      console.error('AnimatedOutfits video player init error:', error);
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
          console.log('AnimatedOutfits video cleanup handled');
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

export function AnimatedOutfits({ outfits = DEFAULT_OUTFITS }: { outfits?: OutfitItem[] }) {
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
        // Removed extraData as Pro gating is removed
      >
        {outfits.map((item, index) => (
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