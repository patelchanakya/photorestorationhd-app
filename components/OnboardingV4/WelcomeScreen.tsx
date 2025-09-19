import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

import { OnboardingButton } from '@/components/OnboardingV4/shared/OnboardingButton';
import { getWelcomeCopy, trackABTestExposure } from '@/utils/abTesting';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '@/utils/responsive';
import * as Haptics from 'expo-haptics';

interface WelcomeScreenV4Props {
  onContinue: () => void;
}

export function WelcomeScreenV4({ onContinue }: WelcomeScreenV4Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const responsive = useResponsive();
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);
  const exitOpacity = useSharedValue(1);


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
      {/* Image at top - absolute full screen width */}
      <View style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        width: '100%',
        height: responsive.isTablet ? 300 : 260,
        zIndex: 1,
      }}>
        <Image
          source={require('../../assets/images/onboarding/welcomescreen.png')}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={300}
        />
      </View>

      <View style={[
        styles.content,
        {
          paddingTop: insets.top + (responsive.isTablet ? 320 : 280)
        }
      ]}>

        {/* Main Content */}
        <View style={[
          styles.centerContent,
          { paddingHorizontal: responsive.isTablet ? responsive.contentPadding : 24 }
        ]}>
          {/* App Logo */}
          <View style={[
            styles.logoContainer,
            { marginBottom: responsive.isTablet ? responsive.spacing(25) : 25 }
          ]}>
            <Text style={[
              styles.logo,
              {
                fontSize: responsive.isTablet ? responsive.fontSize(28) : 28
              }
            ]}>
              {t('onboardingV4.welcome.appName')}
            </Text>
          </View>

          <Animated.View style={titleStyle}>
            <Text style={[
              styles.title,
              {
                fontSize: responsive.isTablet ? responsive.fontSize(34) : 34,
                marginBottom: responsive.isTablet ? responsive.spacing(15) : 15,
                lineHeight: responsive.isTablet ? responsive.lineHeight(responsive.fontSize(34)) : (34 * 1.2)
              }
            ]}>
              {t(welcomeCopy.titleKey)}
            </Text>
          </Animated.View>

          <Animated.View style={subtitleStyle}>
            <Text style={[
              styles.subtitle,
              {
                fontSize: responsive.isTablet ? responsive.fontSize(16) : 16,
                lineHeight: responsive.isTablet ? responsive.lineHeight(responsive.fontSize(16)) : (16 * 1.2),
                paddingHorizontal: responsive.isTablet ? responsive.spacing(40) : 32
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
            paddingBottom: insets.bottom + (responsive.isTablet ? responsive.spacing(20) : 20),
            paddingHorizontal: responsive.contentPadding
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