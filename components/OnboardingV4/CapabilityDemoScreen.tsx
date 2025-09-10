import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withRepeat,
  withSpring,
  runOnJS
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';

interface IntentOption {
  id: string;
  label: string;
  icon: string;
  demoImages: string[];
}

interface CapabilityDemoScreenProps {
  intent: IntentOption | undefined;
  onContinue: () => void;
}

export function CapabilityDemoScreen({ intent, onContinue }: CapabilityDemoScreenProps) {
  const insets = useSafeAreaInsets();
  const [showAfter, setShowAfter] = React.useState(false);
  
  const titleOpacity = useSharedValue(0);
  const beforeOpacity = useSharedValue(0);
  const afterOpacity = useSharedValue(0);
  const arrowOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Entrance animations
    titleOpacity.value = withTiming(1, { duration: 500 });
    
    setTimeout(() => {
      beforeOpacity.value = withTiming(1, { duration: 400 });
    }, 300);
    
    setTimeout(() => {
      arrowOpacity.value = withTiming(1, { duration: 300 });
    }, 700);
    
    // Show transformation after 1 second
    setTimeout(() => {
      runOnJS(setShowAfter)(true);
      afterOpacity.value = withTiming(1, { duration: 600 });
    }, 1000);
    
    setTimeout(() => {
      taglineOpacity.value = withTiming(1, { duration: 400 });
    }, 1600);
    
    setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 400 });
    }, 2000);
  }, []);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const beforeStyle = useAnimatedStyle(() => ({
    opacity: beforeOpacity.value,
  }));

  const afterStyle = useAnimatedStyle(() => ({
    opacity: afterOpacity.value,
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  if (!intent) {
    return null;
  }

  return (
    <LinearGradient
      colors={['#0B0B0F', '#1a1a2e']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        {/* Header */}
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>{intent.label}</Text>
        </Animated.View>

        {/* Demo Area */}
        <View style={styles.demoContainer}>
          {/* Before/After Images */}
          <View style={styles.imageContainer}>
            {/* Before Image - Placeholder */}
            <Animated.View style={[styles.imageWrapper, beforeStyle]}>
              <View style={styles.placeholderImage}>
                <Text style={styles.placeholderText}>Before</Text>
                <Text style={styles.placeholderSubtext}>Damaged Photo</Text>
              </View>
            </Animated.View>

            {/* Arrow */}
            <Animated.View style={[styles.arrow, arrowStyle]}>
              <Text style={styles.arrowText}>→</Text>
            </Animated.View>

            {/* After Image - Placeholder */}
            <Animated.View style={[styles.imageWrapper, afterStyle]}>
              {showAfter ? (
                <View style={styles.placeholderImageAfter}>
                  <Text style={styles.placeholderText}>After</Text>
                  <Text style={styles.placeholderSubtext}>Restored ✨</Text>
                </View>
              ) : (
                <View style={styles.placeholderImageEmpty} />
              )}
            </Animated.View>
          </View>

          {/* Tagline */}
          <Animated.View style={[styles.taglineContainer, taglineStyle]}>
            <Text style={styles.tagline}>See what Clever can do</Text>
          </Animated.View>
        </View>

        {/* Bottom Button */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonStyle}>
            <OnboardingButton
              title="Try with your photo"
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 0.5,
  },
  demoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  imageWrapper: {
    flex: 1,
  },
  placeholderImage: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f97316',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageAfter: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImageEmpty: {
    aspectRatio: 3/4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  arrow: {
    paddingHorizontal: 16,
  },
  arrowText: {
    fontSize: 24,
    color: '#f97316',
    fontWeight: 'bold',
  },
  taglineContainer: {
    alignItems: 'center',
  },
  tagline: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomContent: {
    paddingHorizontal: 8,
  },
});