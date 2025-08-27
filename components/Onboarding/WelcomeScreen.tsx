import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
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

interface WelcomeScreenProps {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);
  const legalOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  React.useEffect(() => {
    // Stagger the animations for a smooth entrance
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 200 }));
    
    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    subtitleTranslateY.value = withDelay(400, withSpring(0, { damping: 15, stiffness: 200 }));
    
    legalOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    
    buttonOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    buttonScale.value = withDelay(800, withSpring(1, { damping: 15, stiffness: 200 }));
  }, []);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const legalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: legalOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  const openTerms = () => {
    // Replace with your actual terms URL
    Linking.openURL('https://your-app.com/terms');
  };

  const openPrivacy = () => {
    // Replace with your actual privacy URL  
    Linking.openURL('https://your-app.com/privacy');
  };

  return (
    <OnboardingContainer>
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: ONBOARDING_SPACING.xxl 
      }}>
        {/* Main Content */}
        <View style={{ alignItems: 'center', marginBottom: ONBOARDING_SPACING.massive * 1.5 }}>
          {/* App Title */}
          <Animated.View style={[
            { alignItems: 'center', marginBottom: ONBOARDING_SPACING.xl }, 
            titleAnimatedStyle
          ]}>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.giant, 
              fontWeight: ONBOARDING_TYPOGRAPHY.bold, 
              color: ONBOARDING_COLORS.textPrimary,
              textAlign: 'center',
              marginBottom: ONBOARDING_SPACING.sm,
            }}>
              Welcome to Clever! ✨
            </Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.View style={[{ alignItems: 'center' }, subtitleAnimatedStyle]}>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.xl, 
              color: ONBOARDING_COLORS.textSecondary,
              textAlign: 'center',
              lineHeight: 28,
              paddingHorizontal: ONBOARDING_SPACING.md,
            }}>
              Transform your photos with AI magic
            </Text>
          </Animated.View>
        </View>

        {/* Legal Text - Fixed inline layout */}
        <Animated.View style={[{ marginBottom: ONBOARDING_SPACING.xxxl }, legalAnimatedStyle]}>
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            justifyContent: 'center',
            paddingHorizontal: ONBOARDING_SPACING.xxxl,
          }}>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.sm, 
              color: ONBOARDING_COLORS.textDisabled,
              textAlign: 'center',
              lineHeight: 20,
            }}>
              By continuing, you agree to our{' '}
            </Text>
            <TouchableOpacity onPress={openTerms}>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.sm,
                color: ONBOARDING_COLORS.accent, 
                textDecorationLine: 'underline',
                lineHeight: 20,
              }}>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text style={{ 
              fontSize: ONBOARDING_TYPOGRAPHY.sm, 
              color: ONBOARDING_COLORS.textDisabled,
              lineHeight: 20,
            }}>
              {' '}and{' '}
            </Text>
            <TouchableOpacity onPress={openPrivacy}>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.sm,
                color: ONBOARDING_COLORS.accent, 
                textDecorationLine: 'underline',
                lineHeight: 20,
              }}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Get Started Button */}
        <Animated.View style={[{ width: '100%', maxWidth: 280 }, buttonAnimatedStyle]}>
          <OnboardingButton
            title="Get Started"
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