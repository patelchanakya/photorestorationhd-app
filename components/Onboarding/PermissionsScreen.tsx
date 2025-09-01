import React from 'react';
import { View, Text, Platform, Linking, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import * as Application from 'expo-application';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  withSequence 
} from 'react-native-reanimated';
import { OnboardingContainer } from './shared/OnboardingContainer';
import { OnboardingButton } from './shared/OnboardingButton';
import { ONBOARDING_COLORS, ONBOARDING_SPACING, ONBOARDING_TYPOGRAPHY, ONBOARDING_SHADOWS } from './shared/constants';
import { analyticsService } from '@/services/analytics';
import { permissionsService } from '@/services/permissions';

interface PermissionsScreenProps {
  onContinue: () => void;
}

export function PermissionsScreen({ onContinue }: PermissionsScreenProps) {
  const [isRequesting, setIsRequesting] = React.useState(false);
  
  const iconScale = useSharedValue(0.8);
  const iconOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(15);
  const noteOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Track screen view
    analyticsService.trackScreenView('onboarding_permissions', {
      onboarding_version: 'v3'
    });
    
    // Icon bounce animation
    iconOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    iconScale.value = withDelay(100, withSequence(
      withSpring(1.2, { damping: 12, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 250 })
    ));
    
    // Add gentle floating animation to icon
    setTimeout(() => {
      iconScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000 }),
          withTiming(1, { duration: 2000 })
        ),
        -1,
        true
      );
    }, 1000);
    
    // Text animations with stagger
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(300, withSpring(0, { damping: 15, stiffness: 200 }));
    
    bodyOpacity.value = withDelay(500, withTiming(1, { duration: 500 }));
    bodyTranslateY.value = withDelay(500, withSpring(0, { damping: 15, stiffness: 200 }));
    
    noteOpacity.value = withDelay(700, withTiming(1, { duration: 400 }));
    buttonOpacity.value = withDelay(900, withTiming(1, { duration: 400 }));
  }, []);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  const noteAnimatedStyle = useAnimatedStyle(() => ({
    opacity: noteOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleContinue = async () => {
    setIsRequesting(true);
    
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
      
      // Immediately update the permissions service state so it's available in explore screen
      permissionsService.updatePermissionState('mediaLibrary', permissionResult.status as any);
      
    } catch (error) {
      if (__DEV__) {
        console.warn('📸 [Permissions] Permission request failed:', error);
      }
    }
    
    // Always continue regardless of permission result
    // The app will handle missing permissions when the user tries to pick photos
    setIsRequesting(false);
    onContinue();
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

        {/* Hero Icon - top section */}
        <View style={{ 
          flex: 1.8,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: ONBOARDING_SPACING.xl
        }}>
          <Animated.View style={iconAnimatedStyle}>
            <Text style={{ fontSize: 140 }}>📸</Text>
          </Animated.View>
        </View>

        {/* Spacer to push title to lower portion */}
        <View style={{ flex: 0.4 }} />

        {/* Title - positioned in lower portion */}
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
          }}>
            Let's get you{'\n'}started!
          </Text>
        </Animated.View>

        {/* Body Text */}
        <Animated.View style={[
          { marginBottom: ONBOARDING_SPACING.lg }, 
          bodyAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: ONBOARDING_TYPOGRAPHY.lg, 
            color: ONBOARDING_COLORS.textMuted,
            textAlign: 'left',
            lineHeight: 26,
          }}>
            Allow photo access to get the most out of Clever.
          </Text>
        </Animated.View>

        {/* Helper Note */}
        <Animated.View style={[
          { marginBottom: ONBOARDING_SPACING.lg }, 
          noteAnimatedStyle
        ]}>
          <Text style={{ 
            fontSize: ONBOARDING_TYPOGRAPHY.sm, 
            color: ONBOARDING_COLORS.textDisabled,
            textAlign: 'left',
            lineHeight: 20,
            fontStyle: 'italic',
          }}>
            You can always change this in your device settings
          </Text>
        </Animated.View>

        {/* Continue Button */}
        <Animated.View style={[{ width: '100%' }, buttonAnimatedStyle]}>
          <OnboardingButton
            title={isRequesting ? 'Requesting Access...' : 'Continue'}
            onPress={handleContinue}
            variant="primary"
            size="large"
            disabled={isRequesting}
            style={{ width: '100%' }}
          />
        </Animated.View>
      </View>
    </OnboardingContainer>
  );
}