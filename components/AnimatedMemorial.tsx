// Memorial-focused features for passed loved ones and remembrance photos
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
import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface MemorialItem {
  id: string;
  video?: any; // require('...') for videos
  image?: any; // require('...') for images as fallback
  titleKey: string; // Translation key for title
  type?: 'video' | 'image';
  memorialPrompt?: string; // The prompt to apply this memorial effect
}

// Memorial features specifically designed for passed loved ones and remembrance photos
const DEFAULT_MEMORIAL_ITEMS: MemorialItem[] = [
  {
    id: 'memorial-3',
    titleKey: 'memorial.whiteBackground',
    type: 'video',
    video: require('../assets/videos/memorial/remback.mp4'),
    memorialPrompt:
      "Remove or clean up the background for a clean, professional memorial display that focuses attention on your loved one. Perfect for memorial services and displays."
  },
  { 
    id: 'popular-3', 
    titleKey: 'popular.addHalo', 
    type: 'video', 
    video: require('../assets/videos/popular/halo.mp4'), 
    memorialPrompt: "Add a subtle glowing halo above the subject's head." 
  },
  {
    id: 'memorial-4',
    titleKey: 'memorial.lightRays',
    type: 'video',
    video: require('../assets/videos/memorial/light.mp4'),
    memorialPrompt:
      "Add divine light rays shining down from above, creating a heavenly and spiritual atmosphere perfect for memorial photos. The rays should emanate from above and create a peaceful, uplifting effect."
  },
  { 
    id: 'popular-7', 
    titleKey: 'popular.angelWings', 
    type: 'video', 
    video: require('../assets/videos/popular/angel.mp4'), 
    memorialPrompt: "Add realistic wings that match pose, background, and lighting." 
  },
  {
    id: 'memorial-1',
    titleKey: 'memorial.memorialFlowers',
    type: 'video',
    video: require('../assets/videos/memorial/flowers.mp4'),
    memorialPrompt:
      "Add beautiful memorial flowers like lilies, roses, or white flowers around the photo border or background, symbolizing love, remembrance, and peace."
  },
  {
    id: 'memorial-6',
    titleKey: 'memorial.etherealGlow',
    type: 'video',
    video: require('../assets/videos/memorial/glow.mp4'),
    memorialPrompt:
      "Add a soft, ethereal glow around the subject creating a peaceful and spiritual memorial atmosphere. The glow should be gentle and respectful, not overwhelming."
  },
  {
    id: 'memorial-8',
    titleKey: 'memorial.candlelightVigil',
    type: 'video',
    video: require('../assets/videos/candle.mp4'),
    memorialPrompt:
      "Transform this photo into a warm candlelit memorial-style portrait. Keep the person's face and features unchanged. Add soft golden candlelight in front of the subject, casting a gentle warm glow across the image without darkening the background too much. Place several realistic candles at the bottom, making the scene feel peaceful, emotional, and respectful."
  },
  {
    id: 'memorial-11',
    titleKey: 'memorial.heavenly',
    type: 'video',
    video: require('../assets/videos/clouders.mp4'),
    memorialPrompt:
      "Add soft, peaceful clouds in the background creating a serene heavenly atmosphere perfect for memorial photos."
  },
  {
    id: 'memorial-5',
    titleKey: 'memorial.doveOfPeace',
    type: 'video',
    video: require('../assets/videos/memorial/dove.mp4'),
    memorialPrompt:
      "Add a white dove symbolizing peace, hope, and the Holy Spirit. Position it gracefully in the background or near the subject, perfect for memorial and remembrance photos."
  },
  {
    id: 'memorial-2',
    titleKey: 'memorial.heavenGates',
    type: 'video',
    video: require('../assets/videos/memorial/gates.mp4'),
    memorialPrompt:
      "Add subtle heavenly gate elements in the background for a spiritual and comforting memorial effect. The gates should be elegant and not dominate the photo."
  },
  {
    id: 'memorial-9',
    titleKey: 'memorial.restInPeace',
    type: 'video',
    video: require('../assets/videos/ripvid.mp4'),
    memorialPrompt:
      "Add elegant 'Rest in Peace' text overlay to the image in a respectful, tasteful font that complements the memorial photo."
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

const MemorialTile = React.memo(({ item, tileWidth, fontSize, isVisible = false }: { item: MemorialItem; tileWidth: number; fontSize: number; isVisible?: boolean }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleMemorialSelect = async () => {
    const translatedTitle = t(item.titleKey);

    console.log('🕊️ MEMORIAL FEATURE SELECTED:', {
      id: item.id,
      title: translatedTitle,
      prompt: item.memorialPrompt
    });

    analyticsService.trackTileUsage({
      category: 'memorial',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: 'nano_memorial',
      customPrompt: item.memorialPrompt,
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
          functionType: 'nano_memorial' as any,
          imageUri: result.assets[0].uri,
          styleKey: item.id,
          styleName: translatedTitle
        });
      } catch {
        router.push({
          pathname: '/text-edits',
          params: {
            imageUri: result.assets[0].uri,
            prompt: item.memorialPrompt || translatedTitle,
            mode: 'nano_memorial'
          }
        });
      }
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleMemorialSelect}
      style={{
        width: tileWidth,
        aspectRatio: 9/16,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#000000',
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

export function MemorialFeatures({ memorialItems = DEFAULT_MEMORIAL_ITEMS }: { memorialItems?: MemorialItem[] }) {
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
        data={memorialItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MemorialTile
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
          width: 30,
          pointerEvents: 'none'
        }}
      />
    </View>
  );
}