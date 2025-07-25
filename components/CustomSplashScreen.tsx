import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TypeAnimation } from 'react-native-type-animation';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CustomSplashScreenProps {
  onAnimationComplete: () => void;
}

export default function CustomSplashScreen({ onAnimationComplete }: CustomSplashScreenProps) {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const glowOpacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);
  const welcomeOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const testimonialsOpacity = useSharedValue(0);
  
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showTestimonials, setShowTestimonials] = React.useState(false);
  
  // Add timeout refs to clear them when skipping
  const welcomeTimeout = useRef<NodeJS.Timeout | null>(null);
  const subtitleTimeout = useRef<NodeJS.Timeout | null>(null);
  const testimonialsTimeout = useRef<NodeJS.Timeout | null>(null);
  const hasSkipped = useRef(false);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const welcomeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: welcomeOpacity.value,
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleOpacity.value === 0 ? 10 : 0 }],
  }));

  const testimonialsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: testimonialsOpacity.value,
  }));

  // Handle tap to skip
  const handleSkip = () => {
    // Prevent multiple calls
    if (hasSkipped.current) return;
    hasSkipped.current = true;
    
    // Clear any pending timeouts
    if (welcomeTimeout.current) {
      clearTimeout(welcomeTimeout.current);
      welcomeTimeout.current = null;
    }
    if (subtitleTimeout.current) {
      clearTimeout(subtitleTimeout.current);
      subtitleTimeout.current = null;
    }
    if (testimonialsTimeout.current) {
      clearTimeout(testimonialsTimeout.current);
      testimonialsTimeout.current = null;
    }
    
    // Immediately fade out and proceed
    containerOpacity.value = withTiming(0, { duration: 500 }, () => {
      'worklet';
      runOnJS(onAnimationComplete)();
    });
  };

  useEffect(() => {
    const startAnimation = () => {
      // Background fade in with subtle breathing animation
      backgroundOpacity.value = withTiming(1, { duration: 800 });

      // Show welcome message typewriter (1 second delay)
      welcomeTimeout.current = setTimeout(() => {
        if (!hasSkipped.current) {
          setShowWelcome(true);
          welcomeOpacity.value = withTiming(1, { duration: 400 });
          
          // Show subtitle 800ms after main title starts
          subtitleTimeout.current = setTimeout(() => {
            if (!hasSkipped.current) {
              subtitleOpacity.value = withTiming(1, { duration: 600 });
            }
          }, 800);
        }
      }, 1000);

      // Show testimonials typewriter (3 second delay for better pacing)
      testimonialsTimeout.current = setTimeout(() => {
        if (!hasSkipped.current) {
          setShowTestimonials(true);
          testimonialsOpacity.value = withTiming(1, { duration: 500 });
        }
      }, 3000);

      // Remove auto-advance timer - let user tap to skip or let it play indefinitely
    };

    startAnimation();
    
    // Cleanup timeouts on unmount
    return () => {
      hasSkipped.current = true;
      if (welcomeTimeout.current) {
        clearTimeout(welcomeTimeout.current);
        welcomeTimeout.current = null;
      }
      if (subtitleTimeout.current) {
        clearTimeout(subtitleTimeout.current);
        subtitleTimeout.current = null;
      }
      if (testimonialsTimeout.current) {
        clearTimeout(testimonialsTimeout.current);
        testimonialsTimeout.current = null;
      }
    };
  }, []);

  return (
    <TouchableOpacity onPress={handleSkip} style={{ flex: 1 }} activeOpacity={1}>
      <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
        <Animated.View style={[{ flex: 1 }, backgroundAnimatedStyle]}>
          <LinearGradient
            colors={['#0a0a0a', '#1a0b2e', '#0d1421', '#0a0a0a']}
            style={{ flex: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Rich overlay for depth with subtle breathing effect */}
            <LinearGradient
              colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View className="flex-1 justify-center items-center px-8">
            {/* Welcome Message */}
            <Animated.View style={[welcomeAnimatedStyle, { marginBottom: 15, alignItems: 'center' }]}>
              {showWelcome && (
                <TypeAnimation
                  sequence={[
                    { text: 'Clever' },
                  ]}
                  typeSpeed={70}
                  cursor={false}
                  style={{
                    color: 'white',
                    fontSize: 38,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    textShadowColor: 'rgba(249, 115, 22, 0.5)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 15,
                    letterSpacing: 1.2,
                  }}
                />
              )}
            </Animated.View>

            {/* Subtitle */}
            <Animated.View style={[subtitleAnimatedStyle, { marginBottom: 50, alignItems: 'center' }]}>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: 17,
                fontWeight: '500',
                textAlign: 'center',
                letterSpacing: 0.8,
                textShadowColor: 'rgba(0, 0, 0, 0.3)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }}>
                The best photo restoration app
              </Text>
            </Animated.View>

            {/* Testimonials */}
            <Animated.View style={[testimonialsAnimatedStyle, { 
              marginTop: 20, 
              paddingHorizontal: 28, 
              maxWidth: SCREEN_WIDTH * 0.88,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 20,
              paddingVertical: 24,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }]}>
              {showTestimonials && (
                <TypeAnimation
                    sequence={[
                      { text: '"Your quality is good, got addicted to your app"' },
                      { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."' },
                      { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"' },
                      { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"\n\n"Finally found what I was looking for"' },
                      { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"\n\n"Finally found what I was looking for"\n\n"This is therapeutic somehow"' },
                    ]}
                    typeSpeed={50}
                    cursor={true}
                    blinkSpeed={700}
                    style={{
                      color: 'rgba(255, 255, 255, 0.92)',
                      fontSize: 16,
                      textAlign: 'center',
                      fontStyle: 'italic',
                      lineHeight: 28,
                      fontWeight: '400',
                      textShadowColor: 'rgba(0, 0, 0, 0.2)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}
                  />
              )}
            </Animated.View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}