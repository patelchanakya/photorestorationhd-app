import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { onboardingTrackingService } from '@/services/onboardingTracking';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { ONBOARDING_FEATURES, onboardingUtils } from '@/utils/onboarding';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
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

  if (currentStep === 'free-attempt') {
    const primaryFeature = onboardingUtils.getPrimaryFeature(selectedFeatures, selectedFeatures[0]);
    
    return (
      <View className="flex-1 bg-white">
        {/* Header */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 16 }}>
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity 
              onPress={() => setCurrentStep('selection')} 
              className="p-2 -ml-2"
            >
              <IconSymbol name="chevron.left" size={24} color="#374151" />
            </TouchableOpacity>
            <View className="flex-row space-x-2">
              <View className="w-8 h-1 bg-blue-500 rounded-full" />
              <View className="w-8 h-1 bg-blue-500 rounded-full" />
            </View>
            <View className="w-8" />
          </View>
          
          <Text className="text-gray-900 text-3xl font-bold text-center mb-3">
            Try {primaryFeature?.name}
          </Text>
          <Text className="text-gray-600 text-center text-base leading-6">
            Select a photo to see what Photo Restoration HD can do for free!
          </Text>
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
                className="w-20 h-20 rounded-full items-center justify-center mb-6"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <IconSymbol name={primaryFeature?.icon as any} size={36} color="#FFFFFF" />
              </LinearGradient>
              
              <Text className="text-gray-900 text-xl font-semibold mb-2 text-center">
                {primaryFeature?.name}
              </Text>
              <Text className="text-gray-600 text-center text-base leading-6">
                {primaryFeature?.description}
              </Text>
            </View>

            {/* Call to Action */}
            <TouchableOpacity
              onPress={handleFreeAttempt}
              disabled={isProcessing}
              className="w-full mb-4"
              style={{
                shadowColor: '#3B82F6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <LinearGradient
                colors={isProcessing ? ['#9CA3AF', '#6B7280'] : ['#3B82F6', '#1D4ED8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="py-4 rounded-2xl"
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
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 16 }}>
        <View className="flex-row items-center justify-center mb-6">
          <View className="flex-row space-x-2">
            <View className="w-8 h-1 bg-blue-500 rounded-full" />
            <View className="w-8 h-1 bg-gray-200 rounded-full" />
          </View>
        </View>
        
        <Text className="text-gray-900 text-3xl font-bold text-center mb-3">
          What brought you here today?
        </Text>
        <Text className="text-gray-600 text-center text-base leading-6">
          Select all features that interest you
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="pb-40">
          {ONBOARDING_FEATURES.map((feature, index) => {
            const isSelected = selectedFeatures.includes(feature.id);
            
            return (
              <TouchableOpacity
                key={feature.id}
                onPress={() => handleFeatureToggle(feature.id)}
                className={`rounded-2xl border-2 bg-white ${
                  isSelected ? 'border-blue-500' : 'border-gray-100'
                } ${index > 0 ? 'mt-5' : ''}`}
                style={{
                  shadowColor: isSelected ? '#3B82F6' : '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isSelected ? 0.1 : 0.05,
                  shadowRadius: isSelected ? 8 : 4,
                  elevation: isSelected ? 3 : 1,
                }}
              >
                <View className="p-5">
                  <View className="flex-row items-center">
                    {/* Icon */}
                    <View className="mr-4">
                      <LinearGradient
                        colors={feature.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="w-12 h-12 rounded-xl items-center justify-center"
                      >
                        <IconSymbol 
                          name={feature.icon as any} 
                          size={20} 
                          color="#FFFFFF" 
                        />
                      </LinearGradient>
                    </View>
                    
                    {/* Content */}
                    <View className="flex-1">
                      <Text className="text-gray-900 font-semibold text-lg mb-1">
                        {feature.name}
                      </Text>
                      <Text className="text-gray-600 text-sm leading-5">
                        {feature.description}
                      </Text>
                    </View>

                    {/* Checkbox */}
                    <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <IconSymbol name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom action */}
      <View 
        className="absolute bottom-0 left-0 right-0 px-5"
        style={{ 
          paddingBottom: insets.bottom + 16,
          paddingTop: 16,
        }}
      >
        <TouchableOpacity
          onPress={handleContinue}
          className="bg-blue-600 rounded-2xl justify-center items-center p-4 shadow-lg active:scale-95"
        >
          <Text className="text-white text-sm font-semibold">
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}