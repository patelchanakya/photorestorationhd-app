import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { IconSymbol } from '../ui/IconSymbol';

interface IntentOption {
  id: string;
  label: string;
  icon: string;
  demoImages: string[];
  video?: any;
  image?: any;
  functionType?: 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'enlighten' | 'restore_repair' | 'water_damage' | null;
  customPrompt?: string;
}

interface IntentCaptureScreenProps {
  options: IntentOption[];
  onSelect: (intentId: string) => void;
}

// Video content component for tiles
const TileVideo = React.memo(({ video }: { video: any }) => {
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(true);
  const playerRef = React.useRef<any>(null);
  
  const player = useVideoPlayer(video, (player: any) => {
    playerRef.current = player;
    player.loop = true;
    player.muted = true;
    shouldBePlayingRef.current = true;
    
    // Auto-play after a small delay
    setTimeout(() => {
      if (isMountedRef.current && playerRef.current) {
        try {
          playerRef.current.play();
        } catch {
          // Ignore initial play errors
        }
      }
    }, 100);
  });

  // Initial setup
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
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
  }, []);

  // Handle app state changes
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (playerRef.current && !playerRef.current.playing && playerRef.current.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current && playerRef.current) {
                playerRef.current.play();
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
  }, []);

  // Handle navigation focus
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (playerRef.current && !playerRef.current.playing && playerRef.current.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current && playerRef.current) {
                playerRef.current.play();
              }
            }, 100);
          }
        } catch (error) {
          // Ignore focus resume errors
        }
      }
    }, [])
  );

  if (!player) {
    return (
      <View style={[styles.tileMedia, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#666', fontSize: 12 }}>Loading...</Text>
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
  onPress 
}: { 
  option: IntentOption; 
  index: number; 
  onPress: () => void; 
}) {
  const handlePressIn = React.useCallback(() => {
    try { Haptics.selectionAsync(); } catch {}
  }, []);

  const handlePress = () => {
    onPress();
  };

  return (
    <View style={styles.tileContainer}>
      <TouchableOpacity
        style={styles.tile}
        onPress={handlePress}
        onPressIn={handlePressIn}
        activeOpacity={0.85}
      >
        <View style={styles.tileContent}>
          {option.video ? (
            <TileVideo video={option.video} />
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
            <Text style={styles.tileLabel}>{option.label}</Text>
            
            <View style={styles.tileActionButton}>
              <Text style={styles.tileActionText} numberOfLines={1}>
                Choose Photo
              </Text>
              <IconSymbol name="chevron.right" size={12} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function IntentCaptureScreen({ options, onSelect }: IntentCaptureScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Calculate grid dimensions
  const isTablet = width >= 768;
  const columnsCount = isTablet ? 3 : 2;
  const containerPadding = 24;
  const itemGap = 16;
  const totalGapWidth = (columnsCount - 1) * itemGap;
  const availableWidth = width - (containerPadding * 2) - totalGapWidth;
  const tileWidth = availableWidth / columnsCount;
  const tileHeight = tileWidth * 1.2;

  // Default intent options - photo restoration focused with "Just Explore" option
  const defaultOptions: IntentOption[] = [
    {
      id: 'fix-old-photos',
      label: 'Fix Old Family Photos',
      icon: '📸',
      demoImages: [],
      video: require('../../assets/videos/repair.mp4'),
      functionType: 'restore_repair'
    },
    {
      id: 'repair-torn',
      label: 'Repair Torn & Ripped Photos',
      icon: '📄',
      demoImages: [],
      video: require('../../assets/videos/recreate.mp4'),
      functionType: 'repair'
    },
    {
      id: 'colorize-bw',
      label: 'Colorize Black & White',
      icon: '🎨',
      demoImages: [],
      video: require('../../assets/videos/doctor.mp4'),
      functionType: 'colorize'
    },
    {
      id: 'remove-water-damage',
      label: 'Remove Water Damage',
      icon: '💧',
      demoImages: [],
      video: require('../../assets/videos/ripvid.mp4'),
      functionType: 'water_damage'
    },
    {
      id: 'sharpen-faces',
      label: 'Clear Up Blurry Faces',
      icon: '🔍',
      demoImages: [],
      video: require('../../assets/videos/clouders.mp4'),
      functionType: 'unblur'
    },
    {
      id: 'remove-scratches',
      label: 'Remove Scratches & Marks',
      icon: '✨',
      demoImages: [],
      video: require('../../assets/videos/repair.mp4'),
      functionType: 'descratch'
    },
    {
      id: 'brighten-dark',
      label: 'Brighten Dark Photos',
      icon: '☀️',
      demoImages: [],
      video: require('../../assets/videos/whitening.mp4'),
      functionType: 'enlighten'
    },
    {
      id: 'just-explore',
      label: 'Just Explore the App',
      icon: '✨',
      demoImages: [],
      video: require('../../assets/videos/welcome.mp4'),
      functionType: null
    }
  ];

  const displayOptions = options.length > 0 ? options : defaultOptions;

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What brought you here?</Text>
        </View>

        {/* Intent Options Grid */}
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.grid, { 
            gap: itemGap,
            paddingHorizontal: containerPadding 
          }]}>
            {displayOptions.map((option, index) => (
              <View key={option.id} style={{ width: tileWidth, height: tileHeight }}>
                <IntentTile
                  option={option}
                  index={index}
                  onPress={() => onSelect(option.id)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
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
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tileActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lexend-Medium',
    marginRight: 6,
  },
});