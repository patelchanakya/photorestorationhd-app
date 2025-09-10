import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring,
  withDelay,
  withSequence
} from 'react-native-reanimated';

import { OnboardingButton } from '@/components/Onboarding/shared/OnboardingButton';

interface PhotoData {
  uri: string;
  width: number;
  height: number;
}

interface ProcessingResult {
  uri: string;
  processingTime: number;
}

interface ResultConversionScreenProps {
  beforePhoto: PhotoData | null;
  afterPhoto: ProcessingResult | null;
  onStartTrial: () => void;
  onMaybeLater: () => void;
}

export function ResultConversionScreen({
  beforePhoto,
  afterPhoto,
  onStartTrial,
  onMaybeLater
}: ResultConversionScreenProps) {
  const insets = useSafeAreaInsets();
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedToGallery, setSavedToGallery] = React.useState(false);
  
  const checkmarkScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const imageOpacity = useSharedValue(0);
  const saveMessageOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  const handleSaveToGallery = async () => {
    if (isSaving || savedToGallery) return;
    
    try {
      setIsSaving(true);
      
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to save photos to your gallery.');
        return;
      }
      
      // Use the restored photo URI, or fallback to before photo
      const imageUri = afterPhoto?.uri || beforePhoto?.uri;
      if (!imageUri) {
        Alert.alert('Error', 'No photo available to save.');
        return;
      }
      
      // Save to media library
      await MediaLibrary.saveToLibraryAsync(imageUri);
      setSavedToGallery(true);
      Alert.alert('Success!', 'Photo saved to your gallery.');
      
    } catch (error) {
      console.error('Failed to save photo:', error);
      Alert.alert('Error', 'Failed to save photo to gallery.');
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    // Success checkmark animation
    checkmarkScale.value = withSequence(
      withTiming(1.2, { duration: 300 }),
      withSpring(1, { damping: 8 })
    );

    setTimeout(() => {
      titleOpacity.value = withTiming(1, { duration: 400 });
    }, 200);

    setTimeout(() => {
      imageOpacity.value = withTiming(1, { duration: 500 });
    }, 400);

    setTimeout(() => {
      saveMessageOpacity.value = withTiming(1, { duration: 300 });
    }, 800);

    setTimeout(() => {
      ctaOpacity.value = withTiming(1, { duration: 400 });
    }, 1000);

    setTimeout(() => {
      buttonsOpacity.value = withTiming(1, { duration: 400 });
    }, 1200);
  }, []);

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const saveMessageStyle = useAnimatedStyle(() => ({
    opacity: saveMessageOpacity.value,
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0B0B0F', '#1a1a2e']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Success Header */}
        <View style={styles.header}>
          <Animated.View style={checkmarkStyle}>
            <Text style={styles.checkmark}>✓</Text>
          </Animated.View>
          
          <Animated.View style={titleStyle}>
            <Text style={styles.title}>Beautifully Restored!</Text>
          </Animated.View>
        </View>

        {/* Before/After Comparison */}
        <Animated.View style={[styles.comparisonContainer, imageStyle]}>
          {beforePhoto ? (
            <View style={styles.imageComparison}>
              {/* Before */}
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>Before</Text>
                <Image source={{ uri: beforePhoto.uri }} style={styles.comparisonImage} />
              </View>

              {/* After - Use beforePhoto if no afterPhoto for demo */}
              <View style={styles.imageSection}>
                <Text style={styles.imageLabel}>After</Text>
                <View style={styles.afterImageWrapper}>
                  <Image 
                    source={{ uri: afterPhoto?.uri || beforePhoto.uri }} 
                    style={styles.comparisonImage} 
                  />
                  <View style={styles.sparkleOverlay}>
                    <Text style={styles.sparkle}>✨</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.placeholderComparison}>
              <Text style={styles.placeholderText}>Photo Enhancement Complete!</Text>
            </View>
          )}
        </Animated.View>

        {/* Save to gallery button */}
        <Animated.View style={[styles.saveMessage, saveMessageStyle]}>
          <TouchableOpacity 
            style={[
              styles.saveButton, 
              savedToGallery && styles.saveButtonDisabled
            ]} 
            onPress={handleSaveToGallery}
            disabled={isSaving || savedToGallery}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : savedToGallery ? '✓ Saved to gallery' : 'Save to gallery'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Trial CTA */}
        <Animated.View style={[styles.ctaContainer, ctaStyle]}>
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeText}>⚡ START FREE TRIAL ⚡</Text>
          </View>
          <Text style={styles.trialDescription}>
            Unlimited for 3 days{'\n'}
            Then $9.99/week
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <View style={[styles.bottomContent, { paddingBottom: insets.bottom + 20 }]}>
          <Animated.View style={buttonsStyle}>
            <OnboardingButton
              title="Start Free Trial"
              onPress={onStartTrial}
              variant="primary"
              size="large"
              style={styles.primaryButton}
            />
            
            <OnboardingButton
              title="Maybe later"
              onPress={onMaybeLater}
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  checkmark: {
    fontSize: 48,
    color: '#22c55e',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  comparisonContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  imageComparison: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 300,
  },
  imageSection: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  imageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  comparisonImage: {
    width: '100%',
    aspectRatio: 3/4,
    borderRadius: 12,
  },
  afterImageWrapper: {
    position: 'relative',
  },
  sparkleOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  sparkle: {
    fontSize: 20,
    textShadowColor: '#f97316',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  placeholderComparison: {
    height: 200,
    width: '100%',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
  },
  saveMessage: {
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  saveText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
  ctaContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  trialBadge: {
    backgroundColor: '#f97316',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  trialDescription: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
  },
  primaryButton: {
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
});