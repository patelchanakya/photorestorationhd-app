import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, AppState, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { IconSymbol } from '../ui/IconSymbol';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '@/utils/responsive';

// Map intent IDs to translation keys
const getIntentTranslationKey = (intentId: string): string => {
  const keyMap: Record<string, string> = {
    'fix-old-photos': 'onboardingV4.intentCapture.options.fixOldPhotos',
    'repair-torn': 'onboardingV4.intentCapture.options.repairTorn',
    'colorize-bw': 'onboardingV4.intentCapture.options.colorizeBlackWhite',
    'remove-water-damage': 'onboardingV4.intentCapture.options.removeWaterDamage',
    'sharpen-faces': 'onboardingV4.intentCapture.options.sharpenFaces',
    'remove-scratches': 'onboardingV4.intentCapture.options.removeScratches',
    'brighten-dark': 'onboardingV4.intentCapture.options.brightenDark',
    'just-explore': 'onboardingV4.intentCapture.options.justExplore'
  };
  return keyMap[intentId] || 'onboardingV4.intentCapture.options.fixOldPhotos';
};

interface IntentOption {
  id: string;
  label: string;
  icon: string;
  demoImages: string[];
  video?: any;
  image?: any;
  functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'restore_repair' | 'water_damage' | 'nano_banana' | null;
  customPrompt?: string;
}

interface IntentCaptureScreenProps {
  options: IntentOption[];
  onSelect: (intentId: string) => void;
}

