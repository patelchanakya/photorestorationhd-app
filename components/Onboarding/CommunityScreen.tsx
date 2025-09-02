import { useTranslation } from '@/src/hooks/useTranslation';
import { Image as ExpoImage } from 'expo-image';
import React from 'react';
import { Dimensions, ScrollView, Text, View } from 'react-native';
import Animated, {
    cancelAnimation,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { ONBOARDING_SPACING } from './shared/constants';

const { width: screenWidth } = Dimensions.get('window');

interface CommunityScreenProps {
  onContinue: () => void;
}

export function CommunityScreen({ onContinue }: CommunityScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Background animation values
  const backgroundPulse = useSharedValue(0);
  
  // Hero animations
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.95);
  const photo1Rotate = useSharedValue(-8);
  const photo2Rotate = useSharedValue(12);
  const photo3Rotate = useSharedValue(-5);
  const heroGlow = useSharedValue(0);
  
  // Content animations
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(20);
  const statsOpacity = useSharedValue(0);
  const statsScale = useSharedValue(0.9);
  const buttonOpacity = useSharedValue(0);

  // Animated values for stats counting
  const stat1Value = useSharedValue(0);
  const stat2Value = useSharedValue(0);
  const stat3Value = useSharedValue(0);
  const counterGlow = useSharedValue(0);
  const statsBgPulse = useSharedValue(0);

  React.useEffect(() => {
    // Background pulse animation - continuous subtle effect
    backgroundPulse.value = withRepeat(
      withTiming(1, { duration: 4000 }),
      -1,
      true
    );

    // Stats background pulse animation
    statsBgPulse.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      true
    );

    // Hero animations with stagger
    heroOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));
    heroScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 180 }));
    heroGlow.value = withDelay(400, withTiming(1, { duration: 1000 }));
    
    // Photo rotation animations
    photo1Rotate.value = withDelay(300, withSpring(-5, { damping: 20, stiffness: 150 }));
    photo2Rotate.value = withDelay(500, withSpring(8, { damping: 20, stiffness: 150 }));
    photo3Rotate.value = withDelay(700, withSpring(-3, { damping: 20, stiffness: 150 }));
    
    // Title animation with more dramatic entrance
    titleOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(600, withSpring(0, { damping: 16, stiffness: 200 }));
    
    // Body animation
    bodyOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));
    bodyTranslateY.value = withDelay(800, withSpring(0, { damping: 16, stiffness: 200 }));
    
    // Stats animation with scale effect
    statsOpacity.value = withDelay(1000, withTiming(1, { duration: 600 }));
    statsScale.value = withDelay(1000, withSpring(1, { damping: 14, stiffness: 250 }));
    
    // Start with initial counting animation to 10,532
    stat1Value.value = withDelay(1200, withTiming(10532, { duration: 1800 }));
    
    // Regular animations for other stats
    stat2Value.value = withDelay(1400, withTiming(5.0, { duration: 1800 }));
    stat3Value.value = withDelay(1600, withTiming(172, { duration: 1800 }));
    
    // Button animation
    buttonOpacity.value = withDelay(1400, withTiming(1, { duration: 500 }));

    // Start continuous increment with glow effect
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        stat1Value.value = stat1Value.value + 1;
        // Trigger glow effect on each increment
        counterGlow.value = withTiming(1, { duration: 200 }, () => {
          counterGlow.value = withTiming(0, { duration: 800 });
        });
      }, 1500); // Slower increment for better UX
    }, 3000);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      cancelAnimation(stat1Value);
      cancelAnimation(stat2Value);
      cancelAnimation(stat3Value);
      cancelAnimation(backgroundPulse);
      cancelAnimation(counterGlow);
      cancelAnimation(statsBgPulse);
    };
  }, []);

  // Background animated style
  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + (backgroundPulse.value * 0.05),
  }));

  // Hero animated styles
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const photo1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${photo1Rotate.value}deg` }],
  }));

  const photo2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${photo2Rotate.value}deg` }],
  }));

  const photo3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${photo3Rotate.value}deg` }],
  }));

  const heroGlowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroGlow.value * 0.6,
  }));

  // Content animated styles
  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  const statsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ scale: statsScale.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const counterGlowAnimatedStyle = useAnimatedStyle(() => ({
    shadowColor: '#FF8C5A',
    shadowOpacity: 0.2 + (counterGlow.value * 0.4),
    shadowRadius: 4 + (counterGlow.value * 6),
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  }));

  const statsBgAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + (statsBgPulse.value * 0.15),
    transform: [{ scale: 1 + (statsBgPulse.value * 0.05) }],
  }));

  return (
    <OnboardingContainer>
      {/* Animated Background Elements */}
      <Animated.View style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(250, 204, 21, 0.02)',
        },
        backgroundAnimatedStyle
      ]} />
      
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section - Photo Collage */}
          <Animated.View style={[
            {
              alignItems: 'center',
              marginBottom: 56,
              marginTop: 20,
            },
            heroAnimatedStyle
          ]}>
            <ExpoImage
              source={require('@/assets/images/onboarding/communityscreen.svg')}
              style={{
                width: 320,
                height: 200,
                borderRadius: 16,
              }}
              contentFit="cover"
            />
          </Animated.View>

          {/* Main Title */}
          <Animated.View style={[
            { alignItems: 'center', marginBottom: 16 }, 
            titleAnimatedStyle
          ]}>
            <Text style={{ 
              fontSize: 34, 
              fontFamily: 'Lexend-Bold', 
              color: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 40,
              letterSpacing: -1.0,
            }}>
              {t('onboarding.community.title')}
            </Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View style={[
            { alignItems: 'center', marginBottom: 48 }, 
            bodyAnimatedStyle
          ]}>
            <Text style={{ 
              fontSize: 18, 
              color: 'rgba(255, 255, 255, 0.8)',
              textAlign: 'center',
              lineHeight: 26,
              fontFamily: 'Lexend-Regular',
              letterSpacing: -0.3,
            }}>
              {t('onboarding.community.subtitle')}
            </Text>
          </Animated.View>

          {/* Stats Section */}
          <Animated.View style={[
            {
              paddingHorizontal: 24,
              marginBottom: 32,
              alignItems: 'center',
            },
            statsAnimatedStyle
          ]}>
            {/* Live counter */}
            <StatItem
              value={stat1Value}
              suffix=""
              label={t('onboarding.community.photosPerfected')}
              isCounting
              isLarge
              glowStyle={counterGlowAnimatedStyle}
              bgStyle={statsBgAnimatedStyle}
            />
          </Animated.View>
        </ScrollView>

        {/* Continue Button - Fixed at bottom */}
        <Animated.View style={[
          { 
            paddingHorizontal: ONBOARDING_SPACING.xxl, 
            paddingBottom: Math.max(insets.bottom, ONBOARDING_SPACING.huge),
            paddingTop: ONBOARDING_SPACING.xl,
          }, 
          buttonAnimatedStyle
        ]}>
                      <OnboardingButton
              title={t('onboarding.community.continue')}
              onPress={onContinue}
            variant="primary"
            size="large"
            style={{ width: '100%' }}
          />
        </Animated.View>
      </View>
    </OnboardingContainer>
  );
}

interface StatItemProps {
  value: Animated.SharedValue<number>;
  suffix: string;
  label: string;
  isDecimal?: boolean;
  isCounting?: boolean;
  isLarge?: boolean;
  glowStyle?: any;
  bgStyle?: any;
}

function StatItem({ value, suffix, label, isDecimal = false, isCounting = false, isLarge = false, glowStyle, bgStyle }: StatItemProps) {
  const [displayText, setDisplayText] = React.useState('0');

  // Use animated reaction to update the text when value changes
  useAnimatedReaction(
    () => value.value,
    (currentValue) => {
      if (isCounting) {
        const displayValue = Math.round(currentValue);
        const formattedValue = displayValue.toLocaleString('en-US');
        runOnJS(setDisplayText)(`${formattedValue}${suffix}`);
      } else {
        const displayValue = isDecimal ? currentValue.toFixed(1) : Math.round(currentValue);
        runOnJS(setDisplayText)(`${displayValue}${suffix}`);
      }
    }
  );

  return (
    <View style={{ alignItems: 'center', position: 'relative' }}>
      
      <Animated.Text style={[
        { 
          fontSize: isLarge ? 64 : 44, 
          fontFamily: isCounting ? 'Lexend-SemiBold' : 'Lexend-SemiBold',
          color: isCounting ? '#FF6B35' : '#FFFFFF',
          marginBottom: isLarge ? 8 : 6,
          letterSpacing: -0.8,
          textAlign: 'center',
          shadowColor: isCounting ? '#FFB380' : '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        isCounting && glowStyle
      ]}>
        {displayText}
      </Animated.Text>
      <Text style={{ 
        fontSize: isLarge ? 14 : 12, 
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        fontFamily: 'Lexend-Medium',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}>
        {label}
      </Text>
    </View>
  );
}

