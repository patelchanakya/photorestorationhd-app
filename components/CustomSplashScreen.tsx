import React, { useEffect, useRef } from 'react';
import { View, Image, Text, Dimensions } from 'react-native';
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
  const testimonialsOpacity = useSharedValue(0);
  
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showTestimonials, setShowTestimonials] = React.useState(false);

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

  useEffect(() => {
    const startAnimation = () => {
      // Background fade in with subtle breathing animation
      backgroundOpacity.value = withTiming(1, { duration: 800 });

      // Show welcome message typewriter (1 second delay)
      setTimeout(() => {
        setShowWelcome(true);
        welcomeOpacity.value = withTiming(1, { duration: 400 });
      }, 1000);

      // Show testimonials typewriter (2.5 second delay for better pacing)
      setTimeout(() => {
        setShowTestimonials(true);
        testimonialsOpacity.value = withTiming(1, { duration: 400 });
      }, 2500);

      // Start fade out after 14 seconds, complete after 15 seconds
      setTimeout(() => {
        containerOpacity.value = withTiming(0, { duration: 1000 }, () => {
          'worklet';
          runOnJS(onAnimationComplete)();
        });
      }, 14000);
    };

    startAnimation();
  }, []);

  return (
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
            <Animated.View style={[welcomeAnimatedStyle, { marginBottom: 60 }]}>
              {showWelcome && (
                <TypeAnimation
                  sequence={[
                    { text: 'Clever' },
                  ]}
                  typeSpeed={70}
                  cursor={false}
                  style={{
                    color: 'white',
                    fontSize: 34,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    textShadowColor: 'rgba(249, 115, 22, 0.4)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 12,
                    letterSpacing: 1,
                  }}
                />
              )}
            </Animated.View>

            {/* Testimonials */}
            <Animated.View style={[testimonialsAnimatedStyle, { marginTop: 20, paddingHorizontal: 24, maxWidth: SCREEN_WIDTH * 0.9 }]}>
              {showTestimonials && (
                <TypeAnimation
                  sequence={[
                    { text: '"Your quality is good, got addicted to your app"' },
                    { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."' },
                    { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"' },
                    { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"\n\n"Finally found what I was looking for"' },
                    { text: '"Your quality is good, got addicted to your app"\n\n"I\'ve helped a lot of people review pictures and it brings me so much happiness. It\'s been a little hobby for me."\n\n"My mom cried when she saw her childhood photos restored"\n\n"Finally found what I was looking for"\n\n"This is therapeutic somehow"' },
                  ]}
                  typeSpeed={45}
                  cursor={true}
                  blinkSpeed={600}
                  style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: 17,
                    textAlign: 'center',
                    fontStyle: 'italic',
                    lineHeight: 32,
                    fontWeight: '400',
                  }}
                />
              )}
            </Animated.View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}