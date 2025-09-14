import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';
import { IconSymbol } from '../ui/IconSymbol';

interface SavePermissionScreenProps {
  onAllowAndSave: () => void;
  onNotNow: () => void;
}

export function SavePermissionScreen({ onAllowAndSave, onNotNow }: SavePermissionScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const iconOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const descriptionOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Entrance animations
    iconOpacity.value = withTiming(1, { duration: 400 });
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    descriptionOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    buttonsOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 80 }]}>
        {/* Icon */}
        <Animated.View style={[styles.iconContainer, iconStyle]}>
          <IconSymbol name="photo" size={64} color="#f97316" />
        </Animated.View>

        {/* Title */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>{t('onboardingV4.savePermission.title')}</Text>
        </Animated.View>

        {/* Description */}
        <Animated.View style={descriptionStyle}>
          <Text style={styles.description}>
            {t('onboardingV4.savePermission.description')}
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonsStyle}>
            <OnboardingButton
              title={t('onboardingV4.savePermission.saveWork')}
              onPress={onAllowAndSave}
              variant="primary"
              size="large"
              style={styles.primaryButton}
            />

            <OnboardingButton
              title={t('onboardingV4.savePermission.notNow')}
              onPress={onNotNow}
              variant="secondary"
              size="medium"
              style={styles.secondaryButton}
            />
          </Animated.View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 24,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 60,
    fontFamily: 'Lexend-Regular',
  },
  bottomContent: {
    width: '100%',
    marginTop: 'auto',
  },
  primaryButton: {
    marginBottom: 12,
    minHeight: 48,
  },
  secondaryButton: {
    minHeight: 48,
  },
});