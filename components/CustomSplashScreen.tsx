import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Dimensions, Image, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { TypeAnimation } from 'react-native-type-animation';
import { IconSymbol } from './ui/IconSymbol';

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
  const testimonialsOpacity = useSharedValue(0);
  
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showTestimonials, setShowTestimonials] = React.useState(false);
  
  // Add timeout refs to clear them when skipping
  const welcomeTimeout = useRef<any>(null);
  const testimonialsTimeout = useRef<any>(null);
  const autoAdvanceTimeout = useRef<any>(null);
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


  const testimonialsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: testimonialsOpacity.value,
  }));


  // Handle auto-advance with timer-based approach
  const startAutoAdvanceTimer = () => {
    if (hasSkipped.current) return;
    
    // Calculate typing time: ~350 characters at 50ms/char = ~17.5 seconds
    // Plus initial delays (3s) + buffer = 22 seconds total
    autoAdvanceTimeout.current = setTimeout(() => {
      if (!hasSkipped.current) {
        hasSkipped.current = true;
        containerOpacity.value = withTiming(0, { duration: 500 }, () => {
          'worklet';
          runOnJS(onAnimationComplete)();
        });
      }
    }, 22000);
  };

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
    if (testimonialsTimeout.current) {
      clearTimeout(testimonialsTimeout.current);
      testimonialsTimeout.current = null;
    }
    if (autoAdvanceTimeout.current) {
      clearTimeout(autoAdvanceTimeout.current);
      autoAdvanceTimeout.current = null;
    }
    
    // Stop all ongoing animations immediately
    welcomeOpacity.value = withTiming(0, { duration: 0 });
    testimonialsOpacity.value = withTiming(0, { duration: 0 });
    
    // Then fade out container and proceed
    containerOpacity.value = withTiming(0, { duration: 500 }, () => {
      'worklet';
      runOnJS(onAnimationComplete)();
    });
  };

  useEffect(() => {
    // Pre-load the icon image for onboarding screen
    const iconUri = Image.resolveAssetSource(require('@/assets/images/icon.png')).uri;
    if (iconUri) {
      Image.prefetch(iconUri).catch(() => {});
    }
    
    const startAnimation = () => {
      // Background fade in with subtle breathing animation
      backgroundOpacity.value = withTiming(1, { duration: 800 });

      // Show welcome message typewriter (1 second delay)
      welcomeTimeout.current = setTimeout(() => {
        if (!hasSkipped.current) {
          setShowWelcome(true);
          welcomeOpacity.value = withTiming(1, { duration: 400 });
        }
      }, 1000);

      // Show testimonials typewriter (3 second delay for better pacing)
      testimonialsTimeout.current = setTimeout(() => {
        if (!hasSkipped.current) {
          setShowTestimonials(true);
          testimonialsOpacity.value = withTiming(1, { duration: 500 });
        }
      }, 3000);

      // Auto-advance after testimonials complete (reduced time since no subtitle)
      autoAdvanceTimeout.current = setTimeout(() => {
        if (!hasSkipped.current) {
          hasSkipped.current = true;
          
          // Stop all animations before proceeding
          welcomeOpacity.value = withTiming(0, { duration: 0 });
          testimonialsOpacity.value = withTiming(0, { duration: 0 });
          
          containerOpacity.value = withTiming(0, { duration: 500 }, () => {
            'worklet';
            runOnJS(onAnimationComplete)();
          });
        }
      }, 23500);
    };

    startAnimation();
    
    // Cleanup timeouts on unmount
    return () => {
      hasSkipped.current = true;
      if (welcomeTimeout.current) {
        clearTimeout(welcomeTimeout.current);
        welcomeTimeout.current = null;
      }
      if (testimonialsTimeout.current) {
        clearTimeout(testimonialsTimeout.current);
        testimonialsTimeout.current = null;
      }
      if (autoAdvanceTimeout.current) {
        clearTimeout(autoAdvanceTimeout.current);
        autoAdvanceTimeout.current = null;
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
            <Animated.View style={[welcomeAnimatedStyle, { marginBottom: 12, alignItems: 'center' }]}>
              {showWelcome && (
                <TypeAnimation
                  sequence={[
                    { text: 'Clever' },
                  ]}
                  typeSpeed={90}
                  cursor={false}
                  style={{
                    color: 'white',
                    fontSize: 58,
                    fontFamily: 'PlayfairDisplay-SemiBold',
                    textAlign: 'center',
                    textShadowColor: 'rgba(139, 92, 246, 0.6)',
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 25,
                    letterSpacing: -1,
                  }}
                />
              )}
            </Animated.View>

            {/* Subtitle */}
            <View style={{ marginBottom: 25, alignItems: 'center' }}>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: 18,
                textAlign: 'center',
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}>
                The ultimate photo restoration & repair app
              </Text>
            </View>

            {/* Testimonials */}
            <Animated.View style={[testimonialsAnimatedStyle, { 
              marginTop: 15, 
              marginHorizontal: 12, // Even smaller margins for wider container
              paddingHorizontal: 28, 
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 20,
              paddingVertical: 24,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.08)',
              minHeight: 250, // Reserve space to prevent shifting and accommodate all testimonials
              alignSelf: 'stretch', // Take available width minus margins
            }]}>
              {showTestimonials && (
                <>
                  {/* Subtle header */}
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 12, fontWeight: '500', marginBottom: 8 }}>
                      Real reviews
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconSymbol name="star.fill" size={14} color="rgba(249, 115, 22, 0.7)" />
                      <IconSymbol name="star.fill" size={14} color="rgba(249, 115, 22, 0.7)" style={{ marginLeft: 2 }} />
                      <IconSymbol name="star.fill" size={14} color="rgba(249, 115, 22, 0.7)" style={{ marginLeft: 2 }} />
                      <IconSymbol name="star.fill" size={14} color="rgba(249, 115, 22, 0.7)" style={{ marginLeft: 2 }} />
                      <IconSymbol name="star.fill" size={14} color="rgba(249, 115, 22, 0.7)" style={{ marginLeft: 2 }} />
                    </View>
                  </View>

                    <TypeAnimation
                    sequence={[
                      { text: '"Your quality is so good, I got addicted"' },
                      { text: '"Your quality is so good, I got addicted"\n\n"I\'ve helped a lot of people revive pictures and it brings me so much happiness. It\'s been a little hobby for me."' },
                      { text: '"Your quality is so good, I got addicted"\n\n"I\'ve helped a lot of people revive pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"' },
                      { text: '"Your quality is so good, I got addicted"\n\n"I\'ve helped a lot of people revive pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"\n\n"Fixed 50+ photos for my Facebook group this month!"' },
                      { text: '"Your quality is so good, I got addicted"\n\n"I\'ve helped a lot of people revive pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"\n\n"Fixed 50+ photos for my Facebook group this month!"\n\n"This is therapeutic somehow"' },
                    ]}
                    typeSpeed={50}
                    cursor={true}
                    blinkSpeed={700}
                    style={{
                      color: 'rgba(255, 255, 255, 0.85)',
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
                  
                  {/* Subtle counter */}
                  <Text style={{ 
                    marginTop: 16, 
                    color: 'rgba(255, 255, 255, 0.4)', 
                    fontSize: 11, 
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    Restore. Revive. Remember.
                  </Text>
                </>
              )}
            </Animated.View>

            {/* Tap to skip hint - always visible */}
            <View style={{ 
              position: 'absolute', 
              bottom: 30, 
              left: 0, 
              right: 0, 
              alignItems: 'center' 
            }}>
              <Text style={{
                color: 'rgba(255, 255, 255, 0.3)',
                fontSize: 11,
                fontWeight: '300',
                textAlign: 'center',
              }}>
                Tap to skip
              </Text>
            </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}