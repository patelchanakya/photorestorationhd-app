// Memorial-focused features for passed loved ones and remembrance photos
import { analyticsService } from '@/services/analytics';
import { useQuickEditStore } from '@/store/quickEditStore';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useRef } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface MemorialItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  title: string;
  type?: 'video' | 'image';
  memorialPrompt?: string; // The prompt to apply this memorial effect
}

// Memorial features specifically designed for passed loved ones and remembrance photos
const DEFAULT_MEMORIAL_ITEMS: MemorialItem[] = [
  {
    id: 'memorial-1',
    title: 'Light Rays',
    type: 'video',
    video: require('../assets/videos/memorial/light.mp4'),
    memorialPrompt:
      "Add divine light rays shining down from above, creating a heavenly and spiritual atmosphere perfect for memorial photos. The rays should emanate from above and create a peaceful, uplifting effect."
  },
  {
    id: 'memorial-2',
    title: 'Dove of Peace',
    type: 'video',
    video: require('../assets/videos/memorial/dove.mp4'),
    memorialPrompt:
      "Add a white dove symbolizing peace, hope, and the Holy Spirit. Position it gracefully in the background or near the subject, perfect for memorial and remembrance photos."
  },
  {
    id: 'memorial-3',
    title: 'Ethereal Glow',
    type: 'video',
    video: require('../assets/videos/memorial/glow.mp4'),
    memorialPrompt:
      "Add a soft, ethereal glow around the subject creating a peaceful and spiritual memorial atmosphere. The glow should be gentle and respectful, not overwhelming."
  },
  {
    id: 'memorial-4',
    title: 'Heaven Gates',
    type: 'video',
    video: require('../assets/videos/memorial/gates.mp4'),
    memorialPrompt:
      "Add subtle heavenly gate elements in the background for a spiritual and comforting memorial effect. The gates should be elegant and not dominate the photo."
  },
  {
    id: 'memorial-5',
    title: 'Memorial Flowers',
    type: 'video',
    video: require('../assets/videos/memorial/flowers.mp4'),
    memorialPrompt:
      "Add beautiful memorial flowers like lilies, roses, or white flowers around the photo border or background, symbolizing love, remembrance, and peace."
  },
  {
    id: 'memorial-6',
    title: 'Clean Background',
    type: 'video',
    video: require('../assets/videos/memorial/remback.mp4'),
    memorialPrompt:
      "Remove or clean up the background for a clean, professional memorial display that focuses attention on your loved one. Perfect for memorial services and displays."
  }
];

// VideoView component with player hook - optimized for performance
const VideoViewWithPlayer = ({ video, index }: { video: any; index?: number }) => {
  // Deterministic values based on index for visual variety
  const videoIndex = index || 0;
  const isMountedRef = useRef(true);
  
  const playbackRate = React.useMemo(() => {
    // Normal playback speeds
    const rates = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
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
      // Don't auto-play, wait for explicit play call
    } catch (error) {
      console.error('AnimatedBackgrounds video player init error:', error);
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
          console.log('AnimatedBackgrounds video cleanup handled');
        }
      }
    };
  }, []);

  // Start playback with staggered timing and seek to initial position
  React.useEffect(() => {
    if (!player) return;
    
    let playTimer: any;
    
    // Seek to initial position then start playing
    playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (player.status !== 'idle') {
          player.currentTime = initialSeek;
          player.play();
        }
      } catch (error) {
        // Ignore playback errors
      }
    }, videoIndex * 150); // Staggered start for visual variety
    
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
            }, 100 + videoIndex * 50); // Staggered resume
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
    }, [player, videoIndex])
  );

  return (
    <Animated.View entering={FadeIn.delay(videoIndex * 100).duration(600)} style={{ width: '100%', height: '100%' }}>
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
  const router = useRouter();
  const handleMemorialSelect = async (memorialItem: MemorialItem) => {
    // No Pro gating - all memorial features are now free
    
    // PROMPT LOGGING: Track which memorial feature is selected
    console.log('🕊️ MEMORIAL FEATURE SELECTED:', {
      id: memorialItem.id,
      title: memorialItem.title,
      prompt: memorialItem.memorialPrompt
    });
    
    // Track memorial tile selection
    analyticsService.trackTileUsage({
      category: 'memorial',
      tileName: memorialItem.title,
      tileId: memorialItem.id,
      functionType: 'memorial',
      customPrompt: memorialItem.memorialPrompt,
      stage: 'selected'
    });
    
    // Launch image picker then open Quick Edit sheet in background mode
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      try {
        useQuickEditStore.getState().openWithImage({ functionType: 'memorial' as any, imageUri: result.assets[0].uri, styleKey: memorialItem.id, styleName: memorialItem.title, customPrompt: memorialItem.memorialPrompt || memorialItem.title });
      } catch {
        // fallback: existing flow
        router.push({ pathname: '/text-edits', params: { imageUri: result.assets[0].uri, prompt: memorialItem.memorialPrompt || memorialItem.title, mode: 'memorial' } });
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
        {memorialItems.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.delay(index * 100).duration(800)}
            style={{ width: 120, marginRight: index === memorialItems.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleMemorialSelect(item)}
              style={{ 
                width: 120, 
                aspectRatio: 9/16, 
                borderRadius: 16, 
                overflow: 'hidden', 
                borderWidth: 1, 
                borderColor: 'rgba(255,255,255,0.08)', 
                backgroundColor: '#000000' 
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
                // Black background for items without images
                <View style={{ width: '100%', height: '100%', backgroundColor: '#000000' }} />
              )}
              
              {/* Gradient overlay */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
                start={{ x: 0.5, y: 0.3 }}
                end={{ x: 0.5, y: 1 }}
                style={{ position: 'absolute', inset: 0 as any }}
              />
              
              {/* Bottom label */}
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