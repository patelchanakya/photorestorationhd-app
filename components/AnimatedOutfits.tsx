// Removed Pro gating - all outfits are now free
import { analyticsService } from '@/services/analytics';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useT } from '@/src/hooks/useTranslation';
import { useFocusEffect } from '@react-navigation/native';
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
  }
];

// VideoView component with smooth desynchronization for visual comfort
const VideoViewWithPlayer = ({ video, index }: { video: any; index?: number }) => {
  // Deterministic values based on index for visual variety
  const videoIndex = index || 0;
  const isMountedRef = useRef(true);
  
  const playbackRate = React.useMemo(() => {
    // Slower playback speeds (0.5x to 0.8x) for gentle, easy-on-eyes movement
    const rates = [0.5, 0.6, 0.7, 0.55, 0.65, 0.75];
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
      // Don't auto-play, wait for effect
    } catch (error) {
      console.error('AnimatedOutfits video player init error:', error);
    }
  });

  // Cleanup video player on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
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

  React.useEffect(() => {
    if (!player) return;
    
    // Stagger start times more dramatically for visual comfort
    const baseDelay = videoIndex * 250; // 250ms between each video
    const randomOffset = Math.random() * 300; // 0-300ms random variation
    const totalDelay = baseDelay + randomOffset;
    
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // Seek to different starting points to break up synchronization
      try {
        if (player.status !== 'idle') {
          player.currentTime = initialSeek;
        }
      } catch (e) {
        // Ignore seek errors on initial load
      }
      
      // Start playing with the varied playback rate
      try {
        if (!player.playing && player.status !== 'idle') {
          player.play();
        }
      } catch (e) {
        // Ignore play errors
      }
    }, totalDelay);
    
    return () => clearTimeout(playTimer);
  }, [player, videoIndex, initialSeek]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isMountedRef.current) {
        // Resume video playback when app returns to foreground
        try {
          if (player && !player.playing && player.status !== 'idle') {
            // Small delay to let the app settle
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
      // Resume playback when screen comes into focus
      try {
        if (player && !player.playing && player.status !== 'idle' && isMountedRef.current) {
          setTimeout(() => {
            if (isMountedRef.current) {
              player.play();
            }
          }, 100 + videoIndex * 50);
        }
      } catch (error) {
        // Ignore focus resume errors
      }
      
      return () => {
        // Optional: pause when leaving screen
        // if (player && player.playing) player.pause();
      };
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
              
              {/* Gradient overlay */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
                start={{ x: 0.5, y: 0.3 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', inset: 0 as any }}
              />
              
              {/* Bottom label - removed PRO badge */}
              <View style={{ position: 'absolute', left: 6, right: 6, bottom: 6, minHeight: 36, justifyContent: 'flex-end' }}>
                <Text 
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.7}
                  style={{ 
                    color: '#FFFFFF', 
                    fontFamily: 'Lexend-SemiBold', 
                    fontSize: fontSize,
                    lineHeight: fontSize * 1.2,
                    textAlign: 'center'
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