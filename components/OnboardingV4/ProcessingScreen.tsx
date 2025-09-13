import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
  withDelay,
  Easing
} from 'react-native-reanimated';

import { useOnboardingV4Analytics } from '@/hooks/useOnboardingV4Analytics';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';

// Toggle for mock vs real API - change to false for production
const USE_MOCK_API = true;

interface PhotoData {
  uri: string;
  width: number;
  height: number;
}

interface ProcessingScreenProps {
  photo: PhotoData | null;
  intent: string | null;
  onComplete: (result: { uri: string; processingTime: number }) => void;
  onError: (error: Error) => void;
}

const SOCIAL_PROOF_DATA = {
  totalPhotos: '2,847,293',
  recentActivity: {
    city: 'Toronto',
    action: 'restored a 1952 wedding photo'
  },
  testimonial: {
    text: '"Brought my mom to tears"',
    author: 'Sarah'
  }
};

export function ProcessingScreen({ photo, intent, onComplete, onError }: ProcessingScreenProps) {
  const insets = useSafeAreaInsets();
  const { trackSocialProofShown } = useOnboardingV4Analytics();
  
  const [processingStep, setProcessingStep] = React.useState('analyzing');
  const [startTime] = React.useState(Date.now());
  
  const scanLineOpacity = useSharedValue(0);
  const scanLineTranslateY = useSharedValue(-10);
  const socialProofOpacity = useSharedValue(0);
  const counterValue = useSharedValue(0);
  const imageOpacity = useSharedValue(1);
  const stepProgress = useSharedValue(0);
  
  // Function to map intent to restoration function type
  const getRestorationFunction = (intentId: string | null): 'restoration' | 'colorize' => {
    // Map intent to restoration function
    switch (intentId) {
      case 'colorize_memories':
        return 'colorize';
      case 'fix_old_family':
      case 'remove_scratches':
      case 'restore_grandparents':
      case 'fix_water_damage':
      case 'repair_torn':
      default:
        return 'restoration';
    }
  };
  
  const photoRestoration = usePhotoRestoration();

  // Real photo restoration API call
  const performRestoration = React.useCallback(async () => {
    // Set global flag for mock mode
    (global as any).USE_MOCK_API = USE_MOCK_API;
    
    if (!photo && USE_MOCK_API) {
      // Demo mode - simulate processing
      setTimeout(() => {
        const processingTime = Date.now() - startTime;
        const mockResult = {
          uri: 'demo-result-uri',
          processingTime
        };
        // Clear mock flag before completing
        (global as any).USE_MOCK_API = false;
        runOnJS(onComplete)(mockResult);
      }, 5000);
      return;
    }

    if (!photo) {
      console.error('No photo provided for restoration');
      runOnJS(onError)(new Error('No photo provided'));
      return;
    }

    try {
      const functionType = getRestorationFunction(intent);
      
      if (USE_MOCK_API) {
        // Mock processing for demo
        setTimeout(() => {
          const processingTime = Date.now() - startTime;
          // Clear mock flag before completing
          (global as any).USE_MOCK_API = false;
          runOnJS(onComplete)({
            uri: 'demo-result-uri',
            processingTime
          });
        }, 5000);
        return;
      }

      // Use same pipeline as Explore
      const result = await photoRestoration.mutateAsync({
        imageUri: photo.uri,
        functionType,
        customPrompt: undefined,
        imageSource: 'gallery'
      });

      const processingTime = Date.now() - startTime;

      // Clear mock flag before completing
      (global as any).USE_MOCK_API = false;
      runOnJS(onComplete)({
        uri: result.restoredImageUri,
        processingTime
      });
      
    } catch (error) {
      console.error('Photo restoration error:', error);
      runOnJS(onError)(error instanceof Error ? error : new Error('Restoration failed'));
    }
  }, [photo, intent, startTime, onComplete, onError, getRestorationFunction, photoRestoration]);

  React.useEffect(() => {
    const easing = Easing.bezier(0.4, 0, 0.2, 1);
    
    // Optimized scan line animation
    scanLineOpacity.value = withTiming(1, { duration: 300, easing });
    scanLineTranslateY.value = withRepeat(
      withSequence(
        withTiming(266, { duration: 1500, easing }),
        withTiming(-10, { duration: 1500, easing })
      ),
      -1,
      false
    );

    // Optimized pulsing effect
    imageOpacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1200, easing }),
        withTiming(1, { duration: 1200, easing })
      ),
      -1,
      true
    );

    // Smooth social proof entrance
    socialProofOpacity.value = withDelay(800, withTiming(1, { duration: 600, easing }));
    
    // Smooth counter animation
    counterValue.value = withDelay(1000, withTiming(2847293, { duration: 2500, easing }));

    // Track social proof
    setTimeout(() => trackSocialProofShown('counter'), 800);

    // Smooth step transitions
    stepProgress.value = withTiming(1, { duration: 5000, easing }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(setProcessingStep)('finalizing');
      }
    });

    // Start restoration process
    performRestoration();

    // CRITICAL: Clear mock API flag when component unmounts to prevent breaking main app
    return () => {
      (global as any).USE_MOCK_API = false;
    };
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    opacity: scanLineOpacity.value,
    transform: [{ translateY: scanLineTranslateY.value }],
  }));

  const socialProofStyle = useAnimatedStyle(() => ({
    opacity: socialProofOpacity.value,
  }));

  const counterStyle = useAnimatedStyle(() => ({
    opacity: socialProofOpacity.value,
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const getProcessingText = () => {
    switch (processingStep) {
      case 'analyzing':
        return 'You\'re analyzing the damage...';
      case 'enhancing':
        return 'You\'re enhancing the details...';
      case 'finalizing':
        return 'You\'re bringing it back to life...';
      default:
        return 'You\'re working on your photo...';
    }
  };

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Photo with scan effect */}
        <View style={styles.photoContainer}>
          {photo ? (
            <View style={styles.imageWrapper}>
              <Animated.Image source={{ uri: photo.uri }} style={[styles.image, imageStyle]} />
              
              {/* Processing overlay */}
              <View style={styles.processingOverlay} />
              
              {/* Scan line overlay */}
              <View style={styles.scanOverlay}>
                <Animated.View style={[styles.scanLine, scanLineStyle]} />
                <Animated.View style={[styles.scanGlow, scanLineStyle]} />
              </View>
            </View>
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>Processing Demo Photo</Text>
            </View>
          )}
        </View>

        {/* Processing status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{getProcessingText()}</Text>
        </View>

        {/* Social Proof Section */}
        <Animated.View style={[styles.socialProofContainer, socialProofStyle]}>
          {/* Photo counter */}
          <Animated.View style={[styles.statItem, counterStyle]}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statText}>{SOCIAL_PROOF_DATA.totalPhotos} photos restored</Text>
          </Animated.View>

          {/* Recent activity */}
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>📍</Text>
            <Text style={styles.statText}>
              Someone in {SOCIAL_PROOF_DATA.recentActivity.city} just{'\n'}
              {SOCIAL_PROOF_DATA.recentActivity.action}
            </Text>
          </View>

          {/* Testimonial */}
          <View style={styles.statItem}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statText}>
              {SOCIAL_PROOF_DATA.testimonial.text} - {SOCIAL_PROOF_DATA.testimonial.author}
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: insets.bottom + 20 }} />
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
  photoContainer: {
    marginBottom: 40,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: 200,
    height: 266,
    borderRadius: 16,
  },
  placeholderImage: {
    width: 200,
    height: 266,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scanLine: {
    height: 3,
    backgroundColor: '#f97316',
    width: '100%',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  scanGlow: {
    height: 8,
    backgroundColor: 'rgba(249, 115, 22, 0.3)',
    width: '100%',
    position: 'absolute',
    top: -2.5,
    borderRadius: 4,
  },
  statusContainer: {
    marginBottom: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  socialProofContainer: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  statIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  statText: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 18,
  },
});