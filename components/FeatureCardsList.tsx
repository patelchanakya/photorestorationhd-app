import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { analyticsService } from '@/services/analytics';
import { featureRequestService } from '@/services/featureRequestService';
import { useTranslation } from 'react-i18next';
import { useQuickEditStore } from '@/store/quickEditStore';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import { useVideoPlayer } from 'expo-video';
import React from 'react';
import { Alert, Animated, AppState, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import ReanimatedAnimated, { FadeIn } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { IconSymbol } from './ui/IconSymbol';

// TypeScript interfaces for strict type safety
// Limited video component using pool
const CardVideo = React.memo(({ video }: { video: any }) => {
  const { t } = useTranslation();
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(true);
  
  const player = useVideoPlayer(video, (player: any) => {
    player.loop = true;
    player.muted = true;
    player.play(); // Auto-play for feature cards
    shouldBePlayingRef.current = true;
  });

  // Handle app state changes (backgrounding/foregrounding)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                player.play();
              }
            }, 100);
          }
        } catch (error) {
          // Ignore resume errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [player]);

  // Handle navigation focus (returning to screen)
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                player.play();
              }
            }, 100);
          }
        } catch (error) {
          // Ignore focus resume errors
        }
      }
    }, [player])
  );

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
    };
  }, []);

  if (!player) {
    // Show placeholder if player limit reached
    return (
      <View style={[styles.cardImage, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#666', fontSize: 12 }}>{t('common.videoLoading')}</Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={styles.cardImage}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
});

// Strict TypeScript types - no any types allowed
type ImageSource = ReturnType<typeof require>;
type VideoSourceAsset = ReturnType<typeof require>;

type CardItem = {
  id: string;
  titleKey: string; // Translation key for title
  emoji: string; // Emoji for the card
  functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'restore_repair' | 'water_damage';
  styleKey?: string;
  route?: string;
  customPrompt?: string; // Custom prompt for specific functionality
  image?: ImageSource; // Properly typed image asset
  video?: VideoSourceAsset; // Properly typed video asset
};

// Poster-style cards; order sets Featured (first). Prioritize Repair; move Water Damage lower.
const CARDS: CardItem[] = [
  { id: 'fc_repair', titleKey: 'magic.repair.title', emoji: '🔧', functionType: 'repair', video: require('../assets/videos/repair.mp4') },
  { id: 'fc_torn_photos', titleKey: 'magic.fixTornPhotos', emoji: '📄', functionType: 'repair', customPrompt: 'Repair tears and rips in old photos', image: require('../assets/images/teared.png') },
  { id: 'fc_colorize', titleKey: 'magic.colorize.title', emoji: '🎨', functionType: 'colorize', image: require('../assets/images/popular/colorize/pop-1.png') },
  { id: 'fc_descratch', titleKey: 'magic.descratch.title', emoji: '✨', functionType: 'descratch', image: require('../assets/images/popular/descratch/pop-2.png') },
  { id: 'fc_enlighten', titleKey: 'magic.brighten.title', emoji: '☀️', functionType: 'enlighten', image: require('../assets/images/popular/brighten/pop-4.png') },
  { id: 'fc_water_stain', titleKey: 'magic.waterDamage.title', emoji: '💧', functionType: 'water_damage', image: require('../assets/images/popular/stain/pop-7.png') },
  { id: 'fc_enhance', titleKey: 'magic.clarify.title', emoji: '🔍', functionType: 'unblur', image: require('../assets/images/popular/enhance/pop-3.png') },
  { id: 'fc_remove_stains', titleKey: 'magic.removeStains', emoji: '🧽', functionType: 'water_damage', customPrompt: 'Remove coffee stains, water stains, and discoloration', image: require('../assets/images/stained.png') },
  { id: 'fc_faded_photos', titleKey: 'magic.fixFadedPhotos', emoji: '🌅', functionType: 'enlighten', customPrompt: 'Restore color and contrast to faded images', image: require('../assets/images/popular/recreate/pop-5.png') },
];

// Create O(1) lookup map for better performance
const CARDS_BY_FUNCTION_TYPE = new Map<string, CardItem[]>();
CARDS.forEach(card => {
  if (card.functionType) {
    if (!CARDS_BY_FUNCTION_TYPE.has(card.functionType)) {
      CARDS_BY_FUNCTION_TYPE.set(card.functionType, []);
    }
    CARDS_BY_FUNCTION_TYPE.get(card.functionType)!.push(card);
  }
});

type FeatureCardsListProps = {
  onOpenBackgrounds?: () => void;
  onOpenClothes?: () => void;
  // When true, renders a compact Featured + Grid layout optimized for readability
  compact?: boolean;
};



// Memoize individual card to prevent re-renders
const FeatureCardBase = React.memo(({ 
  item, 
  onPress,
  index = 0
}: { 
  item: CardItem; 
  onPress: (item: CardItem) => void;
  index?: number;
}) => {
  const { t } = useTranslation();
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = React.useCallback(() => {
    try { Haptics.selectionAsync(); } catch {}
    Animated.timing(scaleValue, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true
    }).start();
  }, [scaleValue]);
  
  const handlePressOut = React.useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true
    }).start();
  }, [scaleValue]);
  
  return (
    <TouchableOpacity
    activeOpacity={0.9}
    onPress={() => onPress(item)}
    onPressIn={handlePressIn}
    onPressOut={handlePressOut}
    style={styles.cardContainer}
  >
    <Animated.View style={[styles.cardView, {
      transform: [{ scale: scaleValue }]
    }]}>
      {item.video ? (
        <CardVideo video={item.video} />
      ) : (
        <ExpoImage 
          source={item.image || undefined} 
          style={styles.cardImage} 
          contentFit="cover"
          cachePolicy="memory-disk"
          priority={index < 6 ? "high" : "low"}
          placeholderContentFit="cover"
          transition={0}
          recyclingKey={item.id}
        />
      )}
      <LinearGradient
        colors={[ 'transparent', 'rgba(0,0,0,0.68)' ]}
        locations={[0, 1]}
        style={styles.gradientOverlay}
      />
      
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>
          {t(item.titleKey)}
        </Text>
        
        <View style={styles.cardActionButton}>
          <Text style={styles.cardActionText} numberOfLines={1}>
            {t('photoProcessor.choosePhoto')}
          </Text>
          <IconSymbol name="chevron.right" size={14} color="#FFFFFF" />
        </View>
      </View>
      
    </Animated.View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id && 
         prevProps.index === nextProps.index;
});

