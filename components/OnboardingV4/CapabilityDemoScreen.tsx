import React from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { useTranslation } from 'react-i18next';


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


interface CapabilityDemoScreenProps {
  intent: IntentOption | undefined;
  onContinue: () => void;
}

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

export function CapabilityDemoScreen({ intent, onContinue }: CapabilityDemoScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(true);
  const playerRef = React.useRef<any>(null);
  const [isVideoReady, setIsVideoReady] = React.useState(false);
  
  const titleOpacity = useSharedValue(0);
  const videoOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  const player = useVideoPlayer(intent?.video, (player: any) => {
    playerRef.current = player;
    player.loop = true;
    player.muted = true;
    
    // Mark as ready and start playing
    setIsVideoReady(true);
    shouldBePlayingRef.current = true;
    
    // Auto-play with minimal delay
    setTimeout(() => {
      if (isMountedRef.current && playerRef.current) {
        try {
          playerRef.current.play();
        } catch {
          // Ignore initial play errors
        }
      }
    }, 50);
  });

  // Optimized entrance animations
  React.useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    titleOpacity.value = withTiming(1, { duration: 400, easing });
    videoOpacity.value = withDelay(150, withTiming(1, { duration: 400, easing }));
    overlayOpacity.value = withDelay(600, withTiming(1, { duration: 400, easing }));
    buttonOpacity.value = withDelay(900, withTiming(1, { duration: 400, easing }));
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      setIsVideoReady(false);
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
  }, []);

  // Handle navigation focus
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current && isVideoReady) {
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
    }, [isVideoReady])
  );

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const videoStyle = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  if (!intent) {
    return null;
  }

  if (!player || !isVideoReady) {
    return (
      <LinearGradient
        colors={['#000000', '#000000']}
        style={styles.container}
      >
        <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>{t('onboardingV4.demo.loadingDemo')}</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>{intent ? t(getIntentTranslationKey(intent.id)) : ''}</Text>
        </Animated.View>

        {/* Full Screen Video Demo */}
        <Animated.View style={[styles.videoContainer, videoStyle]}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            nativeControls={false}
            allowsFullscreen={false}
          />
          
          {/* Overlay Text */}
          <Animated.View style={[styles.videoOverlay, overlayStyle]}>
            <Text style={styles.overlayText}>{t('onboardingV4.demo.overlayText')}</Text>
          </Animated.View>
        </Animated.View>

        {/* Bottom Button */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonStyle}>
            <OnboardingButton
              title={t('onboardingV4.demo.selectPhoto')}
              onPress={onContinue}
              variant="primary"
              size="large"
            />
          </Animated.View>
        </View>
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
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 0.5,
    paddingHorizontal: 16,
  },
  videoContainer: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 40,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    overflow: 'hidden',
  },
  bottomContent: {
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Lexend-Regular',
  },
});