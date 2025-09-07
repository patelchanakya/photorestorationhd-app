import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTranslation } from '@/src/hooks/useTranslation';
import { ONBOARDING_FEATURES, OnboardingFeature } from '@/utils/onboarding';
import { analyticsService } from '@/services/analytics';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { useEvent } from 'expo';
import React from 'react';
import { AppState, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { 
    FadeIn, 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { ONBOARDING_BORDER_RADIUS, ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY } from './shared/constants';

interface FeatureWithAssets extends OnboardingFeature {
  video?: any;
  image?: any;
}

// Map onboarding features to their visual assets
const FEATURE_ASSETS: Record<string, { video?: any; image?: any }> = {
  add_smile: { video: require('../../assets/videos/popular/smile.mp4') },
  clear_skin: { video: require('../../assets/videos/popular/clear-skin.mp4') },
  fix_hair: { video: require('../../assets/videos/popular/fix-hair.mp4') },
  make_younger: { video: require('../../assets/videos/popular/younger.mp4') },
  add_wings: { video: require('../../assets/videos/popular/angel.mp4') },
  add_halo: { video: require('../../assets/videos/popular/halo.mp4') },
  make_slimmer: { video: require('../../assets/videos/popular/slimmer.mp4') },
  add_color_bw: { image: require('../../assets/images/popular/colorize/pop-1.png') },
  water_stain_damage: { image: require('../../assets/images/popular/stain/pop-7.png') },
  repair: { image: require('../../assets/images/popular/recreate/pop-5.png') },
  unblur_sharpen: { image: require('../../assets/images/popular/enhance/pop-3.png') },
  professional_outfit: { image: require('../../assets/images/popular/enhance/pop-3.png') },
  blur_background: { image: require('../../assets/images/backgrounds/thumbnail/studio/studio.jpeg') },
  memorial_flowers: { image: require('../../assets/images/backgrounds/thumbnail/garden/garden.jpeg') }
};

// VideoView component with reliable playback
const VideoTilePlayer = ({ video, index, isSelected }: { video: any; index: number; isSelected: boolean }) => {
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(false);
  
  const playbackRate = React.useMemo(() => {
    const rates = [1.2, 1.0, 1.1, 1.3, 1.1, 1.2, 1.0, 1.2];
    return rates[index % rates.length];
  }, [index]);
  
  const player = useVideoPlayer(video, (player) => {
    try {
      player.loop = true;
      player.muted = true;
      player.playbackRate = playbackRate;
    } catch (error) {
      console.error('FeatureTileGrid video player init error:', error);
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Auto-recovery for video playback
  React.useEffect(() => {
    if (!isPlaying && shouldBePlayingRef.current && isMountedRef.current) {
      try {
        if (player && player.status !== 'idle') {
          player.play();
        }
      } catch (error) {
        // Ignore recovery errors
      }
    }
  }, [isPlaying, player]);

  // Handle selection state changes
  React.useEffect(() => {
    if (isSelected && !shouldBePlayingRef.current) {
      try {
        if (player && player.status !== 'idle') {
          player.play();
          shouldBePlayingRef.current = true;
        }
      } catch (error) {
        // Ignore play errors
      }
    }
  }, [isSelected, player]);

  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      
      try {
        if (player) {
          const status = player.status;
          if (status !== 'idle') {
            player.pause();
          }
          player.release();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Initial playback setup
  React.useEffect(() => {
    if (!player) return;
    
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (player.status !== 'idle') {
          player.currentTime = (index * 0.3) % 2;
          if (isSelected) {
            player.play();
            shouldBePlayingRef.current = true;
          }
        }
      } catch (e) {
        // Ignore initial play errors
      }
    }, index * 100);
    
    return () => clearTimeout(playTimer);
  }, [player, index, isSelected]);

  // Handle app state changes
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current && isSelected) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                player.play();
              }
            }, 100 + index * 50);
          }
        } catch (error) {
          // Ignore resume errors
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [player, index, isSelected]);

  // Handle navigation focus
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current && isSelected) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current) {
                player.play();
              }
            }, 100 + index * 50);
          }
        } catch (error) {
          // Ignore focus resume errors
        }
      }
    }, [player, index, isSelected])
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

interface FeatureTileProps {
  feature: FeatureWithAssets;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  customInputRef?: React.RefObject<any>;
  t: (key: string) => string;
}

