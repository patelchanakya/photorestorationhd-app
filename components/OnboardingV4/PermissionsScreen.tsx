import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withRepeat,
  withDelay,
  Easing
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface PermissionsScreenV4Props {
  onContinue: () => void;
}

// Sample images for the falling animation
const SAMPLE_IMAGES = [
  require('../../assets/images/popular/colorize/pop-1.png'),
  require('../../assets/images/popular/descratch/pop-2.png'),
  require('../../assets/images/popular/enhance/pop-3.png'),
  require('../../assets/images/popular/brighten/pop-4.png'),
  require('../../assets/images/backgrounds/cleanbkgd.jpeg'),
  require('../../assets/images/backgrounds/naturebgd.jpeg'),
];

// Falling Photo Component
const FallingPhoto = React.memo(({ 
  source, 
  delay,
  startX,
  screenHeight,
  screenWidth,
  photoSize 
}: { 
  source: any; 
  delay: number;
  startX: number;
  screenHeight: number;
  screenWidth: number;
  photoSize: number;
}) => {
  const translateY = useSharedValue(-photoSize); // Start from above screen
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0.8);

  React.useEffect(() => {
    // Faster, more natural falling animation
    const baseDuration = 4000;
    const duration = baseDuration + Math.random() * 2000; // 4-6 seconds for quicker motion
    
    opacity.value = withDelay(delay, withTiming(0.85, { duration: 600, easing: Easing.out(Easing.cubic) }));
    scale.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 100 }));
    
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(screenHeight + photoSize, { 
          duration,
          easing: Easing.linear // Linear for consistent falling speed
        }),
        -1, // infinite repeat
        false
      )
    );
    
    // Much smoother rotation with less dramatic turns
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { // Full rotation but smooth
          duration: duration * 2, // Slower rotation relative to falling
          easing: Easing.linear // Linear for smooth continuous rotation
        }),
        -1,
        false
      )
    );
  }, [delay, screenHeight, photoSize]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: startX },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value }
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0, // Start from very top
          left: 0,
          width: photoSize,
          height: photoSize,
          borderRadius: photoSize * 0.2,
          overflow: 'hidden',
          backgroundColor: '#ffffff', // Solid background for shadow optimization
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 4,
        },
        animatedStyle
      ]}
    >
      <ExpoImage
        source={source}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </Animated.View>
  );
});

export function PermissionsScreenV4({ onContinue }: PermissionsScreenV4Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const titleOpacity = useSharedValue(0);
  const descriptionOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Simple entrance animation
    
    setTimeout(() => {
      titleOpacity.value = withTiming(1, { duration: 500 });
    }, 300);
    
    setTimeout(() => {
      descriptionOpacity.value = withTiming(1, { duration: 500 });
    }, 600);
    
    setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 400 });
    }, 900);
  }, []);


  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  // Generate responsive falling photo positions and delays
  const fallingPhotos = React.useMemo(() => {
    // Responsive photo size based on screen width (made larger)
    const basePhotoSize = Math.min(width, height) * 0.18; // 18% of smaller dimension (increased from 12%)
    const photoSize = Math.max(65, Math.min(basePhotoSize, 120)); // Between 65-120px (increased from 45-80px)
    
    // Reduced photo count for more elegant, less cluttered look
    const isSmallScreen = width < 400;
    const isTablet = width > 768;
    const photoCount = isSmallScreen ? 5 : isTablet ? 9 : 7;
    
    const photos = [];
    for (let i = 0; i < photoCount; i++) {
      photos.push({
        id: i,
        source: SAMPLE_IMAGES[i % SAMPLE_IMAGES.length],
        startX: Math.random() * (width - photoSize),
        delay: Math.random() * 4000, // Random delay up to 4 seconds for quicker start
        photoSize,
      });
    }
    return photos;
  }, [width, height]);

  return (
    <View style={styles.container}>
      {/* Falling Photos Background */}
      <View style={StyleSheet.absoluteFill}>
        {fallingPhotos.map((photo) => (
          <FallingPhoto
            key={photo.id}
            source={photo.source}
            startX={photo.startX}
            delay={photo.delay}
            screenHeight={height}
            screenWidth={width}
            photoSize={photo.photoSize}
          />
        ))}
      </View>

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Main Content */}
        <View style={styles.centerContent}>
          
          <Animated.View style={titleStyle}>
            <Text style={styles.title}>
              Get the most out of Clever!{'\u00A0\u00A0'}<IconSymbol 
                name="wand.and.stars" 
                size={32} 
                color="#FFFFFF" 
                style={{ transform: [{ translateY: -6 }] }}
              />
            </Text>
          </Animated.View>
          
          <Animated.View style={descriptionStyle}>
            <Text style={styles.subtitle}>
              We only access photos you choose to edit and enhance.
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Button */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonStyle}>
            <Text style={styles.settingsNote}>
              You can change this later in settings
            </Text>
            <OnboardingButton
              title="Allow Access"
              onPress={onContinue}
              variant="primary"
              size="large"
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black like other screens
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    fontSize: 38, // Match updated WelcomeScreen
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
    fontSize: 17, // Match WelcomeScreen for consistency
    color: '#E5E7EB',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    paddingHorizontal: 16, // Match WelcomeScreen padding
  },
  bottomContent: {
    paddingHorizontal: 8,
  },
  settingsNote: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.1,
  },
});