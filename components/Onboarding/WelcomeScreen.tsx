import { NetworkErrorModal } from '@/components/NetworkErrorModal';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { analyticsService } from '@/services/analytics';
import { useTranslation } from '@/src/hooks/useTranslation';
import React from 'react';
import { Dimensions, Image, Linking, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { IconSymbol } from '../ui/IconSymbol';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY } from './shared/constants';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export const WelcomeScreen = React.memo(function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const { t } = useTranslation();
  
  if (__DEV__) {
    console.log('🔥 [WELCOME-SCREEN] Component mounting...');
    console.log('🔥 [WELCOME-SCREEN] Props:', { onContinue: !!onContinue });
  }

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isTablet = screenWidth > 768;
  const imageHeight = Math.min(screenHeight * 0.4, isTablet ? 400 : 300);
  
  if (__DEV__) {
    console.log('🔥 [WELCOME-SCREEN] Dimensions:', { screenWidth, screenHeight, isTablet, imageHeight });
  }
  
  const { hasReliableConnection, refreshNetworkStatus } = useNetworkStatus();
  const [showNetworkModal, setShowNetworkModal] = React.useState(false);
  
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const legalOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  React.useEffect(() => {
    if (__DEV__) {
      console.log('🔥 [WELCOME-SCREEN] useEffect triggered');
    }
    
    // Track screen view
    analyticsService.trackScreenView('onboarding_welcome', {
      onboarding_version: 'v3',
      is_tablet: isTablet ? 'true' : 'false'
    });
    
    if (__DEV__) {
      console.log('🔥 [WELCOME-SCREEN] Starting animations...');
    }
    
    // Faster animations for snappier feel
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 200 }));
    
    legalOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
    
    buttonOpacity.value = withDelay(300, withTiming(1, { duration: 250 }));
    buttonScale.value = withDelay(300, withSpring(1, { damping: 15, stiffness: 200 }));
    
    if (__DEV__) {
      console.log('🔥 [WELCOME-SCREEN] Animations initiated');
    }
  }, [isTablet]);

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

  const handleGetStarted = async () => {
    if (__DEV__) {
      console.log('🚀 [WelcomeScreen] Get Started pressed - checking network and photo access...');
    }
    
    // Check network connectivity before proceeding
    const isConnected = hasReliableConnection();
    
    if (!isConnected) {
      if (__DEV__) {
        console.log('❌ [WelcomeScreen] No network connection - showing modal');
      }
      setShowNetworkModal(true);
      return;
    }
    
    
    if (__DEV__) {
      console.log('✅ [WelcomeScreen] Network and photo access OK - proceeding with onboarding');
    }
    
    // Proceed with onboarding
    onContinue();
  };
  
  const handleNetworkRetry = async () => {
    if (__DEV__) {
      console.log('🔄 [WelcomeScreen] Retrying network check...');
    }
    
    const isConnected = await refreshNetworkStatus();
    
    if (isConnected) {
      if (__DEV__) {
        console.log('✅ [WelcomeScreen] Network restored - closing modal and continuing');
      }
      setShowNetworkModal(false);
      onContinue();
    } else {
      if (__DEV__) {
        console.log('❌ [WelcomeScreen] Still no network connection');
      }
      // Modal stays open, user can try again or cancel
    }
  };
  
  const handleNetworkModalClose = () => {
    if (__DEV__) {
      console.log('✋ [WelcomeScreen] Network modal closed by user');
    }
    setShowNetworkModal(false);
  };

  if (__DEV__) {
    console.log('🔥 [WELCOME-SCREEN] About to render OnboardingContainer');
  }

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
              {t('onboarding.welcome.title')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ 
                fontSize: ONBOARDING_TYPOGRAPHY.giant, 
                fontFamily: 'Lexend-Bold', 
                color: ONBOARDING_COLORS.textPrimary,
                textAlign: 'left',
              }}>
                {t('onboarding.welcome.appName')}
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
            {t('onboarding.welcome.terms')}{' '}
            <Text 
              style={{ color: ONBOARDING_COLORS.accent, textDecorationLine: 'underline' }}
              onPress={openTerms}
            >
              {t('onboarding.welcome.termsOfService')}
            </Text>
            {' '}{t('onboarding.welcome.and')}{' '}
            <Text 
              style={{ color: ONBOARDING_COLORS.accent, textDecorationLine: 'underline' }}
              onPress={openPrivacy}
            >
              {t('onboarding.welcome.privacyPolicy')}
            </Text>
          </Text>
        </Animated.View>

        {/* Get Started Button - positioned at bottom */}
        <Animated.View style={[{ width: '100%' }, buttonAnimatedStyle]}>
          <OnboardingButton
            title={t('onboarding.welcome.getStarted')}
            onPress={handleGetStarted}
            variant="primary"
            size="large"
            style={{ width: '100%' }}
          />
        </Animated.View>
        
        {/* Network Error Modal */}
        <NetworkErrorModal
          visible={showNetworkModal}
          onClose={handleNetworkModalClose}
          onRetry={handleNetworkRetry}
          message="You need an internet connection to continue. Please check your Wi-Fi or cellular data."
        />
      </View>
    </OnboardingContainer>
  );
});