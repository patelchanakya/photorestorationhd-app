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
import { useTranslation } from 'react-i18next';
import { getLocales, getCalendars } from 'expo-localization';

// Toggle for mock vs real API - change to false for production
const USE_MOCK_API = false;

interface PhotoData {
  uri: string;
  width: number;
  height: number;
}

interface ProcessingScreenProps {
  photo: PhotoData | null;
  intent: string | null;
  functionType: string | null;
  onComplete: (result: { uri: string; processingTime: number }) => void;
  onError: (error: Error) => void;
}

// Dynamic city data based on regions
const CITIES_BY_REGION = {
  US: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'San Jose', 'Fort Worth', 'Charlotte', 'Seattle', 'Denver', 'Boston', 'Nashville', 'Detroit', 'Portland', 'Las Vegas'],
  CA: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton', 'Quebec City', 'Winnipeg', 'Hamilton', 'London', 'Halifax', 'Victoria', 'Saskatoon', 'Regina', 'Kelowna'],
  GB: ['London', 'Birmingham', 'Manchester', 'Liverpool', 'Leeds', 'Sheffield', 'Bristol', 'Glasgow', 'Edinburgh', 'Cardiff', 'Belfast', 'Newcastle', 'Nottingham', 'Plymouth'],
  AU: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Newcastle', 'Canberra', 'Wollongong', 'Geelong', 'Hobart', 'Townsville', 'Cairns'],
  DE: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden', 'Hanover'],
  FR: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Montpellier', 'Strasbourg', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Saint-Étienne'],
  DEFAULT: ['London', 'New York', 'Tokyo', 'Sydney', 'Toronto', 'Berlin', 'Paris', 'Madrid', 'Rome', 'Amsterdam', 'Stockholm', 'Copenhagen', 'Vienna']
};

const getRestorationActions = (t: any) => [
  t('onboardingV4.processing.socialProof.actions.autoRestore'),
  t('onboardingV4.processing.socialProof.actions.backgroundRemoval'),
  t('onboardingV4.processing.socialProof.actions.colorize'),
  t('onboardingV4.processing.socialProof.actions.repair'),
  t('onboardingV4.processing.socialProof.actions.clarify'),
  t('onboardingV4.processing.socialProof.actions.brighten'),
  t('onboardingV4.processing.socialProof.actions.descratch'),
  t('onboardingV4.processing.socialProof.actions.backgroundStyle'),
  t('onboardingV4.processing.socialProof.actions.memorialStyle'),
  t('onboardingV4.processing.socialProof.actions.photoMagic')
];

// Comprehensive timezone to city mapping (no permissions needed)
const TIMEZONE_TO_CITY = {
  // North America
  'America/New_York': 'New York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Los_Angeles': 'Los Angeles',
  'America/Toronto': 'Toronto',
  'America/Vancouver': 'Vancouver',
  'America/Montreal': 'Montreal',
  'America/Phoenix': 'Phoenix',
  'America/Detroit': 'Detroit',
  'America/Boston': 'Boston',
  'America/Miami': 'Miami',
  'America/Seattle': 'Seattle',

  // Europe
  'Europe/London': 'London',
  'Europe/Paris': 'Paris',
  'Europe/Berlin': 'Berlin',
  'Europe/Madrid': 'Madrid',
  'Europe/Rome': 'Rome',
  'Europe/Amsterdam': 'Amsterdam',
  'Europe/Stockholm': 'Stockholm',
  'Europe/Copenhagen': 'Copenhagen',
  'Europe/Vienna': 'Vienna',
  'Europe/Brussels': 'Brussels',
  'Europe/Dublin': 'Dublin',
  'Europe/Zurich': 'Zurich',

  // Asia Pacific
  'Asia/Tokyo': 'Tokyo',
  'Asia/Shanghai': 'Shanghai',
  'Asia/Singapore': 'Singapore',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Seoul': 'Seoul',
  'Asia/Mumbai': 'Mumbai',
  'Asia/Dubai': 'Dubai',
  'Asia/Bangkok': 'Bangkok',
  'Australia/Sydney': 'Sydney',
  'Australia/Melbourne': 'Melbourne',
  'Australia/Brisbane': 'Brisbane',
  'Australia/Perth': 'Perth',

  // South America
  'America/Sao_Paulo': 'São Paulo',
  'America/Buenos_Aires': 'Buenos Aires',
  'America/Mexico_City': 'Mexico City',
  'America/Lima': 'Lima',

  // Africa & Middle East
  'Africa/Cairo': 'Cairo',
  'Africa/Lagos': 'Lagos',
  'Africa/Johannesburg': 'Johannesburg',
  'Asia/Jerusalem': 'Jerusalem'
} as const;

