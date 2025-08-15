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
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <View className="flex-row space-x-2">
        <View className={`w-8 h-1 rounded-full ${activeIndex >= 0 ? 'bg-blue-500' : 'bg-gray-200'}`} />
        <View className={`w-8 h-1 rounded-full ${activeIndex >= 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
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
      <VideoView player={player} style={{ width, height: width * (16/9), transform: [{ scaleY: 9/16 }, { scaleX: 16/9 }] as any, opacity: isDimmed ? 0.7 : 1 }} contentFit="cover" nativeControls={false} allowsFullscreen={false} />
    );
  }

  // Use the same image style as Explore feature posters
  const FEATURE_IMAGES: Record<string, any> = {
    restoration: require('../assets/images/onboarding/after-2.png'),
    unblur: require('../assets/images/onboarding/before-3.jpg'),
    colorize: require('../assets/images/onboarding/after-3.png'),
    descratch: require('../assets/images/onboarding/before-4.jpg'),
    custom: require('../assets/images/onboarding/after-4.png'),
    back_to_life: require('../assets/images/onboarding/after-2.png'),
  };

  const getFeatureImage = (mapsTo: string) => FEATURE_IMAGES[mapsTo] ?? FEATURE_IMAGES.restoration;

  if (currentStep === 'free-attempt') {
    const primaryFeature = onboardingUtils.getPrimaryFeature(selectedFeatures, selectedFeatures[0]);
    
    return (
      <View className="flex-1 bg-white">
        {/* Header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}>
          <View className="px-5">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setCurrentStep('selection')} className="p-2 -ml-2">
                <IconSymbol name="chevron.left" size={24} color="#111827" />
              </TouchableOpacity>
              {renderStepIndicator(1)}
              <View className="w-9" />
            </View>
            <Text className="text-gray-900 text-3xl font-bold text-center mt-2">Try {primaryFeature?.name}</Text>
            <Text className="text-gray-600 text-center text-base leading-6 mt-2 px-3">
              Select a photo to see what Photo Restoration HD can do for free.
            </Text>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-full max-w-sm">
            {/* Icon Container */}
            <View className="items-center mb-8">
              <LinearGradient
                colors={primaryFeature?.gradient || ['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="w-24 h-24 rounded-2xl items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.15,
                  shadowRadius: 20,
                  elevation: 6,
                }}
              >
                <IconSymbol name={primaryFeature?.icon as any} size={40} color="#FFFFFF" />
              </LinearGradient>
              
              <Text className="text-gray-900 text-xl font-semibold mt-4">
                {primaryFeature?.name}
              </Text>
              <Text className="text-gray-600 text-center text-base leading-6 mt-1 px-4">
                {primaryFeature?.description}
              </Text>
              <View className="mt-4 px-3 py-2 rounded-xl bg-gray-50">
                <Text className="text-gray-500 text-xs">This will use one of your free restorations</Text>
              </View>
            </View>

            {/* Call to Action */}
            <TouchableOpacity
              onPress={handleFreeAttempt}
              disabled={isProcessing}
              className="w-full mb-4 rounded-2xl overflow-hidden"
              style={{
                shadowColor: '#3B82F6',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <LinearGradient
                colors={isProcessing ? ['#9CA3AF', '#6B7280'] : ['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="py-4"
              >
                <Text className="text-white text-center text-lg font-semibold">
                  {isProcessing ? 'Processing...' : 'Select Photo & Try Free'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkipToApp} className="py-3">
              <Text className="text-gray-500 text-center text-base">Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Hero header */}
      <View style={{ paddingTop: insets.top + 8 }}>
        <LinearGradient
          colors={["#EEF2FF", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-5 pb-6"
        >
          {renderStepIndicator(0)}
          <Text className="text-gray-900 text-3xl font-bold text-center">
            What brought you here today?
          </Text>
          <Text className="text-gray-600 text-center text-base leading-6 mt-2">
            {selectedCountLabel}
          </Text>
        </LinearGradient>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: (insets.bottom || 0) + 120 }}>
        {/* Back to Life row */}
        <View className="mt-4">
          <Text className="px-5 text-gray-900 font-semibold text-lg mb-2">Create Moving Videos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {VIDEO_TILES.map((tile) => {
              const width = 120;
              const isSelected = selectedFeatures.includes('create_videos');
              return (
                <TouchableOpacity key={tile.id} activeOpacity={0.9} onPress={() => handleFeatureToggle('create_videos')} style={{ width, marginRight: 10 }}>
                  <View style={{ width, aspectRatio: 9/16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isSelected ? 'rgba(59,130,246,0.6)' : 'rgba(0,0,0,0.08)', backgroundColor: '#0b0b0f' }}>
                    <SmallVideoTile source={tile.video} width={width} isDimmed={!isSelected} />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', inset: 0 as any }} />
                    <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{tile.title}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Outfits row */}
        <View className="mt-6">
          <Text className="px-5 text-gray-900 font-semibold text-lg mb-2">Change Clothes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {OUTFIT_TILES.map((tile) => {
              const width = 120;
              const isSelected = selectedFeatures.includes('memorial_touches'); // temporary map to custom until a dedicated id exists
              return (
                <TouchableOpacity key={tile.id} activeOpacity={0.9} onPress={() => handleFeatureToggle('memorial_touches')} style={{ width, marginRight: 10 }}>
                  <View style={{ width, aspectRatio: 9/16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isSelected ? 'rgba(59,130,246,0.6)' : 'rgba(0,0,0,0.08)', backgroundColor: '#0b0b0f' }}>
                    <SmallVideoTile source={tile.video} width={width} isDimmed={!isSelected} />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', inset: 0 as any }} />
                    <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{tile.title}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Backgrounds row */}
        <View className="mt-6">
          <Text className="px-5 text-gray-900 font-semibold text-lg mb-2">Change Background</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {BACKGROUND_TILES.map((tile) => {
              const width = 120;
              const isSelected = selectedFeatures.includes('memorial_touches'); // same temporary mapping if treated as custom edits
              return (
                <TouchableOpacity key={tile.id} activeOpacity={0.9} onPress={() => handleFeatureToggle('memorial_touches')} style={{ width, marginRight: 10 }}>
                  <View style={{ width, aspectRatio: 9/16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isSelected ? 'rgba(59,130,246,0.6)' : 'rgba(0,0,0,0.08)', backgroundColor: '#0b0b0f' }}>
                    <ExpoImage source={tile.image} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
                    <LinearGradient colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={{ position: 'absolute', inset: 0 as any }} />
                    <View style={{ position: 'absolute', left: 10, bottom: 10 }}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{tile.title}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Classic features row (smaller chips) */}
        <View className="mt-6">
          <Text className="px-5 text-gray-900 font-semibold text-lg mb-2">Photo Enhancements</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {ONBOARDING_FEATURES.filter(f => ['restoration','unblur','colorize','descratch'].includes(f.mapsTo)).map((f) => {
              const isSelected = selectedFeatures.includes(f.id);
              return (
                <TouchableOpacity key={f.id} onPress={() => handleFeatureToggle(f.id)} activeOpacity={0.9} style={{ marginRight: 10 }}>
                  <View className={`flex-row items-center rounded-xl border ${isSelected ? 'border-blue-500' : 'border-gray-200'}`} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                    <LinearGradient colors={f.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="w-8 h-8 rounded-lg items-center justify-center mr-3">
                      <IconSymbol name={f.icon as any} size={16} color="#FFFFFF" />
                    </LinearGradient>
                    <Text className="text-gray-900 font-semibold text-[14px]">{f.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}>
        <TouchableOpacity
          onPress={handleContinue}
          className="bg-blue-600 rounded-2xl p-4 shadow-lg active:scale-95"
        >
          <Text className="text-white text-center text-lg font-bold">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}