import { NetworkErrorModal } from '@/components/NetworkErrorModal';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { analyticsService } from '@/services/analytics';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { AppState, Dimensions, Linking, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
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
  const playerRef = React.useRef<any>(null);
  const shouldBePlayingRef = React.useRef(true);
  const isMountedRef = React.useRef(true);
  
  // Video player setup
  const player = useVideoPlayer(require('../../assets/videos/welcome.mp4'), player => {
    playerRef.current = player;
    player.loop = true;
    player.play();
    shouldBePlayingRef.current = true;
  });
  
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const legalOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.8);

  // App state and video lifecycle management
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

    // Handle app state changes for video lifecycle
    const handleAppStateChange = (nextAppState: string) => {
      if (__DEV__) {
        console.log('🎬 [WELCOME-VIDEO] App state changed:', nextAppState);
      }

      if (playerRef.current) {
        try {
          if (nextAppState === 'active') {
            // App came to foreground - restart video
            if (__DEV__) {
              console.log('🎬 [WELCOME-VIDEO] App active - restarting video');
            }
            if (shouldBePlayingRef.current && isMountedRef.current) {
              playerRef.current.play();
            }
          } else if (nextAppState === 'background' || nextAppState === 'inactive') {
            // App going to background - pause video
            if (__DEV__) {
              console.log('🎬 [WELCOME-VIDEO] App backgrounded - pausing video');
            }
            playerRef.current.pause();
            shouldBePlayingRef.current = false;
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('🎬 [WELCOME-VIDEO] Error handling app state change:', error);
          }
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function
    return () => {
      if (__DEV__) {
        console.log('🔥 [WELCOME-SCREEN] Cleanup starting');
      }
      
      isMountedRef.current = false;
      shouldBePlayingRef.current = false;
      
      // Remove app state listener
      appStateSubscription?.remove();
      
      // Clean up video player
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.release();
          if (__DEV__) {
            console.log('🎬 [WELCOME-VIDEO] Video player cleaned up');
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('🎬 [WELCOME-VIDEO] Error during video cleanup:', error);
          }
        }
        playerRef.current = null;
      }
    };
  }, [isTablet, titleOpacity, titleTranslateY, legalOpacity, buttonOpacity, buttonScale]);

  // Handle navigation focus - restart video after fast refresh
  useFocusEffect(
    React.useCallback(() => {
      if (shouldBePlayingRef.current && isMountedRef.current && playerRef.current) {
        try {
          if (playerRef.current.status !== 'idle' && !playerRef.current.playing) {
            if (__DEV__) {
              console.log('🎬 [WELCOME-VIDEO] Focus restored - restarting video');
            }
            setTimeout(() => {
              if (isMountedRef.current && playerRef.current) {
                playerRef.current.play();
              }
            }, 100);
          }
        } catch (error) {
          if (__DEV__) {
            console.warn('🎬 [WELCOME-VIDEO] Error resuming on focus:', error);
          }
        }
      }
    }, [])
  );

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
        {/* Hero Video - full width and height */}
        <View style={{ 
          flex: 3,
          width: screenWidth,
          marginLeft: -ONBOARDING_SPACING.xxl,
          marginRight: -ONBOARDING_SPACING.xxl,
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}>
          <VideoView
            player={player}
            style={{
              width: '100%',
              height: '100%',
            }}
            nativeControls={false}
            contentFit="cover"
          />
          {/* Gradient fade overlay at bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 100,
            }}
            pointerEvents="none"
          />
        </View>

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