// Video content component for tiles - improved with fast refresh support
const TileVideo = React.memo(({ video, isVisible = true }: { video: any; isVisible?: boolean }) => {
  const { t } = useTranslation();
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(false);
  const playerRef = React.useRef<any>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  
  const player = useVideoPlayer(video, (player: any) => {
    playerRef.current = player;
    player.loop = true;
    player.muted = true;
    player.audioMixingMode = 'mixWithOthers';
    
    // Mark as ready and start playing if visible
    setIsReady(true);
    setHasError(false);
  });

  // Handle visibility changes
  React.useEffect(() => {
    if (!isReady || !isMountedRef.current) return;

    try {
      if (isVisible && playerRef.current) {
        shouldBePlayingRef.current = true;
        if (!playerRef.current.playing) {
          playerRef.current.play();
        }
      } else if (!isVisible && playerRef.current?.playing) {
        playerRef.current.pause();
        shouldBePlayingRef.current = false;
      }
    } catch {
      // Ignore visibility errors
    }
  }, [isVisible, isReady]);

  // Initial setup and cleanup
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      setIsReady(false);
      setHasError(false);
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.release();
        } catch {
          // Silent cleanup
        }
        playerRef.current = null;
      }
    };
  }, [video]); // Re-run when video changes (fast refresh)

  // Handle app state changes
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current && isVisible) {
        try {
          if (playerRef.current && !playerRef.current.playing) {
            setTimeout(() => {
              if (isMountedRef.current && playerRef.current) {
                playerRef.current.play();
              }
            }, 100);
          }
        } catch {
          // Ignore resume errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isVisible]);

  // Handle navigation focus
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current && isVisible && isReady) {
        try {
          if (playerRef.current && !playerRef.current.playing) {
            setTimeout(() => {
              if (isMountedRef.current && playerRef.current) {
                playerRef.current.play();
              }
            }, 100);
          }
        } catch {
          // Ignore focus resume errors
        }
      }
    }, [isVisible, isReady])
  );

  if (hasError) {
    return (
      <View style={[styles.tileMedia, { backgroundColor: '#2a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#999', fontSize: 11 }}>{t('onboardingV4.intentCapture.previewUnavailable')}</Text>
      </View>
    );
  }

  if (!player || !isReady) {
    return (
      <View style={[styles.tileMedia, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#666', fontSize: 12 }}>{t('onboardingV4.intentCapture.loading')}</Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={styles.tileMedia}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
});

function IntentTile({
  option,
  index,
  onPress,
  isVisible = true
}: {
  option: IntentOption;
  index: number;
  onPress: () => void;
  isVisible?: boolean;
}) {
  const { t } = useTranslation();

  const handlePressIn = React.useCallback(() => {
    // Visual feedback handled by TouchableOpacity activeOpacity
  }, []);

  const handlePress = () => {
    onPress();
  };

  return (
    <Animated.View 
      style={styles.tileContainer}
      entering={FadeIn.delay(index * 100).duration(800)}
    >
      <TouchableOpacity
        style={styles.tile}
        onPress={handlePress}
        onPressIn={handlePressIn}
        activeOpacity={0.85}
      >
        <View style={styles.tileContent}>
          {option.video ? (
            <TileVideo video={option.video} isVisible={isVisible} />
          ) : (
            <ExpoImage 
              source={option.image || undefined} 
              style={styles.tileMedia} 
              contentFit="cover"
              cachePolicy="memory-disk"
              priority={index < 4 ? "high" : "low"}
              placeholderContentFit="cover"
              transition={0}
              recyclingKey={option.id}
            />
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.68)']}
            locations={[0, 1]}
            style={styles.gradientOverlay}
          />
          
          <View style={styles.tileTextContent}>
            <Text style={styles.tileLabel}>{t(getIntentTranslationKey(option.id))}</Text>

            <View style={styles.tileActionButton}>
              <Text style={styles.tileActionText} numberOfLines={1}>
                {option.id === 'just-explore' ? t('onboardingV4.intentCapture.actions.continue') : t('onboardingV4.intentCapture.actions.tryThis')}
              </Text>
              <IconSymbol name="chevron.right" size={12} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function IntentCaptureScreen({ options, onSelect }: IntentCaptureScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();

  // Track visible items for video performance optimization
  const [visibleIndices, setVisibleIndices] = React.useState<Set<number>>(new Set([0, 1, 2, 3])); // Show first 4 initially

  // Smooth entrance animations
  const headerOpacity = useSharedValue(0);

  React.useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 500 });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  // Calculate responsive grid dimensions
  const columnsCount = responsive.gridColumns;
  const containerPadding = responsive.contentPadding;
  const itemGap = responsive.spacing(16);
  const totalGapWidth = (columnsCount - 1) * itemGap;
  const availableWidth = responsive.dimensions.width - (containerPadding * 2) - totalGapWidth;
  const tileWidth = availableWidth / columnsCount;
  const tileHeight = tileWidth * (responsive.isTablet ? 1.1 : 1.2); // Slightly less height on tablets

  // Default intent options - photo restoration focused with "Just Exploring" option
  const defaultOptions: IntentOption[] = [
    {
      id: 'fix-old-photos',
      label: 'Fix Old Family Photos',
      icon: '📸',
      demoImages: [],
      video: require('../../assets/videos/onboarding/family-photos.mp4'),
      functionType: 'restore_repair'
    },
    {
      id: 'repair-torn',
      label: 'Repair Torn & Ripped Photos',
      icon: '📄',
      demoImages: [],
      video: require('../../assets/videos/onboarding/torn-photos.mp4'),
      functionType: 'repair'
    },
    {
      id: 'colorize-bw',
      label: 'Colorize Black & White',
      icon: '🎨',
      demoImages: [],
      video: require('../../assets/videos/onboarding/color-images.mp4'),
      functionType: 'colorize'
    },
    {
      id: 'remove-water-damage',
      label: 'Remove Water Damage',
      icon: '💧',
      demoImages: [],
      video: require('../../assets/videos/repair.mp4'),
      functionType: 'water_damage'
    },
    {
      id: 'sharpen-faces',
      label: 'Clear Up Blurry Faces',
      icon: '🔍',
      demoImages: [],
      video: require('../../assets/videos/onboarding/blur-photo.mp4'),
      functionType: 'unblur'
    },
    {
      id: 'remove-scratches',
      label: 'Remove Scratches & Marks',
      icon: '✨',
      demoImages: [],
      video: require('../../assets/videos/onboarding/descratch-photo.mp4'),
      functionType: 'descratch'
    },
    {
      id: 'brighten-dark',
      label: 'Brighten Dark Photos',
      icon: '☀️',
      demoImages: [],
      video: require('../../assets/videos/onboarding/brighten-photo.mp4'),
      functionType: 'enlighten'
    },
    {
      id: 'just-explore',
      label: 'Just Exploring the App',
      icon: '✨',
      demoImages: [],
      video: require('../../assets/videos/welcome.mp4'),
      functionType: null
    }
  ];

  const displayOptions = options.length > 0 ? options : defaultOptions;

  // Memoized FlatList callbacks
  const keyExtractor = React.useCallback((item: IntentOption) => item.id, []);

  const renderIntentTile = React.useCallback(({ item, index }: { item: IntentOption; index: number }) => (
    <View style={{ width: tileWidth, height: tileHeight }}>
      <IntentTile
        option={item}
        index={index}
        onPress={() => onSelect(item.id)}
        isVisible={visibleIndices.has(index)}
      />
    </View>
  ), [tileWidth, tileHeight, onSelect, visibleIndices]);

  const viewabilityConfig = React.useMemo(() => ({
    itemVisiblePercentThreshold: 50
  }), []);

  const onViewableItemsChanged = React.useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    setVisibleIndices(new Set(viewableItems.map(item => item.index)));
  }, []);

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + responsive.spacing(40) }]}>
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle, { paddingHorizontal: containerPadding }]}>
          <Text style={[styles.title, { fontSize: responsive.fontSize(28), marginBottom: responsive.spacing(8) }]}>
            {t('onboardingV4.intentCapture.title')}
          </Text>
          <Text style={[styles.subtitle, { fontSize: responsive.fontSize(16) }]}>
            {t('onboardingV4.intentCapture.subtitle')}
          </Text>
        </Animated.View>

        {/* Intent Options Grid */}
        <FlatList
          data={displayOptions}
          keyExtractor={keyExtractor}
          renderItem={renderIntentTile}
          numColumns={columnsCount}
          columnWrapperStyle={columnsCount > 1 ? { gap: itemGap, paddingHorizontal: containerPadding } : undefined}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + responsive.spacing(20) }]}
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          removeClippedSubviews={true}
          windowSize={5}
          maxToRenderPerBatch={columnsCount * 2}
          initialNumToRender={columnsCount * 2}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'Lexend-Regular',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  tileContainer: {
    flex: 1,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tileContent: {
    flex: 1,
  },
  tileMedia: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  tileTextContent: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    alignItems: 'center',
  },
  tileLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Lexend-Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  tileActionButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    minHeight: 36,
  },
  tileActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lexend-Medium',
    marginRight: 6,
  },
});