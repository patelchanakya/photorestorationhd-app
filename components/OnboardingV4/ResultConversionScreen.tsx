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
  withSequence,
  Easing
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
  const [isSharing, setIsSharing] = React.useState(false);
  const [sharedToGallery, setSharedToGallery] = React.useState(false);
  
  const checkmarkScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const imageOpacity = useSharedValue(0);
  const saveMessageOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  const handleShareToGallery = async () => {
    if (isSharing || sharedToGallery) return;
    
    try {
      setIsSharing(true);
      
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
      
      // Save to media library (still saves, but branded as sharing)
      await MediaLibrary.saveToLibraryAsync(imageUri);
      setSharedToGallery(true);
      Alert.alert('Success!', 'Your work has been shared to your gallery.');
      
    } catch (error) {
      console.error('Failed to share photo:', error);
      Alert.alert('Error', 'Failed to share photo to gallery.');
    } finally {
      setIsSharing(false);
    }
  };

  React.useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    
    // Optimized success checkmark animation
    checkmarkScale.value = withSequence(
      withTiming(1.2, { duration: 300, easing }),
      withSpring(1, { damping: 12, stiffness: 150, mass: 1 })
    );

    // Smooth staggered entrance
    titleOpacity.value = withDelay(150, withTiming(1, { duration: 400, easing }));
    imageOpacity.value = withDelay(300, withTiming(1, { duration: 400, easing }));
    saveMessageOpacity.value = withDelay(600, withTiming(1, { duration: 400, easing }));
    buttonsOpacity.value = withDelay(750, withTiming(1, { duration: 400, easing }));
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

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Success Header */}
        <View style={styles.header}>
          <Animated.View style={checkmarkStyle}>
            <Text style={styles.checkmark}>✓</Text>
          </Animated.View>
          
          <Animated.View style={titleStyle}>
            <Text style={styles.title}>Look What YOU Just Did!</Text>
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

        {/* Share to gallery button */}
        <Animated.View style={[styles.shareMessage, saveMessageStyle]}>
          <TouchableOpacity 
            style={[
              styles.shareButton, 
              sharedToGallery && styles.shareButtonDisabled
            ]} 
            onPress={handleShareToGallery}
            disabled={isSharing || sharedToGallery}
          >
            <Text style={styles.shareButtonText}>
              {isSharing ? 'Sharing Your Work...' : sharedToGallery ? '✓ Your Work is Shared' : 'Share Your Work'}
            </Text>
          </TouchableOpacity>
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
    marginBottom: 32,
    flex: 1,
    justifyContent: 'center',
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
  shareMessage: {
    alignItems: 'center',
    marginBottom: 60,
  },
  shareButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shareButtonDisabled: {
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  shareButtonText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
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