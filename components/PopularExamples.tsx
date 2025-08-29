// Removed Pro gating - all popular examples are now free
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

interface PopularItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  title: string;
  type?: 'video' | 'image';
  prompt?: string; // The prompt to apply
}

// Popular photo restoration and editing requests
const DEFAULT_POPULAR_ITEMS: PopularItem[] = [
  { 
    id: 'popular-1', 
    title: 'Clear Skin', 
    type: 'video', 
    video: require('../assets/videos/popular/clear-skin.mp4'), 
    prompt: "Remove acne, blemishes, and skin imperfections while keeping natural skin texture, tone, and lighting unchanged." 
  },
  { 
    id: 'popular-2', 
    title: 'Add Halo', 
    type: 'video', 
    video: require('../assets/videos/popular/halo.mp4'), 
    prompt: "Add a subtle glowing halo above the subject's head." 
  },
  { 
    id: 'popular-3', 
    title: 'Fix Hair', 
    type: 'video', 
    video: require('../assets/videos/popular/fix-hair.mp4'), 
    prompt: "Clean up messy or stray hairs while preserving natural hair texture, style, volume, and keeping hair in place without altering its position on the face." 
  },
  { 
    id: 'popular-4', 
    title: 'Slimmer', 
    type: 'video', 
    video: require('../assets/videos/popular/slimmer.mp4'), 
    prompt: "Reduce visible body and facial fat while keeping natural proportions, pose, and facial identity intact. Make changes realistic and balanced without distorting the subject." 
  },
  { 
    id: 'popular-5', 
    title: 'Angel Wings', 
    type: 'video', 
    video: require('../assets/videos/popular/angel.mp4'), 
    prompt: "Add realistic wings that match pose, background, and lighting." 
  },
  { 
    id: 'popular-6', 
    title: 'Younger', 
    type: 'video', 
    video: require('../assets/videos/popular/younger.mp4'), 
    prompt: "Make the subject look a bit younger while keeping their identity, facial features, and natural expression unchanged." 
  },
  { 
    id: 'popular-7', 
    title: 'Older', 
    type: 'video', 
    video: require('../assets/videos/popular/older.mp4'), 
    prompt: "Make the subject appear slightly older in a natural, age-appropriate way. Preserve facial identity, proportions, and realistic features, adjusting age subtly without exaggeration." 
  },
  { 
    id: 'popular-8', 
    title: 'Add Smile', 
    type: 'video', 
    video: require('../assets/videos/popular/smile.mp4'), 
    prompt: "Add a natural, authentic smile while preserving facial identity and features." 
  }
];

// VideoView component with smooth desynchronization for visual comfort
const VideoViewWithPlayer = ({ video, index }: { video: any; index?: number }) => {
  // Deterministic values based on index for visual variety
  const videoIndex = index || 0;
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
    player.loop = true;
    player.muted = true;
    player.playbackRate = playbackRate;
    // Don't auto-play, wait for effect
  });

  React.useEffect(() => {
    if (!player) return;
    
    // Stagger start times more dramatically for visual comfort
    const baseDelay = videoIndex * 250; // 250ms between each video
    const randomOffset = Math.random() * 300; // 0-300ms random variation
    const totalDelay = baseDelay + randomOffset;
    
    const playTimer = setTimeout(() => {
      // Seek to different starting points to break up synchronization
      try {
        player.currentTime = initialSeek;
      } catch (e) {
        // Ignore seek errors on initial load
      }
      
      // Start playing with the varied playback rate
      if (!player.playing) {
        player.play();
      }
    }, totalDelay);
    
    return () => clearTimeout(playTimer);
  }, [player, videoIndex, initialSeek]);

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Resume video playback when app returns to foreground
        if (player && !player.playing) {
          // Small delay to let the app settle
          setTimeout(() => {
            player.play();
          }, 100 + videoIndex * 50);
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
      if (player && !player.playing) {
        setTimeout(() => {
          player.play();
        }, 100 + videoIndex * 50);
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

export function PopularExamples({ items = DEFAULT_POPULAR_ITEMS }: { items?: PopularItem[] }) {
  const router = useRouter();
  const handlePopularSelect = async (item: PopularItem) => {
    // No Pro gating - all popular examples are now free
    
    // Launch image picker then open text-edits with custom prompt
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      router.push({ pathname: '/text-edits', params: { imageUri: result.assets[0].uri, prompt: item.prompt || item.title, mode: 'custom' } });
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
            style={{ width: 120, marginRight: index === items.length - 1 ? 0 : 10 }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePopularSelect(item)}
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