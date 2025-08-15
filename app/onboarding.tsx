import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { onboardingTrackingService } from '@/services/onboardingTracking';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { ONBOARDING_FEATURES, onboardingUtils } from '@/utils/onboarding';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const photoRestoration = usePhotoRestoration();
  const { isPro } = useSubscriptionStore();
  
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<'selection' | 'free-attempt' | 'demo'>('selection');
  const [isProcessing, setIsProcessing] = useState(false);

  // If user is Pro, skip onboarding
  React.useEffect(() => {
    if (isPro) {
      router.replace('/explore');
    }
  }, [isPro, router]);

  const handleFeatureToggle = (featureId: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    
    setSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleContinue = async () => {
    if (selectedFeatures.length === 0) {
      // No features selected - skip onboarding and go straight to explore
      await onboardingUtils.completeOnboarding();
      router.replace('/explore');
      return;
    }

    // Prefer a primary feature that exists in ONBOARDING_FEATURES and is not Back to Life (video)
    const primaryCandidate = ONBOARDING_FEATURES.find(
      (f) => selectedFeatures.includes(f.id) && f.mapsTo !== 'back_to_life'
    );
    const primaryInterest = primaryCandidate?.id ?? selectedFeatures.find((id) => ONBOARDING_FEATURES.some((f) => f.id === id)) ?? selectedFeatures[0];
    
    // Save selections locally
    await onboardingUtils.saveOnboardingSelections(selectedFeatures, primaryInterest);
    
    // Save to Supabase for analytics (non-blocking)
    onboardingTrackingService.saveOnboardingSelections({
      selectedFeatures,
      primaryInterest,
    }).catch(() => {
      // Silently fail - analytics shouldn't block user flow
    });

    // Move to free attempt
    setCurrentStep('free-attempt');
  };

  const handleFreeAttempt = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to continue.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const primaryFeature = onboardingUtils.getPrimaryFeature(selectedFeatures, selectedFeatures[0]);
    if (!primaryFeature) {
      Alert.alert('Error', 'Please try again.');
      return;
    }

    // Don't allow video attempts for free
    if (primaryFeature.mapsTo === 'back_to_life') {
      Alert.alert(
        'Pro Feature',
        'Video creation requires a Pro subscription. You can try our photo restoration features for free first!',
        [
          { text: 'Try Photo Features', onPress: () => handleSkipToApp() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Process using 1 of their 5 free restorations
      const restoration = await photoRestoration.mutateAsync({
        imageUri: result.assets[0].uri,
        functionType: primaryFeature.mapsTo as any,
        imageSource: 'gallery',
      });

      // Mark free attempt as used
      await onboardingUtils.markFreeAttemptUsed(primaryFeature.id);
      onboardingTrackingService.markFreeAttemptUsed(primaryFeature.id).catch(() => {});

      // Complete onboarding
      await onboardingUtils.completeOnboarding();

      // Navigate to result
      router.replace(`/restoration/${restoration.id}`);

    } catch (error: any) {
      setIsProcessing(false);
      Alert.alert('Processing Failed', error?.message || 'Something went wrong. Please try again.');
    }
  };

  const handleSkipToApp = async () => {
    await onboardingUtils.completeOnboarding();
    router.replace('/explore');
  };

  const selectedCountLabel = useMemo(() => {
    if (currentStep !== 'selection') return '';
    if (selectedFeatures.length === 0) return 'Select all that apply';
    if (selectedFeatures.length === 1) return '1 selected';
    return `${selectedFeatures.length} selected`;
  }, [currentStep, selectedFeatures.length]);

  const renderStepIndicator = (activeIndex: 0 | 1) => (
    <View className="flex-row items-center justify-center mb-6">
      <View className="flex-row items-center space-x-2">
        {/* Step 1 */}
        <View className={`w-6 h-6 rounded-full items-center justify-center ${
          activeIndex >= 0 ? 'bg-yellow-400' : 'bg-gray-700'
        }`}>
          <Text className={`text-xs font-semibold ${
            activeIndex >= 0 ? 'text-black' : 'text-gray-400'
          }`}>
            1
          </Text>
        </View>
        
        {/* Connector Line */}
        <View className={`w-6 h-0.5 ${
          activeIndex >= 1 ? 'bg-yellow-400' : 'bg-gray-700'
        }`} />
        
        {/* Step 2 */}
        <View className={`w-6 h-6 rounded-full items-center justify-center ${
          activeIndex >= 1 ? 'bg-yellow-400' : 'bg-gray-700'
        }`}>
          <Text className={`text-xs font-semibold ${
            activeIndex >= 1 ? 'text-black' : 'text-gray-400'
          }`}>
            2
          </Text>
        </View>
      </View>
    </View>
  );

  // Small tile data (reuse Explore assets) - each row toggles a single feature id
  const VIDEO_TILES = [
    { id: 'btl-0', title: 'Smile', type: 'video' as const, video: require('../assets/videos/magic/backtolife/thumbnail/btl-0.mp4') },
    { id: 'btl-2', title: 'Fun', type: 'video' as const, video: require('../assets/videos/magic/backtolife/thumbnail/btl-2.mp4') },
    { id: 'btl-3', title: 'Hug', type: 'video' as const, video: require('../assets/videos/magic/backtolife/thumbnail/btl-3.mp4') },
  ];
  const OUTFIT_TILES = [
    { id: 'outfit-1', title: 'Fix Clothes', type: 'video' as const, video: require('../assets/videos/magic/outfits/thumbnail/fix-clothes/niceclothes.mp4') },
    { id: 'outfit-2', title: 'Change Color', type: 'video' as const, video: require('../assets/videos/magic/outfits/thumbnail/change-color/colorchange.mp4') },
    { id: 'outfit-3', title: 'Job Interview', type: 'video' as const, video: require('../assets/videos/magic/outfits/thumbnail/job-interview/jobinterview.mp4') },
  ];
  const BACKGROUND_TILES = [
    { id: 'bg-1', title: 'Garden', type: 'image' as const, image: require('../assets/images/backgrounds/thumbnail/garden/garden.jpeg') },
    { id: 'bg-2', title: 'Heavenly', type: 'image' as const, image: require('../assets/images/backgrounds/thumbnail/heavenly/heavenly.jpg') },
    { id: 'bg-4', title: 'Studio', type: 'image' as const, image: require('../assets/images/backgrounds/thumbnail/studio/studio.jpeg') },
  ];

  function SmallVideoTile({ source, width, isDimmed = false }: { source: any; width: number; isDimmed?: boolean }) {
    const player = useVideoPlayer(source, (p) => {
      p.loop = true;
      p.muted = true;
    });
    React.useEffect(() => {
      let t: any;
      if (player && !player.playing) {
        t = setTimeout(() => {
          try { player.play(); } catch {}
        }, 150 + Math.random() * 200);
      }
      return () => t && clearTimeout(t);
    }, [player]);
    return (
      <VideoView 
        player={player} 
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: isDimmed ? 0.8 : 1 }} 
        contentFit="cover" 
        nativeControls={false} 
        allowsFullscreen={false} 
      />
    );
  }

  // Use local onboarding images instead of external URLs
  const FEATURE_IMAGES: Record<string, any> = {
    restoration: require('../assets/images/onboarding/after-2.png'),
    unblur: require('../assets/images/onboarding/before-3.jpg'),
    colorize: require('../assets/images/onboarding/after-3.png'),
    descratch: require('../assets/images/onboarding/before-4.jpg'),
    custom: require('../assets/images/onboarding/after-4.png'),
    back_to_life: require('../assets/images/onboarding/before-2.jpg'),
  };

  const getFeatureImage = (mapsTo: string) => FEATURE_IMAGES[mapsTo] ?? FEATURE_IMAGES.restoration;

  if (currentStep === 'free-attempt') {
    const primaryFeature = onboardingUtils.getPrimaryFeature(selectedFeatures, selectedFeatures[0]);
    
    return (
      <View className="flex-1 bg-gray-900">
        {/* Header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}>
          <View className="px-5">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setCurrentStep('selection')} className="p-2 -ml-2">
                <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              {renderStepIndicator(1)}
              <View className="w-9" />
            </View>
            <Text className="text-white text-3xl font-bold text-center mt-2">Try {primaryFeature?.name}</Text>
            <Text className="text-gray-400 text-center text-base leading-6 mt-2 px-3">
              Select a photo to see what Photo Restoration HD can do for free.
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-full max-w-sm">
            {/* Feature Display */}
            <View className="items-center mb-10">
              <Text style={{ fontSize: 64 }} className="mb-6">
                {primaryFeature?.id === 'fix_old_damaged' ? '🔧' :
                 primaryFeature?.id === 'add_color_bw' ? '🎨' :
                 primaryFeature?.id === 'remove_backgrounds' ? '✂️' :
                 primaryFeature?.id === 'restore_old_memories' ? '🖼️' :
                 primaryFeature?.id === 'change_outfits' ? '👕' :
                 primaryFeature?.id === 'create_videos' ? '🎬' :
                 primaryFeature?.id === 'face_enhancement' ? '✨' :
                 primaryFeature?.id === 'photo_upscaling' ? '🔍' : '⚡'}
              </Text>
              
              <Text className="text-white text-2xl font-bold mb-3 text-center">
                {primaryFeature?.name}
              </Text>
              <Text className="text-gray-400 text-center text-base leading-6 px-4">
                {primaryFeature?.description}
              </Text>
            </View>

            {/* Call to Action */}
            <TouchableOpacity
              onPress={handleFreeAttempt}
              disabled={isProcessing}
              className={`w-full mb-4 rounded-2xl py-4 ${
                isProcessing ? 'bg-gray-600' : 'bg-yellow-400'
              }`}
            >
              <Text className={`text-center text-lg font-bold ${
                isProcessing ? 'text-gray-300' : 'text-black'
              }`}>
                {isProcessing ? 'Processing...' : 'Select Photo & Try Free'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkipToApp} className="py-3">
              <Text className="text-gray-400 text-center text-base">Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900">
      {/* Hero header */}
      <View style={{ paddingTop: insets.top + 8 }}>
        <View className="px-5 pb-4">
          {renderStepIndicator(0)}
          <Text className="text-white text-3xl font-bold text-center">
            What brought you here today?
          </Text>
          <Text className="text-gray-400 text-center text-base leading-6 mt-1">
            {selectedCountLabel}
          </Text>
        </View>
      </View>

      <View className="flex-1 px-5 pt-2">
        <FlatList
          data={ONBOARDING_FEATURES as unknown as any[]}
          keyExtractor={(item: any) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 100 }}
          renderItem={({ item: feature }: any) => {
            const isSelected = selectedFeatures.includes(feature.id);

            return (
              <FeatureItem
                feature={feature}
                isSelected={isSelected}
                onToggle={() => handleFeatureToggle(feature.id)}
              />
            );
          }}
        />
      </View>

      {/* Bottom action */}
      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}>
        <TouchableOpacity
          onPress={handleContinue}
          className="bg-yellow-400 rounded-2xl p-4 shadow-lg active:scale-95"
        >
          <Text className="text-black text-center text-lg font-bold">
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Animated Feature Item Component
function FeatureItem({ feature, isSelected, onToggle }: { feature: any, isSelected: boolean, onToggle: () => void }) {
  const scale = useSharedValue(1);
  const backgroundColor = useSharedValue(0);

  React.useEffect(() => {
    backgroundColor.value = withTiming(isSelected ? 1 : 0, { duration: 300 });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const bgOpacity = backgroundColor.value * 0.15 + 0.02;
    const borderOpacity = backgroundColor.value * 0.6 + 0.1;
    const borderWidth = backgroundColor.value > 0.5 ? 2 : backgroundColor.value > 0.2 ? 1 : 0;
    
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: `rgba(59, 130, 246, ${bgOpacity})`,
      borderColor: `rgba(59, 130, 246, ${borderOpacity})`,
      borderWidth: borderWidth,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onToggle}
      activeOpacity={1}
      className="mb-2"
    >
      <Animated.View 
        style={[animatedStyle]}
        className="flex-row items-center py-4 px-5 rounded-2xl"
      >
        {/* Icon */}
        <View className="w-12 h-12 items-center justify-center mr-4">
          <Text style={{ fontSize: 24 }}>
            {feature.id === 'fix_old_damaged' ? '🔧' :
             feature.id === 'add_color_bw' ? '🎨' :
             feature.id === 'remove_backgrounds' ? '✂️' :
             feature.id === 'restore_old_memories' ? '🖼️' :
             feature.id === 'change_outfits' ? '👕' :
             feature.id === 'create_videos' ? '🎬' : 
             feature.id === 'face_enhancement' ? '✨' :
             feature.id === 'photo_upscaling' ? '🔍' : '⚡'}
          </Text>
        </View>
        
        {/* Text content */}
        <View className="flex-1">
          <Text className={`font-semibold text-base ${isSelected ? 'text-white' : 'text-gray-200'}`}>
            {feature.name}
          </Text>
          <Text className={`text-xs mt-1 ${isSelected ? 'text-blue-200' : 'text-gray-500'}`} numberOfLines={2}>
            {feature.description}
          </Text>
        </View>
        
        {/* Selection indicator */}
        {isSelected && (
          <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center ml-2">
            <Text style={{ fontSize: 12, color: 'white' }}>✓</Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}