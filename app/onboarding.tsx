import { IconSymbol } from '@/components/ui/IconSymbol';
import { usePhotoRestoration } from '@/hooks/usePhotoRestoration';
import { onboardingTrackingService } from '@/services/onboardingTracking';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { ONBOARDING_FEATURES, onboardingUtils } from '@/utils/onboarding';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { presentPaywall } from '@/services/revenuecat';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, Text, TouchableOpacity, View, useWindowDimensions, Platform } from 'react-native';
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
  const MOCK_ONBOARDING_FREE = (process.env.EXPO_PUBLIC_ONBOARDING_MOCK_FREE === '1') || __DEV__;
  
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<'selection' | 'free-attempt' | 'demo'>('selection');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFunOverlay, setShowFunOverlay] = useState(false);
  const [uploadedImageUri, setUploadedImageUri] = useState<string | null>(null);
  const [typedText, setTypedText] = useState('');
  const [cursorOn, setCursorOn] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  const FUN_MESSAGES = [
    'image uploaded ✓',
    'booting up GPUs (on the house)…',
    'warming up models…',
    'enhancing details…',
  ];

  React.useEffect(() => {
    if (!showFunOverlay) return;
    const t = setInterval(() => setCursorOn((v) => !v), 500);
    return () => clearInterval(t);
  }, [showFunOverlay]);

  const typeNextMessage = React.useCallback((index: number) => {
    if (index >= FUN_MESSAGES.length) return;
    const msg = FUN_MESSAGES[index];
    let i = 0;
    if (index === 0) setTypedText(''); else setTypedText((prev) => prev + '\n');
    const interval = setInterval(() => {
      i++;
      setTypedText((prev) => prev + msg.slice(i - 1, i));
      if (i >= msg.length) {
        clearInterval(interval);
        setTimeout(() => setMessageIndex((v) => v + 1), 350);
      }
    }, 28);
  }, []);

  React.useEffect(() => {
    if (!showFunOverlay) return;
    typeNextMessage(messageIndex);
  }, [showFunOverlay, messageIndex, typeNextMessage]);

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

    // Determine if user selected ONLY the moving video option
    const selectedDefs = ONBOARDING_FEATURES.filter(f => selectedFeatures.includes(f.id));
    const hasNonVideo = selectedDefs.some(f => f.mapsTo !== 'back_to_life');
    const hasOnlyVideo = selectedDefs.length > 0 && !hasNonVideo;

    // Prefer a primary feature that is not Back to Life when available
    const primaryCandidate = selectedDefs.find((f) => f.mapsTo !== 'back_to_life');
    const primaryInterest = primaryCandidate?.id ?? selectedFeatures[0];
    
    // Save selections locally
    await onboardingUtils.saveOnboardingSelections(selectedFeatures, primaryInterest);
    
    // Save to Supabase for analytics (non-blocking)
    onboardingTrackingService.saveOnboardingSelections({
      selectedFeatures,
      primaryInterest,
    }).catch(() => {
      // Silently fail - analytics shouldn't block user flow
    });

    // If they selected ONLY Back to Life (moving video), show paywall instead of free attempt
    if (hasOnlyVideo) {
      if (isPro) {
        await onboardingUtils.completeOnboarding();
        router.replace('/explore');
        return;
      }
      // Present paywall. On success, complete onboarding and continue to app
      try {
        const purchased = await presentPaywall();
        if (purchased) {
          await onboardingUtils.completeOnboarding();
          router.replace('/explore');
        }
      } catch {
        // ignore
      }
      return;
    }

    // Otherwise continue to free attempt for photo features
    setCurrentStep('free-attempt');
  };

  const handleFreeAttempt = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to continue.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
      // Show fun overlay and run processing concurrently
      setUploadedImageUri(result.assets[0].uri);
      setShowFunOverlay(true);
      setTypedText('');
      setMessageIndex(0);

      if (MOCK_ONBOARDING_FREE) {
        // Mock path: don't spend credit. Simulate work then exit.
        await new Promise((r) => setTimeout(r, 3600));
        await onboardingUtils.completeOnboarding();
        setShowFunOverlay(false);
        setIsProcessing(false);
        router.replace('/explore');
        return;
      }

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

      // Small delay to let last line finish
      setTimeout(() => {
        router.replace(`/restoration/${restoration.id}`);
      }, 450);

    } catch (error: any) {
      setIsProcessing(false);
      setShowFunOverlay(false);
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

  function StepIndicator({ index }: { index: 0 | 1 }) {
    const progress = useSharedValue(index);
    const dot1Opacity = useSharedValue(1);
    const dot2Opacity = useSharedValue(0.4);
    
    React.useEffect(() => {
      progress.value = withSpring(index, { damping: 12, stiffness: 120 });
      dot1Opacity.value = withTiming(index === 0 ? 1 : 0.4, { duration: 300 });
      dot2Opacity.value = withTiming(index === 1 ? 1 : 0.4, { duration: 300 });
    }, [index]);

    const connectorStyle = useAnimatedStyle(() => ({
      width: `${progress.value * 100}%`,
    }));

    const dot1Style = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(index === 0 ? 1.2 : 1, { damping: 15 }) }],
      opacity: dot1Opacity.value,
    }));
    
    const dot2Style = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(index === 1 ? 1.2 : 1, { damping: 15 }) }],
      opacity: dot2Opacity.value,
    }));

    return (
      <View className="flex-row items-center justify-center mb-6">
        <View className="flex-row items-center">
          <Animated.View 
            className="w-3 h-3 rounded-full"
            style={[
              dot1Style,
              {
                backgroundColor: index === 0 ? '#FACC15' : '#6B7280',
                shadowColor: index === 0 ? '#FACC15' : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
                elevation: 4,
              }
            ]}
          />
          <View className="mx-3 h-0.5 w-12 bg-gray-700 relative overflow-hidden rounded-full">
            <Animated.View 
              style={[
                connectorStyle,
                { 
                  height: 2, 
                  backgroundColor: '#FACC15',
                  shadowColor: '#FACC15',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 4,
                }
              ]} 
            />
          </View>
          <Animated.View 
            style={[
              dot2Style,
              {
                backgroundColor: index === 1 ? '#FACC15' : '#6B7280',
                shadowColor: index === 1 ? '#FACC15' : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
                elevation: 4,
              }
            ]}
            className="w-3 h-3 rounded-full"
          />
        </View>
      </View>
    );
  }

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
    // Never use Back to Life (video) as the primary feature for free attempt
    const primaryFeature =
      ONBOARDING_FEATURES.find(f => selectedFeatures.includes(f.id) && f.mapsTo !== 'back_to_life') ||
      ONBOARDING_FEATURES.find(f => selectedFeatures.includes(f.id));
    
    return (
      <View className="flex-1 bg-gray-900">
        {/* Header */}
        <View style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}>
          <View className="px-5">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity onPress={() => setCurrentStep('selection')} className="p-2 -ml-2">
                <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
              </TouchableOpacity>
          <StepIndicator index={1} />
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
          <StepIndicator index={0} />
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

      {/* Fun terminal overlay */}
      {showFunOverlay && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <LinearGradient colors={["#0B0B0F", "#0B0B0F"]} style={{ flex: 1, paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
            {uploadedImageUri && (
              <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 16 }}>
                <View style={{ backgroundColor: '#111318', paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 6 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 6 }} />
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                  <Text style={{ color: '#9CA3AF', marginLeft: 8, fontSize: 12 }}>restoration.log</Text>
                </View>
                <ExpoImage source={{ uri: uploadedImageUri }} style={{ width: '100%', height: 220 }} contentFit="cover" />
              </View>
            )}
            <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0E1015', padding: 14 }}>
              <Text style={{ color: '#A3E635', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as any, fontSize: 13, lineHeight: 20 }}>
                $ {typedText}
                {cursorOn ? '|' : ' '}
              </Text>
            </View>
          </LinearGradient>
        </View>
      )}
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