// Removed Pro gating - all outfits are now free
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
    outfitPrompt: "Clean ALL clothing completely on the person. Remove ALL stains and dirt from every piece of clothing while maintaining original fabric texture and material properties. Keep the same colors, style, and design. Preserve exact facial features, hairstyle, body position, and original lighting conditions with natural shadows. Only clean the clothing - keep background and pose completely unchanged." 
  },
  { 
    id: 'outfit-2', 
    titleKey: 'outfits.changeColour', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/change-color/colorchange.mp4'), 
    outfitPrompt: "Keep the person's clothing design, fabric texture, material properties, shape, and style exactly the same, but change the color to a random, attractive color that looks natural and flattering. Avoid overly bright colors - choose stylish, wearable colors. Ensure the new color appears natural under existing lighting conditions with proper fabric sheen and material behavior. Maintain exact facial features, hairstyle, body position, and original lighting with natural shadows. Do not alter background, accessories, or pose - only change the clothing color." 
  },
  { 
    id: 'outfit-3', 
    titleKey: 'outfits.casualDay', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/casual-day/outfit-0.mp4'), 
    outfitPrompt: "Change the person's clothing to casual, comfortable wear: soft cotton t-shirt with denim jeans or lightweight cotton summer outfit. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure clothing appears realistic with natural cotton weave texture, authentic denim properties, and proper fabric drape under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged." 
  },
  { 
    id: 'outfit-4', 
    titleKey: 'outfits.weddingOutfit', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/wedding-outfit/outfit-wedding.mp4'), 
    outfitPrompt: "Replace clothing with elegant wedding attire: silk wedding dress with lace details or formal wool suit with silk tie. Preserve exact head position, facial features, and body positioning of all subjects. Maintain original lighting conditions with natural fabric sheen and texture - silk should appear lustrous, lace delicate, wool structured. Ensure proper garment drape under existing lighting. Keep pose, background, and lighting completely unchanged." 
  },
  { 
    id: 'outfit-5', 
    titleKey: 'outfits.professional', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/formal-wear/professional.mp4'), 
    outfitPrompt: "Replace ALL of the person's clothing with a complete professional business outfit: well-tailored wool suit with cotton dress shirt and silk tie, or elegant professional wool blazer with quality fabric trousers or skirt. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure fabric appears realistic with natural wool texture, cotton weave, and silk properties. Proper suit drape and authentic fabric folds under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged." 
  },
  { 
    id: 'outfit-6', 
    titleKey: 'outfits.jobInterview', 
    type: 'video', 
    video: require('../assets/videos/magic/outfits/thumbnail/job-interview/jobinterview.mp4'), 
    outfitPrompt: "Replace the person's clothing with smart business casual attire: cotton blazer with wool trousers or professional skirt made of quality fabric. Use neutral, professional colors. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure fabric appears realistic with natural cotton weave texture, wool properties, and proper garment drape under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged." 
  },
  { 
    id: 'outfit-7', 
    titleKey: 'outfits.makeDoctor', 
    type: 'video', 
    video: require('../assets/videos/doctor.mp4'), 
    outfitPrompt: "Replace the person's clothing with professional medical attire: crisp white cotton doctor's coat over quality dress shirt and trousers, or medical scrubs made of professional cotton blend fabric. Maintain exact facial features, hairstyle, body position, and original lighting conditions. Ensure fabric appears realistic with natural cotton texture, proper coat drape, and authentic medical garment fit under existing lighting. Preserve shadows and highlights. Keep background and pose completely unchanged." 
  },
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

const OutfitTile = React.memo(({ item, tileWidth, fontSize, isVisible = false }: { item: OutfitItem; tileWidth: number; fontSize: number; isVisible?: boolean }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleOutfitSelect = async () => {
    const translatedTitle = t(item.titleKey);

    console.log('🎨 OUTFIT STYLE SELECTED:', {
      id: item.id,
      title: translatedTitle,
      prompt: item.outfitPrompt
    });

    analyticsService.trackTileUsage({
      category: 'outfit',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: 'nano_outfit',
      customPrompt: item.outfitPrompt,
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
          functionType: 'nano_outfit' as any,
          imageUri: result.assets[0].uri,
          styleName: translatedTitle,
          styleKey: item.id
        });
      } catch {
        router.push({
          pathname: '/text-edits',
          params: {
            imageUri: result.assets[0].uri,
            prompt: item.outfitPrompt || translatedTitle,
            mode: 'outfit'
          }
        });
      }
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleOutfitSelect}
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
      ) : (
        <ExpoImage
          source={item.image}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={0}
        />
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

export function AnimatedOutfits({ outfits = DEFAULT_OUTFITS }: { outfits?: OutfitItem[] }) {
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
        data={outfits}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <OutfitTile
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