const Card = React.memo(FeatureCardBase);
Card.displayName = 'FeatureCard';

// Grid card component - optimized for 2-column layout with viewport tracking
const GridCard = React.memo(({ 
  item, 
  onPress,
  index,
  isVisible 
}: { 
  item: CardItem; 
  onPress: (item: CardItem) => void;
  index: number;
  isVisible: boolean;
}) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const scaleValue = React.useRef(new Animated.Value(1)).current;
  
  // Calculate grid card dimensions
  // Account for container padding (16*2=32) and gap between cards (8*2=16)
  const cardWidth = (width - 32 - 16) / 2; // 2 columns with proper spacing
  const cardHeight = cardWidth * 1.2;

  const handlePressIn = React.useCallback(() => {
    try { Haptics.selectionAsync(); } catch {}
    Animated.timing(scaleValue, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true
    }).start();
  }, [scaleValue]);
  
  const handlePressOut = React.useCallback(() => {
    Animated.timing(scaleValue, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true
    }).start();
  }, [scaleValue]);
  
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        width: cardWidth,
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      <ReanimatedAnimated.View 
        entering={FadeIn.delay(index * 80).duration(800)}
        style={{
          height: cardHeight,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: 'transparent'
        }}
      >
        <Animated.View style={{
          flex: 1,
          transform: [{ scale: scaleValue }]
        }}>
{item.video ? (
          isVisible ? (
            <CardVideo video={item.video} />
          ) : (
            <ExpoImage 
              source={item.image || undefined} 
              style={styles.cardImage} 
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="low"
              placeholderContentFit="cover"
              transition={0}
              recyclingKey={`${item.id}_placeholder`}
            />
          )
        ) : (
          <ExpoImage 
            source={item.image || undefined} 
            style={styles.cardImage} 
            contentFit="cover"
            cachePolicy="memory-disk"
            priority={index < 4 ? "high" : "low"}
            placeholderContentFit="cover"
            transition={0}
            recyclingKey={item.id}
          />
        )}
        
        <LinearGradient
          colors={[ 'transparent', 'rgba(0,0,0,0.68)' ]}
          locations={[0, 1]}
          style={styles.gradientOverlay}
        />
        
        <View style={styles.gridCardContent}>
          <Text style={styles.gridCardTitle}>
            {t(item.titleKey)}
          </Text>
          
          <View style={styles.gridActionButton}>
            <Text style={styles.gridActionText} numberOfLines={1}>
              {t('photoProcessor.choosePhoto')}
            </Text>
            <IconSymbol name="chevron.right" size={12} color="#FFFFFF" />
          </View>
        </View>
        </Animated.View>
      </ReanimatedAnimated.View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id && 
         prevProps.index === nextProps.index &&
         prevProps.isVisible === nextProps.isVisible;
});
GridCard.displayName = 'GridCard';


