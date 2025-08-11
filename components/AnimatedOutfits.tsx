import { presentPaywall } from '@/services/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { AppState, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface OutfitItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  title: string;
  type?: 'video' | 'image';
  outfitPrompt?: string; // The prompt to apply this outfit
}

// Add your outfit transformation videos here
const DEFAULT_OUTFITS: OutfitItem[] = [
  { 
    id: 'outfit-1', 
    title: 'Casual Day', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/casual-day/outfit-0.mp4'), 
    outfitPrompt: "Change the subject's clothing to casual, comfortable wear such as a t-shirt and jeans or a relaxed summer outfit. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure the clothing appears soft, naturally worn, and fits realistically with natural fabric folds and textures." 
  },
  { 
    id: 'outfit-2', 
    title: 'Change Color', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/change-color/colorchange.mp4'), 
    outfitPrompt: "Keep the subject's clothing design, texture, shape, and style exactly the same, but change the color to a random, attractive color that looks natural and flattering. Avoid overly bright or obnoxious colors - choose something stylish and wearable. Make sure the new color appears natural under the existing lighting and shadows. Do not alter the subject's face, hair, background, accessories, or any other aspect of the photo - only change the clothing color." 
  },
  { 
    id: 'outfit-3', 
    title: 'Fix Clothes', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/fix-clothes/niceclothes.mp4'), 
    outfitPrompt: "Clean ALL clothing completely. Remove ALL stains and dirt from shirt, pants, dress, everything. Keep same colors. Keep same style. Only clean, nothing else changes." 
  },
  { 
    id: 'outfit-4', 
    title: 'Wedding Outfit', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/wedding-outfit/outfit-wedding.mp4'), 
    outfitPrompt: "Replace clothing with wedding attire. Preserve exact head position of all subjects, specifically keeping facial features and head positioning the same, along with pose, background, and lighting. Do not alter any other elements of the image." 
  },
  { 
    id: 'outfit-5', 
    title: 'Professional', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/formal-wear/professional.mp4'), 
    outfitPrompt: "Replace ALL of the subject's clothing with a complete professional outfit: a well-tailored black suit with white dress shirt and tie for men, or an elegant professional dress or suit for women. This includes replacing shirts, pants, shorts, dresses, skirts - EVERY piece of clothing. Keep the subject's facial features, hairstyle, pose, lighting, and background exactly the same. Ensure the entire outfit is cohesive, properly fitted, and has natural fabric folds and realistic texture under the existing lighting." 
  },
  { 
    id: 'outfit-6', 
    title: 'Job Interview', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/job-interview/jobinterview.mp4'), 
    outfitPrompt: "Replace the subject's clothing with smart business casual attire suitable for a job interview: a nice blazer with dark jeans or smart trousers, or a professional dress that's approachable and friendly. Use neutral, professional colors that look confident but not intimidating. Keep the subject's face, hairstyle, pose, lighting, and background unchanged. Ensure clothing appears realistic with natural fabric folds and texture." 
  }
];

// VideoView component with smooth desynchronization for visual comfort
const VideoViewWithPlayer = ({ video, index }: { video: any; index?: number }) => {
  // Deterministic values based on index for visual variety
  const videoIndex = index || 0;
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
    player.loop = true;
    player.muted = true;
    player.playbackRate = playbackRate;
    // Don't auto-play, wait for effect
  });

  React.useEffect(() => {
    if (!player) return;
    const baseDelay = videoIndex * 250;
    const randomOffset = Math.random() * 300;
    const totalDelay = baseDelay + randomOffset;
    const playTimer = setTimeout(() => {
      try {
        player.currentTime = initialSeek;
      } catch {}
      try {
        if (!player.playing) {
          player.play();
        }
      } catch {}
    }, totalDelay);
    return () => clearTimeout(playTimer);
  }, [player, videoIndex, initialSeek]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Resume video playback when app returns to foreground
        try {
          if (player && !player.playing) {
            setTimeout(() => {
              try { player.play(); } catch {}
            }, 100 + videoIndex * 50);
          }
        } catch {}
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
        if (player && !player.playing) {
          setTimeout(() => {
            try { player.play(); } catch {}
          }, 100 + videoIndex * 50);
        }
      } catch {}
      
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
  const router = useRouter();
  const isPro = useSubscriptionStore((state) => state.isPro);
  const { width: screenWidth } = useWindowDimensions();
  const spacing = 10;
  const tileWidth = Math.round(Math.min(140, Math.max(110, screenWidth * 0.3)));
  const [visibleSet, setVisibleSet] = React.useState<Set<number>>(new Set());

  const handleOutfitSelect = async (outfit: OutfitItem) => {
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
        console.log('👔 Outfit selected:', outfit.title);
        console.log('📝 Prompt to be used:', outfit.outfitPrompt || outfit.title);
      }
      
      // Navigate to processing with outfit prompt
      router.push({
        pathname: '/text-edits',
        params: {
          imageUri: result.assets[0].uri,
          prompt: outfit.outfitPrompt || outfit.title,
          mode: 'outfit'
        }
      });
    }
  };

  const renderItem = React.useCallback(({ item, index }: { item: OutfitItem; index: number }) => {
    const isVisible = visibleSet.has(index);
    return (
      <Animated.View
        entering={FadeIn.delay(index * 40).duration(250)}
        style={{ width: tileWidth, marginRight: index === outfits.length - 1 ? 0 : spacing }}
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
          {item.type === 'video' && item.video ? (
            isVisible ? (
              <VideoViewWithPlayer video={item.video} index={index} />
            ) : (
              <View style={{ width: '100%', height: '100%', backgroundColor: '#0b0b0f' }} />
            )
          ) : (
            <ExpoImage 
              source={item.image} 
              style={{ width: '100%', height: '100%' }} 
              contentFit="cover" 
              transition={0} 
            />
          )}

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
            start={{ x: 0.5, y: 0.3 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', inset: 0 as any }}
          />

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
    );
  }, [visibleSet, tileWidth, spacing, outfits.length, isPro]);

  const onViewableItemsChanged = React.useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const next = new Set<number>();
    for (const v of viewableItems) {
      if (typeof v.index === 'number') next.add(v.index);
    }
    setVisibleSet(next);
  }).current;

  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 30, minimumViewTime: 0 }).current;

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <FlashList
        horizontal
        data={outfits}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        estimatedItemSize={tileWidth + spacing}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        extraData={visibleSet}
        ItemSeparatorComponent={() => <View style={{ width: spacing }} />}
      />

      <LinearGradient
        colors={['transparent', '#0B0B0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 30, pointerEvents: 'none' }}
      />
    </View>
  );
}