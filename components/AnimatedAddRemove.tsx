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

interface AddRemoveItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  customPrompt: string; // The AI prompt for this transformation
  emoji: string; // Emoji for the feature
}

// Add/Remove transformation options
const DEFAULT_ADDREMOVE: AddRemoveItem[] = [
  { 
    id: 'addremove-1', 
    titleKey: 'addRemove.removePerson.title', 
    type: 'image',
    emoji: '🚫',
    customPrompt: "Remove the person I select from the photo while naturally filling in the background. Make it look like they were never there." 
  },
  { 
    id: 'addremove-2', 
    titleKey: 'addRemove.removeObjects.title', 
    type: 'image',
    emoji: '🗑️',
    customPrompt: "Remove the object I select from the photo and fill the area naturally. Clean up the scene completely." 
  },
  { 
    id: 'addremove-3', 
    titleKey: 'addRemove.removeText.title', 
    type: 'image',
    emoji: '📝',
    customPrompt: "Remove all text, signs, watermarks, logos, and writing from the photo while keeping everything else intact." 
  },
  { 
    id: 'addremove-4', 
    titleKey: 'addRemove.removeWires.title', 
    type: 'image',
    emoji: '⚡',
    customPrompt: "Remove all power lines, cables, wires, and overhead lines from the photo while keeping the scene natural." 
  },
  { 
    id: 'addremove-5', 
    titleKey: 'addRemove.addPerson.title', 
    type: 'image',
    emoji: '👤',
    customPrompt: "Add a person to this photo in a natural way that matches the lighting and perspective of the scene." 
  },
  { 
    id: 'addremove-6', 
    titleKey: 'addRemove.addObjects.title', 
    type: 'image',
    emoji: '➕',
    customPrompt: "Add objects to the photo naturally. The objects should fit the scene's lighting, perspective, and style." 
  },
  { 
    id: 'addremove-7', 
    titleKey: 'addRemove.cloneDuplicate.title', 
    type: 'image',
    emoji: '👥',
    customPrompt: "Duplicate the selected person or object in the photo, placing them naturally in the scene with proper lighting and shadows." 
  },
  { 
    id: 'addremove-8', 
    titleKey: 'addRemove.removeBackground.title', 
    type: 'image',
    emoji: '🏠',
    customPrompt: "Remove distracting elements from the background while keeping the main subject in focus and the scene natural." 
  }
];

// VideoView component with reliable playback recovery - same as other sections
const VideoViewWithPlayer = ({ video, index }: { video: any; index?: number }) => {
  const videoIndex = index || 0;
  const isMountedRef = useRef(true);
  const shouldBePlayingRef = useRef(false);
  
  const playbackRate = React.useMemo(() => {
    const rates = [1.1, 1.0, 1.2, 1.1, 1.3, 1.2];
    return rates[videoIndex % rates.length];
  }, [videoIndex]);
  
  const initialSeek = React.useMemo(() => {
    return (videoIndex * 0.3) % 2;
  }, [videoIndex]);
  
  const player = useVideoPlayer(video, (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = playbackRate;
    } catch (error) {
      console.error('AnimatedAddRemove video player init error:', error);
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  
  // Initial play effect
  React.useEffect(() => {
    if (!isMountedRef.current) return;
    
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
    }, videoIndex * 100);
    
    return () => clearTimeout(playTimer);
  }, [player, videoIndex, initialSeek]);

  // Handle app state changes
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

  // Handle navigation focus
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
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
};

// Individual tile component - smaller style like Backgrounds
const AddRemoveTile = React.memo(({ item, index, tileWidth, fontSize }: { item: AddRemoveItem; index: number; tileWidth: number; fontSize: number }) => {
  const t = useT();
  const router = useRouter();

  const handlePress = async () => {
    // Track tile selection
    analyticsService.trackTileUsage({
      category: 'addremove',
      tileName: t(item.titleKey),
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
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
      exif: false
    });

    if (!result.canceled && result.assets[0]) {
      try {
        useQuickEditStore.getState().openWithImage({ 
          functionType: 'custom', 
          imageUri: result.assets[0].uri,
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
      style={{ width: tileWidth, marginRight: index === DEFAULT_ADDREMOVE.length - 1 ? 0 : 10 }}
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
        {/* Placeholder content - videos/images can be added later */}
        <View style={{ 
          width: '100%', 
          height: '100%', 
          backgroundColor: '#1a1a1a',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
        </View>
        
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
            {t(item.titleKey)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

AddRemoveTile.displayName = 'AddRemoveTile';

// Main component - matching Backgrounds style
export function AnimatedAddRemove() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  
  // Responsive tile dimensions - same as Backgrounds
  const tileWidth = isTabletLike ? 105 : (isSmallPhone ? 90 : 105);
  const fontSize = isTabletLike ? 13 : (isSmallPhone ? 11 : 12);
  
  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {DEFAULT_ADDREMOVE.map((item, index) => (
          <AddRemoveTile 
            key={item.id} 
            item={item} 
            index={index} 
            tileWidth={tileWidth}
            fontSize={fontSize}
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