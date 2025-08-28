import React from 'react';
import { View, Text, TouchableOpacity, Linking, Image, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { OnboardingButton } from './shared/OnboardingButton';
import { ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY } from './shared/constants';
import { IconSymbol } from '../ui/IconSymbol';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isTablet = screenWidth > 768;
  const imageHeight = Math.min(screenHeight * 0.4, isTablet ? 400 : 300);
  
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const legalOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  React.useEffect(() => {
    // Stagger the animations for a smooth entrance
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 200 }));
    
    legalOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    
    buttonOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    buttonScale.value = withDelay(600, withSpring(1, { damping: 15, stiffness: 200 }));
  }, []);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const legalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: legalOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  const openTerms = () => {
    Linking.openURL('http://apple.com/legal/internet-services/itunes/dev/stdeula/');
  };

  const openPrivacy = () => {
    Linking.openURL('https://cleverapp.lovable.app/privacy-policy');
  };

  return (
    <OnboardingContainer>
      <View style={{ 
        flex: 1,
        paddingHorizontal: ONBOARDING_SPACING.xxl,
        paddingBottom: ONBOARDING_SPACING.huge,
      }}>
        {/* Spacer to position content */}
        <View style={{ flex: 0.3 }} />

        {/* Hero Image - top half */}
        <View style={{ 
          height: imageHeight,
          width: screenWidth,
          marginLeft: -ONBOARDING_SPACING.xxl,
          marginRight: -ONBOARDING_SPACING.xxl,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: ONBOARDING_SPACING.xl
        }}>
          <Image 
            source={require('../../assets/images/onboarding/welcomescreen.png')}
            style={{
              width: screenWidth,
              height: imageHeight,
              resizeMode: 'cover',
            }}
          />
        </View>

        {/* Spacer to push title to lower third */}
        <View style={{ flex: 1.2 }} />

        {/* Title - positioned in lower third */}
        <Animated.View style={[
          { 
            alignItems: 'flex-start',
            marginBottom: ONBOARDING_SPACING.massive * 0.8
          }, 
          titleAnimatedStyle
        ]}>
          <View>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.giant, 
              fontFamily: 'Lexend-Bold', 
              color: ONBOARDING_COLORS.textPrimary,
              textAlign: 'left',
              lineHeight: 52,
            }}>
              Welcome to
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.giant, 
                fontFamily: 'Lexend-Bold', 
                color: ONBOARDING_COLORS.textPrimary,
                textAlign: 'left',
              }}>
                Clever! 
              </Text>
              <IconSymbol 
                name="wand.and.stars" 
                size={34} 
                color={ONBOARDING_COLORS.accent}
                style={{ marginLeft: 8, opacity: 0.95 }}
              />
            </View>
          </View>
        </Animated.View>

        {/* Legal Text - positioned above button */}
        <Animated.View style={[{ marginBottom: ONBOARDING_SPACING.lg }, legalAnimatedStyle]}>
          <Text style={{ 
            fontSize: ONBOARDING_TYPOGRAPHY.sm, 
            fontFamily: 'Lexend-Regular',
            color: ONBOARDING_COLORS.textDisabled,
            textAlign: 'left',
            lineHeight: 20,
          }}>
            By continuing, you accept our{' '}
            <Text 
              style={{ color: ONBOARDING_COLORS.accent, textDecorationLine: 'underline' }}
              onPress={openTerms}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text 
              style={{ color: ONBOARDING_COLORS.accent, textDecorationLine: 'underline' }}
              onPress={openPrivacy}
            >
              Privacy Policy
            </Text>
          </Text>
        </Animated.View>

        {/* Get Started Button - positioned at bottom */}
        <Animated.View style={[{ width: '100%' }, buttonAnimatedStyle]}>
          <OnboardingButton
            title="Get Started >"
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