// Get user's city from timezone (most accurate, no permissions)
const getUserCity = (): string => {
  try {
    const locale = getLocales()[0];
    const calendar = getCalendars()[0];
    const timezone = calendar?.timeZone;
    const region = locale?.regionCode || 'DEFAULT';

    // Primary: Direct timezone mapping (most accurate)
    if (timezone && TIMEZONE_TO_CITY[timezone as keyof typeof TIMEZONE_TO_CITY]) {
      return TIMEZONE_TO_CITY[timezone as keyof typeof TIMEZONE_TO_CITY];
    }

    // Secondary: Extract city from timezone string
    if (timezone) {
      const timezoneParts = timezone.split('/');
      if (timezoneParts.length > 1) {
        const cityName = timezoneParts[timezoneParts.length - 1].replace(/_/g, ' ');
        if (cityName && cityName !== 'GMT' && cityName.length > 2) {
          return cityName;
        }
      }
    }

    // Tertiary: Regional fallback
    const cities = CITIES_BY_REGION[region as keyof typeof CITIES_BY_REGION] || CITIES_BY_REGION.DEFAULT;
    return cities[Math.floor(Math.random() * cities.length)];

  } catch {
    // Ultimate fallback - just show something nice
    return 'your city';
  }
};

// Generate a random time ago (5-30 minutes)
const getRandomTimeAgo = (t: any) => {
  const minutes = Math.floor(Math.random() * 26) + 5; // 5-30 minutes
  return t('onboardingV4.processing.socialProof.timeFormat', { minutes });
};

// Get dynamic social proof data
const getDynamicSocialProofData = (t: any) => {
  const userCity = getUserCity();
  const restorationActions = getRestorationActions(t);
  const randomAction = restorationActions[Math.floor(Math.random() * restorationActions.length)];
  const timeAgo = getRandomTimeAgo(t);

  return {
    totalPhotos: t('onboardingV4.processing.socialProof.totalPhotos'),
    recentActivity: {
      city: userCity,
      action: randomAction,
      timeAgo: timeAgo
    },
    testimonial: {
      text: `"${t('onboardingV4.processing.socialProof.testimonialText')}"`,
      author: t('onboardingV4.processing.socialProof.authorName')
    }
  };
};

export function ProcessingScreen({ photo, intent, functionType, onComplete, onError }: ProcessingScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { trackSocialProofShown } = useOnboardingV4Analytics();
  const [socialProofData] = React.useState(() => getDynamicSocialProofData(t));

  console.log('📸 [PROCESSING] Screen initialized:', {
    intent,
    functionType,
    hasPhoto: !!photo,
    USE_MOCK_API,
    photoUri: photo?.uri
  });
  
  const [processingStep, setProcessingStep] = React.useState('analyzing');
  const [startTime] = React.useState(Date.now());
  
  const scanLineOpacity = useSharedValue(0);
  const scanLineTranslateY = useSharedValue(-10);
  const socialProofOpacity = useSharedValue(0);
  const counterValue = useSharedValue(0);
  const imageOpacity = useSharedValue(1);
  const stepProgress = useSharedValue(0);
  
  
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
      const actualFunctionType = functionType || 'restoration';

      console.log('🔧 [PROCESSING] Using functionType:', {
        received: functionType,
        actual: actualFunctionType,
        USE_MOCK_API
      });

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
      console.log('🚀 [PROCESSING] Calling API:', {
        functionType: actualFunctionType,
        imageUri: photo.uri,
        customPrompt: undefined,
        imageSource: 'gallery'
      });

      const result = await photoRestoration.mutateAsync({
        imageUri: photo.uri,
        functionType: actualFunctionType,
        customPrompt: undefined,
        imageSource: 'gallery'
      });

      const processingTime = Date.now() - startTime;

      console.log('✅ [PROCESSING] API Success:', {
        resultUri: result.restoredImageUri,
        processingTime,
        functionType: actualFunctionType
      });

      // Clear mock flag before completing
      (global as any).USE_MOCK_API = false;
      runOnJS(onComplete)({
        uri: result.restoredImageUri,
        processingTime
      });
      
    } catch (error) {
      console.error('❌ [PROCESSING] API Error:', {
        error,
        functionType: functionType,
        intent,
        hasPhoto: !!photo,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      runOnJS(onError)(error instanceof Error ? error : new Error('Restoration failed'));
    }
  }, [photo, intent, functionType, startTime, onComplete, onError, photoRestoration]);

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
        return t('onboardingV4.processing.analyzing');
      case 'enhancing':
        return t('onboardingV4.processing.enhancing');
      case 'finalizing':
        return t('onboardingV4.processing.finalizing');
      default:
        return t('onboardingV4.processing.working');
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
              <Text style={styles.placeholderText}>{t('onboardingV4.processing.demoPhoto')}</Text>
            </View>
          )}
        </View>

        {/* Processing status */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{getProcessingText()}</Text>
        </View>

        {/* Social Proof Section */}
        <Animated.View style={[styles.socialProofContainer, socialProofStyle]}>
          {/* Recent activity */}
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📍</Text>
            <Text style={styles.statText}>
              {t('onboardingV4.processing.socialProof.recentActivity', {
                timeAgo: socialProofData.recentActivity.timeAgo,
                city: socialProofData.recentActivity.city,
                action: socialProofData.recentActivity.action
              })}
            </Text>
          </View>

          {/* Testimonial */}
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⭐</Text>
            <Text style={styles.statText}>
              {t('onboardingV4.processing.socialProof.testimonial', {
                quote: socialProofData.testimonial.text,
                author: socialProofData.testimonial.author
              })}
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
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  statText: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 22,
  },
});