const FeatureTile = React.memo<FeatureTileProps>(({ 
  feature, 
  isSelected, 
  onSelect, 
  index, 
  customPrompt, 
  setCustomPrompt, 
  customInputRef, 
  t 
}) => {
  const { width } = useWindowDimensions();
  const shortestSide = Math.min(width, 800);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = width <= 375;
  
  const tileWidth = isTabletLike ? 110 : (isSmallPhone ? 95 : 105);
  const fontSize = isTabletLike ? 11 : (isSmallPhone ? 9 : 10);
  
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const selectionScale = useSharedValue(1);
  const borderOpacity = useSharedValue(0);
  

  // Entrance animation
  React.useEffect(() => {
    const delay = index * 50;
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
  }, [index]);

  // Selection animation
  React.useEffect(() => {
    if (isSelected) {
      selectionScale.value = withSequence(
        withSpring(1.05, { damping: 15, stiffness: 300 }),
        withSpring(1.02, { damping: 15, stiffness: 200 })
      );
      borderOpacity.value = withTiming(1, { duration: 200 });
    } else {
      selectionScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      borderOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value * selectionScale.value }
    ],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));


  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
  };

  // Get translated feature name and description
  const getTranslatedFeature = () => {
    const translationKey = feature.id.replace(/_/g, '');
    const nameKey = `onboarding.features.${translationKey}`;
    const descKey = `onboarding.features.${translationKey}Desc`;
    
    return {
      name: t(nameKey) || feature.name,
      description: t(descKey) || feature.description
    };
  };

  const translatedFeature = getTranslatedFeature();

  return (
    <Animated.View style={[{ marginBottom: ONBOARDING_SPACING.sm }, animatedStyle]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onSelect}
        activeOpacity={1}
        style={{ 
          width: tileWidth,
          alignItems: 'center',
        }}
      >
        <View style={{ position: 'relative' }}>
          {/* Main tile */}
          <View
            style={{ 
              width: tileWidth, 
              aspectRatio: 9/16, 
              borderRadius: ONBOARDING_BORDER_RADIUS.lg, 
              overflow: 'hidden',
              backgroundColor: isSelected ? ONBOARDING_COLORS.accentBackground : ONBOARDING_COLORS.cardBackground,
            }}
          >
            {/* Media content */}
            {feature.video ? (
              <VideoTilePlayer video={feature.video} index={index} isSelected={isSelected} />
            ) : feature.image ? (
              <Image 
                source={feature.image} 
                style={{ width: '100%', height: '100%' }} 
                contentFit="cover" 
                transition={0} 
              />
            ) : (
              // Fallback gradient background
              <LinearGradient
                colors={feature.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
              >
                <IconSymbol name={feature.icon as any} size={32} color="#FFFFFF" />
              </LinearGradient>
            )}
            
            {/* Gradient overlay for text visibility */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
              locations={[0, 0.6, 1]}
              start={{ x: 0.5, y: 0.2 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: 'absolute', inset: 0 }}
            />
            
            {/* Feature title */}
            <View style={{ 
              position: 'absolute', 
              left: 6, 
              right: 6, 
              bottom: 6, 
              minHeight: 32,
              justifyContent: 'flex-end',
            }}>
              <Text 
                adjustsFontSizeToFit={true}
                minimumFontScale={0.7}
                style={{ 
                  color: '#FFFFFF', 
                  fontFamily: 'Lexend-Bold', 
                  fontSize: fontSize + 1,
                  lineHeight: (fontSize + 1) * 1.2,
                  textAlign: 'center',
                  textShadowColor: 'rgba(0,0,0,0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                  letterSpacing: -0.1
                }}
              >
                {translatedFeature.name}
              </Text>
            </View>

          </View>
          
          {/* Selection checkmark */}
          {isSelected && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: ONBOARDING_COLORS.accent,
                  justifyContent: 'center',
                  alignItems: 'center',
                },
                borderAnimatedStyle
              ]}
            >
              <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
            </Animated.View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

interface FeatureTileGridProps {
  selectedFeature: string | null;
  onFeatureSelect: (featureId: string) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  customInputRef?: React.RefObject<any>;
}

export const FeatureTileGrid = React.memo<FeatureTileGridProps>(({ 
  selectedFeature, 
  onFeatureSelect, 
  customPrompt, 
  setCustomPrompt, 
  customInputRef 
}) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const shortestSide = Math.min(width, 800);
  const isTabletLike = shortestSide >= 768;
  const isSmallPhone = width <= 375;
  
  const tileWidth = isTabletLike ? 110 : (isSmallPhone ? 95 : 105);
  const spacing = 12;
  const tilesPerRow = Math.floor((width - 32) / (tileWidth + spacing));
  
  // Add assets to features and filter out custom_prompt
  const featuresWithAssets: FeatureWithAssets[] = ONBOARDING_FEATURES
    .filter(feature => feature.id !== 'custom_prompt')
    .map(feature => ({
      ...feature,
      ...FEATURE_ASSETS[feature.id]
    }));

  // Create rows of tiles
  const createRows = () => {
    const rows = [];
    for (let i = 0; i < featuresWithAssets.length; i += tilesPerRow) {
      rows.push(featuresWithAssets.slice(i, i + tilesPerRow));
    }
    return rows;
  };

  const rows = createRows();

  return (
    <ScrollView 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ 
        paddingHorizontal: ONBOARDING_SPACING.lg,
        paddingTop: ONBOARDING_SPACING.md,
        paddingBottom: ONBOARDING_SPACING.xl 
      }}
    >
      {rows.map((row, rowIndex) => (
        <View 
          key={rowIndex}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: ONBOARDING_SPACING.lg,
            paddingHorizontal: (width - 32 - (row.length * tileWidth) - ((row.length - 1) * spacing)) / 2,
          }}
        >
          {row.map((feature, tileIndex) => {
            const globalIndex = rowIndex * tilesPerRow + tileIndex;
            return (
              <FeatureTile
                key={feature.id}
                feature={feature}
                isSelected={selectedFeature === feature.id}
                onSelect={() => onFeatureSelect(feature.id)}
                index={globalIndex}
                customPrompt={customPrompt}
                setCustomPrompt={setCustomPrompt}
                customInputRef={feature.isCustomPrompt ? customInputRef : undefined}
                t={t}
              />
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
});