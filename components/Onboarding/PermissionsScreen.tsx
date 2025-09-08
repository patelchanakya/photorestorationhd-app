import { analyticsService } from '@/services/analytics';
import { permissionsService } from '@/services/permissions';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingButton } from './shared/OnboardingButton';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { PhotoGridBackground } from './shared/PhotoGridBackground';
import { ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY } from './shared/constants';

interface PermissionsScreenProps {
  onContinue: () => void;
}

export const PermissionsScreen = React.memo(function PermissionsScreen({ onContinue }: PermissionsScreenProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const [isRequesting, setIsRequesting] = React.useState(false);
  const insets = useSafeAreaInsets();
  
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  const headerOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(15);
  const buttonOpacity = useSharedValue(0);
  const backgroundAnimation = useSharedValue(0);

  React.useEffect(() => {
    // Track screen view
    analyticsService.trackScreenView('onboarding_permissions', {
      onboarding_version: 'v3'
    });
    
    // Background gradient animation
    backgroundAnimation.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000 }),
        withTiming(0, { duration: 3000 })
      ),
      -1,
      true
    );
    
    // Faster animations with reduced stagger
    headerOpacity.value = withTiming(1, { duration: 200 });
    
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 200 }));
    
    bodyOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));
    bodyTranslateY.value = withDelay(150, withSpring(0, { damping: 15, stiffness: 200 }));
    
    buttonOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
  }, []);

  const backgroundAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 1,
    };
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleSkip = () => {
    // Track permission skip (fire and forget)
    analyticsService.track('onboarding_permission_skipped', {
      onboarding_version: 'v3'
    });
    onContinue();
  };

  const handleContinue = async () => {
    setIsRequesting(true);
    
    // Add haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      if (__DEV__) {
        console.log('📸 [Permissions] Requesting photo library access...');
      }
      
      // This will show the iOS system dialog if permissions haven't been asked before
      // or if the user needs to be prompted again
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (__DEV__) {
        console.log('📸 [Permissions] Permission result:', permissionResult.status);
      }
      
      // Track permission result (fire and forget)
      analyticsService.track('onboarding_permission_result', {
        permission_type: 'photo_library',
        status: permissionResult.status,
        onboarding_version: 'v3'
      });

      // Update permission state based on result
      if (permissionResult.status === 'granted') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Track permission granted (fire and forget)
        analyticsService.track('onboarding_permission_granted', {
          permission_type: 'photo_library',
          onboarding_version: 'v3'
        });
      } else {
        // Track permission denied (fire and forget)
        analyticsService.track('onboarding_permission_denied', {
          permission_type: 'photo_library',
          status: permissionResult.status,
          onboarding_version: 'v3'
        });
      }
      
      // Immediately update the permissions service state so it's available in explore screen
      permissionsService.updatePermissionState('mediaLibrary', permissionResult.status as any);
      
    } catch (error) {
      if (__DEV__) {
        console.warn('📸 [Permissions] Permission request failed:', error);
      }
    }
    
    // Small delay to show success state
    setTimeout(() => {
      setIsRequesting(false);
      onContinue();
    }, 500);
  };

  return (
    <OnboardingContainer>
      {/* Photo grid background */}
      <PhotoGridBackground width={screenWidth} height={screenHeight} />

      <View style={{ flex: 1 }}>
        {/* Header with Skip button */}
        <Animated.View style={[
          { 
            flexDirection: 'row', 
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          },
          headerAnimatedStyle
        ]}>
          <TouchableOpacity 
            onPress={handleSkip}
            style={{ 
              padding: 12,
              minWidth: 60,
              alignItems: 'center' 
            }}
          >
            <Text style={{ 
              fontSize: 16,
              color: '#9CA3AF',
              fontFamily: 'Lexend-Medium' 
            }}>
              Skip
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Content positioned lower on screen */}
        <View style={{ 
          flex: 1,
          justifyContent: 'flex-end',
          paddingHorizontal: ONBOARDING_SPACING.xxl,
          paddingBottom: ONBOARDING_SPACING.huge, // Match other screens
        }}>
        {/* Title */}
        <Animated.View style={[
          { 
            alignItems: 'flex-start',
            marginBottom: ONBOARDING_SPACING.lg
          }, 
          titleAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: ONBOARDING_TYPOGRAPHY.giant, 
            fontFamily: 'Lexend-Bold', 
            color: ONBOARDING_COLORS.textPrimary,
            textAlign: 'left',
            lineHeight: 52,
            textShadowColor: 'rgba(0, 0, 0, 0.8)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4,
          }}>
            {t('onboarding.permissions.title')}
          </Text>
        </Animated.View>

        {/* Body Text */}
        <Animated.View style={[
          { marginBottom: ONBOARDING_SPACING.xl }, 
          bodyAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: ONBOARDING_TYPOGRAPHY.lg, 
            color: ONBOARDING_COLORS.textSecondary,
            textAlign: 'left',
            lineHeight: 26,
            textShadowColor: 'rgba(0, 0, 0, 0.6)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}>
            {t('onboarding.permissions.subtitle')}
          </Text>
        </Animated.View>

        {/* Continue Button */}
        <Animated.View style={[{ width: '100%' }, buttonAnimatedStyle]}>
          <LinearGradient
            colors={[ONBOARDING_COLORS.accent, ONBOARDING_COLORS.accentDark]}
            style={{
              borderRadius: 16,
            }}
          >
            <OnboardingButton
              title={isRequesting ? t('onboarding.permissions.requestingAccess') : t('onboarding.permissions.continue')}
              onPress={handleContinue}
              variant="primary"
              size="large"
              disabled={isRequesting}
              style={{ 
                width: '100%', 
                backgroundColor: 'transparent',
              }}
            />
          </LinearGradient>
        </Animated.View>
        </View>
      </View>
    </OnboardingContainer>
  );
});