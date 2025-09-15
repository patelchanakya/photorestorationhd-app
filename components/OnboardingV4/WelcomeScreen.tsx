import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
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
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

interface WelcomeScreenV4Props {
  onContinue: () => void;
}

export function WelcomeScreenV4({ onContinue }: WelcomeScreenV4Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);
  const exitOpacity = useSharedValue(1);

  // Responsive sizing
  const isSmallScreen = screenHeight < 700;
  const isMediumScreen = screenHeight >= 700 && screenHeight < 850;
  const isLargeScreen = screenHeight >= 850;

  // A/B testing copy
  const welcomeCopy = React.useMemo(() => getWelcomeCopy(), []);

  // Initial setup and animations
  React.useEffect(() => {
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
  }, [titleOpacity, subtitleOpacity, buttonScale, welcomeCopy.variant]);

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
      <View style={[
        styles.content,
        {
          paddingTop: insets.top + (isSmallScreen ? 10 : 20)
        }
      ]}>
        {/* Image at top */}
        <View style={[
          styles.imageContainer,
          {
            height: isSmallScreen ? screenHeight * 0.4 :
                   isMediumScreen ? screenHeight * 0.45 :
                   screenHeight * 0.5,
            marginBottom: isSmallScreen ? 10 : 15,
            paddingHorizontal: 0
          }
        ]}>
          <Image
            source={require('../../assets/images/onboarding/welcomescreen.png')}
            style={styles.topImage}
            contentFit="contain"
            transition={300}
          />
        </View>

        {/* Main Content */}
        <View style={[
          styles.centerContent,
          { paddingHorizontal: screenWidth * 0.06 }
        ]}>
          {/* App Logo */}
          <View style={[
            styles.logoContainer,
            { marginBottom: isSmallScreen ? 20 : 30 }
          ]}>
            <Text style={[
              styles.logo,
              {
                fontSize: isSmallScreen ? 24 : isMediumScreen ? 28 : 32
              }
            ]}>
              {t('onboardingV4.welcome.appName')}
            </Text>
          </View>

          <Animated.View style={titleStyle}>
            <Text style={[
              styles.title,
              {
                fontSize: isSmallScreen ? 26 : isMediumScreen ? 32 : 38,
                marginBottom: isSmallScreen ? 12 : 18,
                lineHeight: isSmallScreen ? 30 : isMediumScreen ? 38 : 44
              }
            ]}>
              {t(welcomeCopy.titleKey)}
            </Text>
          </Animated.View>

          <Animated.View style={subtitleStyle}>
            <Text style={[
              styles.subtitle,
              {
                fontSize: isSmallScreen ? 15 : 17,
                lineHeight: isSmallScreen ? 20 : 24,
                paddingHorizontal: screenWidth * 0.08
              }
            ]}>
              {t(welcomeCopy.subtitleKey)}
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Button */}
        <View style={[
          styles.bottomContent,
          {
            paddingBottom: insets.bottom + (isSmallScreen ? 15 : 25),
            paddingHorizontal: screenWidth * 0.06
          }
        ]}>
          <Animated.View style={buttonStyle}>
            <OnboardingButton
              title={t('onboardingV4.welcome.getStarted')}
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
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  topImage: {
    width: '100%',
    height: '100%',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    fontFamily: 'Lexend-Bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  bottomContent: {
    justifyContent: 'flex-end',
  },
});