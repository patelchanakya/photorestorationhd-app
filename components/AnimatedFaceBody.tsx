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

interface FaceBodyItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  customPrompt: string; // The AI prompt for this transformation
  emoji: string; // Emoji for the feature
}

// Face/Body transformation options - ordered by virality (most to least important)
const DEFAULT_FACEBODY: FaceBodyItem[] = [
  { 
    id: 'popular-5', 
    titleKey: 'popular.clearSkin', 
    type: 'video', 
    video: require('../assets/videos/popular/clear-skin.mp4'), 
    emoji: '✨',
    customPrompt: "Remove acne, blemishes, and skin imperfections while keeping natural skin texture, tone, and lighting unchanged." 
  },
  { 
    id: 'popular-1', 
    titleKey: 'popular.addSmile', 
    type: 'video', 
    video: require('../assets/videos/popular/smile.mp4'), 
    emoji: '😊',
    customPrompt: "Add a natural, authentic smile while preserving facial identity and features." 
  },
  { 
    id: 'popular-4', 
    titleKey: 'popular.slimmer', 
    type: 'video', 
    video: require('../assets/videos/popular/slimmer.mp4'), 
    emoji: '💪',
    customPrompt: "Reduce visible body and facial fat while keeping natural proportions, pose, and facial identity intact. Make changes realistic and balanced without distorting the subject." 
  },
  {
    id: 'facebody-new-2',
    titleKey: 'faceBody.teethWhitening',
    type: 'video',
    video: require('../assets/videos/whitening.mp4'),
    emoji: '🦷',
    customPrompt: "Whiten and brighten teeth naturally"
  },
  { 
    id: 'popular-6', 
    titleKey: 'popular.fixHair', 
    type: 'video', 
    video: require('../assets/videos/popular/fix-hair.mp4'), 
    emoji: '💇',
    customPrompt: "Clean up messy or stray hairs while preserving natural hair texture, style, volume, and keeping hair in place without altering its position on the face." 
  },
  { 
    id: 'popular-2', 
    titleKey: 'faceBody.fixClosedEyes', 
    type: 'video', 
    video: require('../assets/videos/popular/open-eyes.mp4'), 
    emoji: '👁️',
    customPrompt: "open my eyes" 
  },
  {
    id: 'facebody-new-3',
    titleKey: 'faceBody.removeWrinkles',
    type: 'video',
    video: require('../assets/videos/wrinkles.mp4'),
    emoji: '✨',
    customPrompt: "Smooth facial lines and wrinkles while maintaining natural appearance"
  },
  { 
    id: 'popular-8', 
    titleKey: 'popular.younger', 
    type: 'video', 
    video: require('../assets/videos/popular/younger.mp4'), 
    emoji: '⏰',
    customPrompt: "Make the subject look a bit younger while keeping their identity, facial features, and natural expression unchanged." 
  },
  {
    id: 'facebody-new-1',
    titleKey: 'faceBody.removeRedEye',
    type: 'video',
    video: require('../assets/videos/redeyes.mp4'),
    emoji: '👁️',
    customPrompt: "Remove red-eye effect from flash photography"
  },
  { 
    id: 'popular-9', 
    titleKey: 'popular.older', 
    type: 'video', 
    video: require('../assets/videos/popular/older.mp4'), 
    emoji: '👴',
    customPrompt: "Make the subject appear slightly older in a natural, age-appropriate way. Preserve facial identity, proportions, and realistic features, adjusting age subtly without exaggeration." 
  }
];

// VideoView component with simple visibility-based playback control
const VideoViewWithPlayer = ({ video, index, isVisible }: { video: any; index?: number; isVisible?: boolean }) => {
  const videoIndex = index || 0;

  const playbackRate = React.useMemo(() => {
    // Faster playback speeds for better looping
    const rates = [1.1, 1.0, 1.2, 1.1, 1.3, 1.2];
    return rates[videoIndex % rates.length];
  }, [videoIndex]);

  const initialSeek = React.useMemo(() => {
    // Start at different points in the video (0-2 seconds)
    return (videoIndex * 0.3) % 2;
  }, [videoIndex]);

  // Always create player but control playback based on visibility
  const player = useVideoPlayer(video, (player: any) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = playbackRate;
      player.currentTime = initialSeek;
      console.log(`🎬 Created facebody video player ${videoIndex}`);
    } catch (error) {
      console.error('AnimatedFaceBody video player init error:', error);
    }
  });

  // Control playback based on visibility
  React.useEffect(() => {
    if (!player) return;

    try {
      if (isVisible && !player.playing) {
        player.play();
        console.log(`▶️ Playing facebody video ${videoIndex}`);
      } else if (!isVisible && player.playing) {
        player.pause();
        console.log(`⏸️ Pausing facebody video ${videoIndex}`);
      }
    } catch (error) {
      console.error('FaceBody video visibility control error:', error);
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

// Individual tile component - with viewport-based video loading
const FaceBodyTile = React.memo(({ item, index, tileWidth, fontSize, isVisible }: { item: FaceBodyItem; index: number; tileWidth: number; fontSize: number; isVisible: boolean }) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const router = useRouter();
  
  const translatedTitle = React.useMemo(() => t(item.titleKey), [item.titleKey, t, currentLanguage]);

  const handlePress = async () => {
    // Track tile selection
    analyticsService.trackTileUsage({
      category: 'popular',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: 'custom',
      stage: 'selected'
    });

    // Open native picker first
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
          functionType: 'custom', 
          imageUri: result.assets[0].uri,
          styleName: translatedTitle,
          customPrompt: item.customPrompt
        });
      } catch (error) {
        console.error('Error opening Quick Edit:', error);
      }
    }
  };

  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(800)}
      style={{ width: tileWidth, marginRight: index === DEFAULT_FACEBODY.length - 1 ? 0 : 10 }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
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
            <Text style={{ color: '#666', fontSize: 24 }}>{item.emoji}</Text>
          </View>
        ) : item.image ? (
          <ExpoImage 
            source={item.image} 
            style={{ width: '100%', height: '100%' }} 
            contentFit="cover" 
            transition={0} 
          />
        ) : (
          // Fallback placeholder
          <View style={{ 
            width: '100%', 
            height: '100%', 
            backgroundColor: '#1a1a1a',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
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
            {translatedTitle}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

FaceBodyTile.displayName = 'FaceBodyTile';

// Main component - with viewport-based video loading
export function AnimatedFaceBody() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  
  // Responsive tile dimensions - same as Backgrounds
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
      DEFAULT_FACEBODY.length - 1, 
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
        console.log('🎭 FaceBody visible tiles:', [...newVisibleIndices]);
      }
    }
  }, [tileWidth, width, visibleIndices]);
  
  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={100} // Throttle to reduce performance impact
      >
        {DEFAULT_FACEBODY.map((item, index) => (
          <FaceBodyTile 
            key={item.id} 
            item={item} 
            index={index} 
            tileWidth={tileWidth}
            fontSize={fontSize}
            isVisible={visibleIndices.has(index)}
          />
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
          width: 32,
          zIndex: 1,
          pointerEvents: 'none'
        }}
      />
    </View>
  );
}