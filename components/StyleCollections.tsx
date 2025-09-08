import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuickEditStore } from '@/store/quickEditStore';
import React from 'react';
import { Dimensions, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

type StyleItem = {
  id: string;
  title: string;
  subtitle?: string;
  styleKey: string;
  image: any; // require('...')
};

type SectionConfig = {
  id: string;
  title: string;
  items: StyleItem[];
};

const CLOTHING: StyleItem[] = [
  { id: 'c1', title: 'Wedding Attire', subtitle: 'Classic formal', styleKey: 'wedding_attire', image: require('../assets/images/onboarding/after-4.png') },
  { id: 'c2', title: 'Sports Jersey', subtitle: 'Athletic vibe', styleKey: 'sports_jersey', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'c3', title: 'Formal Suit', subtitle: 'Sharp & clean', styleKey: 'formal_suit', image: require('../assets/images/onboarding/before-3.jpg') },
  { id: 'c4', title: 'Casual Fit', subtitle: 'Relaxed look', styleKey: 'casual_fit', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'c5', title: 'Matching Outfits', subtitle: 'Match everyone’s clothes', styleKey: 'match_clothes', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'c6', title: 'Formal Dress', subtitle: 'Elegant gown', styleKey: 'formal_dress', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'c7', title: 'Men’s Formal', subtitle: 'Suit & tie', styleKey: 'formal_men', image: require('../assets/images/onboarding/before-4.jpg') },
  { id: 'c8', title: 'Ceremonial Robe', subtitle: 'Cap/gown style', styleKey: 'ceremonial_robe', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'c9', title: 'Neutral Uniform', subtitle: 'Simple blazer/tie', styleKey: 'uniform_neutral', image: require('../assets/images/onboarding/before-2.jpg') },
];

const BACKGROUNDS: StyleItem[] = [
  { id: 'b1', title: 'Heavenly', subtitle: 'Soft glow sky', styleKey: 'heavenly_bg', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'b2', title: 'Studio', subtitle: 'Neutral portrait', styleKey: 'studio_bg', image: require('../assets/images/onboarding/before-4.jpg') },
  { id: 'b3', title: 'Vintage', subtitle: 'Timeless feel', styleKey: 'vintage_bg', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'b4', title: 'Outdoors', subtitle: 'Natural scene', styleKey: 'outdoor_bg', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'b5', title: 'Clean Gradient', subtitle: 'Simple, minimal', styleKey: 'clean_bg', image: require('../assets/images/onboarding/after-4.png') },
];

const EFFECTS: StyleItem[] = [
  { id: 'e1', title: 'Repair', subtitle: 'Fix damage', styleKey: 'vintage_repair', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'e2', title: 'Unblur', subtitle: 'Sharpen details', styleKey: 'unblur', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'e3', title: 'Colorize', subtitle: 'Add color to B&W', styleKey: 'colorize', image: require('../assets/images/onboarding/after-4.png') },
  { id: 'e4', title: 'Descratch', subtitle: 'Remove scratches', styleKey: 'descratch', image: require('../assets/images/onboarding/before-4.jpg') },
  { id: 'e5', title: 'Hand‑color look', subtitle: 'Period‑correct tones', styleKey: 'hand_color', image: require('../assets/images/onboarding/before-3.jpg') },
  { id: 'e6', title: 'De‑sepia', subtitle: 'Neutralize heavy sepia', styleKey: 'de_sepia', image: require('../assets/images/onboarding/before-2.jpg') },
  { id: 'e7', title: 'De‑glare', subtitle: 'Reduce reflections', styleKey: 'de_glare', image: require('../assets/images/onboarding/after-2.png') },
  { id: 'e8', title: 'Soft Vignette', subtitle: 'Gentle edge fade', styleKey: 'soft_vignette', image: require('../assets/images/onboarding/after-3.png') },
  { id: 'e9', title: 'Memorial Crop', subtitle: 'Centered, 4:5 portrait', styleKey: 'memorial_crop', image: require('../assets/images/onboarding/after-4.png') },
  { id: 'e10', title: 'Candlelight Vigil', subtitle: 'Warm memorial glow', styleKey: 'candlelight_vigil', image: require('../assets/images/onboarding/after-2.png') },
];

const SECTIONS: SectionConfig[] = [
  { id: 's1', title: 'Change clothes', items: CLOTHING },
  { id: 's2', title: 'Change background', items: BACKGROUNDS },
  // Break out effects into single-purpose rows for clarity
  { id: 's3', title: 'Fix damage', items: [EFFECTS[0]] },
  { id: 's4', title: 'Unblur', items: [EFFECTS[1]] },
  { id: 's5', title: 'Colorize', items: [EFFECTS[2]] },
  { id: 's6', title: 'Descratch', items: [EFFECTS[3]] },
  { id: 's7', title: 'Hand‑color look', items: [EFFECTS[4]] },
  { id: 's8', title: 'De‑sepia', items: [EFFECTS[5]] },
  { id: 's9', title: 'De‑glare', items: [EFFECTS[6]] },
  { id: 's10', title: 'Soft vignette', items: [EFFECTS[7]] },
  { id: 's11', title: 'Memorial crop', items: [EFFECTS[8]] },
  { id: 's12', title: 'Candlelight vigil', items: [EFFECTS[9]] },
];

export function StyleCollections() {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const shortestSide = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);
  const longestSide = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = longestSide <= 700;
  
  const H_PADDING = 12; // matches container padding
  const GAP = 10; // gap between tiles
  const PEEK = 36; // visible part of 3rd tile to hint scroll
  
  // Responsive tile sizing - optimized for text visibility and mobile/tablet experience
  const baseTileWidth = isTabletLike ? 130 : (isSmallPhone ? 110 : 120);
  const TILE_WIDTH = Math.max(baseTileWidth, Math.floor((SCREEN_WIDTH - H_PADDING * 2 - GAP - PEEK) / 2));
  const TILE_HEIGHT = Math.round(TILE_WIDTH * 1.2);
  
  // Track visible tiles for each section (for smooth animations)
  const [visibleSections, setVisibleSections] = React.useState<{[key: string]: Set<number>}>({
    'clothing': new Set([0, 1]),
    'backgrounds': new Set([0, 1]),  
    'effects': new Set([0, 1])
  });
  
  const createScrollHandler = React.useCallback((sectionId: string, itemCount: number) => {
    return (event: any) => {
      const scrollX = event.nativeEvent.contentOffset.x;
      const viewportWidth = SCREEN_WIDTH - H_PADDING * 2;
      
      // Calculate which tiles are visible (with buffer)
      const firstVisibleIndex = Math.max(0, Math.floor((scrollX - 30) / (TILE_WIDTH + GAP)));
      const lastVisibleIndex = Math.min(itemCount - 1, Math.ceil((scrollX + viewportWidth + 30) / (TILE_WIDTH + GAP)));
      
      const newVisibleIndices = new Set<number>();
      for (let i = firstVisibleIndex; i <= lastVisibleIndex; i++) {
        newVisibleIndices.add(i);
      }
      
      // Only update if changed
      const currentVisible = visibleSections[sectionId] || new Set();
      if (newVisibleIndices.size !== currentVisible.size || 
          ![...newVisibleIndices].every(i => currentVisible.has(i))) {
        setVisibleSections(prev => ({
          ...prev,
          [sectionId]: newVisibleIndices
        }));
        
        if (__DEV__) {
          console.log(`📜 Memorial ${sectionId} visible:`, [...newVisibleIndices]);
        }
      }
    };
  }, [SCREEN_WIDTH, H_PADDING, TILE_WIDTH, GAP, visibleSections]);

  const openPicker = async (styleKey: string) => {
    // No permission check needed on iOS 11+ - PHPickerViewController handles privacy
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ['images'], 
      allowsEditing: false, 
      quality: 1,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.PAGE_SHEET,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.CURRENT,
      exif: false
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const functionType = styleKey === 'candlelight_vigil' ? 'memorial' : 'restoration';
      useQuickEditStore.getState().openWithImage({ 
        functionType: functionType, 
        imageUri: uri,
        styleKey: styleKey
      });
    }
  };

  const PreviewTile = ({ item, index, isVisible }: { item: StyleItem; index: number; isVisible?: boolean }) => (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(600)}
      style={{ marginRight: 10 }}
    >
      <TouchableOpacity
        onPress={() => openPicker(item.styleKey)}
        activeOpacity={0.9}
        style={{ width: TILE_WIDTH, height: TILE_HEIGHT, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0B0B0F' }}
      >
        <ExpoImage source={item.image} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={0} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingVertical: 6, minHeight: 44, justifyContent: 'flex-end' }}>
          <Text 
            style={{ 
              color: '#EAEAEA', 
              fontSize: isTabletLike ? 13 : (isSmallPhone ? 11 : 12), 
              fontFamily: 'Lexend-Black', 
              letterSpacing: -0.2,
              textAlign: 'center',
              lineHeight: isTabletLike ? 15 : (isSmallPhone ? 13 : 14)
            }} 
            adjustsFontSizeToFit={true}
            minimumFontScale={0.6}
          >
            {item.title}
          </Text>
          {!!item.subtitle && (
            <Text 
              style={{ 
                color: '#BFC3CF', 
                fontSize: isTabletLike ? 10 : (isSmallPhone ? 9 : 10), 
                fontFamily: 'Lexend-Medium',
                textAlign: 'center',
                marginTop: 2,
                lineHeight: isTabletLike ? 12 : (isSmallPhone ? 11 : 12)
              }} 
              adjustsFontSizeToFit={true}
              minimumFontScale={0.6}
            >
              {item.subtitle}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 16 }}>
      {SECTIONS.map((section) => {
        const sectionKey = section.id.includes('clothing') ? 'clothing' : 
                          section.id.includes('background') ? 'backgrounds' : 'effects';
        const visibleIndices = visibleSections[sectionKey] || new Set();
        
        return (
          <View key={section.id} style={{ marginBottom: 14 }}>
            <Text style={{ color: '#EAEAEA', fontSize: 16, fontFamily: 'Lexend-Black', marginBottom: 8 }}>{section.title}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ paddingRight: 8 }}
              onScroll={createScrollHandler(sectionKey, section.items.length)}
              scrollEventThrottle={100}
            >
              {section.items.map((item, index) => (
                <PreviewTile 
                  key={item.id} 
                  item={item} 
                  index={index}
                  isVisible={visibleIndices.has(index)}
                />
              ))}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}


