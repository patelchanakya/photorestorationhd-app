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
      // Background fade in
      backgroundOpacity.value = withTiming(1, { duration: 500 });

      // Show welcome message typewriter (1 second delay)
      setTimeout(() => {
        setShowWelcome(true);
        welcomeOpacity.value = withTiming(1, { duration: 300 });
      }, 1000);

      // Show testimonials typewriter (2 second delay)
      setTimeout(() => {
        setShowTestimonials(true);
        testimonialsOpacity.value = withTiming(1, { duration: 300 });
      }, 2000);

      // Start fade out after 15 seconds, complete after 16 seconds
      setTimeout(() => {
        containerOpacity.value = withTiming(0, { duration: 1000 }, () => {
          'worklet';
          runOnJS(onAnimationComplete)();
        });
      }, 15000);
    };

    startAnimation();
  }, []);

  return (
    <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
      <Animated.View style={[{ flex: 1 }, backgroundAnimatedStyle]}>
        <LinearGradient
          colors={['#0a0a0a', '#1a0b2e', '#0d1421']}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Rich overlay for depth */}
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View className="flex-1 justify-center items-center px-8">
            {/* Welcome Message */}
            <Animated.View style={[welcomeAnimatedStyle, { marginBottom: 40 }]}>
              {showWelcome && (
                <TypeAnimation
                  sequence={[
                    { text: 'Clever' },
                  ]}
                  typeSpeed={50}
                  cursor={false}
                  style={{
                    color: 'white',
                    fontSize: 28,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    textShadowColor: 'rgba(249, 115, 22, 0.3)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                  }}
                />
              )}
            </Animated.View>

            {/* Testimonials */}
            <Animated.View style={[testimonialsAnimatedStyle, { marginTop: 20, paddingHorizontal: 20 }]}>
              {showTestimonials && (
                <TypeAnimation
                  sequence={[
                    { text: "Brought my grandmother's photo back to life!" },
                    { text: "Brought my grandmother's photo back to life!\nAmazing! Fixed my water-damaged wedding photos" },
                    { text: "Brought my grandmother's photo back to life!\nAmazing! Fixed my water-damaged wedding photos\nCan't believe how clear my old photos look now" },
                    { text: "Brought my grandmother's photo back to life!\nAmazing! Fixed my water-damaged wedding photos\nCan't believe how clear my old photos look now\n5 stars - This app is pure magic!" },
                    { text: "Brought my grandmother's photo back to life!\nAmazing! Fixed my water-damaged wedding photos\nCan't believe how clear my old photos look now\n5 stars - This app is pure magic!\nSaved my precious family memories" },
                  ]}
                  typeSpeed={40}
                  cursor={true}
                  blinkSpeed={500}
                  style={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: 16,
                    textAlign: 'center',
                    fontStyle: 'italic',
                    lineHeight: 24,
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