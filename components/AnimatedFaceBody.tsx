import { analyticsService } from '@/services/analytics';
import { useTranslation } from 'react-i18next';
import { useQuickEditStore } from '@/store/quickEditStore';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useVideoPlayer } from 'expo-video';
import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

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

const VideoViewWithPlayer = ({ video, isVisible }: { video: any; isVisible: boolean }) => {
  const player = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    if (isVisible) {
      player?.play();
    } else {
      player?.pause();
    }
  }, [isVisible, player]);

  return (
    <View style={{ width: '100%', height: '100%' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%', opacity: 0.95 }}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
    </View>
  );
};

const FaceBodyTile = React.memo(({ item, tileWidth, fontSize, isVisible = false }: { item: FaceBodyItem; tileWidth: number; fontSize: number; isVisible?: boolean }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handlePress = async () => {
    const translatedTitle = t(item.titleKey);

    analyticsService.trackTileUsage({
      category: 'popular',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: 'custom',
      stage: 'selected'
    });

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
        backgroundColor: '#0b0b0f',
        marginRight: 10
      }}
    >
      {item.type === 'video' && item.video ? (
        <VideoViewWithPlayer video={item.video} isVisible={isVisible} />
      ) : item.image ? (
        <ExpoImage
          source={item.image}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={0}
        />
      ) : (
        <View style={{ width: '100%', height: '100%', backgroundColor: '#000000' }} />
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.9)"]}
        locations={[0, 0.6, 1]}
        start={{ x: 0.5, y: 0.2 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 as any }}
      />

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
  );
});

export function AnimatedFaceBody() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;

  const tileWidth = isTabletLike ? 105 : (isSmallPhone ? 90 : 105);
  const fontSize = isTabletLike ? 13 : (isSmallPhone ? 11 : 12);

  const [visibleIndices, setVisibleIndices] = useState(new Set<number>());

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    setVisibleIndices(new Set(viewableItems.map(item => item.index)));
  }, []);

  return (
    <View style={{ marginTop: 16, marginBottom: 8, position: 'relative' }}>
      <FlatList
        data={DEFAULT_FACEBODY}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FaceBodyTile
            item={item}
            tileWidth={tileWidth}
            fontSize={fontSize}
            isVisible={visibleIndices.has(index)}
          />
        )}
        windowSize={2}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        getItemLayout={(data, index) => ({
          length: tileWidth + 10,
          offset: (tileWidth + 10) * index,
          index,
        })}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        removeClippedSubviews={true}
      />

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