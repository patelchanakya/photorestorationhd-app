import React from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  runOnJS,
  withDelay,
  Easing
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { getWelcomeCopy, trackABTestExposure } from '@/utils/abTesting';
import * as Haptics from 'expo-haptics';

interface WelcomeScreenV4Props {
  onContinue: () => void;
}

export function WelcomeScreenV4({ onContinue }: WelcomeScreenV4Props) {
  const insets = useSafeAreaInsets();
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);
  const exitOpacity = useSharedValue(1);
  
  // A/B testing copy
  const welcomeCopy = React.useMemo(() => getWelcomeCopy(), []);
  
  // Video player refs and state
  const playerRef = React.useRef<any>(null);
  const shouldBePlayingRef = React.useRef(true);
  const isMountedRef = React.useRef(true);
  
  // Video player setup
  const player = useVideoPlayer(require('../../assets/videos/welcome.mp4'), player => {
    playerRef.current = player;
    player.loop = true;
    player.muted = true;
    player.play();
    shouldBePlayingRef.current = true;
  });

  // Initial setup and animations
  React.useEffect(() => {
    isMountedRef.current = true;
    
    // Track A/B test exposure
    trackABTestExposure('welcomeScreenCopy', welcomeCopy.variant);
    
    // Optimized staggered entrance animations using withDelay
    const easing = Easing.out(Easing.cubic);
    titleOpacity.value = withTiming(1, { duration: 400, easing });
    subtitleOpacity.value = withDelay(150, withTiming(1, { duration: 400, easing }));
    buttonScale.value = withDelay(300, withSpring(1, { 
      damping: 15, 
      stiffness: 120,
      mass: 1 
    }));
    
    return () => {
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
    };
  }, [titleOpacity, subtitleOpacity, buttonScale, welcomeCopy.variant]);
  
  // Initial video playback setup
  React.useEffect(() => {
    if (!player) return;
    
    const playTimer = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        if (player.status !== 'idle') {
          player.play();
          shouldBePlayingRef.current = true;
        }
      } catch {
        // Ignore initial play errors
      }
    }, 50); // Minimal delay for immediate start
    
    return () => clearTimeout(playTimer);
  }, [player]);
  
  // Handle app state changes separately like working components
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current && player) {
                player.play();
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
  }, [player]);
  
  // Cleanup video player on unmount
  React.useEffect(() => {
    return () => {
      if (player) {
        try {
          if (typeof player.status !== 'undefined') {
            const status = player.status;
            if (status !== 'idle') {
              player.pause();
            }
            player.release();
          }
        } catch {
          // Silent cleanup
        }
        playerRef.current = null;
      }
    };
  }, [player]);
  
  // Handle navigation focus - restart video after navigation
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current) {
        try {
          if (player && !player.playing && player.status !== 'idle') {
            setTimeout(() => {
              if (isMountedRef.current && player) {
                player.play();
              }
            }, 100);
          }
        } catch {
          // Silent error handling
        }
      }
    }, [player])
  );

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
  }));

  // Optimized smooth exit animation with worklet and haptic feedback
  const handleContinue = React.useCallback(() => {
    // Immediate haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Button press feedback
    buttonScale.value = withSpring(0.96, { 
      damping: 20, 
      stiffness: 300 
    }, () => {
      buttonScale.value = withSpring(1, { damping: 15, stiffness: 120 });
    });

    // Exit animation
    exitOpacity.value = withTiming(0, { 
      duration: 300, 
      easing: Easing.in(Easing.cubic) 
    }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(onContinue)();
      }
    });
  }, [exitOpacity, buttonScale, onContinue]);

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Full-screen Video Background */}
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="cover"
      />
      
      {/* Gradient overlay for better text visibility */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(11,11,15,0.9)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Main Content */}
        <View style={styles.centerContent}>
          <Animated.View style={titleStyle}>
            <Text style={styles.title}>{welcomeCopy.title}</Text>
          </Animated.View>
          
          <Animated.View style={subtitleStyle}>
            <Text style={styles.subtitle}>
              {welcomeCopy.subtitle}
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Button */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonStyle}>
            <OnboardingButton
              title="Get Started"
              onPress={handleContinue}
              variant="primary"
              size="large"
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // pure black for consistency
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
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    lineHeight: 44,
    paddingHorizontal: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 16,
  },
  bottomContent: {
    paddingHorizontal: 8,
  },
});