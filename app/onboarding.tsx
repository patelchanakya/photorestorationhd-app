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
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
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

    const primaryInterest = selectedFeatures[0]; // First selected is primary
    
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
      <View className="flex-row items-center">
        {/* Step 1 */}
        <View className="relative">
          <View className={`w-3 h-3 rounded-full ${activeIndex >= 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          {activeIndex >= 0 && (
            <View className="absolute inset-0 w-3 h-3 rounded-full bg-blue-600 opacity-30 animate-pulse" />
          )}
        </View>
        
        {/* Progress line */}
        <View className="relative mx-4">
          <View className="h-0.5 w-16 bg-gray-200" />
          <View 
            className={`absolute top-0 left-0 h-0.5 bg-blue-600 transition-all duration-500 ${
              activeIndex >= 1 ? 'w-16' : 'w-0'
            }`} 
          />
        </View>
        
        {/* Step 2 */}
        <View className="relative">
          <View className={`w-3 h-3 rounded-full ${activeIndex >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
          {activeIndex >= 1 && (
            <View className="absolute inset-0 w-3 h-3 rounded-full bg-blue-600 opacity-30 animate-pulse" />
          )}
        </View>
      </View>
    </View>
  );

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

      <FlatList
        data={ONBOARDING_FEATURES as unknown as any[]}
        keyExtractor={(item: any) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: (insets.bottom || 0) + 120 }}
        renderItem={({ item: feature }: any) => {
          const isSelected = selectedFeatures.includes(feature.id);
          const cardBorder = isSelected ? 'rgba(59,130,246,0.45)' : 'rgba(0,0,0,0.06)';
          const bubbleBg = isSelected ? '#3B82F6' : 'rgba(255,255,255,0.14)';
          const bubbleBorder = isSelected ? '#3B82F6' : 'rgba(255,255,255,0.25)';
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleFeatureToggle(feature.id)}
              style={{ marginHorizontal: 16, marginBottom: 14 }}
            >
              <View style={{ height: 220, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: cardBorder }}>
                <ExpoImage
                  source={getFeatureImage(feature.mapsTo)}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="high"
                />
                {/* Vignettes */}
                <LinearGradient colors={[ 'rgba(0,0,0,0.12)', 'transparent' ]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '20%' }} />
                <LinearGradient colors={[ 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.65)' ]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }} />

                {/* Text */}
                <View style={{ position: 'absolute', left: 16, right: 56, bottom: 14 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
                    {feature.name}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>
                    {feature.description}
                  </Text>
                </View>

                {/* Icon/Check bubble */}
                <View style={{ position: 'absolute', right: 12, top: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: bubbleBg, borderWidth: 1, borderColor: bubbleBorder }}>
                  {isSelected ? (
                    <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
                  ) : (
                    <IconSymbol name={feature.icon as any} size={16} color={'#FFFFFF'} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom action */}
      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 12 }}>
        <TouchableOpacity
          onPress={handleContinue}
          className="rounded-2xl overflow-hidden"
          activeOpacity={0.9}
          style={{
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <LinearGradient colors={["#3B82F6", "#1D4ED8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="py-4 items-center justify-center">
            <Text className="text-white text-base font-semibold">
              {selectedFeatures.length > 0
                ? `Continue with ${selectedFeatures.length} feature${selectedFeatures.length > 1 ? 's' : ''}`
                : 'Continue'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <View className="mt-3">
          <Text className="text-center text-gray-400 text-xs">
            You can change preferences later in Settings
          </Text>
        </View>
      </View>
    </View>
  );
}