// Memoize the entire component - export as default function
export function FeatureCardsList({ 
  onOpenBackgrounds, 
  onOpenClothes,
  compact = false
}: FeatureCardsListProps) {
  const router = useRouter();
  const { isPro } = useRevenueCat();
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  // Track visible grid cards for performance optimization (videos only)
  const [visibleGridIndices, setVisibleGridIndices] = React.useState<Set<number>>(new Set([0, 1, 2, 3])); // Show first 4 initially

  // Handle request idea submission
  const handleRequestIdea = React.useCallback(async () => {
    Alert.prompt(
      t('magic.requestFeature.title'),
      t('magic.requestFeature.prompt'),
      async (text) => {
        if (text && text.trim()) {
          try {
            const result = await featureRequestService.submitRequest(text, undefined, isPro, 'feature');
            if (result.success) {
              Alert.alert(
                t('magic.requestFeature.thankYouTitle'),
                t('magic.requestFeature.thankYouMessage'),
                [{ text: t('magic.requestFeature.button') }]
              );
            } else {
              Alert.alert(
                t('magic.requestFeature.errorTitle'),
                result.error || t('magic.requestFeature.errorMessage'),
                [{ text: t('common.ok') }]
              );
            }
          } catch (error) {
            Alert.alert(
              t('common.error'),
              t('magic.requestFeature.errorGeneric'),
              [{ text: t('common.ok') }]
            );
          }
        }
      },
      'plain-text',
      '',
      'Describe your feature idea here...'
    );
  }, [isPro]);

  // Handle bug report submission
  const handleBugReport = React.useCallback(async () => {
    Alert.prompt(
      t('magic.reportBug.title'),
      t('magic.reportBug.prompt'),
      async (text) => {
        if (text && text.trim()) {
          try {
            const result = await featureRequestService.submitRequest(text, undefined, isPro, 'bug');
            if (result.success) {
              Alert.alert(
                t('magic.reportBug.thankYouTitle'),
                t('magic.reportBug.thankYouMessage'),
                [{ text: t('magic.reportBug.button') }]
              );
            } else {
              Alert.alert(
                t('magic.reportBug.errorTitle'),
                result.error || t('magic.reportBug.errorMessage'),
                [{ text: t('common.ok') }]
              );
            }
          } catch (error) {
            Alert.alert(
              t('common.error'),
              t('magic.reportBug.errorGeneric'),
              [{ text: t('common.ok') }]
            );
          }
        }
      },
      'plain-text',
      '',
      'Describe the bug you encountered...'
    );
  }, [isPro]);

  // Memoize handlePress to prevent re-creation
  const handlePress = React.useCallback(async (item: CardItem) => {
    if (item.route === '/backgrounds' && onOpenBackgrounds) {
      onOpenBackgrounds();
      return;
    }
    if (item.route === '/clothes' && onOpenClothes) {
      onOpenClothes();
      return;
    }
    const functionType = item.functionType ?? 'restoration';
    const translatedTitle = t(item.titleKey);
    
    // PROMPT LOGGING: Track which feature card is selected
    if (__DEV__) {
      console.log('🎯 FEATURE CARD SELECTED:', {
        id: item.id,
        title: translatedTitle,
        functionType: functionType,
        styleKey: item.styleKey
      });
    }
    
    // Track feature tile selection
    analyticsService.trackTileUsage({
      category: 'feature',
      tileName: translatedTitle,
      tileId: item.id,
      functionType: functionType,
      styleKey: item.styleKey,
      stage: 'selected'
    });
    
    // Open native picker first, then open Quick Edit sheet prefilled
    // No permission check needed on iOS 11+ - PHPickerViewController handles privacy
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
          functionType, 
          imageUri: result.assets[0].uri, 
          styleKey: item.styleKey, 
          styleName: translatedTitle,
          customPrompt: item.customPrompt
        });
      } catch {}
    }
  }, [onOpenBackgrounds, onOpenClothes, router, t, currentLanguage]);

  if (!compact) {
    return (
      <View style={{ paddingTop: 8, paddingBottom: 24 }}>
        {CARDS.map((c) => (
          <Card key={c.id} item={c} onPress={handlePress} />
        ))}
        
        {/* Request your idea & Report bug side-by-side cards */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, gap: 12 }}>
          {/* Request your idea card - smaller */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleRequestIdea}
            style={{ flex: 1 }}
          >
            <View style={{ 
              height: 140, 
              borderRadius: 18, 
              overflow: 'hidden', 
              borderWidth: 1.5, 
              borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 12
            }}>
              <LinearGradient
                colors={["rgba(255,255,255,0.06)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.6 }}
                style={{ position: 'absolute', inset: 0 }}
              />
              
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <IconSymbol name="lightbulb" size={20} color="#D4A574" />
                </View>
                <Text style={{ 
                  color: '#D4A574', 
                  fontSize: 16, 
                  fontFamily: 'Lexend-Bold', 
                  letterSpacing: -0.2,
                  marginBottom: 4,
                  textAlign: 'center'
                }}>
                  {t('magic.requestIdea')}
                </Text>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  fontSize: 11,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  {t('magic.requestIdeaSubtitle')}
                </Text>
                
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)'
                }}>
                  <IconSymbol name="envelope" size={12} color="#D4A574" />
                  <Text style={{ color: '#D4A574', fontSize: 11, fontFamily: 'Lexend-SemiBold' }}>
                    {t('magic.send')}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Report bug card - smaller */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleBugReport}
            style={{ flex: 1 }}
          >
            <View style={{ 
              height: 140, 
              borderRadius: 18, 
              overflow: 'hidden', 
              borderWidth: 1.5, 
              borderColor: 'rgba(255,255,255,0.18)',
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 12
            }}>
              <LinearGradient
                colors={["rgba(255,255,255,0.06)", "transparent"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.6 }}
                style={{ position: 'absolute', inset: 0 }}
              />
              
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10
                }}>
                  <IconSymbol name="chevron.right" size={20} color="#C1A28A" />
                </View>
                <Text style={{ 
                  color: '#C1A28A', 
                  fontSize: 16, 
                  fontFamily: 'Lexend-Bold', 
                  letterSpacing: -0.2,
                  marginBottom: 4,
                  textAlign: 'center'
                }}>
                  {t('magic.reportBug.title')}
                </Text>
                <Text style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  fontSize: 11,
                  textAlign: 'center',
                  marginBottom: 8
                }}>
                  {t('magic.reportBugSubtitle')}
                </Text>
                
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)'
                }}>
                  <IconSymbol name="exclamationmark.triangle" size={12} color="#C1A28A" />
                  <Text style={{ color: '#C1A28A', fontSize: 11, fontFamily: 'Lexend-SemiBold' }}>
                    {t('magic.report')}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Since grid cards are in a fixed layout (not scrollable), all should be visible
  // This optimization is mainly for video tiles, but our grid has mostly images anyway
  React.useEffect(() => {
    // Set all grid cards as visible since they're in a fixed 2-column layout
    const allGridIndices = new Set<number>();
    for (let i = 0; i < CARDS.length - 1; i++) { // -1 for featured card
      allGridIndices.add(i);
    }
    setVisibleGridIndices(allGridIndices);
    
    if (__DEV__) {
      console.log('📜 Restoration grid - all tiles visible:', [...allGridIndices]);
    }
  }, []);

  // Compact: show first item as Featured, rest as 2-column grid
  const [featured, ...rest] = CARDS;
  return (
    <View style={{ paddingTop: 8, paddingBottom: 24 }}>
      {/* Featured card - always plays video */}
      <Card item={featured} onPress={handlePress} />
      
      {/* Grid cards - 2 columns with viewport optimization */}
      <View 
        style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingTop: 8 
        }}
      >
        {rest.map((item, index) => (
          <GridCard 
            key={item.id}
            item={item} 
            onPress={handlePress}
            index={index}
            isVisible={visibleGridIndices.has(index)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 16,
    marginBottom: 14
  },
  cardView: {
    height: 260,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'transparent'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%'
  },
  cardContent: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    alignItems: 'center'
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    letterSpacing: -0.4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8
  },
  cardActionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  cardActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Lexend-Medium',
    letterSpacing: -0.1,
    marginLeft: 6
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8
  },
  gridCardContainer: {
    // width set dynamically
  },
  gridCard: {
    marginHorizontal: 8,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    height: 200
  },
  gridCardImage: {
    width: '100%',
    height: '100%'
  },
  gridGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%'
  },
  gridCardContent: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center'
  },
  gridCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Lexend-Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
  gridActionButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginTop: 6
  },
  gridActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lexend-Medium',
    marginLeft: 6
  }
});