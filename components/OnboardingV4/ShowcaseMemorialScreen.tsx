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
  withDelay 
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';

interface ShowcaseMemorialScreenProps {
  onContinue: () => void;
  onSkip: () => void;
}

export function ShowcaseMemorialScreen({ onContinue, onSkip }: ShowcaseMemorialScreenProps) {
  const insets = useSafeAreaInsets();
  const isMountedRef = React.useRef(true);
  const shouldBePlayingRef = React.useRef(true);
  const playerRef = React.useRef<any>(null);
  const [isVideoReady, setIsVideoReady] = React.useState(false);
  
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  const player = useVideoPlayer(require('../../assets/videos/candle.mp4'), (player: any) => {
    playerRef.current = player;
    player.loop = true;
    player.muted = true;
    
    // Mark as ready and start playing
    setIsVideoReady(true);
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
    }, 200);
  });

  // Entrance animations
  React.useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 500 });
    subtitleOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    buttonsOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
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

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Loading placeholder */}
      {!isVideoReady && (
        <View style={[styles.video, { backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#666', fontSize: 14 }}>Loading...</Text>
        </View>
      )}
      
      {/* Full-screen Video Background */}
      {player && isVideoReady && (
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
        />
      )}
      
      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(11,11,15,0.9)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      
      <View style={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        {/* Skip button - top right */}
        <View style={styles.skipContainer}>
          <OnboardingButton
            title="Skip"
            onPress={onSkip}
            variant="secondary"
            size="small"
          />
        </View>

        {/* Center content */}
        <View style={styles.centerContent}>
          <Animated.View style={titleStyle}>
            <Text style={styles.sectionHeader}>With Clever You Can:</Text>
            <Text style={styles.title}>Preserve Memories</Text>
          </Animated.View>
          
          <Animated.View style={subtitleStyle}>
            <Text style={styles.subtitle}>
              Family photos, memorial tributes, heritage
            </Text>
          </Animated.View>
        </View>

        {/* Bottom button */}
        <Animated.View style={[styles.bottomButton, buttonsStyle]}>
          <OnboardingButton
            title="Start Exploring"
            onPress={onContinue}
            variant="primary"
            size="large"
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    position: 'relative',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  skipContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 16,
  },
  bottomButton: {
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
});