import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withRepeat,
  withSequence,
  withSpring 
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';

interface PermissionsScreenV4Props {
  onContinue: () => void;
}

export function PermissionsScreenV4({ onContinue }: PermissionsScreenV4Props) {
  const insets = useSafeAreaInsets();
  const iconScale = useSharedValue(0.8);
  const titleOpacity = useSharedValue(0);
  const descriptionOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Animated entrance sequence
    iconScale.value = withRepeat(
      withSequence(
        withSpring(1.1, { damping: 8 }),
        withSpring(1, { damping: 8 })
      ),
      3,
      false
    );
    
    setTimeout(() => {
      titleOpacity.value = withTiming(1, { duration: 500 });
    }, 300);
    
    setTimeout(() => {
      descriptionOpacity.value = withTiming(1, { duration: 500 });
    }, 600);
    
    setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 400 });
    }, 900);
  }, []);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const descriptionStyle = useAnimatedStyle(() => ({
    opacity: descriptionOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0B0B0F', '#1a1a2e']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Main Content */}
        <View style={styles.centerContent}>
          {/* Photo Icon */}
          <Animated.View style={[styles.iconContainer, iconStyle]}>
            <Text style={styles.icon}>📸</Text>
          </Animated.View>
          
          <Animated.View style={titleStyle}>
            <Text style={styles.title}>Access Your Photos</Text>
          </Animated.View>
          
          <Animated.View style={descriptionStyle}>
            <Text style={styles.description}>
              To restore your damaged photos,{'\n'}
              we need access to your photo library
            </Text>
          </Animated.View>
        </View>

        {/* Bottom Button */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonStyle}>
            <OnboardingButton
              title="Allow Access"
              onPress={onContinue}
              variant="primary"
              size="large"
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
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
    paddingHorizontal: 16,
  },
  bottomContent: {
    paddingHorizontal: 8,
  },
});